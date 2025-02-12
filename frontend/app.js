let tg = window.Telegram.WebApp;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    // Сообщаем Telegram, что приложение готово
    tg.ready();
    
    // Настраиваем основной цвет и тему
    tg.setHeaderColor('secondary_bg_color');
    tg.MainButton.hide();
    
    // Определяем базовый URL для API
    const API_BASE_URL = 'https://sanakoev.github.io/vet-app/api';
    
    // Получаем элементы интерфейса
    const searchInput = document.getElementById('searchInput');
    const confirmationSection = document.getElementById('confirmation-section');
    const drugOptions = document.getElementById('drug-options');
    const drugInfo = document.getElementById('drug-info');
    const drugContent = document.getElementById('drug-content');
    const errorDiv = document.getElementById('error');
    const selectAllBtn = document.getElementById('selectAllCategories');
    const clearBtn = document.getElementById('clearCategories');
    const categoryCheckboxes = document.querySelectorAll('input[name="category"]');
    const searchButton = document.querySelector('.search-button');
    
    let currentDrug = null;
    
    // Настраиваем тему в зависимости от темы Telegram
    function setThemeColors() {
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.backgroundColor);
        document.documentElement.style.setProperty('--tg-theme-text-color', tg.textColor);
        document.documentElement.style.setProperty('--tg-theme-button-color', tg.buttonColor || '#2a695a');
        document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.buttonTextColor || '#ffffff');
        document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', tg.secondaryBackgroundColor);
    }
    
    // Применяем тему
    setThemeColors();
    
    // Обработчики для кнопок управления категориями
    selectAllBtn.addEventListener('click', () => {
        categoryCheckboxes.forEach(checkbox => checkbox.checked = true);
        if (currentDrug) updateDrugInfo(currentDrug);
    });
    
    clearBtn.addEventListener('click', () => {
        categoryCheckboxes.forEach(checkbox => checkbox.checked = false);
        if (currentDrug) updateDrugInfo(currentDrug);
    });
    
    // Обработчик изменения категорий
    categoryCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            if (currentDrug) updateDrugInfo(currentDrug);
        });
    });
    
    // Функция получения выбранных категорий
    function getSelectedCategories() {
        const selected = [];
        categoryCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                selected.push(checkbox.value);
            }
        });
        return selected.length > 0 ? selected : ['full'];
    }
    
    // Функция запуска поиска
    function startSearch() {
        const query = searchInput.value.trim();
        if (query.length >= 2) {
            searchDrugs(query);
        } else {
            errorDiv.textContent = 'Введите минимум 2 символа для поиска';
            errorDiv.style.display = 'block';
            confirmationSection.style.display = 'none';
            drugInfo.style.display = 'none';
        }
    }
    
    // Обработчики поиска
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            startSearch();
        }
    });
    
    searchButton.addEventListener('click', startSearch);
    
    // Функция поиска препаратов
    async function searchDrugs(query) {
        try {
            const initData = tg.initData || '';
            
            const response = await fetch(`${API_BASE_URL}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Telegram-Data': initData
                },
                body: JSON.stringify({
                    query,
                    categories: ['full'],
                    user: tg.initDataUnsafe?.user || null
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.status === 'success') {
                const results = Array.isArray(data.results) ? data.results : [data.results];
                showDrugOptions(results);
                errorDiv.style.display = 'none';
            } else {
                errorDiv.textContent = data.message || data.detail || 'Произошла ошибка при поиске';
                errorDiv.style.display = 'block';
                confirmationSection.style.display = 'none';
                drugInfo.style.display = 'none';
            }
        } catch (error) {
            errorDiv.textContent = 'Ошибка соединения с сервером';
            errorDiv.style.display = 'block';
            confirmationSection.style.display = 'none';
            drugInfo.style.display = 'none';
        }
    }
    
    // Функция отображения вариантов препаратов
    function showDrugOptions(drugs) {
        drugOptions.innerHTML = '';
        confirmationSection.style.display = 'block';
        drugInfo.style.display = 'none';
        
        drugs.forEach(drug => {
            const option = document.createElement('div');
            option.className = 'drug-option';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'drug-name';
            nameSpan.textContent = drug.name;
            option.appendChild(nameSpan);
            
            if (drug.trade_names) {
                const tradeSpan = document.createElement('span');
                tradeSpan.className = 'drug-trade-names';
                tradeSpan.textContent = ` (${drug.trade_names})`;
                option.appendChild(tradeSpan);
            }
            
            if (drug.classification) {
                const classSpan = document.createElement('div');
                classSpan.className = 'drug-classification';
                classSpan.textContent = drug.classification;
                option.appendChild(classSpan);
            }
            
            option.addEventListener('click', () => {
                currentDrug = drug;
                confirmationSection.style.display = 'none';
                drugInfo.style.display = 'block';
                updateDrugInfo(drug);
            });
            
            drugOptions.appendChild(option);
        });
    }
    
    // Функция обновления информации о препарате
    async function updateDrugInfo(drug) {
        try {
            const initData = tg.initData || '';
            const categories = getSelectedCategories();
            
            const response = await fetch(`${API_BASE_URL}/search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Telegram-Data': initData
                },
                body: JSON.stringify({
                    query: drug.name,
                    categories: categories,
                    user: tg.initDataUnsafe?.user || null
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.status === 'success') {
                const updatedDrug = Array.isArray(data.results) ? data.results[0] : data.results;
                displayDrugInfo(updatedDrug);
            }
        } catch (error) {
            console.error('Error updating drug info:', error);
        }
    }
    
    // Функция отображения информации о препарате
    function displayDrugInfo(drug) {
        drugContent.innerHTML = '';
        
        const title = document.createElement('div');
        title.className = 'drug-title';
        title.textContent = drug.name;
        drugContent.appendChild(title);
        
        const info = document.createElement('div');
        info.className = 'drug-info';
        
        let content = [];
        
        if (drug.trade_names) content.push(`💊 Торговые названия: ${drug.trade_names}`);
        if (drug.classification) content.push(`📦 Группа: ${drug.classification}`);
        if (drug.mechanism) content.push(`⚡ Механизм действия: ${drug.mechanism}`);
        if (drug.indications) content.push(`🎯 Показания: ${drug.indications}`);
        if (drug.side_effects) content.push(`⚕️ Побочные эффекты: ${drug.side_effects}`);
        if (drug.contraindications) content.push(`⚠️ Противопоказания: ${drug.contraindications}`);
        if (drug.interactions) content.push(`🔄 Взаимодействия: ${drug.interactions}`);
        if (drug.usage) content.push(`💉 Применение: ${drug.usage}`);
        if (drug.storage) content.push(`🏠 Хранение: ${drug.storage}`);
        if (drug.cat_dosage) content.push(`🐱 Дозировка для кошек: ${drug.cat_dosage}`);
        if (drug.dog_dosage) content.push(`🐕 Дозировка для собак: ${drug.dog_dosage}`);
        
        info.innerHTML = content.join('<br><br>');
        drugContent.appendChild(info);
    }
}); 