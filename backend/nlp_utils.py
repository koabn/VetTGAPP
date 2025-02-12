from typing import Tuple, Set, Optional
import re
import spacy
from logger import setup_logger
from config import QUERY_TYPES, ANIMAL_TYPES, KEYWORDS
from difflib import SequenceMatcher

logger = setup_logger(__name__)

# Загрузка модели SpaCy
try:
    nlp = spacy.load('ru_core_news_sm')
    logger.info("Языковая модель SpaCy загружена успешно")
except OSError:
    logger.error("Ошибка: Модель ru_core_news_sm не установлена!")
    logger.info("Установите модель командой: python -m spacy download ru_core_news_sm")
    raise SystemExit("Необходимо установить языковую модель")
except Exception as e:
    logger.error(f"Неожиданная ошибка при загрузке модели SpaCy: {str(e)}")
    raise SystemExit("Ошибка инициализации NLP")

def calculate_similarity(str1: str, str2: str) -> float:
    """
    Вычисляет схожесть между двумя строками
    
    Args:
        str1: Первая строка
        str2: Вторая строка
        
    Returns:
        float: Значение схожести от 0 до 1
    """
    # Приводим строки к нижнему регистру и удаляем лишние пробелы
    str1 = str1.lower().strip()
    str2 = str2.lower().strip()
    
    # Если строки равны, возвращаем 1
    if str1 == str2:
        return 1.0
    
    # Если одна строка является началом другой, возвращаем высокий коэффициент
    if str1.startswith(str2) or str2.startswith(str1):
        return 0.95
    
    # Если одна строка содержит другую (но не является началом), чуть меньший коэффициент
    if str1 in str2 or str2 in str1:
        return 0.85
    
    # Разбиваем строки на слова
    words1 = set(str1.split())
    words2 = set(str2.split())
    
    # Если есть общие слова
    common_words = words1.intersection(words2)
    if common_words:
        # Вычисляем процент совпадающих слов
        similarity = len(common_words) / max(len(words1), len(words2))
        # Умножаем на 0.7, чтобы даже при полном совпадении слов
        # коэффициент был ниже, чем при прямом вхождении строки
        return 0.7 * similarity
    
    # Для остальных случаев используем SequenceMatcher с понижающим коэффициентом
    return 0.6 * SequenceMatcher(None, str1, str2).ratio()

def analyze_query(query: str) -> Tuple[Set[str], Optional[str]]:
    """
    Анализирует запрос пользователя и определяет типы запроса и целевое животное
    
    Args:
        query: Текст запроса
        
    Returns:
        Tuple[Set[str], Optional[str]]: (типы запроса, тип животного)
    """
    query = query.lower()
    doc = nlp(query)
    
    # Инициализируем множество для типов запросов
    query_types = set()
    
    # Определяем животное из текста запроса
    animal = None
    for animal_type, words in KEYWORDS['animals'].items():
        if any(word in query for word in words):
            animal = animal_type
            break
    
    # Если запрос состоит из одного слова, возвращаем полную информацию
    if len(query.split()) == 1:
        query_types.add('full')
        logger.debug(f"Однословный запрос, возвращаем полную информацию. Типы запроса: {query_types}, животное: {animal}")
        return query_types, animal
    
    # Для остальных запросов проверяем наличие ключевых слов
    for token in doc:
        word = token.text.lower()
        lemma = token.lemma_.lower()
        
        # Проверяем каждый тип запроса
        for query_type, keywords in KEYWORDS.items():
            if query_type != 'animals':  # Пропускаем словарь животных
                if isinstance(keywords, list):  # Для обычных ключевых слов
                    if word in keywords or lemma in keywords:
                        query_types.add(query_type)
    
    # Если не найдено конкретных типов запроса
    if not query_types:
        # Проверяем наличие вопросительных слов
        question_words = {'что', 'как', 'какой', 'какая', 'какие', 'сколько', 'где', 'когда'}
        if any(word in query.split() for word in question_words):
            query_types.add('full')
        else:
            query_types.add('full')
    
    logger.debug(f"Типы запроса: {query_types}, животное: {animal}")
    return query_types, animal

def preprocess_query(query: str) -> str:
    """
    Предварительная обработка запроса
    
    Args:
        query: Исходный запрос
        
    Returns:
        str: Обработанный запрос
    """
    # Приводим к нижнему регистру
    query = query.lower()
    
    # Обрабатываем через spaCy для лемматизации
    doc = nlp(query)
    
    # Собираем важные слова (исключаем предлоги, союзы и т.д.)
    important_words = []
    skip_pos = {'ADP', 'CCONJ', 'SCONJ', 'PUNCT', 'SPACE'}
    
    for token in doc:
        # Пропускаем служебные части речи и знаки препинания
        if token.pos_ in skip_pos:
            continue
        # Добавляем слово в исходной форме
        important_words.append(token.text)
    
    return ' '.join(important_words) 