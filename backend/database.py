import pandas as pd
from typing import Tuple, Optional, List, Dict, Any, Union
from pathlib import Path
from logger import setup_logger
from config import DATABASE_FILE, DATABASE_ENCODING, DATABASE_SEPARATOR, DEBUG_LOG_FILE
from datetime import datetime
from nlp_utils import calculate_similarity

logger = setup_logger(__name__)

def log_debug(message: str) -> None:
    """Записывает отладочное сообщение в файл расширенного лога"""
    with open(DEBUG_LOG_FILE, 'a', encoding='utf-8') as f:
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        f.write(f"{timestamp} - {message}\n")

class Database:
    def __init__(self):
        """Инициализация базы данных"""
        self.df: Optional[pd.DataFrame] = None
        self._load_database()
    
    def _load_database(self) -> None:
        """Загружает базу данных из CSV файла"""
        try:
            self.df = pd.read_csv(
                DATABASE_FILE,
                sep=DATABASE_SEPARATOR,
                encoding=DATABASE_ENCODING
            )
            # Очищаем названия колонок
            self.df.columns = self.df.columns.str.strip()
            # Удаляем ненужные колонки
            if 'Unnamed: 15' in self.df.columns:
                self.df = self.df.drop('Unnamed: 15', axis=1)
            
            logger.info(f"База данных загружена. Количество записей: {len(self.df)}")
            logger.debug(f"Колонки в базе данных: {', '.join(self.df.columns)}")
            
        except FileNotFoundError:
            logger.error(f"Файл базы данных не найден: {DATABASE_FILE}")
            raise
        except UnicodeDecodeError:
            logger.error(f"Ошибка кодировки при чтении файла: {DATABASE_FILE}")
            raise
        except Exception as e:
            logger.error(f"Ошибка при загрузке базы данных: {str(e)}")
            raise
    
    def get_drug_by_name(self, name: str) -> Optional[pd.Series]:
        """
        Получает информацию о препарате по точному названию
        
        Args:
            name: Название препарата
            
        Returns:
            Optional[pd.Series]: Информация о препарате или None, если не найден
        """
        try:
            matches = self.df[self.df['name'].str.lower() == name.lower()]
            return matches.iloc[0] if not matches.empty else None
        except Exception as e:
            logger.error(f"Ошибка при поиске препарата '{name}': {str(e)}")
            return None
    
    def search_drugs(self, query: str, similarity_threshold: float = 0.75) -> Tuple[Optional[pd.DataFrame], str]:
        """
        Поиск препаратов по запросу с учетом схожести
        
        Args:
            query: Поисковый запрос
            similarity_threshold: Порог схожести для поиска
            
        Returns:
            Tuple[Optional[pd.DataFrame], str]: (Найденные препараты, тип результата)
        """
        try:
            matches = []
            query_words = query.lower().split()
            log_debug(f"\nНовый поиск для запроса: '{query}'")
            log_debug(f"Разбитые слова запроса: {query_words}")
            
            for _, row in self.df.iterrows():
                max_similarity = 0
                best_match_word = ""
                best_match_field = ""
                
                # Проверяем каждое слово из запроса
                for query_word in query_words:
                    # Проверяем основное название и его части
                    if not pd.isna(row['name']):
                        # Разбиваем название на части по запятой
                        names = [name.strip().lower() for name in row['name'].split(',')]
                        for name in names:
                            similarity = calculate_similarity(query_word, name)
                            if similarity > max_similarity:
                                max_similarity = similarity
                                best_match_word = query_word
                                best_match_field = f"name: {name}"
                    
                    # Проверяем торговые названия
                    if not pd.isna(row['Trade_and_other_names']):
                        trade_names = [name.strip().lower() for name in row['Trade_and_other_names'].split(',')]
                        for trade_name in trade_names:
                            similarity = calculate_similarity(query_word, trade_name)
                            if similarity > max_similarity:
                                max_similarity = similarity
                                best_match_word = query_word
                                best_match_field = f"trade_name: {trade_name}"
                    
                    # Проверяем классификацию
                    if not pd.isna(row['Functional_classification']):
                        classifications = [c.strip().lower() for c in row['Functional_classification'].split(',')]
                        for classification in classifications:
                            similarity = calculate_similarity(query_word, classification)
                            if similarity > max_similarity:
                                max_similarity = similarity
                                best_match_word = query_word
                                best_match_field = f"classification: {classification}"
                
                # Если нашли хорошее совпадение
                if max_similarity >= similarity_threshold:
                    matches.append((row, max_similarity))
                    log_debug(f"Найдено совпадение для препарата '{row['name']}':")
                    log_debug(f"  - Слово из запроса: '{best_match_word}'")
                    log_debug(f"  - Совпало с полем: {best_match_field}")
                    log_debug(f"  - Схожесть: {max_similarity:.3f}")
            
            if not matches:
                log_debug("Не найдено подходящих совпадений")
                return None, 'not_found'
            
            # Сортируем результаты
            matches.sort(key=lambda x: x[1], reverse=True)
            log_debug("\nОтсортированные результаты:")
            
            # Проверяем наличие точных совпадений (схожесть >= 0.99)
            exact_matches = [(match, similarity) for match, similarity in matches if similarity >= 0.99]
            
            # Если есть точные совпадения, используем только их
            if exact_matches:
                matches = exact_matches
                log_debug("Найдены точные совпадения (схожесть >= 0.99), используем только их")
            
            for match, similarity in matches[:5]:  # Показываем топ-5 результатов
                log_debug(f"- {match['name']} (схожесть: {similarity:.3f})")
            
            # Удаляем дубликаты
            seen = set()
            unique_matches = []
            for match, similarity in matches:
                if match['name'] not in seen:
                    seen.add(match['name'])
                    unique_matches.append(match)
            
            if len(unique_matches) > 1:
                log_debug(f"\nНайдено несколько уникальных препаратов: {len(unique_matches)}")
                return pd.DataFrame(unique_matches), 'multiple'
            else:
                log_debug(f"\nНайден один препарат: {unique_matches[0]['name']}")
                return unique_matches[0], 'single'
                
        except Exception as e:
            logger.error(f"Ошибка при поиске препаратов: {str(e)}")
            log_debug(f"Ошибка при поиске: {str(e)}")
            return None, 'error'
    
    def get_drug_info(self, row: pd.Series, query_types: set, animal: Optional[str] = None) -> str:
        """
        Форматирует информацию о препарате в читаемый вид
        
        Args:
            row: Строка DataFrame с информацией о препарате
            query_types: Типы запрошенной информации
            animal: Тип животного (cat/dog/None)
            
        Returns:
            str: Отформатированная информация о препарате
        """
        try:
            info = []
            
            # Проверяем противопоказания для конкретного животного
            if animal:
                dosage_field = f"{animal.capitalize()}s_dosage"
                if not pd.isna(row[dosage_field]):
                    dosage = row[dosage_field].lower()
                    contraindicated_words = ['противопоказан', 'нельзя', 'запрещен']
                    if any(word in dosage for word in contraindicated_words):
                        return f"⛔️ {row['name']} противопоказан для {'кошек' if animal == 'cat' else 'собак'}!\n\n⚠️ {row[dosage_field]}"
            
            # Базовая информация
            info.append(f"📋 Название: {row['name']}")
            
            # Добавляем запрошенную информацию
            if 'full' in query_types or not query_types:
                self._add_full_info(info, row, animal)
            else:
                self._add_specific_info(info, row, query_types, animal)
            
            return "\n".join(info)
            
        except Exception as e:
            logger.error(f"Ошибка при форматировании информации о препарате: {str(e)}")
            return "Произошла ошибка при получении информации о препарате"
    
    def _add_full_info(self, info: List[str], row: pd.Series, animal: Optional[str]) -> None:
        """Добавляет полную информацию о препарате"""
        fields = {
            'name': ('📋 Название', None),
            'Trade_and_other_names': ('💊 Торговые названия', None),
            'Functional_classification': ('📦 Группа препаратов', None),
            'Pharmacology_and_Mechanism_of_Action': ('⚡ Фармакология и механизм действия', '\n'),
            'Indications_and_Clinical_Uses': ('🎯 Показания и клиническое применение', '\n'),
            'Adverse_Reactions_and_Side_Effects': ('⚕️ Побочные реакции', '\n'),
            'Contraindications_and_Precautions': ('⚠️ Противопоказания и меры предосторожности', '\n'),
            'Drug_Interactions': ('🔄 Лекарственное взаимодействие', '\n'),
            'Instructions_for_Use': ('💉 Инструкция по применению', '\n'),
            'Patient_Monitoring_and_Laboratory_Tests': ('🔍 Мониторинг пациента и лабораторные анализы', '\n'),
            'Formulations': ('📝 Лекарственные формы', '\n'),
            'Stability_and_Storage': ('🏠 Стабильность и хранение', '\n')
        }
        
        for field, (emoji_text, prefix) in fields.items():
            if not pd.isna(row[field]) and row[field].strip():
                info.append(f"{prefix or ''}{emoji_text}: {row[field]}")
        
        # Добавляем дозировки для животных
        if animal == 'dog':
            if not pd.isna(row['Dogs_dosage']):
                info.append(f"\n🐕 Дозировка для собак:\n{row['Dogs_dosage']}")
        elif animal == 'cat':
            if not pd.isna(row['Cats_dosage']):
                info.append(f"\n🐱 Дозировка для кошек:\n{row['Cats_dosage']}")
        else:
            if not pd.isna(row['Dogs_dosage']):
                info.append(f"\n🐕 Дозировка для собак:\n{row['Dogs_dosage']}")
            if not pd.isna(row['Cats_dosage']):
                info.append(f"\n🐱 Дозировка для кошек:\n{row['Cats_dosage']}")
    
    def _add_specific_info(self, info: List[str], row: pd.Series, query_types: set, animal: Optional[str]) -> None:
        """Добавляет запрошенную информацию о препарате"""
        field_mapping = {
            'usage': ('Instructions_for_Use', '💉 Инструкция по применению'),
            'storage': ('Stability_and_Storage', '🏠 Стабильность и хранение'),
            'contraindications': ('Contraindications_and_Precautions', '⚠️ Противопоказания и меры предосторожности'),
            'side_effects': ('Adverse_Reactions_and_Side_Effects', '⚕️ Побочные реакции'),
            'mechanism': ('Pharmacology_and_Mechanism_of_Action', '⚡ Фармакология и механизм действия'),
            'interactions': ('Drug_Interactions', '🔄 Лекарственное взаимодействие'),
            'form': ('Formulations', '📝 Лекарственные формы'),
            'monitoring': ('Patient_Monitoring_and_Laboratory_Tests', '🔍 Мониторинг пациента и лабораторные анализы')
        }
        
        # Обработка специальных типов запросов
        if 'indications' in query_types and not pd.isna(row['Indications_and_Clinical_Uses']):
            info.append(f"\n🎯 Показания к применению:\n{row['Indications_and_Clinical_Uses']}")
        
        if 'dosage' in query_types:
            if animal == 'dog' and not pd.isna(row['Dogs_dosage']):
                info.append(f"\n🐕 Дозировка для собак:\n{row['Dogs_dosage']}")
            elif animal == 'cat' and not pd.isna(row['Cats_dosage']):
                info.append(f"\n🐱 Дозировка для кошек:\n{row['Cats_dosage']}")
            else:
                if not pd.isna(row['Dogs_dosage']):
                    info.append(f"\n🐕 Дозировка для собак:\n{row['Dogs_dosage']}")
                if not pd.isna(row['Cats_dosage']):
                    info.append(f"\n🐱 Дозировка для кошек:\n{row['Cats_dosage']}")
        
        # Добавляем информацию для остальных типов запросов
        for query_type, (field, emoji_text) in field_mapping.items():
            if query_type in query_types and not pd.isna(row[field]):
                info.append(f"\n{emoji_text}:\n{row[field]}")
    
    def compare_drugs(self, drug1_name: str, drug2_name: str) -> str:
        """
        Сравнивает два препарата и возвращает их сходства и различия по основным параметрам
        
        Args:
            drug1_name: Название первого препарата
            drug2_name: Название второго препарата
            
        Returns:
            str: Отформатированное сравнение препаратов
        """
        try:
            # Получаем информацию о препаратах
            drug1 = self.get_drug_by_name(drug1_name)
            drug2 = self.get_drug_by_name(drug2_name)
            
            if drug1 is None or drug2 is None:
                return "❌ Один или оба препарата не найдены в базе данных"
            
            comparison = []
            comparison.append(f"🔄 Сравнение препаратов {drug1['name']} и {drug2['name']}:\n")
            
            # Сравниваем классификацию
            if drug1['Functional_classification'] == drug2['Functional_classification']:
                comparison.append(f"📦 Группа препаратов:\n✅ Одинаковая: {drug1['Functional_classification']}")
            else:
                comparison.append(f"📦 Группа препаратов:\n- {drug1['name']}: {drug1['Functional_classification']}\n- {drug2['name']}: {drug2['Functional_classification']}")
            
            # Сравниваем показания
            indications1 = drug1['Indications_and_Clinical_Uses']
            indications2 = drug2['Indications_and_Clinical_Uses']
            
            if not pd.isna(indications1) or not pd.isna(indications2):
                comparison.append("\n🎯 Показания к применению:")
                if indications1 == indications2:
                    comparison.append(f"✅ Одинаковые: {indications1}")
                else:
                    comparison.append(f"- {drug1['name']}: {indications1 if not pd.isna(indications1) else 'Нет данных'}")
                    comparison.append(f"- {drug2['name']}: {indications2 if not pd.isna(indications2) else 'Нет данных'}")
            
            # Сравниваем механизм действия
            mech1 = drug1['Pharmacology_and_Mechanism_of_Action']
            mech2 = drug2['Pharmacology_and_Mechanism_of_Action']
            
            if not pd.isna(mech1) or not pd.isna(mech2):
                comparison.append("\n⚡ Механизм действия:")
                if mech1 == mech2:
                    comparison.append(f"✅ Одинаковый: {mech1}")
                else:
                    comparison.append(f"- {drug1['name']}: {mech1 if not pd.isna(mech1) else 'Нет данных'}")
                    comparison.append(f"- {drug2['name']}: {mech2 if not pd.isna(mech2) else 'Нет данных'}")
            
            return "\n".join(comparison)
            
        except Exception as e:
            logger.error(f"Ошибка при сравнении препаратов: {str(e)}")
            return "❌ Произошла ошибка при сравнении препаратов" 