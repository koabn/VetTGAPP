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
    let symptomsData = null;
    
    // Настраиваем тему в зависимости от темы Telegram
    function setThemeColors() {
        // Получаем тему из Telegram
        const isDarkTheme = tg.colorScheme === 'dark';
        document.documentElement.classList.toggle('dark-theme', isDarkTheme);
        
        // Применяем цвета из Telegram
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.backgroundColor);
        document.documentElement.style.setProperty('--tg-theme-text-color', tg.textColor);
        document.documentElement.style.setProperty('--tg-theme-hint-color', tg.hint_color || (isDarkTheme ? '#7d7d7d' : '#999999'));
        document.documentElement.style.setProperty('--tg-theme-link-color', tg.linkColor || (isDarkTheme ? '#8774e1' : '#2481cc'));
        document.documentElement.style.setProperty('--tg-theme-button-color', tg.buttonColor || (isDarkTheme ? '#8774e1' : '#2481cc'));
        document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.buttonTextColor || '#ffffff');
        document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', tg.secondaryBackgroundColor || (isDarkTheme ? '#232323' : '#f4f4f5'));
    }
    
    // Применяем тему
    setThemeColors();
    
    // Загружаем данные при старте
    async function loadDrugsData() {
        try {
            console.log('Начинаем загрузку данных...');
            
            // Загружаем оба файла параллельно
            const [drugsResponse, symptomsResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/api/drugs.json`),
                fetch(`${API_BASE_URL}/api/symptoms.json`)
            ]);
            
            if (!drugsResponse.ok || !symptomsResponse.ok) {
                throw new Error('Ошибка при загрузке данных');
            }

            const [drugsJson, symptomsJson] = await Promise.all([
                drugsResponse.json(),
                symptomsResponse.json()
            ]);
            
            drugsData = drugsJson;
            symptomsData = symptomsJson;
            
            console.log('Данные успешно загружены');
            
        } catch (error) {
            console.error('Ошибка при загрузке данных:', error);
            errorDiv.textContent = 'Ошибка при загрузке данных: ' + error.toString();
            errorDiv.style.display = 'block';
        }
    }
    
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
        if (!drugsData || !symptomsData) {
            errorDiv.textContent = 'Данные еще не загружены';
            errorDiv.style.display = 'block';
            return;
        }
        
        // Поиск по препаратам
        const drugResults = drugsData.filter(drug => {
            const nameMatch = drug.name.toLowerCase().includes(query);
            const tradeMatch = drug.trade_names && drug.trade_names.toLowerCase().includes(query);
            return nameMatch || tradeMatch;
        });
        
        // Поиск по симптомам
        const symptomResults = Object.entries(symptomsData)
            .filter(([symptom, data]) => {
                return symptom.toLowerCase().includes(query) ||
                       data.sections.some(section => 
                           section.title.toLowerCase().includes(query) ||
                           (section.description && section.description.some(desc => 
                               desc.toLowerCase().includes(query)
                           ))
                       );
            })
            .map(([symptom, data]) => ({
                name: symptom,
                type: 'symptom',
                sections: data.sections
            }));
        
        const allResults = [...drugResults, ...symptomResults];
        
        if (allResults.length > 0) {
            showDrugOptions(allResults);
            errorDiv.style.display = 'none';
        } else {
            errorDiv.textContent = 'Ничего не найдено';
            errorDiv.style.display = 'block';
            confirmationSection.style.display = 'none';
            drugInfo.style.display = 'none';
        }
    }
    
    // Функция отображения вариантов препаратов
    function showDrugOptions(results) {
        drugOptions.innerHTML = '';
        confirmationSection.style.display = 'block';
        drugInfo.style.display = 'none';
        
        results.forEach(item => {
            const option = document.createElement('div');
            option.className = 'drug-option';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'drug-name';
            
            if (item.type === 'symptom') {
                nameSpan.textContent = `🔍 ${item.name}`;
                option.classList.add('symptom-option');
            } else {
                nameSpan.textContent = `💊 ${item.name}`;
                option.classList.add('drug-option');
            }
            
            option.appendChild(nameSpan);
            
            if (!item.type && item.trade_names) {
                const tradeSpan = document.createElement('span');
                tradeSpan.className = 'drug-trade-names';
                tradeSpan.textContent = ` (${item.trade_names})`;
                option.appendChild(tradeSpan);
            }
            
            option.addEventListener('click', () => {
                currentDrug = item;
                confirmationSection.style.display = 'none';
                drugInfo.style.display = 'block';
                if (item.type === 'symptom') {
                    displaySymptomInfo(item);
                } else {
                    displayFilteredDrugInfo(item);
                }
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

    // Добавляем новую функцию для отображения информации о симптоме
    function displaySymptomInfo(symptom) {
        drugContent.innerHTML = '';
        
        const title = document.createElement('div');
        title.className = 'drug-title';
        title.textContent = symptom.name;
        drugContent.appendChild(title);
        
        const info = document.createElement('div');
        info.className = 'drug-info';
        
        const content = symptom.sections.map(section => {
            let sectionContent = `🔹 ${section.title}`;
            if (section.description && section.description.length > 0) {
                sectionContent += `\n${section.description.join('\n')}`;
            }
            return sectionContent;
        });
        
        info.innerHTML = content.join('<br><br>');
        drugContent.appendChild(info);
    }

    // Загружаем данные при инициализации
    loadDrugsData();
});
