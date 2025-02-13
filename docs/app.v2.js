let tg = window.Telegram.WebApp;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    // Сообщаем Telegram, что приложение готово
    tg.ready();
    
    // Настраиваем основной цвет и тему
    tg.setHeaderColor('secondary_bg_color');
    tg.MainButton.hide();
    
    // Определяем базовый URL для API
    const API_BASE_URL = 'https://koabn.github.io/VetTGAPP';
    
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
    let drugsData = null;
    
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
    
    // Загружаем данные при старте
    async function loadDrugsData() {
        try {
            console.log('Начинаем загрузку данных...');
            const url = `${API_BASE_URL}/api/search.json`;
            console.log('Загружаем данные с URL:', url);
            const response = await fetch(url);
            console.log('Статус ответа:', response.status);
            const data = await response.json();
            console.log('Данные получены:', data);
            
            if (data.status === 'success') {
                drugsData = data.results;
                console.log('Данные успешно загружены, первый препарат:', drugsData[0]);
            } else {
                console.error('Неверный формат данных:', data);
            }
        } catch (error) {
            console.error('Ошибка при загрузке данных:', error);
            console.error('Полный текст ошибки:', error.toString());
            errorDiv.textContent = 'Ошибка при загрузке данных: ' + error.toString();
            errorDiv.style.display = 'block';
        }
    }
    
    // Выносим парсинг CSV в отдельную функцию
    function parseCSV(text) {
        const rows = text.split('\n').map(row => row.split(';'));
        const headers = rows[0];
        return rows.slice(1)
            .filter(row => row.length === headers.length)
            .map(row => ({
                name: row[1] || '',
                trade_names: row[2] || '',
                classification: row[3] || '',
                mechanism: row[4] || '',
                indications: row[5] || '',
                side_effects: row[6] || '',
                contraindications: row[7] || '',
                interactions: row[8] || '',
                usage: row[9] || '',
                storage: row[12] || '',
                dog_dosage: row[13] || '',
                cat_dosage: row[14] || ''
            }));
    }
    
    // Загружаем данные
    loadDrugsData();
    
    // Обработчики для кнопок управления категориями
    selectAllBtn.addEventListener('click', () => {
        categoryCheckboxes.forEach(checkbox => checkbox.checked = true);
        if (currentDrug) displayFilteredDrugInfo(currentDrug);
    });
    
    clearBtn.addEventListener('click', () => {
        categoryCheckboxes.forEach(checkbox => checkbox.checked = false);
        if (currentDrug) displayFilteredDrugInfo(currentDrug);
    });
    
    // Обработчик изменения категорий
    categoryCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            if (currentDrug) displayFilteredDrugInfo(currentDrug);
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
        const query = searchInput.value.trim().toLowerCase();
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
    function searchDrugs(query) {
        console.log('Начинаем поиск по запросу:', query);
        console.log('Состояние drugsData:', drugsData);
        
        if (!drugsData) {
            console.log('drugsData не загружены');
            errorDiv.textContent = 'Данные еще не загружены';
            errorDiv.style.display = 'block';
            return;
        }
        
        const results = drugsData.filter(drug => {
            const nameMatch = drug.name.toLowerCase().includes(query);
            const tradeMatch = drug.trade_names && drug.trade_names.toLowerCase().includes(query);
            console.log(`Проверяем препарат ${drug.name}:`, { nameMatch, tradeMatch });
            return nameMatch || tradeMatch;
        });
        
        console.log('Результаты поиска:', results);
        
        if (results.length > 0) {
            showDrugOptions(results);
            errorDiv.style.display = 'none';
        } else {
            errorDiv.textContent = 'Препараты не найдены';
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
                displayFilteredDrugInfo(drug);
            });
            
            drugOptions.appendChild(option);
        });
    }
    
    // Функция фильтрации и отображения информации о препарате
    function displayFilteredDrugInfo(drug) {
        const categories = getSelectedCategories();
        const filteredDrug = {};
        
        // Всегда включаем базовую информацию
        filteredDrug.name = drug.name;
        filteredDrug.trade_names = drug.trade_names;
        filteredDrug.classification = drug.classification;
        
        // Добавляем выбранные категории
        if (categories.includes('full') || categories.includes('mechanism')) {
            filteredDrug.mechanism = drug.mechanism;
        }
        if (categories.includes('full') || categories.includes('indications')) {
            filteredDrug.indications = drug.indications;
        }
        if (categories.includes('full') || categories.includes('side_effects')) {
            filteredDrug.side_effects = drug.side_effects;
        }
        if (categories.includes('full') || categories.includes('contraindications')) {
            filteredDrug.contraindications = drug.contraindications;
        }
        if (categories.includes('full') || categories.includes('interactions')) {
            filteredDrug.interactions = drug.interactions;
        }
        if (categories.includes('full') || categories.includes('usage')) {
            filteredDrug.usage = drug.usage;
        }
        if (categories.includes('full') || categories.includes('storage')) {
            filteredDrug.storage = drug.storage;
        }
        if (categories.includes('full') || categories.includes('dosage')) {
            filteredDrug.cat_dosage = drug.cat_dosage;
            filteredDrug.dog_dosage = drug.dog_dosage;
        }
        
        displayDrugInfo(filteredDrug);
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