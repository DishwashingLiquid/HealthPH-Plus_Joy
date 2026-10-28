import {
    useFetchCurrentWeatherQuery,
    useFetchCurrentAirQualityQuery,
} from "../../features/api/environmentalDataSlice";

import { useEffect, useId, useRef, useState } from "react";
import Icon from "../Icon";

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

const formatMeasurement = (value, unit = "") =>
    Number.isFinite(value)
        ? `${value.toLocaleString("en-PH", {
            maximumFractionDigits: 2,
        })}${unit}`
        : "Unavailable";

const formatWindDirection = (direction, speed) => {
    if (Number.isFinite(speed) && speed === 0) {
        return "Calm";
    }

    if (
        !Number.isFinite(direction)
        || direction < 0
        || direction > 360
    ) {
        return "Unavailable";
    }

    const directions = [
        "N", "NE", "E", "SE", "S", "SW", "W", "NW",
    ];

    const compass = directions[Math.round(direction / 45) % 8];

    return compass;
};

const EnvironmentalDataCard = ({
    region,
    latitude,
    longitude,
    locationLabel = "Selected map location",
    dateRange = 7,
}) => {
    const [showDataInfo, setShowDataInfo] = useState(false);
    const dataInfoRef = useRef(null);
    const dataInfoId = useId();

    useEffect(() => {
        if (!showDataInfo) return;

        const closeOutside = (event) => {
            if (!dataInfoRef.current?.contains(event.target)) {
                setShowDataInfo(false);
            }
        };

        const closeOnEscape = (event) => {
            if (event.key === "Escape") {
                setShowDataInfo(false);
            }
        };

        document.addEventListener("pointerdown", closeOutside);
        document.addEventListener("keydown", closeOnEscape);

        return () => {
            document.removeEventListener("pointerdown", closeOutside);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [showDataInfo]);

    const hasLocation = Boolean(region)
        && Number.isFinite(latitude)
        && Number.isFinite(longitude);

    const queryArgs = { region, latitude, longitude };

    const queryOptions = {
        skip: !hasLocation,
        pollingInterval: 600000,
        skipPollingIfUnfocused: true,
        refetchOnMountOrArgChange: true,
    };

    const weatherRequest = useFetchCurrentWeatherQuery(
        queryArgs,
        queryOptions
    );

    const airRequest = useFetchCurrentAirQualityQuery(
        queryArgs,
        queryOptions
    );

    const weather = weatherRequest.isError
        ? null
        : weatherRequest.currentData?.weather;

    const airQuality = airRequest.isError
        ? null
        : airRequest.currentData?.air_quality;

    const displayValue = (request, ready, value) =>
        ready
            ? value
            : request.isFetching
                ? "Loading..."
                : "Unavailable";

    const weatherValue = (value) =>
        displayValue(weatherRequest, Boolean(weather), value);

    const airValue = (value) =>
        displayValue(airRequest, Boolean(airQuality), value);

    const direction = formatWindDirection(
        weather?.wind_direction,
        weather?.wind_speed
    );

    const windParts = [
        formatMeasurement(weather?.wind_speed, " km/h"),
        direction,
    ].filter((part) => part !== "Unavailable");

    const windValue = direction === "Calm"
        ? "Calm"
        : windParts.join(" · ") || "Unavailable";

    const precipitationLabel =
        Number.isFinite(weather?.interval_seconds)
        && weather.interval_seconds > 0
            ? `Precip. (${weather.interval_seconds / 60} min)`
            : "Precipitation";

    const metrics = [
        {
            label: "Conditions",
            value: weatherValue(
                WEATHER_LABELS[weather?.weather_code] ?? "Unavailable"
            ),
        },
        {
            label: "Temp / humidity",
            value: weatherValue(
                `${formatMeasurement(weather?.temperature, " °C")} / ${
                    formatMeasurement(weather?.relative_humidity, "%")
                }`
            ),
        },
        {
            label: "Estimated Heat Index",
            value: weatherValue(
                formatMeasurement(weather?.estimated_heat_index, " °C")
            ),
        },
        {
            label: "Wind",
            value: weatherValue(windValue),
        },
        {
            label: precipitationLabel,
            value: weatherValue(
                formatMeasurement(weather?.precipitation, " mm")
            ),
        },
        {
            label: "US AQI",
            value: airValue(
                formatMeasurement(airQuality?.us_aqi)
            ),
        },
        {
            label: "PM2.5",
            value: airValue(
                formatMeasurement(airQuality?.pm25, " µg/m³")
            ),
        },
    ];

    const requests = [
        { label: "Weather", request: weatherRequest },
        { label: "Air Quality", request: airRequest },
    ];

    return (
        <section className="rounded-xl border border-[#E5E5E5] bg-white p-3">
            <div
                ref={dataInfoRef}
                className="relative flex items-center justify-between gap-2"
                onMouseLeave={(event) => {
                    if (!event.currentTarget.contains(document.activeElement)) {
                        setShowDataInfo(false);
                    }
                }}
                onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                        setShowDataInfo(false);
                    }
                }}
            >
                <h2 className="text-base font-semibold text-gray-800">
                    Environmental Data
                </h2>

                <button
                    type="button"
                    aria-label="About environmental data"
                    aria-describedby={showDataInfo ? dataInfoId : undefined}
                    onMouseEnter={() => setShowDataInfo(true)}
                    onFocus={() => setShowDataInfo(true)}
                    onClick={(event) => {
                        event.currentTarget.focus();
                        setShowDataInfo(true);
                    }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500"
                >
                    <Icon
                        iconName="Information"
                        height="18px"
                        width="18px"
                        fill="#687582"
                    />
                </button>

                {showDataInfo && (
                    <div
                        id={dataInfoId}
                        role="tooltip"
                        className="absolute inset-x-0 top-full z-[1100] pt-2"
                    >
                        <div className="rounded-lg bg-gray-900 p-3 text-xs leading-5 text-white shadow-xl">
                            <p className="font-semibold">Data details</p>
                            <p className="mt-1">
                                Estimated Heat Index is calculated from temperature
                                and humidity for shaded, light-wind conditions.
                            </p>
                            <p className="mt-2">
                                Air quality uses CAMS Global model estimates.
                                These values are not local monitoring-station
                                measurements or regional averages.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {!hasLocation ? (
                <p className="mt-2 text-sm text-gray-500">
                    Environmental data is unavailable for this location.
                </p>
            ) : (
                <>
                    <p className="mt-1 text-xs font-medium text-gray-700">
                        {locationLabel}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-500">
                        {latitude.toFixed(4)}, {longitude.toFixed(4)}
                    </p>
                    <p className="mb-2 mt-1 text-[10px] text-gray-500">
                        Current model estimates for the selected pin
                    </p>
                    <p className="mb-3 rounded-lg bg-blue-50 px-2 py-2 text-[11px] leading-4 text-blue-800">
                        Current conditions only. Environmental history for the selected {dateRange}-day period is not provided in this view.
                    </p>

                    <dl className="flex flex-col gap-1.5">
                        {metrics.map(({ label, value }) => (
                            <div
                                key={label}
                                className="flex items-center justify-between gap-2 rounded-lg bg-[#F5F5F5] px-2 py-2"
                            >
                                <dt className="min-w-0 text-xs leading-4 text-gray-500">
                                    {label}
                                </dt>
                                <dd className="max-w-[65%] break-words text-right text-xs font-semibold leading-4 text-gray-800">
                                    {value}
                                </dd>
                            </div>
                        ))}
                    </dl>

                    {requests
                        .filter(({ request }) => request.isError)
                        .map(({ label, request }) => (
                            <div
                                key={label}
                                role="alert"
                                className="mt-2 text-xs text-destructive-700"
                            >
                                <p>
                                    {label}:{" "}
                                    {typeof request.error?.data?.detail === "string"
                                        ? request.error.data.detail
                                        : request.error?.status === "TIMEOUT_ERROR"
                                            ? "Request timed out."
                                            : "Unable to load data."
                                    }
                                </p>
                                <button
                                    type="button"
                                    onClick={() => request.refetch()}
                                    className="mt-1 font-semibold underline"
                                >
                                    Retry {label.toLowerCase()}
                                </button>
                            </div>
                        ))
                    }

                    {(weatherRequest.isFetching || airRequest.isFetching) && (
                        <p role="status" className="mt-2 text-[10px] text-gray-500">
                            Loading or updating environmental data...
                        </p>
                    )}

                    <div className="mt-3 space-y-1 text-[10px] leading-4 text-gray-500">
                        <p>
                            Weather:{" "}
                            {weather?.data_time
                                ? `${weather.data_time.replace("T", " ")} PHT`
                                : "Unavailable"
                            }
                        </p>
                        <p>
                            Air:{" "}
                            {airQuality?.data_time
                                ? `${airQuality.data_time.replace("T", " ")} PHT`
                                : "Unavailable"
                            }
                        </p>
                        <p>
                            Sources:{" "}
                            <a
                                href="https://open-meteo.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                            >
                                Open-Meteo
                            </a>
                            {" · "}
                            <a
                                href="https://atmosphere.copernicus.eu/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline"
                            >
                                CAMS
                            </a>
                        </p>
                    </div>
                </>
            )}
        </section>
    );
};

export default EnvironmentalDataCard;