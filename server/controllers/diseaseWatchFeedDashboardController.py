"""Permission-protected dashboard adapters over the existing report readers.

Shared export/map APIs retain their original policies and consumers.
"""
from typing import Annotated

from fastapi import Depends

from controllers import diseaseWatchFeedController as reports
from controllers.regionalAlertsController import require_regional_alert_user


async def fetch_dashboard_self_reports(
    user: Annotated[dict, Depends(require_regional_alert_user)],
):
    return await reports.export_mobile_self_reports(str(user["_id"]), format="json")


async def fetch_dashboard_map_pins(
    _user: Annotated[dict, Depends(require_regional_alert_user)],
    region: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    return await reports.fetch_mobile_self_reports_map_pins(region, date_from, date_to)


async def fetch_dashboard_user_analytics(
    user: Annotated[dict, Depends(require_regional_alert_user)],
    region: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    return await reports.fetch_mobile_user_analytics_summary(user, region, date_from, date_to)
