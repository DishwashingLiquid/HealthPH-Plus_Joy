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
    }),
});

export const {
    useFetchCurrentWeatherQuery,
} = environmentalDataApi;