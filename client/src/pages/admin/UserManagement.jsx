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
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  useFetchAdminsQuery,
  useFetchUsersQuery,
  useCreateUserMutation,
} from "../../features/api/userSlice";
import {
  useCreateActivityLogMutation,
  useFetchActivityLogsQuery,
} from "../../features/api/activityLogsSlice";
import useDeviceDetect from "../../hooks/useDeviceDetect";
import Snackbar from "../../components/Snackbar";
import { toast } from "react-toastify";
import { toPng } from "html-to-image";
import { ToolbarSearch } from "../../components/ToolbarControls";

const UserManagement = () => {
  const user = useSelector((state) => state.auth.user);

  const [log_activity] = useCreateActivityLogMutation();

  const {
    data: activityLogs = [],
    isLoading: isActivityLogsLoading,
  } = useFetchActivityLogsQuery();

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

  const getRegionLabel = (region) =>
    Regions.regions.find(({ value }) => value == region)?.label || region || "-";

  const allAccounts = [...(admins || []), ...(users || [])];

  const organizationList = Object.values(
    allAccounts.reduce((collection, account) => {
      const organizationName = account.organization?.trim();

      if (!organizationName) return collection;

      if (!collection[organizationName]) {
        collection[organizationName] = {
          name: organizationName,
          totalAccounts: 0,
          admins: 0,
          users: 0,
          activeAccounts: 0,
          disabledAccounts: 0,
          regions: new Set(),
        };
      }

      const organization = collection[organizationName];

      organization.totalAccounts += 1;

      if (account.user_type === "ADMIN" || account.user_type === "SUPERADMIN") {
        organization.admins += 1;
      } else {
        organization.users += 1;
      }

      if (account.is_disabled) {
        organization.disabledAccounts += 1;
      } else {
        organization.activeAccounts += 1;
      }

      if (account.region && account.region !== "ALL") {
        organization.regions.add(getRegionLabel(account.region));
      }

      return collection;
    }, {})
  )
    .map((organization) => ({
      ...organization,
      regions: Array.from(organization.regions),
    }))
    .sort((a, b) => b.totalAccounts - a.totalAccounts || a.name.localeCompare(b.name));

  const filteredOrganizations = searchQuery.trim()
    ? organizationList.filter((organization) => {
      const terms = searchQuery.toLowerCase().split(" ").filter(Boolean);
      const searchableText = [
        organization.name,
        ...organization.regions,
      ]
        .join(" ")
        .toLowerCase();

      return terms.some((term) => searchableText.includes(term));
    })
  : organizationList;

  const [tabs, setTabs] = useState([
    { label: "Admins", count: 0 },
    { label: "Users", count: 0 },
    { label: "Organizations", count: 0 },
    { label: "User Analytics", count: 0 },
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
          { label: "Organizations", count: filteredOrganizations.length },
          { label: "User Analytics", count: allAccounts.length },
        ]);
      } else {
        setTabs([
          { label: "Admins", count: admins.length },
          { label: "Users", count: users.length },
          { label: "Organizations", count: organizationList.length },
          { label: "User Analytics", count: allAccounts.length },
        ]);
      }
    }
  }, [searchQuery, admins, users, isAdminsLoading, isUsersLoading]);

  const [currentAdminsData, setCurrentAdminsData] = useState([]);

  const [currentUsersData, setCurrentUsersData] = useState([]);

  const visibleTabs =
    user.user_type == "SUPERADMIN"
      ? tabs
      : tabs.filter((tab) => tab.label !== "Admins");

  const canManageUsers = ["ADMIN", "SUPERADMIN"].includes(user.user_type);

  const addButtonLabel = currentTableTab == "Admins" ? "Add Admin" : "Add User";

  const isAccountTableTab = ["Admins", "Users"].includes(currentTableTab);

  const currentTabTotal =
    currentTableTab == "Admins"
      ? currentAdminsData.length
      : currentTableTab == "Users"
      ? currentUsersData.length
      : currentTableTab == "Organizations"
      ? filteredOrganizations.length
      : allAccounts.length;

  const openAddUserModal = () => {
    setAddUserMode(currentTableTab == "Admins" ? "ADMIN" : "USER");
    setAddUserModalActive(true);
  };

  const isCurrentTableLoading =
    currentTableTab == "Admins"
      ? isAdminsLoading
      : currentTableTab == "Users"
      ? isUsersLoading
      : isAdminsLoading || isUsersLoading;

  const currentTableSkeletonColumns = currentTableTab == "Admins" ? 6 : 8;

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
            className={`grid gap-[8px] rounded-[10px] bg-[#F5F5F5] p-[6px] ${
              visibleTabs.length === 4
                ? "grid-cols-4"
                : visibleTabs.length === 3
                ? "grid-cols-3"
                : visibleTabs.length === 2
                ? "grid-cols-2"
                : "grid-cols-1"
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
                    : currentTabTotal
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

              {canManageUsers && isAccountTableTab && (
                <button
                  type="button"
                  className="admin-module-brand-btn flex items-center gap-[8px] rounded-[10px] border px-[16px] py-[10px] text-sm text-white"
                  style={{
                    backgroundColor: "#32418c",
                    borderColor: "#32418c",
                    boxShadow:
                      "0px 0px 0px 1px #32418c, 0px 1px 1px 0px rgba(0, 0, 0, 0.1)",
                  }}
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
                    ? ["FULL NAME", "EMAIL", "USER TYPE", "STATUS", "DATE CREATED"]
                    : [
                        "FULL NAME",
                        "EMAIL",
                        "REGIONAL OFFICE",
                        "ROLE",
                        "ORGANIZATION",
                        "STATUS",
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
                    data.push(value.is_disabled ? "Disabled" : "Active");
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

                    const roleLabels = {
                      ANALYST: "Analyst",
                      DOH: "DOH Official",
                      LGU: "LGU Worker",
                      RESEARCHER: "Researcher",
                      VIEWER: "Viewer",
                      FIELD_WORKER: "Field Worker",
                    };

                    data.push(regions[value.region] || value.region || "-");
                    data.push(roleLabels[value.role_label] || value.role_label || "-");
                    data.push(value.organization || "-");
                    data.push(value.is_disabled ? "Disabled" : "Active");
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
            ) : currentTableTab == "Users" ? (
              <UsersTable
                users={users}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setCurrentData={setCurrentUsersData}
              />
            ) : currentTableTab == "Organizations" ? (
              <OrganizationsPanel organizations={filteredOrganizations} />
            ) : (
              <UserAnalyticsPanel
                users={users || []}
                organizations={organizationList}
                activityLogs={activityLogs || []}
                isActivityLogsLoading={isActivityLogsLoading}
                getRegionLabel={getRegionLabel}
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
    organization: "",
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
          size="snackbar-sm"
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
        detail.forEach(({ field, error }) => {
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
                    { label: "Analyst", value: "ANALYST" },
                    { label: "DOH Official", value: "DOH" },
                    { label: "LGU Worker", value: "LGU" },
                    { label: "Researcher", value: "RESEARCHER" },
                    { label: "Viewer", value: "VIEWER" },
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

            {!isAdminMode && (
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
                state={formErrors.organization ? "error" : ""}
              />
            </FieldGroup>
            
            <FieldGroup
              label="First Name"
              labelFor="first-name"
              additionalClasses="mb-[16px]"
              caption={formErrors.first_name}
              state={formErrors.first_name ? "error" : ""}
            >
              <Input
                size="input-md"
                id="first-name"
                type="text"
                additionalClasses="mt-[8px] w-full"
                placeholder="Enter first name"
                value={formData.first_name}
                onChange={(e) => {
                  setFormData({ ...formData, first_name: e.target.value });
                  resetFieldError("first_name");
                }}
                state={formErrors.first_name ? "error" : ""}
              />
            </FieldGroup>

            <FieldGroup
              label="Last Name"
              labelFor="last-name"
              additionalClasses="mb-[16px]"
              caption={formErrors.last_name}
              state={formErrors.last_name ? "error" : ""}
            >
              <Input
                size="input-md"
                id="last-name"
                type="text"
                additionalClasses="mt-[8px] w-full"
                placeholder="Enter last name"
                value={formData.last_name}
                onChange={(e) => {
                  setFormData({ ...formData, last_name: e.target.value });
                  resetFieldError("last_name");
                }}
                state={formErrors.last_name ? "error" : ""}
              />
            </FieldGroup>

            <FieldGroup
              label="Email"
              labelFor="email"
              additionalClasses="mb-[16px]"
              caption={formErrors.email}
              state={formErrors.email ? "error" : ""}
            >
              <Input
                size="input-md"
                id="email"
                type="email"
                additionalClasses="mt-[8px] w-full"
                placeholder="Enter email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  resetFieldError("email");
                }}
                state={formErrors.email ? "error" : ""}
              />
            </FieldGroup>

            <div className="md:col-span-2">
              <FieldGroup
                label="Password"
                labelFor="password"
                additionalClasses="mb-[12px]"
                caption={formErrors.password}
                state={formErrors.password ? "error" : ""}
              >
                <div className="mt-[8px] flex flex-col gap-[10px] sm:flex-row">
                  <InputPassword
                    size="input-md"
                    id="password"
                    additionalClasses="w-full"
                    placeholder="Enter password"
                    value={formData.password}
                    defaultShow={true}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      resetFieldError("password");
                    }}
                    state={formErrors.password ? "error" : ""}
                  />
                  <button
                    type="button"
                    className="rounded-[8px] border border-[#D0D5DD] bg-white px-[14px] py-[9px] text-sm text-gray-700"
                    onClick={generatePassword}
                    disabled={isLoading}
                  >
                    Generate
                  </button>
                </div>
              </FieldGroup>

              <PasswordRequirements
                password={formData.password}
                pwdFlags={pwdFlags}
                handleChange={setPWDFlags}
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-[10px] border-t border-[#E5E5E5] px-[20px] py-[14px]">
          <button
            type="button"
            className="rounded-[8px] border border-[#D0D5DD] bg-white px-[14px] py-[9px] text-sm text-gray-700"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="admin-module-brand-btn rounded-[8px] border px-[14px] py-[9px] text-sm text-white"
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
};

const OrganizationsPanel = ({ organizations }) => {
  if (organizations.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-[#D0D5DD] bg-[#F8FAFC] p-[28px] text-center">
        <p className="text-sm font-medium text-gray-800">No organizations found</p>
        <p className="mt-[4px] text-sm text-gray-500">
          Try adjusting your search or add users with organization details.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-[16px]">
        <h2 className="text-[18px] font-semibold text-gray-800">
          Partnered Organizations
        </h2>
        <p className="text-sm text-gray-500">
          Organizations derived from registered HealthPH+ accounts.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {organizations.map((organization) => (
          <div
            key={organization.name}
            className="rounded-[12px] border border-[#E5E5E5] bg-white"
          >
            <div className="p-[16px]">
              <h3 className="text-[16px] font-semibold text-gray-900">
                {organization.name}
              </h3>
              <p className="mt-[4px] text-sm text-gray-500">
                {organization.regions.length > 0
                  ? organization.regions.join(", ")
                  : "No region assigned"
                }
              </p>

              <div className="mt-[14px] grid grid-cols-2 gap-[10px] text-sm">
                <div>
                  <p className="text-gray-500">Users</p>
                  <p className="mt-[2px] font-semibold text-gray-900">
                    {organization.users}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Admins</p>
                  <p className="mt-[2px] font-semibold text-gray-900">
                    {organization.admins}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Active</p>
                  <p className="mt-[2px] font-semibold text-[#027A48]">
                    {organization.activeAccounts}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Disabled</p>
                  <p className="mt-[2px] font-semibold text-[#B42318]">
                    {organization.disabledAccounts}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-[#E5E5E5] px-[16px] py-[12px]">
                <span className="rounded-full bg-[#ECFDF3] px-[8px] py-[4px] text-xs font-medium text-[#027A48]">
                  Active
                </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const UserAnalyticsPanel = ({
  users = [],
  organizations = [],
  activityLogs = [],
  isActivityLogsLoading,
  getRegionLabel,
}) => {
  const disabledUsers = users.filter((user) => user.is_disabled).length;
  const activeUsers = users.length - disabledUsers;
  const userActivityLogs = activityLogs.filter((log) => log.user_type === "USER");

  const roleDefinitions = [
    { value: "ANALYST", label: "Analyst", color: "#32418C" },
    { value: "DOH", label: "DOH Official", color: "#2572A5" },
    { value: "LGU", label: "LGU Worker", color: "#9BCC33" },
    { value: "RESEARCHER", label: "Researcher", color: "#FBD117" },
    { value: "VIEWER", label: "Viewer", color: "#4B5563" },
    { value: "FIELD_WORKER", label: "Field Worker", color: "#F97316" },
  ];

  const roleRegionDistribution = Object.values(
    users.reduce((collection, user) => {
      const region = getRegionLabel(user.region);

      if (!collection[region]) {
        collection[region] = { region };
        roleDefinitions.forEach((role) => {
          collection[region][role.value] = 0;
        });
      }

      if (user.role_label in collection[region]) {
        collection[region][user.role_label] += 1;
      }

      return collection;
    }, {})
  );

  const activityByDay = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));

    return {
      key: format(date, "yyyy-MM-dd"),
      day: format(date, "EEE"),
      actions: 0,
    };
  });

  userActivityLogs.forEach((log) => {
    const logDate = new Date(log.created_at);
    if (Number.isNaN(logDate.getTime())) return;

    const match = activityByDay.find(
      (day) => day.key === format(logDate, "yyyy-MM-dd")
    );

    if (match) {
      match.actions += 1;
    }
  });

  const recentActivityLogs = [...userActivityLogs]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);

  const formatLoggedAt = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "-"
      : format(date, "MMM dd, yyyy hh:mm a");
  };

  const getRelativeTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  };

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsSummaryCard label="Total Users" value={users.length} helper={`${activeUsers} active`} />
        <AnalyticsSummaryCard label="Organizations" value={organizations.length} helper="Derived from accounts" />
        <AnalyticsSummaryCard label="Roles" value={roleDefinitions.length} helper="Configured user roles" />
        <AnalyticsSummaryCard label="Disabled Users" value={`${disabledUsers} of ${users.length}`} helper="Users without access" />
      </div>

      <div className="grid grid-cols-1 gap-[16px] xl:grid-cols-2">
        <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
          <h2 className="text-[18px] font-semibold text-gray-800">User Activity</h2>
          <p className="text-sm text-gray-500">User activity log volume over the past week.</p>

          <div className="mt-[16px] h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityByDay}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="actions"
                  name="User Actions"
                  stroke="#32418C"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
          <h2 className="text-[18px] font-semibold text-gray-800">
            User Role Distribution by Region
          </h2>
          <p className="text-sm text-gray-500">
            Regional user counts grouped by assigned role.
          </p>

          <div className="mt-[16px] h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleRegionDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="region" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  iconType="circle"
                  wrapperStyle={{
                    paddingTop: "12px",
                    lineHeight: "20px",
                  }}
                />
                {roleDefinitions.map((role) => (
                  <Bar
                    key={role.value}
                    dataKey={role.value}
                    name={role.label}
                    stackId="roles"
                    fill={role.color}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h2 className="text-[18px] font-semibold text-gray-800">
          Recent User Activity
        </h2>
        <p className="text-sm text-gray-500">
          Latest recorded actions from activity logs.
        </p>

        <div className="mt-[16px] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] text-left text-gray-500">
                <th className="px-[10px] py-[12px] font-medium">User</th>
                <th className="px-[10px] py-[12px] font-medium">
                  <div className="flex items-center gap-[6px]">
                    <span>Entry</span>
                    <span title="Entry means the action performed by the user.">
                      <Icon
                        iconName="Information"
                        height="14px"
                        width="14px"
                        fill="#8693A0"
                      />
                    </span>
                  </div>
                </th>
                <th className="px-[10px] py-[12px] font-medium">Module</th>
                <th className="px-[10px] py-[12px] font-medium">Time</th>
                <th className="px-[10px] py-[12px] font-medium">IP Address</th>
                <th className="px-[10px] py-[12px] font-medium">Logged At</th>
              </tr>
            </thead>
            <tbody>
              {isActivityLogsLoading ? (
                <tr>
                  <td className="px-[10px] py-[14px] text-gray-500" colSpan={6}>
                    Loading activity logs...
                  </td>
                </tr>
              ) : recentActivityLogs.length > 0 ? (
                recentActivityLogs.map((log) => (
                  <tr key={log.id} className="border-b border-[#F0F0F0]">
                    <td className="px-[10px] py-[14px] font-medium text-gray-800">
                      <div>{log.user_name || "-"}</div>
                      <div className="text-xs font-normal text-gray-500">
                        {log.user_type || "-"}
                      </div>
                    </td>
                    <td className="px-[10px] py-[14px] text-gray-600">
                      <div className="flex max-w-[360px] items-center gap-[6px]">
                        <span className="truncate">{log.entry || "-"}</span>
                      </div>
                    </td>
                    <td className="px-[10px] py-[14px] text-gray-600">
                      {log.module || "-"}
                    </td>
                    <td className="px-[10px] py-[14px] text-gray-600">
                      {getRelativeTime(log.created_at)}
                    </td>
                    <td className="px-[10px] py-[14px] text-gray-600">
                      {log.ip_address || log.ip || "-"}
                    </td>
                    <td className="px-[10px] py-[14px] text-gray-600">
                      {formatLoggedAt(log.created_at)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-[10px] py-[14px] text-gray-500" colSpan={6}>
                    No user activity logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
  
const AnalyticsSummaryCard = ({ label, value, helper }) => (
  <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[16px]">
    <p className="text-sm text-gray-500">{label}</p>
    <p className="mt-[6px] text-[28px] font-semibold text-gray-900">{value}</p>
    <p className="mt-[2px] text-sm text-gray-500">{helper}</p>
  </div>
);

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
