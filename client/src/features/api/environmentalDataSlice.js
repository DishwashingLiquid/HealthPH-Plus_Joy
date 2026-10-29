import { baseAPI } from "./_baseAPI";

export const environmentalDataApi = baseAPI.injectEndpoints({
    endpoints: (builder) => ({
        fetchEnvironmentalHistory: builder.query({
            query: ({ region, latitude, longitude, days, hours }) => ({
                url: "/environmental-data/history",
                params: { region, latitude, longitude, days, hours },
                timeout: 30000,
            }),
            keepUnusedDataFor: 120,
        }),
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
    useFetchEnvironmentalHistoryQuery,
    useFetchCurrentWeatherQuery,
    useFetchCurrentAirQualityQuery,
} = environmentalDataApi;
