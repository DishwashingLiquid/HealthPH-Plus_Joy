export const ALERT_AUTOMATION_INTERVALS = Object.freeze([
  { minutes: 15, label: "15 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 480, label: "8 hours" },
  { minutes: 720, label: "12 hours" },
  { minutes: 1440, label: "24 hours" },
]);

const intervalValues = new Set(ALERT_AUTOMATION_INTERVALS.map(({ minutes }) => minutes));

// Local strict guard: shared navigation deliberately supports older sessions.
export const hasDiseaseWatchFeedAccess = (user) => Boolean(
  user && !user.is_disabled && !user.activation_pending && (
    user.user_type === "SUPERADMIN" || (
      Array.isArray(user.accessible_pages) && user.accessible_pages.includes("Disease Watch Feed")
    )
  )
);

export const hasSavedAlertSettings = (settings) => Boolean(
  settings && typeof settings.enabled === "boolean" &&
  Number.isInteger(settings.threshold) && settings.threshold > 0 &&
  intervalValues.has(settings.intervalMinutes)
);

export const alertIntervalLabel = (minutes) =>
  ALERT_AUTOMATION_INTERVALS.find((item) => item.minutes === Number(minutes))?.label || "Unavailable";

export const getRunEvaluationControlState = (settings, isRunning = false) => {
  const available = hasSavedAlertSettings(settings);
  const enabled = available && settings.enabled;

  return {
    enabled,
    disabled: !enabled || isRunning,
    intervalMinutes: available ? settings.intervalMinutes : null,
    helperText: !available ? "Saved alert settings are unavailable. Load settings before checking reports." : enabled ? "" : "Turn on automatic alerts in Set Up Alerts before checking reports.",
  };
};
