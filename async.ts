import { countriesDataType, countryType, ErrorType, requestTypes } from "./types";

// Загрузка данных через промисы (то же самое что `getDataAsync`)
function getDataPromise(url: string) {
    // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
    return fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        redirect: 'follow',
    }).then(
        (response) => {
            // Если мы тут, значит, запрос выполнился.
            // Но там может быть 404, 500, и т.д., поэтому проверяем ответ.
            if (response.ok) {
                return response.json();
            }
            // Пример кастомной ошибки (если нужно проставить какие-то поля
            // для внешнего кода). Можно зареджектить и сам `response`, смотря
            // какой у вас контракт. Главное перевести код в ветку `catch`.
            return Promise.reject({
                status: response.status,
                message: 'Error: something went wrong',
            });
        },

        // При сетевой ошибке (мы оффлайн) из fetch вылетит эксцепшн,
        // и мы попадём в `onRejected` или в `.catch()` на промисе.
        // Если не добавить `onRejected` или `catch`, при ошибке будет
        // эксцепшн `Uncaught (in promise)`.
        () => {
            // Если не вернуть `Promise.reject()`, для внешнего кода
            // промис будет зарезолвлен с `undefined`, и мы не попадём
            // в ветку `catch` для обработки ошибок, а скорее всего
            // получим другой эксцепшн, потому что у нас `undefined`
            // вместо данных, с которыми мы работаем.
            return Promise.reject({message: "Error: Connection error"});
        }
    );
}

export async function loadCountriesData() {
    let countries = [];
    try {
        // ПРОВЕРКА ОШИБКИ №1: ломаем этот урл, заменяя all на allolo,
        // получаем кастомную ошибку.
        countries = await getDataPromise('https://restcountries.com/v3.1/all?fields=name&fields=cca3&fields=area');
    } catch (error) {
        // console.log('catch for getData');
        // console.error(error);
        throw error;
    }
    return countries.reduce((result: countriesDataType, country: countryType) => {
        result[country.cca3] = country;
        return result;
    }, {});
}

// Мапа, в которой будем сохранять запросы, чтобы обращаться к ней, а не еще раз дергать ручку
const alreadyUsedCountryData: Map<string, Omit<countryType, 'area'>> = new Map()

export const fetchAllCountriesData = async () => {
    try {
        const allCountries: Array<countryType> = await getDataPromise('https://restcountries.com/v3.1/all?fields=borders,cca3,name')
        allCountries.forEach(country => {
            alreadyUsedCountryData.set(country.cca3, country)
        })
    } catch (error) {
        return Promise.reject(error)
    }
}

// Эту функцию будем вызывать каждый раз когда захотим получить данные. Она нам вернет либо данные из мапы, если они там есть, либо дернет ручку
const getData = async (requestType: requestTypes, value: string): Promise<{data: countryType, wasRequest: boolean}> => {
    if (requestType === requestTypes.BY_KEY) {
        if (alreadyUsedCountryData.has(value)) {
            return {
                // Пришлось скастовать потому что get может вернуть undefined, но для этого сделал if, поэтому undefined быть не может
                data: alreadyUsedCountryData.get(value) as countryType,
                wasRequest: false
            }
        }
        else {
            return Promise.reject({message: `Error: Can not find country with ${value} cca3 code`})
        }
    }
    else {
        const country = [...alreadyUsedCountryData.values()].find((country) => country.name.common === value)
        if (country) {
            return {
                // Пришлось скастовать потому что find может вернуть undefined, но для этого сделал if, поэтому undefined быть не может
                data: country as countryType,
                wasRequest: false
            }
        }
        else {
            return Promise.reject({message: `Error: Can not find country with name ${value}`})
        }
    }
}

// Основная функция, которую мы экспортируем наружу
export const getPathBetweenCountries = async function (fromCountryName: string, toCountryName: string): Promise<{message: string, requestsNumber: number}> {
    if (!fromCountryName || !toCountryName) {
        return Promise.reject({message: 'Error: You have not entered a country'})
    }

    let fromCountryKey: string
    let requestsNumber = 1; // кол-во запросов не должно меняться
    let bordersFromCountry: Array<string>;
    let bordersToCountry: Array<string>;

    // Делаем запросы для стран из инпута, пытаемся на этом шаге сделать выводы и получить результат
    try {
        const responseFromCountry = await getData(requestTypes.BY_NAME, fromCountryName)
        requestsNumber = responseFromCountry.wasRequest ? requestsNumber + 1 : requestsNumber
        fromCountryKey = responseFromCountry.data.cca3
        bordersFromCountry = responseFromCountry.data.borders
        if (!bordersFromCountry.length) {
            return {message: 'It is impossible to build a path. The source country has no neighbors', requestsNumber}
        }

        const responseToCountry = await getData(requestTypes.BY_NAME, toCountryName)
        requestsNumber = responseToCountry.wasRequest ? requestsNumber + 1 : requestsNumber
        bordersToCountry = responseToCountry.data.borders
        if (!bordersToCountry.length) {
            return {message: 'It is impossible to build a path. The target country has no neighbors', requestsNumber}
        }

        if (fromCountryName === toCountryName) {
            return {message: `You are alredy in ${fromCountryName}`, requestsNumber}
        }
    } catch (error) {
        return Promise.reject(error)
    }

    const bordersToCountryMap = new Map(bordersToCountry.map(countryKey => [countryKey, 1]))

    // Если страны - соседи
    if (bordersToCountryMap.has(fromCountryKey)) {
        return {
            message: fromCountryName + '->' + toCountryName,
            requestsNumber
        }
    }

    // Если страны находятся через одну (беларусь - россия - казахстан)
    for (const countryKey of bordersFromCountry) {
        if (bordersToCountryMap.has(countryKey)) {
            try {
                const response = await getData(requestTypes.BY_KEY, countryKey)
                requestsNumber = response.wasRequest ? requestsNumber + 1 : requestsNumber
                return {
                    message: fromCountryName + '->' + response.data.name.common + '->' + toCountryName,
                    requestsNumber
                }
            } catch (error) {
                return Promise.reject(error)
            }
        }
    }

    const MAX_DEPTH = 10
    const alredyVisited = new Map()
    alredyVisited.set(fromCountryKey, 1)
    const queue = bordersFromCountry.map(countryKey => [countryKey, fromCountryName])
    let resultPath = ''

    // BFS
    while (queue.length) {
        // Пришлось кастовать, потому что .shift() по определению может вернуть undefined, если длина массива 0, но т.к в while есть соответствующая проверка, то и undefined`a не может быть
        const [countryKey, path] = queue.shift() as Array<string>
        if (path.split('->').length - 1 > MAX_DEPTH - 2) {
            break
        }
        if (bordersToCountryMap.has(countryKey)) {
            try {
                // среди соседей целевой страны нашли текущую, формируем ответ
                const response = await getData(requestTypes.BY_KEY, countryKey)
                requestsNumber = response.wasRequest ? requestsNumber + 1 : requestsNumber
                resultPath = path + '->' + response.data.name.common +'->' + toCountryName
                break;
            } catch (error) {
                return Promise.reject(error)
            }
        }
        try {
            const response= await getData(requestTypes.BY_KEY, countryKey)
            requestsNumber = response.wasRequest ? requestsNumber + 1 : requestsNumber
            if (response.data.borders.length) {
                response.data.borders.forEach(countryKey => !alredyVisited.has(countryKey) ? queue.push([countryKey, path+'->'+response.data.name.common]) : null)
            }
            alredyVisited.set(countryKey, 1)
        } catch (error) {
            return Promise.reject(error)
        }
    }

    if (!resultPath) {
        return {
            message: `Could not find path between ${fromCountryName} and ${toCountryName}`,
            requestsNumber
        }
    }
    return {
        message: resultPath,
        requestsNumber
    }
}

