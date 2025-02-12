from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, Union, List, Set
import uvicorn
from database import Database
from nlp_utils import analyze_query, preprocess_query
import pandas as pd
from logger import setup_logger
import json

# Настраиваем логгер
logger = setup_logger(__name__)

app = FastAPI()
db = Database()

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене замените на конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SearchRequest(BaseModel):
    query: str
    categories: Optional[List[str]] = None
    user: Optional[Dict[str, Any]] = None

class DrugResponse(BaseModel):
    name: str
    trade_names: Optional[str] = None
    classification: Optional[str] = None
    mechanism: Optional[str] = None
    indications: Optional[str] = None
    side_effects: Optional[str] = None
    contraindications: Optional[str] = None
    interactions: Optional[str] = None
    usage: Optional[str] = None
    storage: Optional[str] = None
    cat_dosage: Optional[str] = None
    dog_dosage: Optional[str] = None

@app.get("/")
async def read_root():
    logger.info("Получен GET запрос к корневому эндпоинту")
    return {"status": "ok", "message": "Vet Mini App Backend is running"}

@app.post("/api/search")
async def search_drugs(request: SearchRequest):
    try:
        logger.info(f"Получен поисковый запрос: '{request.query}'")
        logger.info(f"Выбранные категории: {request.categories}")
        
        # Предобработка запроса
        query = preprocess_query(request.query)
        logger.info(f"Предобработанный запрос: '{query}'")
        
        # Определяем тип животного из запроса
        animal_type = determine_animal_type(request.query)
        logger.info(f"Определен тип животного: {animal_type}")
        
        # Поиск препаратов
        logger.info("Начинаем поиск препаратов в базе данных...")
        results, result_type = db.search_drugs(query)
        logger.info(f"Тип результата поиска: {result_type}")
        
        if result_type == 'not_found':
            logger.warning(f"Препарат '{query}' не найден в базе данных")
            return {
                "status": "error",
                "message": f"Препарат '{query}' не найден"
            }
        
        if result_type == 'error':
            logger.error("Произошла ошибка при поиске препарата в базе данных")
            return {
                "status": "error",
                "message": "Произошла ошибка при поиске препарата"
            }
        
        # Форматируем результаты
        if result_type == 'single':
            logger.info("Найден один препарат, форматируем информацию...")
            drug_info = format_drug_info(results, set(request.categories or ['full']), animal_type)
            logger.info("Информация о препарате успешно отформатирована")
            return {
                "status": "success",
                "results": drug_info
            }
        else:
            logger.info(f"Найдено несколько препаратов: {len(results)}")
            drugs_info = [format_drug_info(drug, set(request.categories or ['full']), animal_type) 
                         for drug in results.to_dict('records')]
            logger.info("Информация о препаратах успешно отформатирована")
            return {
                "status": "success",
                "results": drugs_info
            }
            
    except Exception as e:
        logger.error(f"Необработанная ошибка при обработке запроса: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

def determine_animal_type(query: str) -> Optional[str]:
    """Определяет тип животного из запроса"""
    query = query.lower()
    if any(word in query for word in ['собак', 'собака', 'собаки', 'пес', 'пёс', 'щенок', 'собаке']):
        return 'dog'
    elif any(word in query for word in ['кошек', 'кошка', 'кошки', 'кот', 'котенок', 'котёнок', 'кошке']):
        return 'cat'
    return None

def format_drug_info(drug: pd.Series, query_types: Set[str], animal_type: Optional[str] = None) -> Dict[str, str]:
    """
    Форматирует информацию о препарате в зависимости от типа запроса
    """
    logger.info(f"Форматирование информации для препарата: {drug.get('name', 'Неизвестный препарат')}")
    logger.info(f"Типы запроса: {query_types}")
    logger.info(f"Тип животного: {animal_type}")
    
    # Инициализируем результат со всеми возможными полями
    result = {
        "name": drug['name'],
        "trade_names": "",
        "classification": "",
        "mechanism": "",
        "indications": "",
        "side_effects": "",
        "contraindications": "",
        "interactions": "",
        "usage": "",
        "storage": "",
        "cat_dosage": "",
        "dog_dosage": ""
    }
    
    # Маппинг полей из базы данных в поля результата
    field_mapping = {
        "trade_names": "Trade_and_other_names",
        "classification": "Functional_classification",
        "mechanism": "Pharmacology_and_Mechanism_of_Action",
        "indications": "Indications_and_Clinical_Uses",
        "side_effects": "Adverse_Reactions_and_Side_Effects",
        "contraindications": "Contraindications_and_Precautions",
        "interactions": "Drug_Interactions",
        "usage": "Instructions_for_Use",
        "storage": "Stability_and_Storage",
        "cat_dosage": "Cats_dosage",
        "dog_dosage": "Dogs_dosage"
    }
    
    # Если запрошена полная информация
    if 'full' in query_types:
        logger.info("Форматирование полной информации о препарате")
        # Заполняем все поля
        for result_field, db_field in field_mapping.items():
            if db_field in drug:
                result[result_field] = str(drug[db_field]) if not pd.isna(drug[db_field]) else ""
    else:
        logger.info("Форматирование выборочной информации о препарате")
        # Базовая информация всегда включается
        for field in ["trade_names", "classification"]:
            db_field = field_mapping[field]
            if db_field in drug:
                result[field] = str(drug[db_field]) if not pd.isna(drug[db_field]) else ""
        
        # Добавляем информацию в зависимости от типа запроса
        if 'dosage' in query_types:
            logger.info("Добавление информации о дозировке")
            if animal_type == 'dog':
                result["dog_dosage"] = str(drug["Dogs_dosage"]) if not pd.isna(drug["Dogs_dosage"]) else ""
            elif animal_type == 'cat':
                result["cat_dosage"] = str(drug["Cats_dosage"]) if not pd.isna(drug["Cats_dosage"]) else ""
            else:
                result["dog_dosage"] = str(drug["Dogs_dosage"]) if not pd.isna(drug["Dogs_dosage"]) else ""
                result["cat_dosage"] = str(drug["Cats_dosage"]) if not pd.isna(drug["Cats_dosage"]) else ""
        
        # Маппинг типов запросов на поля
        query_field_mapping = {
            'mechanism': 'mechanism',
            'indications': 'indications',
            'side_effects': 'side_effects',
            'contraindications': 'contraindications',
            'interactions': 'interactions',
            'usage': 'usage',
            'storage': 'storage'
        }
        
        # Добавляем запрошенную информацию
        for query_type, result_field in query_field_mapping.items():
            if query_type in query_types:
                db_field = field_mapping[result_field]
                if db_field in drug:
                    result[result_field] = str(drug[db_field]) if not pd.isna(drug[db_field]) else ""
                    logger.info(f"Добавлена информация: {query_type}")
    
    logger.info("Форматирование информации завершено")
    return result

if __name__ == "__main__":
    logger.info("Запуск сервера FastAPI...")
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True) 