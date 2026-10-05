export const ALERT_AUTOMATION_INTERVALS = Object.freeze([
  { minutes: 15, label: "15 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 480, label: "8 hours" },
  { minutes: 720, label: "12 hours" },
  { minutes: 1440, label: "24 hours" },
]);

const intervalValues = new Set(ALERT_AUTOMATION_INTERVALS.map(({ minutes }) => minutes));

export const normalizeAlertAutomationInterval = (value) => {
  const interval = Number(value);
  return intervalValues.has(interval) ? interval : 1440;
};

export const getRunEvaluationControlState = (settings, isRunning = false) => {
  const enabled = Boolean(settings?.enabled);

  return {
    enabled,
    disabled: !enabled || isRunning,
    intervalMinutes: normalizeAlertAutomationInterval(settings?.intervalMinutes),
    helperText: enabled ? "" : "Enable automation in Alert Settings to run an evaluation.",
  };
};
