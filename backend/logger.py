import logging
import os
from datetime import datetime
from config import LOG_FORMAT, LOG_FILE, LOG_LEVEL

def setup_logger(name: str) -> logging.Logger:
    """
    Настраивает и возвращает логгер
    
    Args:
        name: Имя логгера
        
    Returns:
        logging.Logger: Настроенный логгер
    """
    # Создаем директорию для логов, если её нет
    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    
    # Настраиваем логгер
    logger = logging.getLogger(name)
    logger.setLevel(LOG_LEVEL)
    
    # Добавляем обработчик для файла
    file_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
    file_handler.setFormatter(logging.Formatter(LOG_FORMAT))
    logger.addHandler(file_handler)
    
    # Добавляем обработчик для консоли
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter(LOG_FORMAT))
    logger.addHandler(console_handler)
    
    return logger 