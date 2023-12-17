import { fetchAllCountriesData, getPathBetweenCountries, loadCountriesData } from '/async.js';

const form = document.getElementById('form');
const fromCountry = document.getElementById('fromCountry');
const toCountry = document.getElementById('toCountry');
const countriesList = document.getElementById('countriesList');
const submit = document.getElementById('submit');
const output = document.getElementById('output');

const setLoading = (flag) => {
    fromCountry.disabled = flag;
    toCountry.disabled = flag;
    submit.disabled = flag;
    output.textContent = flag ? 'Loading…' : '';
};

(async () => {
    setLoading(true);
    let countriesData = {};
    try {
        // ПРОВЕРКА ОШИБКИ №2: Ставим тут брейкпоинт и, когда дойдёт
        // до него, переходим в оффлайн-режим. Получаем эксцепшн из `fetch`.
        countriesData = await loadCountriesData();
    } catch (error) {
        // console.log('catch for loadCountriesData');
        // console.error(error);
        output.textContent = 'Something went wrong. Try to reset your compluter.';
        return;
    }
    output.textContent = '';

    // Заполняем список стран для подсказки в инпутах
    Object.keys(countriesData)
        .sort((a, b) => countriesData[b].area - countriesData[a].area)
        .forEach((code) => {
            const option = document.createElement('option');
            option.value = countriesData[code].name.common;
            countriesList.appendChild(option);
        });

    await fetchAllCountriesData();
    setLoading(false);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        // TODO: Вывести, откуда и куда едем, и что идёт расчёт.
        // TODO: Рассчитать маршрут из одной страны в другую за минимум запросов.
        // TODO: Вывести маршрут и общее количество запросов.
        try {
            setLoading(true);
            const { message, requestsNumber } = await getPathBetweenCountries(fromCountry.value, toCountry.value);
            setLoading(false);
            const messageTag = document.createElement('p');
            messageTag.textContent = message;
            const requestsTag = document.createElement('p');
            requestsTag.textContent =
                requestsNumber === 1 ? `${requestsNumber} request!` : `${requestsNumber} requests!`;
            output.appendChild(messageTag);
            output.appendChild(requestsTag);
        } catch (error) {
            setLoading(false);
            const { message } = error;
            output.textContent = message;
        }
    });
})();
