let tg = window.Telegram.WebApp;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    // Сообщаем Telegram, что приложение готово
    tg.ready();
    
    // Подробное логирование данных пользователя
    console.log('Данные пользователя из initDataUnsafe:', {
        user: tg.initDataUnsafe?.user,
        username: tg.initDataUnsafe?.user?.username,
        firstName: tg.initDataUnsafe?.user?.first_name,
        lastName: tg.initDataUnsafe?.user?.last_name,
        id: tg.initDataUnsafe?.user?.id,
        isBot: tg.initDataUnsafe?.user?.is_bot,
        languageCode: tg.initDataUnsafe?.user?.language_code
    });
    
    // Логируем все доступные данные WebApp
    console.log('Все данные WebApp:', {
        platform: tg.platform,
        version: tg.version,
        viewportHeight: tg.viewportHeight,
        viewportStableHeight: tg.viewportStableHeight,
        isExpanded: tg.isExpanded,
        colorScheme: tg.colorScheme
    });
    
    // Оригинальное логирование
    console.log('Telegram WebApp данные:', {
        initData: tg.initData,
        initDataUnsafe: tg.initDataUnsafe,
        version: tg.version,
        platform: tg.platform
    });
    
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
    const reportErrorBtn = document.getElementById('reportError');
    const backButton = document.getElementById('backButton');
    
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
        document.documentElement.style.setProperty('--tg-theme-hint-color', tg.hint_color);
        document.documentElement.style.setProperty('--tg-theme-link-color', tg.linkColor);
        document.documentElement.style.setProperty('--tg-theme-button-color', tg.buttonColor);
        document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.buttonTextColor);
        document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', tg.secondaryBackgroundColor);
    }
    
    // Применяем тему
    setThemeColors();
    
    // Загружаем данные при старте
    async function loadDrugsData() {
        try {
            console.log('Начинаем загрузку данных...');
            console.log('URL для drugs:', `${API_BASE_URL}/api/drugs.json`);
            console.log('URL для symptoms:', `${API_BASE_URL}/api/symptoms.json`);
            
            // Загружаем оба файла параллельно
            const [drugsResponse, symptomsResponse] = await Promise.all([
                fetch(`${API_BASE_URL}/api/drugs.json`),
                fetch(`${API_BASE_URL}/api/symptoms.json`)
            ]);
            
            console.log('Статус ответа drugs:', drugsResponse.status);
            console.log('Статус ответа symptoms:', symptomsResponse.status);
            
            if (!drugsResponse.ok || !symptomsResponse.ok) {
                throw new Error('Ошибка при загрузке данных');
            }

            const [drugsJson, symptomsJson] = await Promise.all([
                drugsResponse.json(),
                symptomsResponse.json()
            ]);
            
            console.log('Данные drugs получены:', !!drugsJson);
            console.log('Данные symptoms получены:', !!symptomsJson);
            
            // Проверяем структуру данных
            if (Array.isArray(drugsJson)) {
                drugsData = drugsJson;
            } else if (drugsJson && drugsJson.results) {
                drugsData = drugsJson.results;
            } else {
                throw new Error('Неверный формат данных препаратов');
            }
            
            symptomsData = symptomsJson;
            
            console.log('Данные успешно загружены');
            console.log('Количество препаратов:', drugsData.length);
            console.log('Количество симптомов:', Object.keys(symptomsData).length);
            
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
        return selected;
    }
    
    // Функция возврата на главный экран
    function goBack() {
        clearSearch();
        searchInput.value = '';
        hideBackButton();
        // Показываем калькулятор при возврате назад
        document.querySelector('.calculator-section').style.display = 'block';
    }

    // Добавляем обработчик для кнопки возврата
    backButton.addEventListener('click', goBack);

    // Обновляем функцию startSearch
    function startSearch() {
        const query = searchInput.value.trim().toLowerCase();
        if (query.length >= 2) {
            searchDrugs(query);
            showBackButton();
            document.querySelector('.calculator-section').style.display = 'none';
        } else {
            errorDiv.textContent = 'Введите минимум 2 символа для поиска';
            errorDiv.style.display = 'block';
            confirmationSection.style.display = 'none';
            drugInfo.style.display = 'none';
            hideBackButton();
            document.querySelector('.calculator-section').style.display = 'block';
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
    
    // Добавляем функцию расчета расстояния Левенштейна
    function levenshteinDistance(str1, str2) {
        const m = str1.length;
        const n = str2.length;
        const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

        for (let i = 0; i <= m; i++) {
            dp[i][0] = i;
        }
        for (let j = 0; j <= n; j++) {
            dp[0][j] = j;
        }

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = Math.min(
                        dp[i - 1][j - 1] + 1,  // замена
                        dp[i - 1][j] + 1,      // удаление
                        dp[i][j - 1] + 1       // вставка
                    );
                }
            }
        }
        return dp[m][n];
    }

    // Добавляем функцию проверки схожести строк
    function stringSimilarity(str1, str2) {
        const maxLength = Math.max(str1.length, str2.length);
        if (maxLength === 0) return 1.0;
        const distance = levenshteinDistance(str1, str2);
        return 1 - distance / maxLength;
    }

    // Функция поиска препаратов
    function searchDrugs(query) {
        if (!drugsData || !symptomsData) {
            errorDiv.textContent = 'Данные еще не загружены';
            errorDiv.style.display = 'block';
            return;
        }
        
        // Скрываем калькулятор при поиске
        document.querySelector('.calculator-section').style.display = 'none';
        
        const threshold = 0.7; // Порог схожести (можно настроить)
        query = query.toLowerCase();
        
        // Поиск по препаратам с учетом схожести
        const drugResults = drugsData.filter(drug => {
            // Точное совпадение
            const nameMatch = drug.name.toLowerCase().includes(query);
            const tradeMatch = drug.trade_names && drug.trade_names.toLowerCase().includes(query);
            
            if (nameMatch || tradeMatch) return true;
            
            // Нечеткий поиск
            const nameSimilarity = Math.max(
                ...drug.name.toLowerCase().split(/\s+/).map(word => 
                    stringSimilarity(word, query)
                )
            );
            
            const tradeSimilarity = drug.trade_names ? Math.max(
                ...drug.trade_names.toLowerCase().split(/\s+/).map(word => 
                    stringSimilarity(word, query)
                )
            ) : 0;
            
            return nameSimilarity >= threshold || tradeSimilarity >= threshold;
        }).map(drug => ({
            ...drug,
            relevance: Math.max(
                ...drug.name.toLowerCase().split(/\s+/).map(word => 
                    stringSimilarity(word, query)
                ),
                ...(drug.trade_names ? 
                    drug.trade_names.toLowerCase().split(/\s+/).map(word => 
                        stringSimilarity(word, query)
                    ) : []
                )
            )
        })).sort((a, b) => b.relevance - a.relevance);
        
        // Поиск по симптомам с учетом схожести
        const symptomResults = Object.entries(symptomsData)
            .filter(([symptom, data]) => {
                // Точное совпадение
                if (symptom.toLowerCase().includes(query)) return true;
                
                // Нечеткий поиск в названии симптома
                const symptomSimilarity = Math.max(
                    ...symptom.toLowerCase().split(/\s+/).map(word => 
                        stringSimilarity(word, query)
                    )
                );
                
                if (symptomSimilarity >= threshold) return true;
                
                // Поиск в секциях
                return data.sections.some(section => {
                    const titleSimilarity = Math.max(
                        ...section.title.toLowerCase().split(/\s+/).map(word => 
                            stringSimilarity(word, query)
                        )
                    );
                    
                    if (titleSimilarity >= threshold) return true;
                    
                    return section.description.some(desc => {
                        const descSimilarity = Math.max(
                            ...desc.toLowerCase().split(/\s+/).map(word => 
                                stringSimilarity(word, query)
                            )
                        );
                        return descSimilarity >= threshold;
                    });
                });
            })
            .map(([symptom, data]) => ({
                name: symptom,
                type: 'symptom',
                sections: data.sections,
                relevance: Math.max(
                    ...symptom.toLowerCase().split(/\s+/).map(word => 
                        stringSimilarity(word, query)
                    )
                )
            }))
            .sort((a, b) => b.relevance - a.relevance);
        
        const allResults = [...drugResults, ...symptomResults];
        
        // Скрываем все секции результатов сначала
        const resultsSection = document.getElementById('results');
        resultsSection.style.display = 'none';
        confirmationSection.style.display = 'none';
        drugInfo.style.display = 'none';
        
        if (allResults.length > 0) {
            showDrugOptions(allResults);
            errorDiv.style.display = 'none';
            confirmationSection.style.display = 'block';
        } else {
            errorDiv.textContent = 'Ничего не найдено';
            errorDiv.style.display = 'block';
        }
    }
    
    // Обновляем функцию clearSearch
    function clearSearch() {
        searchInput.value = '';
        const resultsSection = document.getElementById('results');
        resultsSection.classList.remove('visible');
        setTimeout(() => {
            resultsSection.style.display = 'none';
        }, 300);
        confirmationSection.style.display = 'none';
        drugInfo.style.display = 'none';
        errorDiv.style.display = 'none';
        reportErrorBtn.style.display = 'none';
        hideBackButton();
        
        // Показываем калькулятор при возврате на главную
        document.querySelector('.calculator-section').style.display = 'block';
        
        // Сбрасываем видимость фильтров
        document.querySelector('.categories-section').style.display = 'block';
    }

    // Добавляем обработчик для очистки поиска при нажатии Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            clearSearch();
        }
    });
    
    // Обновляем функцию showDrugOptions
    function showDrugOptions(results) {
        drugOptions.innerHTML = '';
        confirmationSection.style.display = 'block';
        drugInfo.style.display = 'none';
        reportErrorBtn.style.display = 'flex';
        showBackButton();
        
        results.forEach(item => {
            const option = document.createElement('div');
            option.className = 'drug-option';
            if (item.type === 'symptom') {
                option.classList.add('symptom-option');
            }
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'drug-name';
            nameSpan.textContent = item.type === 'symptom' ? `🔍 ${item.name}` : `💊 ${item.name}`;
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
                
                // Показываем секцию результатов и информацию о препарате
                const resultsSection = document.getElementById('results');
                resultsSection.style.display = 'block';
                resultsSection.classList.add('visible');
                drugInfo.style.display = 'block';
                
                // Показываем/скрываем секцию с фильтрами в зависимости от типа
                const categoriesSection = document.querySelector('.categories-section');
                if (item.type === 'symptom') {
                    categoriesSection.style.display = 'none';
                    displaySymptomInfo(item);
                } else {
                    categoriesSection.style.display = 'block';
                    displayFilteredDrugInfo(item);
                }
            });
            
            drugOptions.appendChild(option);
        });
    }
    
    // Функция отображения отфильтрованной информации о препарате
    function displayFilteredDrugInfo(drug) {
        drugContent.innerHTML = '';
        
        const title = document.createElement('div');
        title.className = 'drug-title';
        title.textContent = drug.name;
        drugContent.appendChild(title);
        
        const info = document.createElement('div');
        info.className = 'drug-info';
        
        let content = [];
        const selectedCategories = getSelectedCategories();
        
        // Базовая информация всегда отображается
        if (drug.trade_names) content.push(`💊 Торговые названия: ${drug.trade_names}`);
        if (drug.classification) content.push(`📦 Группа: ${drug.classification}`);
        
        // Если ни одна категория не выбрана или выбраны конкретные категории
        if (selectedCategories.length === 0) {
            // Показываем всю информацию
            if (drug.mechanism) content.push(`⚡ Механизм действия: ${drug.mechanism}`);
            if (drug.indications) content.push(`🎯 Показания: ${drug.indications}`);
            if (drug.side_effects) content.push(`⚕️ Побочные эффекты: ${drug.side_effects}`);
            if (drug.contraindications) content.push(`⚠️ Противопоказания: ${drug.contraindications}`);
            if (drug.interactions) content.push(`🔄 Взаимодействия: ${drug.interactions}`);
            if (drug.usage) content.push(`💉 Применение: ${drug.usage}`);
            if (drug.storage) content.push(`🏠 Хранение: ${drug.storage}`);
            if (drug.cat_dosage) content.push(`🐱 Дозировка для кошек: ${drug.cat_dosage}`);
            if (drug.dog_dosage) content.push(`🐕 Дозировка для собак: ${drug.dog_dosage}`);
        } else {
            // Показываем только выбранные категории
            if (selectedCategories.includes('mechanism') && drug.mechanism) 
                content.push(`⚡ Механизм действия: ${drug.mechanism}`);
            if (selectedCategories.includes('indications') && drug.indications) 
                content.push(`🎯 Показания: ${drug.indications}`);
            if (selectedCategories.includes('side_effects') && drug.side_effects) 
                content.push(`⚕️ Побочные эффекты: ${drug.side_effects}`);
            if (selectedCategories.includes('contraindications') && drug.contraindications) 
                content.push(`⚠️ Противопоказания: ${drug.contraindications}`);
            if (selectedCategories.includes('interactions') && drug.interactions) 
                content.push(`🔄 Взаимодействия: ${drug.interactions}`);
            if (selectedCategories.includes('usage') && drug.usage) 
                content.push(`💉 Применение: ${drug.usage}`);
            if (selectedCategories.includes('storage') && drug.storage) 
                content.push(`🏠 Хранение: ${drug.storage}`);
            if (selectedCategories.includes('dosage')) {
                if (drug.cat_dosage) content.push(`🐱 Дозировка для кошек: ${drug.cat_dosage}`);
                if (drug.dog_dosage) content.push(`🐕 Дозировка для собак: ${drug.dog_dosage}`);
            }
        }
        
        info.innerHTML = content.join('<br><br>');
        drugContent.appendChild(info);
        
        // Показываем кнопку сообщения об ошибке
        reportErrorBtn.style.display = 'flex';
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
        
        // Показываем кнопку сообщения об ошибке
        reportErrorBtn.style.display = 'flex';
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
            let sectionContent = `<div class="section-content">`;
            sectionContent += `<div class="section-title">${section.title}</div>`;
            if (section.description && section.description.length > 0) {
                sectionContent += `<div class="section-description">`;
                section.description.forEach(desc => {
                    const isHeader = desc === desc.toUpperCase() && desc.length > 3;
                    if (isHeader) {
                        sectionContent += `<div class="subsection-header">${desc}</div>`;
                    } else {
                        sectionContent += `<div class="description-item">${desc}</div>`;
                    }
                });
                sectionContent += '</div>';
            }
            sectionContent += '</div>';
            return sectionContent;
        });
        
        info.innerHTML = content.join('');
        drugContent.appendChild(info);
        
        // Показываем кнопку сообщения об ошибке
        reportErrorBtn.style.display = 'flex';
    }

    // Функция для отправки сообщения об ошибке
    async function reportError() {
        const errorModal = document.getElementById('errorModal');
        errorModal.style.display = 'flex';
        setTimeout(() => {
            errorModal.classList.add('visible');
        }, 10);
    }

    // Функция закрытия модального окна
    function closeErrorModal() {
        const errorModal = document.getElementById('errorModal');
        errorModal.classList.remove('visible');
        setTimeout(() => {
            errorModal.style.display = 'none';
            document.getElementById('errorComment').value = '';
        }, 300);
    }

    // Функция отправки сообщения об ошибке
    async function sendErrorReport() {
        const comment = document.getElementById('errorComment').value.trim();
        if (!comment) {
            tg.showAlert('Пожалуйста, опишите проблему');
            return;
        }

        const userData = tg.initDataUnsafe;
        let errorData = {
            date: new Date().toLocaleString(),
            user: userData?.user?.username || 'Не указан',
            userId: userData?.user?.id || 'Не доступен',
            context: currentDrug ? `${currentDrug.type === 'symptom' ? 'Симптом' : 'Препарат'}: ${currentDrug.name}` : 'Поиск',
            comment: comment
        };

        try {
            const url = 'https://script.google.com/macros/s/AKfycbzEDk9Jo4lqJAJ-B8erpNaAb1X71qOHwJeIpOqDqyrpolP8psmL1TpwiGfRR5R7V2yY/exec';
            
            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(errorData)
            });

            closeErrorModal();

            // Создаем и показываем уведомление
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = 'Спасибо! Сообщение об ошибке отправлено.';
            document.body.appendChild(notification);

            setTimeout(() => notification.classList.add('show'), 100);
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 3000);

            tg.showAlert('Спасибо! Сообщение об ошибке отправлено.');
            
        } catch (error) {
            console.error('Ошибка при отправке сообщения:', error);
            tg.showAlert('Извините, не удалось отправить сообщение об ошибке.');
        }
    }

    // Добавляем обработчики для модального окна
    document.getElementById('cancelErrorReport').addEventListener('click', closeErrorModal);
    document.getElementById('sendErrorReport').addEventListener('click', sendErrorReport);
    document.getElementById('errorModal').addEventListener('click', (e) => {
        if (e.target.id === 'errorModal') {
            closeErrorModal();
        }
    });

    // Добавляем обработчик для кнопки сообщения об ошибке
    if (reportErrorBtn) {
        reportErrorBtn.addEventListener('click', reportError);
    } else {
        console.error('Кнопка reportError не найдена в DOM');
    }

    // Загружаем данные при инициализации
    loadDrugsData();

    // Инициализация калькулятора
    const weightInput = document.getElementById('weight');
    const dehydrationInput = document.getElementById('dehydration');
    const additionalInput = document.getElementById('additional');
    const calculatorResults = document.querySelector('.calculator-results');

    // Функция расчета дефицитарного объема
    function calculateDeficit(weight, dehydration) {
        return dehydration * weight * 8;
    }

    // Функция расчета поддерживающего объема
    function calculateMaintenance(weight) {
        if (weight <= 20) {
            return 30 * weight + 70;
        } else {
            return 70 * Math.pow(weight, 0.75);
        }
    }

    // Функция обновления результатов
    function updateResults(deficit, maintenance, additional) {
        document.getElementById('deficit').textContent = Math.round(deficit) + ' мл';
        document.getElementById('maintenance').textContent = Math.round(maintenance) + ' мл';
        document.getElementById('additional-result').textContent = Math.round(additional) + ' мл';
        document.getElementById('total').textContent = Math.round(deficit + maintenance + additional) + ' мл';
    }

    // Обработчики ввода для автоматического расчета
    [weightInput, dehydrationInput, additionalInput].forEach(input => {
        input.addEventListener('input', () => {
            const weight = parseFloat(weightInput.value) || 0;
            const dehydration = parseFloat(dehydrationInput.value) || 0;
            const additional = parseFloat(additionalInput.value) || 0;

            if (weight > 0) {
                if (dehydration < 0 || dehydration > 100) {
                    tg.showAlert('Процент дегидратации должен быть от 0 до 100');
                    return;
                }
                const deficit = calculateDeficit(weight, dehydration);
                const maintenance = calculateMaintenance(weight);
                calculatorResults.style.display = 'block';
                updateResults(deficit, maintenance, additional);
            } else {
                calculatorResults.style.display = 'none';
            }
        });
    });

    function showBackButton() {
        const backButton = document.getElementById('backButton');
        const logo = document.querySelector('.logo');
        
        // Сначала скрываем логотип
        logo.classList.add('hidden');
        
        // После начала анимации логотипа показываем кнопку
        setTimeout(() => {
            backButton.style.display = 'flex';
            requestAnimationFrame(() => {
                backButton.classList.add('visible');
            });
        }, 150);
    }

    function hideBackButton() {
        const backButton = document.getElementById('backButton');
        const logo = document.querySelector('.logo');
        
        // Сначала скрываем кнопку
        backButton.classList.remove('visible');
        
        // После завершения анимации кнопки показываем логотип
        setTimeout(() => {
            backButton.style.display = 'none';
            requestAnimationFrame(() => {
                logo.classList.remove('hidden');
            });
        }, 150);
    }
});
