import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import LoadingSkeleton from "../LoadingSkeleton";
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
    const [dataInfoPosition, setDataInfoPosition] = useState(null);
    const cardRef = useRef(null);
    const dataInfoRef = useRef(null);
    const tooltipRef = useRef(null);
    const closeInfoTimer = useRef(null);
    const infoHovered = useRef(false);
    const dataInfoId = useId();

    const openDataInfo = () => {
        clearTimeout(closeInfoTimer.current);
        setShowDataInfo(true);
    };

    const scheduleCloseDataInfo = () => {
        clearTimeout(closeInfoTimer.current);
        closeInfoTimer.current = setTimeout(() => {
            if (
                !infoHovered.current
                && !dataInfoRef.current?.contains(document.activeElement)
                && !tooltipRef.current?.contains(document.activeElement)
            ) {
                setShowDataInfo(false);
            }
        }, 150);
    };

    useEffect(() => () => clearTimeout(closeInfoTimer.current), []);

    // Render outside the scrolling map panel, then anchor beside the card.
    useLayoutEffect(() => {
        if (!showDataInfo) return;

        const updatePosition = () => {
            if (!cardRef.current || !dataInfoRef.current || !tooltipRef.current) return;

            const card = cardRef.current.getBoundingClientRect();
            const header = dataInfoRef.current.getBoundingClientRect();
            const width = Math.min(320, window.innerWidth - 24);
            const right = card.right + 8;
            const left = card.left - width - 8;
            const x = right + width <= window.innerWidth - 12
                ? right
                : left >= 12 ? left : Math.max(12, window.innerWidth - width - 12);
            const height = tooltipRef.current.getBoundingClientRect().height;
            const y = Math.max(12, Math.min(header.top, window.innerHeight - height - 12));

            setDataInfoPosition((previous) =>
                previous?.left === x && previous?.top === y && previous?.width === width
                    ? previous : { left: x, top: y, width }
            );
        };

        updatePosition();
        const observer = new ResizeObserver(updatePosition);
        observer.observe(cardRef.current);
        observer.observe(tooltipRef.current);
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);

        return () => {
            observer.disconnect();
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [showDataInfo]);

    useEffect(() => {
        if (!showDataInfo) return;

        const closeOutside = (event) => {
            if (
                !dataInfoRef.current?.contains(event.target)
                && !tooltipRef.current?.contains(event.target)
            ) {
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
            <LoadingSkeleton className={`h-[12px] ${width}`} />
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
        <section ref={cardRef} className="rounded-xl border border-[#E5E5E5] bg-white p-3">
            <div
                ref={dataInfoRef}
                className="relative flex items-center justify-between gap-2"
                onMouseLeave={() => {
                    infoHovered.current = false;
                    scheduleCloseDataInfo();
                }}
                onBlur={(event) => {
                    if (
                        !event.currentTarget.contains(event.relatedTarget)
                        && !tooltipRef.current?.contains(event.relatedTarget)
                    ) {
                        scheduleCloseDataInfo();
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
                    onMouseEnter={() => {
                        infoHovered.current = true;
                        openDataInfo();
                    }}
                    onFocus={openDataInfo}
                    onClick={(event) => {
                        event.currentTarget.focus();
                        openDataInfo();
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

                {showDataInfo && createPortal(
                    <div
                        ref={tooltipRef}
                        id={dataInfoId}
                        role="tooltip"
                        className="fixed z-[2000] max-h-[calc(100dvh_-_24px)] overflow-y-auto rounded-lg bg-gray-900 text-white shadow-xl"
                        style={{
                            ...dataInfoPosition,
                            width: dataInfoPosition?.width ?? "min(320px, calc(100vw - 24px))",
                            visibility: dataInfoPosition ? "visible" : "hidden",
                        }}
                        onMouseEnter={() => {
                            infoHovered.current = true;
                            clearTimeout(closeInfoTimer.current);
                        }}
                        onMouseLeave={() => {
                            infoHovered.current = false;
                            scheduleCloseDataInfo();
                        }}
                    >
                        <div className="p-3 text-xs leading-5">
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
                    </div>,
                    document.body
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
                    <p className="mt-2 text-xs font-semibold text-gray-800">
                        Averages for the {timeLabel}
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
