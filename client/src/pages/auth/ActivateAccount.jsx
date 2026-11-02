import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import FieldGroup from "../../components/FieldGroup";
import InputPassword from "../../components/InputPassword";
import PasswordRequirements from "../../components/auth/PasswordRequirements";
import LoadingSkeleton from "../../components/LoadingSkeleton";
import { useActivateAccountMutation, useVerifyInvitationMutation } from "../../features/api/authAPISlice";

const errorMessage = (error, fallback) =>
  typeof error?.data?.detail === "string" ? error.data.detail : fallback;

const ActivateAccount = () => {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") || "");
  const [verifyInvitation] = useVerifyInvitationMutation();
  const [activateAccount, { isLoading: isSaving }] = useActivateAccountMutation();
  const [linkState, setLinkState] = useState("loading");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [flags, setFlags] = useState({ length: "", lowercase: "", uppercase: "", number: "", character: "" });
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let mounted = true;
    const verify = async () => {
      if (!token) {
        setError("This invitation is invalid. Ask your administrator to resend it.");
        setLinkState("invalid");
        return;
      }
      const result = await verifyInvitation(token);
      if (!mounted) return;
      if (result.error) {
        setError(errorMessage(result.error, "Unable to check your invitation. Please try again."));
        setLinkState("invalid");
      } else {
        setLinkState("valid");
      }
    };
    verify();
    return () => { mounted = false; };
  }, [token, verifyInvitation]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!Object.values(flags).every((value) => value === "success") || password.length > 72) {
      setError("Follow the password requirements below and use no more than 72 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    const result = await activateAccount({ token, password, re_password: confirmation });
    if (result.error) {
      setError(errorMessage(result.error, "Unable to activate your account. Please try again."));
      return;
    }
    setPassword("");
    setConfirmation("");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setComplete(true);
  };

  if (linkState === "loading") return <div aria-label="Checking invitation" className="flex flex-col gap-[16px]"><LoadingSkeleton className="h-[28px] w-3/4" /><LoadingSkeleton className="h-[44px] w-full" /></div>;
  if (complete) return <>
    <p className="heading">Your Account Is Ready</p>
    <p className="subheading">Your password has been saved and your account is activated. Sign in using your email and new password.</p>
    <p className="mb-[16px] text-sm text-[#687582]">If you are signed in to another account, sign out before signing in to this one.</p>
    <NavLink to="/login" className="prod-btn-base prod-btn-primary activation-primary-button w-full text-center">Go to Sign In</NavLink>
  </>;
  if (linkState === "invalid") return <>
    <p className="heading">Unable to Open Invitation</p>
    <p className="subheading" role="alert">{error}</p>
    <button type="button" className="prod-btn-base prod-btn-primary activation-primary-button w-full" onClick={() => window.location.reload()}>Try Again</button>
    <NavLink to="/login" className="mt-[16px] block text-center text-[#32418C] hover:underline">Back to Sign In</NavLink>
  </>;

  return <>
    <p className="heading">Activate Your Account</p>
    <p className="subheading">Create your own password to start using HealthPH+.</p>
    {error && <p role="alert" className="mb-[12px] text-[#B42318]">{error}</p>}
    <form onSubmit={submit}>
      <FieldGroup label="New Password" labelFor="activation-password" additionalClasses="mb-[8px]">
        <InputPassword id="activation-password" size="input-md" additionalClasses="mt-[8px] w-full" placeholder="Enter new password" autoComplete="new-password" value={password} maxLength={72} disabled={isSaving} onChange={(event) => setPassword(event.target.value)} />
      </FieldGroup>
      <PasswordRequirements password={password} pwdFlags={flags} handleChange={setFlags} />
      <FieldGroup label="Confirm Password" labelFor="activation-confirmation" additionalClasses="mb-[16px]">
        <InputPassword id="activation-confirmation" size="input-md" additionalClasses="mt-[8px] w-full" placeholder="Re-enter password" autoComplete="new-password" value={confirmation} maxLength={72} disabled={isSaving} onChange={(event) => setConfirmation(event.target.value)} />
      </FieldGroup>
      <button type="submit" disabled={isSaving} className="prod-btn-base prod-btn-primary activation-primary-button mt-[12px] w-full">{isSaving ? "Activating..." : "Set Password & Activate"}</button>
    </form>
  </>;
};

export default ActivateAccount;
