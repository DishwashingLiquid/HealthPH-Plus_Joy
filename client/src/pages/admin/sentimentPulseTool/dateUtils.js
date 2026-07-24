export const formatDateTimeLocalValue = (date) => {
  const pad = (value) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const getDefaultScheduleDateTime = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 15);
  date.setSeconds(0, 0);

  return formatDateTimeLocalValue(date);
};

export const formatSurveyDate = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};
