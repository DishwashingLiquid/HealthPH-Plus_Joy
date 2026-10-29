import { useEffect, useId, useRef, useState } from "react";
import Icon from "../Icon";
import { useFetchEnvironmentalHistoryQuery } from "../../features/api/environmentalDataSlice";

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
    const timeWindow = dateRange === "24h" ? { hours: 24 } : { days: dateRange };
    const timeLabel = dateRange === "24h" ? "Last 24 hours" : `Last ${dateRange} days`;

    const request = useFetchEnvironmentalHistoryQuery(
        { region, latitude, longitude, ...timeWindow },
        {
            skip: !hasLocation,
            pollingInterval: 600000,
            skipPollingIfUnfocused: true,
            refetchOnMountOrArgChange: true,
        }
    );

    const history = request?.isError ? null : request?.currentData;
    const weatherCoverage = history?.weather_coverage;
    const airCoverage = history?.air_quality_coverage;
    const weather = weatherCoverage?.status === "unavailable" ? null : history?.summary;
    const airQuality = airCoverage?.status === "unavailable" ? null : history?.summary;
    const noData = !request?.isFetching && !weather && !airQuality;

    const renderDetail = (value, width = "w-[80px]") =>
        request.isFetching ? (
            <>
                <span
                    aria-hidden="true"
                    className={`inline-block h-[12px] ${width} max-w-full animate-pulse rounded-[6px] bg-[#E4E7EB] align-middle motion-reduce:animate-none`}
                />
                <span className="sr-only">Loading...</span>
            </>
        ) : value;

    const displayValue = (ready, value) =>
        ready
            ? value
            : request?.isFetching
                ? "Loading..."
                : "Unavailable";

    const weatherValue = (value) =>
        displayValue(Boolean(weather), value);

    const airValue = (value) =>
        displayValue(Boolean(airQuality), value);

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
            label: "Precipitation",
            value: weatherValue(
                formatMeasurement(weather?.precipitation, " mm/h")
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

    const coverages = [
        { label: "Weather", coverage: weatherCoverage },
        { label: "Air quality", coverage: airCoverage },
    ];

    const periodDate = (value) => value
        ? new Date(value).toLocaleString("en-PH", {
            month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila",
            ...(dateRange === "24h" ? { hour: "2-digit", minute: "2-digit" } : {}),
        })
        : "";

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
                                Numeric values are averages of available hourly readings
                                at this pin over the selected date range, including
                                AQI and Estimated Heat Index. Wind uses mean speed
                                and a speed-weighted circular mean direction.
                                Conditions show the most frequent weather code;
                                categorical weather codes are not averaged.
                            </p>
                            <p className="mt-1">
                                Estimated Heat Index is calculated from temperature
                                and humidity for shaded, light-wind conditions.
                            </p>
                            <p className="mt-2">
                                Air quality uses CAMS Global model estimates.
                                These values are not local monitoring-station
                                measurements or regional averages.
                            </p>
                            <p className="mt-2">
                                Missing hours are excluded, not replaced with zero.
                                Today includes elapsed hours only. Precipitation
                                is the average completed hourly total, shown in mm/h.
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
                    <p className="mt-2 text-xs font-semibold text-gray-800">
                        Averages for selected date range · {timeLabel}
                    </p>
                    <p className="mb-3 mt-1 text-[11px] leading-4 text-gray-600">
                        {renderDetail(
                            history
                                ? `${periodDate(history.requested_start)} - ${periodDate(history.request_end)} (PHT)`
                                : timeLabel,
                            "w-[180px]"
                        )}
                    </p>

                    {noData ? (
                        <p role="status" className="py-3 text-sm text-gray-500">
                            No environmental data available for this location and date range.
                        </p>
                    ) : (
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
                                    {renderDetail(value)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    )}

                    {request?.isError && (
                        <p role="alert" className="mt-2 text-xs text-destructive-700">
                            {typeof request.error?.data?.detail === "string"
                                ? request.error.data.detail
                                : "Unable to load environmental history. Please try again."}
                        </p>
                    )}
                    {coverages.filter(({ coverage }) => coverage?.message).map(({ label, coverage }) => (
                        <p key={label} className="mt-2 text-[11px] leading-4 text-gray-600">
                            {label}: {coverage.message}
                        </p>
                    ))}
                    {(request?.isError || coverages.some(({ coverage }) => coverage && coverage.status !== "available")) && (
                        <button type="button" onClick={() => request.refetch()} className="mt-2 text-xs font-semibold underline">
                            Retry environmental history
                        </button>
                    )}

                    {request?.isFetching && (
                        <p role="status" className="sr-only">
                            Loading environmental history...
                        </p>
                    )}

                    <div className="mt-3 space-y-1 text-[10px] leading-4 text-gray-500">
                        {coverages
                            .filter(({ coverage }) => coverage || request.isFetching)
                            .map(({ label, coverage }) => (
                                <p key={label}>
                                    {label}:{" "}
                                    {renderDetail(
                                        coverage
                                            ? `${coverage.available_hours}/${coverage.expected_hours} hourly slots${
                                                coverage.last_time
                                                    ? ` · through ${coverage.last_time
                                                        .slice(0, 16)
                                                        .replace("T", " ")} PHT`
                                                    : ""
                                            }`
                                            : null,
                                        "w-[130px]"
                                    )}
                                </p>
                            ))
                        }
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
