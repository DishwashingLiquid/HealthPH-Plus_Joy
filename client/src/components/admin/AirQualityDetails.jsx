import {
    useFetchCurrentAirQualityQuery,
} from "../../features/api/environmentalDataSlice";

const formatMeasurement = (value, unit = "") =>
    Number.isFinite(value)
        ? `${value.toLocaleString("en-PH", {
            maximumFractionDigits: 2,
        })}${unit}`
        : "Unavailable";

const AirQualityDetails = ({ region }) => {
    const {
        currentData,
        isFetching,
        isError,
        error,
        refetch,
    } = useFetchCurrentAirQualityQuery(region, {
        skip: !region,
        pollingInterval: 600000,
        skipPollingIfUnfocused: true,
        refetchOnMountOrArgChange: true,
    });

    const airQuality = currentData?.air_quality;

    let content = (
        <p role="status" className="text-sm text-gray-500">
            Loading air quality...
        </p>
    );

    if (isError || (!isFetching && !airQuality)) {
        const message =
            typeof error?.data?.detail === "string"
                ? error.data.detail
                : error?.status === "TIMEOUT_ERROR"
                    ? "The air-quality request timed out. Please try again."
                    : "Unable to load air quality. Please try again.";

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
    } else if (airQuality) {
        const metrics = [
            {
                label: "Air Quality Index (US AQI)",
                value: formatMeasurement(airQuality.us_aqi),
            },
            {
                label: "PM2.5",
                value: formatMeasurement(airQuality.pm25, " µg/m³"),
            },
        ];

        content = (
            <>
                <p className="mb-3 text-xs text-gray-500">
                    Reference city: {currentData.reference_location.name}.
                    {" "}CAMS Global model estimates at approximately
                    {" "}{airQuality.spatial_resolution_km} km resolution.
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
                        {airQuality.data_time?.replace("T", " ") ?? "Unavailable"}
                        {" "}PHT
                    </p>
                    <p>
                        Air quality data by{" "}
                        <a 
                            href="https://open-meteo.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                        >
                            Open-Meteo
                        </a>
                        {" "}and{" "}
                        <a 
                            href="https://atmosphere.copernicus.eu/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline"
                        >
                            CAMS
                        </a>
                    </p>
                    {isFetching && (
                        <p role="status">Updating air quality...</p>
                    )}
                </div>
            </>
        );
    }

    return (
        <section className="mt-4 border-t border-[#E5E5E5] pt-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-800">
                Air Quality
            </h3>
            {content}
        </section>
    );
};

export default AirQualityDetails;