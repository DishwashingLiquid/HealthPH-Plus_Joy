from math import isfinite, sqrt


def calculate_heat_index(temperature_c, relative_humidity):
    """Return estimated heat index in Celsius using the NWS method."""
    values = (temperature_c, relative_humidity)

    if any(
        isinstance(value, bool) or not isinstance(value, (int, float))
        for value in values
    ):
        return None

    if (
        not all(isfinite(value) for value in values)
        or not 0 <= relative_humidity <= 100
    ):
        return None

    t = temperature_c * 9 / 5 + 32
    rh = relative_humidity

    simple = 0.5 * (
        t + 61 + (t - 68) * 1.2 + rh * 0.094
    )
    heat_index = (simple + t) / 2

    if heat_index >= 80:
        heat_index = (
            -42.379
            + 2.04901523 * t
            + 10.14333127 * rh
            - 0.22475541 * t * rh
            - 0.00683783 * t * t
            - 0.05481717 * rh * rh
            + 0.00122874 * t * t * rh
            + 0.00085282 * t * rh * rh
            - 0.00000199 * t * t * rh * rh
        )

        if rh < 13 and 80 <= t <= 112:
            heat_index -= (
                (13 - rh) / 4
                * sqrt((17 - abs(t - 95)) / 17)
            )
        elif rh > 85 and 80 <= t <= 87:
            heat_index += (
                (rh - 85) / 10 * (87 - t) / 5
            )

    return round((heat_index - 32) * 5 / 9, 1)