export type countryType = {
    name: {common: string}
    cca3: string
    borders: Array<string>
    area: number
}

export type countriesDataType = Record<string, countryType>

export enum requestTypes {
    BY_NAME = 'byName',
    BY_KEY = 'byKey'
}

export interface ErrorType {
    status?: number,
    message: string
}
