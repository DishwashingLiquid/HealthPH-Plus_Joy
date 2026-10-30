import { useEffect, useMemo, useRef, useState } from "react";
import { divIcon, polygon } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
    MapContainer,
    Marker,
    Polygon,
    TileLayer,
} from "react-leaflet";

import Icon from "../Icon";
import EnvironmentalDataCard from "./EnvironmentalDataCard";
import LoadingSkeleton from "../LoadingSkeleton";

import Regions from "../../assets/data/regions.json";
import RegionsCoordinates from "../../assets/data/regions_coordinates.json";

const STACKED_PANEL_WIDTH = 768;

const CONDITIONS = [
    { code: "TB", label: "Tuberculosis" },
    { code: "PN", label: "Pneumonia" },
    { code: "COVID", label: "COVID-19" },
    { code: "AURI", label: "AURI" },
];

const createPin = (selected) =>
    divIcon({
        className: "surveillance-location-pin",
        iconSize: [32, 40],
        iconAnchor: [16, 39],
        html: `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="40"
                viewBox="0 0 48 60"
                aria-hidden="true"
                style="filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))"
            >
                <path
                d="M24 57C19 49 5 34 5 23a19 19 0 1 1 38 0c0 11-14 26-19 34Z"
                fill="${selected ? "#991B1B" : "#DC2626"}"
                stroke="${selected ? "#FBD117" : "#FFFFFF"}"
                stroke-width="3"
                />
                <circle cx="24" cy="23" r="7" fill="#FFFFFF"/>
            </svg>
        `
    });

    const DEFAULT_PIN = createPin(false);
    const SELECTED_PIN = createPin(true);

    const pointKey = (point) =>
        `${point.region || "unknown"}:${point.lat}:${point.long}`;

    const regionLabel = (region) =>
        Regions.regions.find(({ value }) => value === region)?.label ||
        region ||
        "Region unavailable";

    const countValue = (value) => {
        const count = Number(value);
        return Number.isFinite(count) && count > 0 ? count : 0;
    };

    const mapPanelPadding = (map) => {
        if (map.getSize().x < STACKED_PANEL_WIDTH) {
            return { paddingTopLeft: [24, 32], paddingBottomRight: [24, 48] };
        }

        const panelWidth = Math.min(260, map.getSize().x * 0.26);

        return {
            paddingTopLeft: [Math.ceil(panelWidth) + 24, 32],
            paddingBottomRight: [Math.ceil(panelWidth) + 24, 48],
        };
    };

    const SurveillanceMap = ({
        filters,
        highlightRegion = null,
        center = [13, 122],
        points = [],
        isPointsLoading = false,
        isPointsError = false,
        onRetry,
    }) => {
        const [map, setMap] = useState(null);
        const [selectedKey, setSelectedKey] = useState(null);
        const lastViewportKey = useRef(null);
        const [mapSizeKey, setMapSizeKey] = useState("");
        const panelsStacked = !mapSizeKey || Number(mapSizeKey.split(":")[0]) < STACKED_PANEL_WIDTH;

        const visiblePoints = useMemo(() => {
            if (isPointsLoading || isPointsError) return [];

            return points.filter((point) => {
                const lat = Number(point.lat);
                const long = Number(point.long);

                return (
                    Number.isFinite(lat) &&
                    Number.isFinite(long) &&
                    lat >= 4 &&
                    lat <= 22 &&
                    long >= 116 &&
                    long <= 128
                );
            });
        }, [points, isPointsLoading, isPointsError]);

        const selectedPoint = 
            visiblePoints.find((point) => pointKey(point) === selectedKey) || null;

        const selectedRegionCode =
            filters.region.length === 1
                ? filters.region[0].value
                : null;

        const centerLat = center[0];
        const centerLong = center[1];

        // Keep Leaflet aware of the fixed windows actual dimes.
        useEffect(() => {
            if (!map) return;

            const updateSize = () => {
                map.invalidateSize({ pan: false });

                const { x, y } = map.getSize();

                if (x > 0 && y > 0) {
                    setMapSizeKey(`${x}:${y}`);
                }
            };

            const observer = new ResizeObserver(updateSize);

            observer.observe(map.getContainer());
            updateSize();

            return () => observer.disconnect();
        }, [map]);

        // Reframe for region selection or a resized map window.
        // Pin selection and data refreshes do not reset manual zoom.
        useEffect(() => {
            if (!map || !mapSizeKey) return;

            const viewportKey = [
                selectedRegionCode || "all",
                mapSizeKey,
                centerLat,
                centerLong,
            ].join(":");

            if (lastViewportKey.current === viewportKey) return;

            lastViewportKey.current = viewportKey;

            const regionShape = RegionsCoordinates.find(
                ({ id }) => id === selectedRegionCode
            );

            map.stop();

            if (regionShape) {
                const bounds = polygon(
                    regionShape.coordinates
                ).getBounds();

                map.fitBounds(bounds, {
                    ...mapPanelPadding(map),
                    maxZoom: 8,
                    animate: true,
                    duration: 0.35,
                });

                return;
            }

            map.setView(
                [centerLat, centerLong],
                6,
                { animate: true }
            );
        }, [
            map,
            mapSizeKey,
            selectedRegionCode,
            centerLat,
            centerLong,
        ]);

        // Close details when filtering removes the selected location.
        // Preserve selection during a normal data refresh.
        useEffect(() => {
            if (
                !isPointsLoading &&
                selectedKey &&
                !selectedPoint
            ) {
                setSelectedKey(null);
            }
        }, [isPointsLoading, selectedKey, selectedPoint]);

        // A region change clears the shared pin selection and both panels.
        useEffect(() => {
            setSelectedKey(null);
        }, [selectedRegionCode]);

        const labelCount = CONDITIONS.reduce(
            (total, { code }) =>
                total + countValue(selectedPoint?.annotations_count?.[code]),
            0
        );

        return (
            <div
                className="relative isolate h-full w-full"
                style={{ "--map-panel-width": "min(260px, 26%)" }}
            >
                <MapContainer
                    ref={setMap}
                    center={center}
                    zoom={6}
                    minZoom={5}
                    maxZoom={14}
                    maxBounds={[[4, 116], [22, 128]]}
                    maxBoundsViscosity={1}
                    zoomControl={false}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        zIndex: 0,
                    }}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {highlightRegion &&
                        RegionsCoordinates.map(({ id, coordinates, attribution }) =>
                            id === highlightRegion ? (
                                <Polygon
                                    key={id}
                                    positions={coordinates}
                                    attribution={attribution}
                                    interactive={false}
                                    pathOptions={{
                                        color: "#32418C",
                                        fill: false,
                                        weight: 3,
                                    }}
                                />
                            ) : null
                        )}

                    {visiblePoints.map((point) => {
                        const key = pointKey(point);

                        return (
                            <Marker
                                key={key}
                                position={[Number(point.lat), Number(point.long)]}
                                icon={key === selectedKey ? SELECTED_PIN : DEFAULT_PIN}
                                zIndexOffset={key === selectedKey ? 1000 : 0}
                                title={`View disease signals: ${regionLabel(point.region)}`}
                                alt="Disease signal location"
                                keyboard
                                eventHandlers={{
                                    click: () => {
                                        setSelectedKey(key);

                                        if (!map) return;

                                        const coordinates = [
                                            Number(point.lat),
                                            Number(point.long),
                                        ];

                                        map.stop();

                                        map.fitBounds(
                                            [coordinates, coordinates],
                                            {
                                                ...mapPanelPadding(map),
                                                maxZoom: Math.max(
                                                    map.getZoom(),
                                                    9
                                                ),
                                                animate: true,
                                                duration: 1.8,
                                            }
                                        );
                                    },
                                }}
                            />
                        );
                    })}
                </MapContainer>

                {/* SELECTED LOCATION PANELS INSIDE THE MAP */}
                {selectedPoint ? (
                    <>
                        <div
                            className={panelsStacked
                                ? "absolute inset-3 z-[1100] flex flex-col gap-3 overflow-y-auto overscroll-contain rounded-xl"
                                : "pointer-events-none absolute inset-0 z-[1000]"}
                        >
                            <section
                                aria-label="Selected location details"
                                className={`pointer-events-auto min-w-0 shrink-0 rounded-xl border border-gray-200 bg-white p-3 shadow-xl ${
                                    panelsStacked ? "w-full" : "absolute right-3 top-3 max-h-[calc(100%_-_11rem)] overflow-y-auto"
                                }`}
                                style={panelsStacked ? undefined : { width: "var(--map-panel-width)" }}
                            >
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div className="min-w-0 break-words">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                                            Selected location
                                        </p>
                                        <h3 className="mt-1 text-lg font-semibold text-gray-900">
                                            {regionLabel(selectedPoint.region)}
                                        </h3>
                                        {selectedPoint.province && (
                                            <p className="mt-1 text-sm text-gray-600">
                                                {selectedPoint.province}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        aria-label="Close location details"
                                        onClick={() => setSelectedKey(null)}
                                        className={`flex shrink-0 items-center justify-center rounded-lg border border-gray-200 text-xl text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 ${panelsStacked ? "h-11 w-11" : "h-9 w-9"}`}
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="rounded-lg px-3">
                                    <p className="text-sm text-gray-600">
                                        Total Reports
                                    </p>
                                    <p className="mt-1 text-3xl font-semibold text-gray-900">
                                        {Number.isFinite(selectedPoint.report_count)
                                            ? selectedPoint.report_count.toLocaleString()
                                            : "Unavailable"
                                        }
                                    </p>
                                </div>
                                <div className="rounded-lg bg-red-50 px-3">
                                    <p className="text-sm text-gray-600">
                                        Disease label detections
                                    </p>
                                    <p className="mt-1 text-[26px] font-semibold text-red-700">
                                        {labelCount.toLocaleString()}
                                    </p>
                                </div>

                                <p className="mt-2 text-sm font-semibold text-gray-900">
                                    Breakdown at this location
                                </p>

                                <dl>
                                    {CONDITIONS.map(({ code, label }) => (
                                        <div
                                            key={code}
                                            className="flex items-center justify-between border-b border-gray-100 py-2 text-sm"
                                        >
                                            <dt className="text-gray-600">{label}</dt>
                                            <dd className="font-semibold text-gray-900">
                                                {countValue(
                                                    selectedPoint.annotations_count?.[code]
                                                ).toLocaleString()}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>

                                <p className="mt-4 text-xs leading-5 text-gray-500">
                                    A report may contribute to more than one disease label.
                                    Select another pin to change the displayed location.
                                </p>
                            </section>
                            <aside
                                aria-label="Environmental data"
                                className={`pointer-events-auto min-w-0 shrink-0 rounded-xl shadow-xl ${
                                    panelsStacked ? "w-full" : "absolute left-3 top-3 max-h-[calc(100%_-_1.5rem)] overflow-y-auto"
                                }`}
                                style={panelsStacked ? undefined : { width: "var(--map-panel-width)" }}
                            >
                                <EnvironmentalDataCard
                                    region={selectedPoint.region}
                                    latitude={Number(selectedPoint.lat)}
                                    longitude={Number(selectedPoint.long)}
                                    locationLabel={[
                                        selectedPoint.province,
                                        regionLabel(selectedPoint.region),
                                    ].filter(Boolean).join(", ")}
                                    dateRange={filters.dateRange}
                                />
                            </aside>
                        </div>

                    </>
                ) : (
                    <div
                        role={isPointsError ? "alert" : "status"}
                        className="pointer-events-none absolute left-3 top-3 z-[1000] w-max whitespace-normal rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-md"
                        style={{ maxWidth: "calc(100% - 24px)" }}
                    >
                        {isPointsLoading
                            ? <LoadingSkeleton className="h-[14px] w-[200px]" label="Loading map locations..." />
                            : isPointsError
                                ? "Unable to load map locations."
                                : visiblePoints.length === 0
                                    ? "No mapped locations match the current filters."
                                    : "Select a red pin to view disease signals and environmental data for the selected period."
                        }

                        {isPointsError && onRetry && (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="pointer-events-auto ml-2 font-semibold text-[#32418C] underline"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                )}

                {/* MAP CONTROLS */}
                <div className="absolute bottom-8 right-3 z-[1000] flex flex-col overflow-hidden rounded-lg border border-gray-300 bg-white shadow-md">
                    <button
                        type="button"
                        title="Recenter map"
                        aria-label="Recenter map"
                        disabled={!map}
                        onClick={() => {
                            if (!map) return;

                            setSelectedKey(null);
                            map.stop();
                            map.setView(
                                [centerLat, centerLong],
                                6,
                                { animate: true }
                            );
                        }}
                        className="flex h-10 w-10 items-center justify-center border-b border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                    >
                        <Icon
                            iconName="CurrentLocation"
                            height="20px"
                            width="20px"
                            fill="#465360"
                        />
                    </button>
                    <button
                        type="button"
                        title="Zoom in"
                        aria-label="Zoom in"
                        disabled={!map}
                        onClick={() => map?.zoomIn()}
                        className="flex h-10 w-10 items-center justify-center border-b border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                    >
                        <Icon
                            iconName="Plus"
                            height="20px"
                            width="20px"
                            fill="#465360"
                        />
                    </button>
                    <button
                        type="button"
                        title="Zoom out"
                        aria-label="Zoom out"
                        disabled={!map}
                        onClick={() => map?.zoomOut()}
                        className="flex h-10 w-10 items-center justify-center hover:bg-gray-100 disabled:opacity-50"
                    >
                        <Icon
                            iconName="Minus"
                            height="20px"
                            width="20px"
                            fill="#465360"
                        />
                    </button>
                </div>


            </div>
        );
    };

export default SurveillanceMap;
