import { baseAPI } from "./_baseAPI";

export const environmentalDataApi = baseAPI.injectEndpoints({
    endpoints: (builder) => ({
        fetchCurrentWeather: builder.query({
            query: (region) => ({
                url: "/environmental-data/weather",
                params: { region },
                timeout: 15000,
            }),
        }),

        fetchCurrentAirQuality: builder.query({
            query: (region) => ({
                url: "/environmental-data/air-quality",
                params: { region },
                timeout: 15000,
            }),
        }),
    }),
});

export const {
    useFetchCurrentWeatherQuery,
    useFetchCurrentAirQualityQuery,
} = environmentalDataApi;