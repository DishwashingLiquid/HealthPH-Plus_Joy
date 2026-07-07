import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useReactToPrint } from "react-to-print";

import SkeletonBody from "../../components/SkeletonBody";
import Icon from "../../components/Icon";
import Input from "../../components/Input";
import PrintComponent from "../../components/admin/PrintComponent";
import AdminsTable from "../../components/admin/AdminsTable";
import UsersTable from "../../components/admin/UsersTable";
import FieldGroup from "../../components/FieldGroup";
import CustomSelect from "../../components/CustomSelect";
import InputPassword from "../../components/InputPassword";
import PasswordRequirements from "../../components/auth/PasswordRequirements";
import MultiSelect from "../../components/MultiSelect";
import Regions from "../../assets/data/regions.json";

import {
  useFetchAdminsQuery,
  useFetchUsersQuery,
  useCreateUserMutation,
} from "../../features/api/userSlice";
import { useCreateActivityLogMutation } from "../../features/api/activityLogsSlice";
import useDeviceDetect from "../../hooks/useDeviceDetect";
import Snackbar from "../../components/Snackbar";
import { toast } from "react-toastify";
import { toPng } from "html-to-image";
import { ToolbarSearch } from "../../components/ToolbarControls";

const UserManagement = () => {
  const user = useSelector((state) => state.auth.user);

  const [log_activity] = useCreateActivityLogMutation();

  let {
    data: admins,
    isLoading: isAdminsLoading,
    isError: isAdminsError,
  } = useFetchAdminsQuery();

  let {
    data: users,
    isLoading: isUsersLoading,
    isError: isUsersError,
  } = useFetchUsersQuery();

  const [searchQuery, setSearchQuery] = useState("");

  const printRef = useRef();

  const { deviceType } = useDeviceDetect();

  const [showPrint, setShowPrint] = useState(false);

  const navigate = useNavigate();

  const [isPrinting, setIsPrinting] = useState(false);

  const [addUserModalActive, setAddUserModalActive] = useState(false);
  const [addUserMode, setAddUserMode] = useState("USER");

  const handlePrint = () => {
    setIsPrinting(true);

    if (["mobile", "tablet"].includes(deviceType)) {
      setShowPrint(true);
      setTimeout(handleExportUserManagement, 1000);
    } else {
      setTimeout(handlePrintUserManagement, 1000);
    }
  };

  const handlePrintUserManagement = useReactToPrint({
    content: () => printRef.current,
    documentTitle: "HealthPH - User Management",
    pageStyle:
      "@page { size: A4;  margin: 0mm; } @media print { body { -webkit-print-color-adjust: exact; } }",
    onAfterPrint: () => {
      setIsPrinting(false);
      document.getElementById("printWindow").remove();

      log_activity({
        user_id: user.id,
        entry: `Generated ${currentTableTab} report`,
        module: "User Management",
      });
    },
  });

  const handleExportUserManagement = async () => {
    try {
      const pages = document.querySelectorAll(".print-container .page");

      let imageList = [];

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];

        const imageData = await toPng(page, {
          canvasWidth: page.offsetWidth * 2,
          canvasHeight: page.offsetHeight * 2,
          quality: 1,
          pixelRatio: 1,
        });

        imageList.push(imageData);
      }

      setIsPrinting(false);

      navigate("/print", {
        state: {
          data: {
            documentTitle: "HealthPH - User Management",
            imageType: "list",
            imageData: imageList,
            log_activity: {
              user_id: user.id,
              entry: `Generated ${currentTableTab} report`,
              module: "User Management",
            },
          },
        },
      });
    } catch (error) {
      toast(
        <Snackbar
          iconName="Error"
          size="snackbar-sm"
          color="destructive"
          message={"Failed to generate report. Please try again."}
        />,
        {
          closeButton: ({ closeToast }) => (
            <Icon
              iconName="Close"
              className="close-icon close-icon-sm close-destructive"
              onClick={closeToast}
            />
          ),
        }
      );
    }
  };

  const [tabs, setTabs] = useState([
    { label: "Admins", count: 0 },
    { label: "Users", count: 0 },
  ]);

  const [currentTableTab, setCurrentTableTab] = useState(
    user.user_type == "SUPERADMIN" ? "Admins" : "Users"
  );

  useEffect(() => {
    if (admins && users) {
      if (searchQuery) {
        let searchQuerySplit = searchQuery.split(" ");
        searchQuerySplit = searchQuerySplit.filter((s) => s.length > 0);

        const filteredAdmins = admins.filter((admin) => {
          return searchQuerySplit.some((s) => {
            const reg = new RegExp("^.*" + s + ".*$", "i");
            if (
              reg.test(admin["last_name"]) ||
              reg.test(admin["first_name"]) ||
              reg.test(admin["email"])
            ) {
              return true;
            }
          });
        });

        const filteredUsers = users.filter((user) => {
          return searchQuerySplit.some((s) => {
            const reg = new RegExp("^.*" + s + ".*$", "i");
            if (
              reg.test(user["last_name"]) ||
              reg.test(user["first_name"]) ||
              reg.test(user["email"]) ||
              reg.test(user["organization"])
            ) {
              return true;
            }
          });
        });

        setTabs([
          { label: "Admins", count: filteredAdmins.length },
          { label: "Users", count: filteredUsers.length },
        ]);
      } else {
        setTabs([
          { label: "Admins", count: admins.length },
          { label: "Users", count: users.length },
        ]);
      }
    }
  }, [searchQuery, isAdminsLoading, isUsersLoading]);

  const [currentAdminsData, setCurrentAdminsData] = useState([]);

  const [currentUsersData, setCurrentUsersData] = useState([]);

  const visibleTabs =
    user.user_type == "SUPERADMIN"
      ? tabs
      : tabs.filter((tab) => tab.label == "Users");

  const canManageUsers = ["ADMIN", "SUPERADMIN"].includes(user.user_type);

  const addButtonLabel = currentTableTab == "Admins" ? "Add Admin" : "Add User";

  const openAddUserModal = () => {
    setAddUserMode(currentTableTab == "Admins" ? "ADMIN" : "USER");
    setAddUserModalActive(true);
  };

  const isCurrentTableLoading = 
    currentTableTab == "Admins" ? isAdminsLoading : isUsersLoading;

  const currentTableSkeletonColumns = currentTableTab == "Admins" ? 6 : 7;

  return (
    <>
      <div className="flex flex-col gap-[10px]">
        {/* PAGE HEADER */}
        <div>
          <h1 className="text-[24px] font-semibold text-gray-800">
            User Management
          </h1>
          <p className="text-gray-500 text-[14px]">
            Manage administrators, users, access permissions, and account status.
          </p>
        </div>

        {/* SUBTABS */}
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
          <div
            className={`grid grid-cols-1 gap-[8px] rounded-[10px] bg-[#F5F5F5] p-[6px] ${
              visibleTabs.length === 2 ? "md:grid-cols-2" : "md:grid-cols-1"
            }`}
          >
            {visibleTabs.map(({ label }) => (
              <UserManagementTabButton
                key={label}
                label={label}
                active={currentTableTab == label}
                onClick={() => setCurrentTableTab(label)}
              />
            ))}
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
          <div className="mb-[20px] flex flex-col gap-[16px] xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-[12px]">
              <ToolbarSearch
                id="search"
                placeholder={`Search ${currentTableTab.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div className="flex items-center text-sm text-gray-500">
                Total {currentTableTab.toLowerCase()}:{" "}
                <span className="ml-[4px] font-semibold text-gray-800">
                  {isCurrentTableLoading
                    ? "-"
                    : currentTableTab == "Admins"
                    ? currentAdminsData.length
                    : currentUsersData.length
                  }
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-[8px]">
              <button
                type="button"
                className="flex items-center gap-[8px] rounded-[10px] border border-[#E5E5E5] bg-[#F8F9FA] px-[16px] py-[10px] text-sm text-gray-800"
                onClick={handlePrint}
                disabled={isPrinting}
              >
                <Icon
                  iconName="Printer"
                  height="16px"
                  width="16px"
                  fill="none"
                  stroke="#465360"
                />
                <span>{isPrinting ? "Printing..." : "Print"}</span>
              </button>

              {canManageUsers && (
                <button
                  type="button"
                  className="flex items-center gap-[8px] rounded-[10px] bg-[#32418C] px-[16px] py-[10px] text-sm text-white"
                  onClick={openAddUserModal}
                >
                  <Icon
                    iconName="Plus"
                    height="16px"
                    width="16px"
                    fill="#FFF"
                  />
                  <span>{addButtonLabel}</span>
                </button>
              )}

              <PrintComponent
                showPrint={showPrint}
                ref={printRef}
                pageName="User Management"
                tableName={currentTableTab}
                data={
                  currentTableTab == "Admins"
                    ? currentAdminsData
                    : currentUsersData
                }
                columns={
                  currentTableTab == "Admins"
                    ? ["FULL NAME", "EMAIL", "USER TYPE", "DATE CREATED"]
                    : [
                        "FULL NAME",
                        "EMAIL",
                        "REGIONAL OFFICE",
                        "ORGANIZATION",
                        "DATE CREATED",
                      ]
                }
                rowsPerPage={25}
                dateTable={format(new Date(), "MMMM dd, yyyy | hh:mm a")}
                displayFunc={(value) => {
                  let full_name = `${value.first_name} ${value.last_name}`;

                  let data = [full_name, value.email];

                  if (currentTableTab == "Admins") {
                    data.push(value.user_type);
                  } else {
                    const regions = {
                      NCR: "National Capital Region",
                      I: "Region I",
                      II: "Region II",
                      III: "Region III",
                      CAR: "Cordillera Administrative Region (CAR)",
                      IVA: "Region IV-A (CALABARZON)",
                      IVB: "Region IV-B (MIMAROPA)",
                      V: "Region V",
                      VI: "Region VI",
                      VII: "Region VII",
                      VIII: "Region VIII",
                      IX: "Region IX",
                      X: "Region X",
                      XI: "Region XI",
                      XII: "Region XII",
                      XIII: "Region XIII",
                      BARMM: "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)",
                    };

                    data.push(regions[value.region]);
                    data.push(value.organization);
                  }

                  data.push(
                    format(new Date(value.created_at), "MMM dd, yyyy hh:mm a")
                  );

                  return data;
                }}
              />
            </div>
          </div>

          {/* TABLE */}
          <div>
            {isCurrentTableLoading ? (
              <SkeletonBody columns={currentTableSkeletonColumns} rows={6} />
            ) : currentTableTab == "Admins" ? (
              <AdminsTable
                admins={admins}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setCurrentData={setCurrentAdminsData}
              />
            ) : (
              <UsersTable
                users={users}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setCurrentData={setCurrentUsersData}
              />
            )}
          </div>
        </div>

        {addUserModalActive && (
          <UserAccountModal
            mode={addUserMode}
            currentUser={user}
            onClose={() => setAddUserModalActive(false)}
          />
        )}
      </div>
    </>
  );
};

const UserAccountModal = ({ mode, currentUser, onClose }) => {
  const isAdminMode = mode == "ADMIN";

  const [createUser] = useCreateUserMutation();
  const [log_activity] = useCreateActivityLogMutation();

  const initialFormData = {
    user_type: isAdminMode ? "ADMIN" : "USER",
    role_label: "",
    region: isAdminMode ? "ALL" : "",
    accessible_regions: isAdminMode
      ? Regions.regions.map(({ value }) => value).join(",")
      : "",
    organization: isAdminMode ? import.meta.env.VITE_ADMIN_ORG : "",
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  };

  const [formData, setFormData] = useState(initialFormData);

  const [formErrors, setFormErrors] = useState({
    user_type: "",
    role_label: "",
    region: "",
    accessible_regions: "",
    organization: "",
    first_name: "",
    last_name: "",
    email: "",
    password: "",
  });

  const [pwdFlags, setPWDFlags] = useState({
    length: "",
    lowercase: "",
    uppercase: "",
    number: "",
    character: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const title = isAdminMode ? "Add Admin" : "Add User";

  const resetFieldError = (field) => {
    setFormErrors((errors) => ({
      ...errors,
      [field]: "",
    }));
    setError("");
  };

  const handleChangeAccessibleRegions = (value) => {
    const newValue = value.map(({ value }) => value).join(",");

    setFormData((data) => ({
      ...data,
      accessible_regions: newValue,
    }));

    resetFieldError("accessible_regions");
  };

  const generatePassword = () => {
    let pwd = "";
    const length = 10;

    let charset = "";
    charset += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    charset += "abcdefghijklmnopqrstuvwxyz";
    charset += "01234567890";
    charset += "!@#$%^&*-_";

    const specialChars = /^.*[!@#$%^&*_-]+.*$/;

    while (
      /\s/.test(pwd) ||
      !/[a-z]/.test(pwd) ||
      !/[A-Z]/.test(pwd) ||
      !/\d/.test(pwd) ||
      !specialChars.test(pwd)
    ) {
      pwd = "";

      for (let i = 0; i < length; i++) {
        pwd += charset.charAt(Math.floor(Math.random() * charset.length));
      }
    }

    setFormData((data) => ({ ...data, password: pwd }));
    resetFieldError("password");
  };

  const checkError = () => {
    let hasError = false;

    const nextErrors = {
      user_type: "",
      role_label: "",
      region: "",
      accessible_regions: "",
      organization: "",
      first_name: "",
      last_name: "",
      email: "",
      password: "",
    };

    if (!formData.user_type) {
      nextErrors.user_type = "Must choose user type.";
      hasError = true;
    }
    if (!formData.region) {
      nextErrors.region = "Must choose region.";
      hasError = true;
    }
    if (!formData.accessible_regions) {
      nextErrors.accessible_regions = "Must choose at least one accessible region.";
      hasError = true;
    }
    if (!formData.organization || formData.organization.trim().length == 0) {
      nextErrors.organization = "Must enter organization.";
      hasError = true;
    }
    if (!formData.first_name || formData.first_name.trim().length == 0) {
      nextErrors.first_name = "Must enter first name.";
      hasError = true;
    }
    if (!formData.last_name || formData.last_name.trim().length == 0) {
      nextErrors.last_name = "Must enter last name.";
      hasError = true;
    }
    const validEmail =
      /^([a-z0-9]+[a-z0-9!#$%&'*+/=?^_`{|}~-]?(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)$/;

    if (!formData.email || formData.email.trim().length == 0) {
      nextErrors.email = "Must enter email address.";
      hasError = true;
    } else if (!validEmail.test(formData.email)) {
      nextErrors.email = "Must enter valid email address.";
      hasError = true;
    }
    if (!formData.password || formData.password.trim().length == 0) {
      nextErrors.password = "Must enter password.";
      hasError = true;
    }

    for (const key in pwdFlags) {
      if (pwdFlags[key] != "success") {
        nextErrors.password = "Must follow the password requirements.";
        hasError = true;
        break;
      }
    }

    setFormErrors(nextErrors);
    return hasError;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (checkError()) return;

    setIsLoading(true);

    const response = await createUser(formData);

    if (!response) {
      toast(
        <Snackbar
          iconName="Error"
          size="snackbar=sm"
          color="destructive"
          message="Failed to create user"
        />,
        {
          closeButton: ({ closeToast }) => (
            <Icon
              iconName="Close"
              className="close-icon close-icon-sm close-destructive"
              onClick={closeToast}
            />
          ),
        }
      );
      
      setIsLoading(false);
      return;
    }

    if ("error" in response) {
      const detail = response.error?.data?.detail;

      if (Array.isArray(detail)) {
        detail.forEach(({ field, errro }) => {
          if (field in formData) {
            setFormErrors((errors) => ({
              ...errors,
              [field]: error,
            }));
          }

          if (field == "error") {
            setError(error);
          }

          if (field == "snackbar") {
            toast(
              <Snackbar
                iconName="Error"
                size="snackbar-sm"
                color="destructive"
                message={error}
              />,
              {
                closeButton: ({ closeToast }) => (
                  <Icon
                    iconName="Close"
                    className="close-icon close-icon-sm close-destructive"
                    onClick={closeToast}
                  />
                ),
              }
            );
          }
        });
      } else {
        setError(detail || "Failed to create user.");
      }

      setIsLoading(false);
      return;
    }

    toast(
      <Snackbar
        iconName="CheckCircle"
        size="snackbar-sm"
        color="success"
        message={`${isAdminMode ? "Admin" : "User"} added successfully`}
      />,
      {
        closeButton: ({ closeToast }) => (
          <Icon
            iconName="Close"
            className="close-icon close-icon-sm close-success"
            onClick={closeToast}
          />
        ),
      }
    );

    await log_activity({
      user_id: currentUser.id,
      entry: `Added ${formData.user_type} : ${formData.first_name} ${formData.last_name}`,
      module: "User Management",
    });

    setIsLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-[49px] z-50 flex items-center justify-center px-[20px] py-[32px]">
      <button
        type="button"
        className="absolute inset-0 bg-[#34405499] backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close add user modal"
        disabled={isLoading}
      />

      <form
        method="post"
        onSubmit={handleSubmit}
        className="relative flex max-h-[calc(100vh-113px)] w-full max-w-[900px] flex-col overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white shadow-xl"
      >
        <div className="border-b border-[#E5E5E5] px-[20px] py-[16px]">
          <h3 className="text-[18px] font-semibold text-gray-800">
            {title}
          </h3>
          <p className="mt-[2px] text-sm text-gray-500">
            {isAdminMode
              ? "Create an administrator account."
              : "Create a personnel account."
            }
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-[20px]">
          {error && (
            <p className="mb-[14px] text-sm text-[#B42318]">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 gap-x-[16px] md:grid-cols-2">
            <FieldGroup
              label="Account Type"
              labelFor="user-type"
              additionalClasses="mb-[16px]"
              caption={formErrors.user_type}
              state={formErrors.user_type ? "error" : ""}
            >
              <CustomSelect
                options={
                  isAdminMode
                    ? [{ label: "ADMIN", value: "ADMIN" }]
                    : [{ label: "USER", value: "USER" }]
                }
                id="user-type"
                placeholder="Select user type"
                size="input-select-md"
                value={formData.user_type}
                handleChange={(value) => {
                  setFormData({ ...formData, user_type: value });
                  resetFieldError("user_type");
                }}
                additionalClasses="mt-[8px] w-full"
                state={formErrors.user_type ? "error" : ""}
                editable={false}
              />
            </FieldGroup>

            {!isAdminMode && (
              <FieldGroup
                label="Role"
                labelFor="role-label"
                additionalClasses="mb-[16px]"
                caption={formErrors.role_label}
                state={formErrors.role_label ? "error" : ""}
              >
                <CustomSelect
                  options={[
                    { label: "DOH", value: "DOH" },
                    { label: "LGU", value: "LGU" },
                    { label: "Researcher", value: "RESEARCHER" },
                    { label: "Field Worker", value: "FIELD_WORKER" },
                  ]}
                  id="role-label"
                  placeholder="Select role"
                  size="input-select-md"
                  value={formData.role_label}
                  handleChange={(value) => {
                    setFormData({ ...formData, role_label: value });
                    resetFieldError("role_label");
                  }}
                  additionalClasses="mt-[8px] w-full"
                  state={formErrors.role_label ? "error" : ""}
                />
              </FieldGroup>
            )}

            {isAdminMode && (
              <FieldGroup
                label="Regional Office"
                labelFor="region"
                additionalClasses="mb-[16px]"
                caption={formErrors.region}
                state={formErrors.region ? "error" : ""}
              >
                <CustomSelect
                  options={Regions.regions.filter((region) => region.value != "N/A")}
                  id="region"
                  placeholder="Select region"
                  size="input-select-md"
                  value={formData.region}
                  handleChange={(value) => {
                    setFormData({ ...formData, region: value });
                    resetFieldError("region");
                  }}
                  additionalClasses="mt-[8px] w-full"
                  state={formErrors.region ? "error" : ""}
                  menuMaxHeight="max-h-[250px]"
                />
              </FieldGroup>
            )}

            <FieldGroup
              label="Accessible Regions"
              labelFor="accessible-regions"
              additionalClasses="mb-[16px]"
              caption={formErrors.accessible_regions}
              state={formErrors.accessible_regions ? "error" : ""}
            >
              <MultiSelect
                options={Regions.regions}
                placeHolder="Select region/s"
                onChange={handleChangeAccessibleRegions}
                selectAllLabel="All Regions"
                selectAll={isAdminMode}
                additionalClassname="mt-[8px] w-full"
                editable={!isAdminMode}
                state={formErrors.accessible_regions ? "error" : ""}
              />
            </FieldGroup>

            <FieldGroup
              label="Organization"
              labelFor="organization"
              additionalClasses="mb-[16px]"
              caption={formErrors.organization}
              state={formErrors.organization ? "error" : ""}
            >
              <Input
                size="input-md"
                id="organization"
                type="text"
                additionalClasses="mt-[8px] w-full"
                placeholder="Enter organization"
                value={formData.organization}
                onChange={(e) => {
                  setFormData({ ...formData, organization: e.target.value });
                  resetFieldError("organization");
                }}
              />
            </FieldGroup>
          </div>
        </div>
      </form>
    </div>
  )
}

const UserManagementTabButton = ({ label, active, onClick }) => {
  return (
    <button
      type="button"
      className={`flex items-center justify-center rounded-[8px] px-[16px] py-[10px] text-sm font-medium transition ${
        active
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-500 hover:text-gray-800"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};

export default UserManagement;

