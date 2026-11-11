export const alertStatusLabel = (alert) => {
  if (alert.automated) {
    if (alert.status === "Preparing") return "Preparing alert";
    if (alert.status === "Preparation failed") return "Preparation incomplete";
    if (["Published", "Prepared"].includes(alert.status)) {
      if (alert.inboxAssignmentCount == null) return "App inbox availability unknown";
      return alert.inboxAssignmentCount > 0 ? "Available in app inboxes" : "Ready — no app inboxes assigned";
    }
  } else {
    if (alert.status === "Sent") return "Recipients queued — older alert";
    if (alert.status === "Sending") return "Adding recipients";
  }
  return alert.status;
};

export const recipientAssignmentLabel = (alert) => {
  const count = alert.recipientCount;
  const recipients = count == null ? "Recipient count unavailable." : `${Number(count).toLocaleString()} ${Number(count) === 1 ? "recipient" : "recipients"}.`;
  if (alert.automated && ["Published", "Prepared"].includes(alert.status) && alert.inboxAssignmentCount != null) {
    const inboxCount = Number(alert.inboxAssignmentCount);
    return `${recipients} ${inboxCount === 0 ? "No app inboxes assigned." : `Available in ${inboxCount.toLocaleString()} app ${inboxCount === 1 ? "inbox" : "inboxes"}.`}`;
  }
  const availability = alert.automated ? ({
    Preparing: "The alert is being prepared for app inboxes.",
    "Preparation failed": "Some recipients could not be added. App inbox availability is unknown.",
  }[alert.status] || "App inbox availability is unknown.") : ({
    Scheduled: "Recipients have not been added yet.",
    Sending: "Recipients are being added. App inbox availability is unknown.",
    Sent: "App inbox availability is unknown.",
    Cancelled: "This alert was cancelled.",
  }[alert.status] || "App inbox availability is unknown.");
  return `${recipients} ${availability}`;
};
