import { NavLink, useNavigate } from "react-router-dom";
import Icon from "../../components/Icon";
import { useState } from "react";
import FieldGroup from "../../components/FieldGroup";
import Input from "../../components/Input";
import InputPassword from "../../components/InputPassword";
import { useDispatch, useSelector } from "react-redux";
import { updateUser } from "../../features/auth/authSlice";
import { useUpdateEmailMutation } from "../../features/api/userSlice";
import { showToast } from "../../utils/notificationHelpers";
import {
    getRequestErrorMessage,
    getRequestFormErrors,
} from "../../utils/apiErrorHelpers";
import { saveSessionUser } from "../../utils/authSession";

const EditEmail = () => {
  const user = useSelector((state) => state.auth.user);

  const [formData, setFormData] = useState({
    id: user.id,
    email: "",
    password: "",
  });

  const [formErrors, setFormErrors] = useState({
    email: "",
    password: "",
  });

  const [updateEmail] = useUpdateEmailMutation();

  const navigate = useNavigate();

  const dispatch = useDispatch();

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (checkError()) return;

    const failureMessage = "Updating email failed";

    setError("");
    setIsLoading(true);

    try {
      const response = await updateEmail(formData);

      if (!response || "error" in response) {
        const { fieldErrors, message } = getRequestFormErrors(
          response?.error,
          Object.keys(formErrors),
          failureMessage,
        );

        setFormErrors((current) => ({
          ...current,
          ...fieldErrors,
        }));
        setError(message);
        return;
      }

      dispatch(updateUser(response.data));
      saveSessionUser(response.data.user);

      showToast({
        iconName: "CheckCircle",
        color: "success",
        message: "Email updated successfully",
      });

      navigate("/dashboard/settings", { replace: true });
    } catch (failure) {
      setError(getRequestErrorMessage(failure, failureMessage));
    } finally {
      setIsLoading(false);
    }
  };

  const checkError = () => {
    let flag = false;

    const validEmail =
      /^([a-z0-9]+[a-z0-9!#$%&'*+/=?^_`{|}~-]?(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)$/;

    if (formData.email == "" || formData.email.trim().length == 0) {
      setFormErrors((formErrors) => ({
        ...formErrors,
        email: "Must enter new email address.",
      }));
      flag = true;
    } else if (!validEmail.test(formData.email)) {
      setFormErrors((formErrors) => ({
        ...formErrors,
        email: "Must enter valid email address.",
      }));
      flag = true;
    }

    if (formData.password == "" || formData.password.trim().length == 0) {
      setFormErrors((formErrors) => ({
        ...formErrors,
        password: "Must enter current password.",
      }));
      flag = true;
    }

    return flag;
  };

  return (
    <>
      <div className="admin-wrapper flex flex-col h-full">
        <div className="header">
          <div className="breadcrumbs-wrapper">
            <div className="breadcrumb-item">
              <NavLink to="/dashboard/settings" end>
                Settings
              </NavLink>
              <Icon
                iconName="ChevronRight"
                height="16px"
                width="16px"
                fill="#A1ACB8"
                className="icon"
              />
            </div>
            <div className="breadcrumb-item">
              <NavLink to="/dashboard/settings/edit-email">Edit Email</NavLink>
              <Icon
                iconName="ChevronRight"
                height="16px"
                width="16px"
                fill="#A1ACB8"
                className="icon"
              />
            </div>
          </div>
        </div>

        <form method="post" onSubmit={handleSubmit}>
          <div className="settings-header">
            <div className="max-w-[360px]">
              <p>Edit Email</p>
              <span>
                Once you change your email, you will be required to be verified
                again. You will temporarily lose access to other modules.
              </span>
            </div>
            <div className="flex items-center">
              <button
                type="button"
                className="prod-btn-base prod-btn-secondary me-[16px]"
                onClick={() => {
                  navigate("/dashboard/settings", { replace: true });
                }}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="prod-btn-base prod-btn-primary"
                disabled={isLoading}
              >
                {isLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          {error && <p className="prod-p4 text-[#D82727] mb-[8px]">{error}</p>}
          <FieldGroup
            label="New Email"
            labelFor="email"
            additionalClasses="w-full mb-[20px]"
            caption={formErrors.email != "" ? formErrors.email : ""}
            state={formErrors.email != "" ? "error" : ""}
          >
            <Input
              size="input-md"
              id="email"
              type="email"
              additionalClasses="w-full max-w-[360px] mt-[8px]"
              placeholder="Enter new email"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value });
                setFormErrors({ ...formErrors, email: "" });
                setError("");
              }}
              state={formErrors.email != "" ? "error" : ""}
              // required
            />
          </FieldGroup>
          <FieldGroup
            label="Password"
            labelFor="password"
            additionalClasses="w-full"
            caption={formErrors.password != "" ? formErrors.password : ""}
            state={formErrors.password != "" ? "error" : ""}
          >
            <InputPassword
              size="input-md"
              id="password"
              additionalClasses="w-full  max-w-[360px] mt-[8px]"
              placeholder="Enter password"
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: e.target.value });
                setFormErrors({ ...formErrors, password: "" });
                setError("");
              }}
              state={formErrors.password != "" ? "error" : ""}
            />
          </FieldGroup>
        </form>
      </div>
    </>
  );
};
export default EditEmail;
