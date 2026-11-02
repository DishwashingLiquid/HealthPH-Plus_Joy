/* eslint-disable react/prop-types */
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useResendInvitationMutation } from "../../features/api/userSlice";
import Snackbar from "../Snackbar";
import { accountStatusLabel } from "../../utils/accountStatus";

export const ResendInvitationButton = ({ account, disabled = false, emailChanged = false, onLoadingChange }) => {
  const currentUser = useSelector((state) => state.auth.user);
  const [resendInvitation, { isLoading }] = useResendInvitationMutation();
  const canResend = !account.is_disabled && account.activation_pending && (
    currentUser?.user_type === "SUPERADMIN" || (
      currentUser?.role_label === "Admin" && account.user_type !== "SUPERADMIN" && account.role_label !== "Admin"
    )
  );
  const resend = async (event) => {
    event.stopPropagation();
    onLoadingChange?.(true);
    try {
      const result = await resendInvitation(account.id);
      const detail = result.error?.data?.detail;
      toast(<Snackbar size="snackbar-sm" iconName={result.error ? "Error" : "CheckCircle"} color={result.error ? "destructive" : "success"} message={result.error ? (typeof detail === "string" ? detail : "Unable to send invitation. Please try again.") : result.data.message} />);
    } finally {
      onLoadingChange?.(false);
    }
  };
  if (!canResend) return null;
  return <button
    type="button"
    disabled={disabled || isLoading || emailChanged}
    onClick={resend}
    title={emailChanged ? "Update the account to save the new email before resending its invitation." : undefined}
    className="whitespace-nowrap text-xs font-medium text-[#32418C] underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
  >{isLoading ? "Sending..." : "Resend Invitation"}</button>;
};

const AccountStatus = ({ account, showDeliveryNote = true }) => {
  const colors = account.is_disabled ? "bg-[#FEF2F2] text-[#B42318]" : account.activation_pending ? "bg-[#FFFAEB] text-[#B54708]" : "bg-[#ECFDF3] text-[#027A48]";
  return <div className="flex flex-col items-start gap-[8px]">
    <span className={`whitespace-nowrap rounded-full px-[8px] py-[4px] text-xs font-medium ${colors}`}>{accountStatusLabel(account)}</span>
    {showDeliveryNote && account.activation_pending && account.invitation_email_sent === false && <span className="text-xs text-[#B42318]">Invitation not sent</span>}
  </div>;
};

export default AccountStatus;
