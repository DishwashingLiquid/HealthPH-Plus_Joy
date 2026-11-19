export const accountStatusLabel = (account) =>
  account.is_disabled ? "Disabled" : account.activation_pending ? "Pending Activation" : "Active";
