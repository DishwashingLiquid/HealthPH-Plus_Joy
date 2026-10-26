import {
    useFetchCurrentWeatherQuery,
} from "../../features/api/environmentalDataSlice";

const WEATHER_LABELS = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Freezing fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Light rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Light snowfall",
    73: "Moderate snowfall",
    75: "Heavy snowfall",
    77: "Snow grains",
    80: "Light rain showers",
    81: "Moderate rain showers",
    82: "Heavy rain showers",
    85: "Light snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with light hail",
    97: "Heavy thunderstorm",
    99: "Thunderstorm with heavy hail",
};

const formatMeasurement = (value, unit) =>
    Number.isFinite(value)
        ? `${value.toLocaleString("en-PH", {
            maximumFractionDigits: 2,
        })}${unit}`
        : "Unavailable";

const EnvironmentalDataCard = ({ region }) => {
    const {
        currentData: weatherData,
        isFetching,
        isError,
        error,
        refetch,
    } = useFetchCurrentWeatherQuery(region, {
        skip: !region,
        pollingInterval: 600000,
        skipPollingIfUnfocused: true,
        refetchOnMountOrArgChange: true,
    });

    let content = (
        <p role="status" className="text-sm text-gray-500">
            Loading weather...
        </p>
    );

    if (!region) {
        content = (
            <p className="text-sm text-gray-500">
                Select a region above to view weather at its reference city.
            </p>
        );
    } else if (isError) {
        const message =
            typeof error?.data?.detail === "string"
                ? error.data.detail
                : error?.status === "TIMEOUT_ERROR"
                    ? "The weather request timed out. Please try again."
                    : "Unable to load weather. Please try again.";

        content = (
            <div role="alert" className="text-sm text-red-700">
                <p>{message}</p>
                <button
                    type="button"
                    onClick={() => refetch()}
                    className="mt-2 font-semibold underline"
                >
                    Retry
                </button>
            </div>
        );
    } else if (weatherData?.weather) {
        const weather = weatherData.weather;

        const precipitationLabel =
            Number.isFinite(weather.interval_seconds)
            && weather.interval_seconds > 0
                ? `Precipitation (last ${
                    weather.interval_seconds / 60
                } min)`
                : "Precipitation";

        const metrics = [
            {
                label: "Weather Conditions",
                value: WEATHER_LABELS[weather.weather_code] ?? "Unavailable",
            },
            {
                label: "Air Temperature",
                value: formatMeasurement(weather.temperature, " °C"),
            },
            {
                label: "Relative Humidity",
                value: formatMeasurement(weather.relative_humidity, "%"),
            },
            {
                label: "Feels Like",
                value: formatMeasurement(weather.feels_like, " °C"),
            },
            {
                label: precipitationLabel,
                value: formatMeasurement(weather.precipitation, " mm"),
            },
        ];

        content = (
            <>
                <p className="mb-1 text-sm font-medium text-gray-800">
                    Reference city: {weatherData.reference_location.name}
                </p>
                <p className="mb-3 text-xs text-gray-500">
                    Model estimates for this location; not a regional average.
                </p>

                <dl className="flex flex-col gap-3">
                    {metrics.map(({ label, value }) => (
                        <div
                            key={label}
                            className="flex items-center justify-between gap-4 rounded-lg bg-[#F5F5F5] p-3"
                        >
                            <dt className="text-sm text-gray-500">
                                {label}
                            </dt>
                            <dd className="text-right text-sm font-medium text-gray-800">
                                {value}
                            </dd>
                        </div>
                    ))}
                </dl>

                <div className="mt-3 space-y-1 text-xs text-gray-500">
                    <p>
                        Data time:{" "}
                        {weather.data_time?.replace("T", " ") ?? "Unavailable"}
                        {" "}PHT
                    </p>
                    <p>
                        Weather data by{" "}
                        <a
                            href="https://open-meteo.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                        >
                            Open-Meteo
                        </a>
                    </p>
                    {isFetching && (
                        <p role="status">Updating weather...</p>
                    )}
                </div>
            </>
        );
    }

    return (
        <section className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
            <h2 className="mb-3 text-[18px] font-semibold text-gray-800">
                Weather &amp; Air Quality
            </h2>
            {content}
        </section>
    );
};

export default EnvironmentalDataCard;