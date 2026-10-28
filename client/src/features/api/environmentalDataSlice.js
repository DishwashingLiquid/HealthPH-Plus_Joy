import { baseAPI } from "./_baseAPI";

export const environmentalDataApi = baseAPI.injectEndpoints({
    endpoints: (builder) => ({
        fetchCurrentWeather: builder.query({
            query: (location) => ({
                url: "/environmental-data/weather",
                params:
                    typeof location === "string"
                        ? { region: location }
                        : location,
                timeout: 15000,
            }),
        }),

        fetchCurrentAirQuality: builder.query({
            query: (location) => ({
                url: "/environmental-data/air-quality",
                params:
                    typeof location === "string"
                        ? { region: location }
                        : location,
                timeout: 15000,
            }),
        }),
    }),
});

export const {
    useFetchCurrentWeatherQuery,
useFetchCurrentAirQualityQuery,
} = environmentalDataApi;