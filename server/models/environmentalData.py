"""Shared response contracts for dashboard and public mobile environmental data."""

from typing import Literal

from pydantic import BaseModel, Field


class ReferenceLocation(BaseModel):
    name: str
    latitude: float
    longitude: float


class EnvironmentalLocation(BaseModel):
    region: str = Field(description="Canonical supported region code, such as NCR or IVA.")
    region_name: str
    reference_location: ReferenceLocation


class EnvironmentalLocationsResponse(BaseModel):
    items: list[EnvironmentalLocation]


class WeatherAttribution(BaseModel):
    label: str
    url: str


class AirQualityAttribution(WeatherAttribution):
    cams_url: str


class WeatherData(BaseModel):
    provider: str
    timezone: str
    data_time: str = Field(description="Model-valid local ISO 8601 time in timezone; not UTC or retrieval time.")
    interval_seconds: int | None
    temperature: float | None = Field(description="Air temperature in degrees Celsius.")
    relative_humidity: float | None = Field(description="Relative humidity in percent.")
    feels_like: float | None = Field(description="Open-Meteo apparent temperature, in degrees Celsius.")
    estimated_heat_index: float | None = Field(description="Backend-calculated NWS heat index, in degrees Celsius.")
    heat_index_method: str
    heat_index_assumptions: str
    wind_speed: float | None = Field(description="Wind speed at 10 m, in km/h.")
    wind_direction: float | None = Field(description="Wind direction from which wind blows, in degrees clockwise from north.")
    precipitation: float | None = Field(description="Millimetres over the preceding interval_seconds, not a daily total.")
    weather_code: int | None = Field(description="WMO weather interpretation code.")
    units: dict[str, str | None] = Field(description="Provider variable-name unit keys plus estimated_heat_index.")


class AirQualityData(BaseModel):
    provider: str
    model: str
    data_type: Literal["model_estimate"]
    spatial_resolution_km: float
    timezone: str
    data_time: str = Field(description="Model-valid local ISO 8601 time in timezone; may differ from weather time.")
    pm25: float | None = Field(description="PM2.5 concentration in micrograms per cubic metre.")
    us_aqi: float | None = Field(description="US AQI scale; not a Philippine station observation.")
    units: dict[str, str | None]


class WeatherResponse(EnvironmentalLocation):
    data_type: Literal["model_estimate"]
    weather: WeatherData
    attribution: WeatherAttribution


class AirQualityResponse(EnvironmentalLocation):
    data_type: Literal["model_estimate"]
    air_quality: AirQualityData
    attribution: AirQualityAttribution


class EnvironmentalErrorResponse(BaseModel):
    detail: str


class EnvironmentalPeriodSummary(BaseModel):
    temperature: float | None = Field(description="Mean of available hourly temperatures, degrees Celsius.")
    relative_humidity: float | None = Field(description="Mean of available hourly relative humidity, percent.")
    estimated_heat_index: float | None = Field(description="Mean heat index calculated from paired hourly temperature/humidity, degrees Celsius.")
    wind_speed: float | None = Field(description="Mean wind speed, km/h.")
    wind_direction: float | None = Field(description="Speed-weighted circular mean wind direction; null when undefined.")
    precipitation: float | None = Field(description="Mean of available completed hourly precipitation totals, expressed as mm/h.")
    weather_code: int | None = Field(description="Most frequent available hourly WMO weather code.")
    us_aqi: float | None = Field(description="Mean available hourly US AQI over the selected period.")
    pm25: float | None = Field(description="Mean available hourly PM2.5 concentration, micrograms per cubic metre.")


class EnvironmentalHistoryCoverage(BaseModel):
    status: Literal["available", "partial", "unavailable"]
    available_hours: int
    expected_hours: int
    sample_counts: dict[str, int]
    first_time: str | None
    last_time: str | None
    message: str | None


class EnvironmentalHistoryResponse(EnvironmentalLocation):
    data_type: Literal["model_estimate"]
    timezone: str
    days: int
    hours: Literal[24] | None = Field(default=None, description="24 for a rolling 24-hour window; null for calendar-day ranges.")
    requested_start: str
    requested_end: str
    generated_at: str
    summary: EnvironmentalPeriodSummary
    weather_coverage: EnvironmentalHistoryCoverage
    air_quality_coverage: EnvironmentalHistoryCoverage
    attribution: AirQualityAttribution
