let tg = window.Telegram.WebApp;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    // Сообщаем Telegram, что приложение готово
    tg.ready();
    
    // Настраиваем основной цвет и тему
    tg.setHeaderColor('secondary_bg_color');
    
    // Показываем главную кнопку
    tg.MainButton.setText('Отправить');
    tg.MainButton.show();
    
    // Обработчик нажатия на главную кнопку
    tg.MainButton.onClick(() => {
        // Здесь будет логика отправки данных на бэкенд
        fetch('/api/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user: tg.initDataUnsafe.user,
                // Добавьте здесь нужные данные
            })
        })
        .then(response => response.json())
        .then(data => {
            // Обработка ответа
            tg.showAlert('Данные успешно отправлены!');
        })
        .catch(error => {
            console.error('Error:', error);
            tg.showAlert('Произошла ошибка при отправке данных');
        });
    });
}); 