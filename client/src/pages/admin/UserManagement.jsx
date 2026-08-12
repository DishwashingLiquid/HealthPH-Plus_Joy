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
import Snackbar from "../../components/Snackbar";
import { ToolbarSearch } from "../../components/ToolbarControls";
import EmptyState from "../../components/admin/EmptyState";
import Modal from "../../components/admin/Modal";

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
  useFetchOrganizationsQuery,
  useCreateOrganizationMutation,
  useUpdateOrganizationMutation,
  useDeleteOrganizationMutation,
} from "../../features/api/organizationSlice";

import { useFetchRoleLabelsQuery } from "../../features/api/roleLabelsSlice";

import {
  useCreateActivityLogMutation,
  useFetchAccountAnalyticsQuery,
} from "../../features/api/activityLogsSlice";


import useDeviceDetect from "../../hooks/useDeviceDetect";
import { toast } from "react-toastify";
import { toPng } from "html-to-image";

const ADMIN_ROLE_LABEL = "Admin";

const DEFAULT_ROLE_LABELS = [
  { name: "Admin", description: "Administrative platform access", is_active: true },
  { name: "Analyst", description: "Access to analytics and analysis tools", is_active: true },
  { name: "DOH Official", description: "Official DOH representative", is_active: true },
  { name: "LGU Worker", description: "Local government health worker", is_active: true },
  { name: "Researcher", description: "Academic or research institution member", is_active: true },
  { name: "Viewer", description: "Read-only dashboard access", is_active: true },
];

const ROLE_COLORS = [
  "#32418C",
  "#2572A5",
  "#9BCC33",
  "#FBD117",
  "#4B5563",
  "#F97316",
  "#14B8A6",
  "#A855F7",
];

const UserManagement = () => {
  const user = useSelector((state) => state.auth.user);

  const isSuperadmin = user?.user_type == "SUPERADMIN";
  const isUserAccount = user?.user_type == "USER";
  const isAdminRole = user?.role_label == ADMIN_ROLE_LABEL;

  const canViewUsers = isSuperadmin || isUserAccount;
  const canManageUsers = isSuperadmin || isAdminRole;
  const canManageSuperadmins = isSuperadmin;

  const [log_activity] = useCreateActivityLogMutation();

  const {
    data: accountAnalytics = {},
    isLoading: isAccountAnalyticsLoading,
  } = useFetchAccountAnalyticsQuery();

  let {
    data: admins = [],
    isLoading: isAdminsLoading,
    isError: isAdminsError,
    refetch: refetchAdmins,
  } = useFetchAdminsQuery(undefined, { skip: !canManageSuperadmins });

  let {
    data: users = [],
    isLoading: isUsersLoading,
    isError: isUsersError,
    refetch: refetchUsers,
  } = useFetchUsersQuery(undefined, { skip: !canViewUsers });

  const {
    data: organizations = [],
    isLoading: isOrganizationsLoading,
  } = useFetchOrganizationsQuery();

  const {
    data: roleLabels = [],
    isLoading: isRoleLabelsLoading,
    isError: isRoleLabelsError,
  } = useFetchRoleLabelsQuery();

  const [createOrganization, { isLoading: isCreateOrganizationLoading }] =
    useCreateOrganizationMutation();

  const [updateOrganization, { isLoading: isUpdateOrganizationLoading }] =
    useUpdateOrganizationMutation();

  const [deleteOrganization, { isLoading: isDeleteOrganizationLoading }] =
    useDeleteOrganizationMutation();

  const [organizationFormModalActive, setOrganizationFormModalActive] =
    useState(false);

  const [organizationFormMode, setOrganizationFormMode] = useState("create");
  const [selectedOrganization, setSelectedOrganization] = useState(null);

  const [organizationDetailsModalActive, setOrganizationDetailsModalActive] =
    useState(false);

  const [organizationDeleteModalActive, setOrganizationDeleteModalActive] =
    useState(false);

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

  const accountOrganizationStats = Object.values(
    allAccounts.reduce((collection, account) => {
      const organizationName = account.organization?.trim();

      if (!organizationName) return collection;

      if (!collection[organizationName]) {
        collection[organizationName] = {
          name: organizationName,
          totalAccounts: 0,
          superadmins: 0,
          users: 0,
          activeAccounts: 0,
          disabledAccounts: 0,
          regions: new Set(),
        };
      }

      const organization = collection[organizationName];

      organization.totalAccounts += 1;

      if (account.user_type === "SUPERADMIN") {
        organization.superadmins += 1;
      }

      if (account.user_type === "USER") {
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
  ).map((organization) => ({
    ...organization,
    regions: Array.from(organization.regions),
  }));

  const organizationList = organizations
    .map((organization) => {
      const accountStats = accountOrganizationStats.find(
        (stats) =>
          stats.name.trim().toLowerCase() ===
          organization.name.trim().toLowerCase()
      );

      return {
        id: organization.id,
        name: organization.name,
        description: organization.description,
        main_region: organization.main_region,
        region_coverage: organization.region_coverage || [],
        partnership_status: organization.partnership_status || "ACTIVE",
        totalAccounts: accountStats?.totalAccounts || 0,
        superadmins: accountStats?.superadmins || 0,
        users: accountStats?.users || 0,
        activeAccounts: accountStats?.activeAccounts || 0,
        disabledAccounts: accountStats?.disabledAccounts || 0,
        regions:
          accountStats?.regions?.length > 0
            ? accountStats.regions
            : (organization.region_coverage || []).map(getRegionLabel),
        source: "ORGANIZATION",
      };
    })
    .sort((a, b) => b.totalAccounts - a.totalAccounts || a.name.localeCompare(b.name));

  const organizationOptions = organizations
    .filter((organization) => organization?.name?.trim())
    .map((organization) => ({
      label: organization.name,
      value: organization.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const defaultRoleLabelNames = DEFAULT_ROLE_LABELS.map((roleLabel) =>
    roleLabel.name.toLowerCase()
  );

  const effectiveRoleLabels = [
    ...DEFAULT_ROLE_LABELS,
    ...roleLabels.filter(
      (roleLabel) =>
        roleLabel?.name &&
        !defaultRoleLabelNames.includes(roleLabel.name.toLowerCase())
    ),
  ];

  const activeRoleLabels = effectiveRoleLabels.filter(
    (roleLabel) => roleLabel?.name && roleLabel.is_active !== false
  );

  const roleLabelOptions = activeRoleLabels
    .map((roleLabel) => ({
      label: roleLabel.name,
      value: roleLabel.name,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const accountRoleDefinitions = activeRoleLabels.map((roleLabel, index) => ({
    value: roleLabel.name,
    label: roleLabel.name,
    color: ROLE_COLORS[index % ROLE_COLORS.length],
  }));

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
    { label: "Superadmins", count: 0 },
    { label: "Users", count: 0 },
    { label: "Organizations", count: 0 },
    { label: "Account Analytics", count: 0 },
  ]);

  const getDefaultTab = () => {
    if (isSuperadmin) return "Superadmins";
    if (canViewUsers) return "Users";
    return "Account Analytics";
  };

  const [currentTableTab, setCurrentTableTab] = useState(getDefaultTab);

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
          { label: "Superadmins", count: filteredAdmins.length },
          { label: "Users", count: filteredUsers.length },
          { label: "Organizations", count: filteredOrganizations.length },
          { label: "Account Analytics", count: allAccounts.length },
        ]);
      } else {
        setTabs([
          { label: "Superadmins", count: admins.length },
          { label: "Users", count: users.length },
          { label: "Organizations", count: organizationList.length },
          { label: "Account Analytics", count: allAccounts.length },
        ]);
      }
    }
  }, [
    searchQuery,
    admins,
    users,
    filteredOrganizations.length,
    organizationList.length,
    allAccounts.length,
    isAdminsLoading,
    isUsersLoading,
  ]);

  const [currentAdminsData, setCurrentAdminsData] = useState([]);

  const [currentUsersData, setCurrentUsersData] = useState([]);

  const visibleTabs = isSuperadmin
    ? tabs
    : canViewUsers
    ? tabs.filter((tab) => tab.label !== "Superadmins")
    : tabs.filter((tab) => tab.label === "Account Analytics");

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.label === currentTableTab)) {
      setCurrentTableTab(getDefaultTab());
    }
  }, [visibleTabs, currentTableTab]);

  const addButtonLabel = currentTableTab == "Superadmins" ? "Add Superadmin" : "Add User";

  const isAccountTableTab = ["Superadmins", "Users"].includes(currentTableTab);
  const isOrganizationsTab = currentTableTab == "Organizations";
  const isAnalyticsTab = currentTableTab == "Account Analytics";

  const searchPlaceholder =
    currentTableTab == "Organizations"
      ? "Search organizations..."
      : `Search ${currentTableTab.toLowerCase()}...`;

  const handleChangeTab = (label) => {
    setCurrentTableTab(label);
    setSearchQuery("");
  };

  const currentTabTotal =
    currentTableTab == "Superadmins"
      ? currentAdminsData.length
      : currentTableTab == "Users"
      ? currentUsersData.length
      : currentTableTab == "Organizations"
      ? filteredOrganizations.length
      : 0;

  const toolbarTotalLabel = `Total ${currentTableTab.toLowerCase()}`;

  const openAddUserModal = () => {
    setAddUserMode(currentTableTab == "Superadmins" ? "SUPERADMIN" : "USER");
    setAddUserModalActive(true);
  };

  const handleAccountCreated = async (createdUserType) => {
    if (createdUserType == "SUPERADMIN" && canManageSuperadmins) {
      await refetchAdmins();
      return;
    }

    if (createdUserType == "USER" && canManageUsers) {
      await refetchUsers();
    }
  };

  const openCreateOrganizationModal = () => {
    setSelectedOrganization(null);
    setOrganizationFormMode("create");
    setOrganizationFormModalActive(true);
  };

  const openEditOrganizationModal = (organization) => {
    setSelectedOrganization(organization);
    setOrganizationFormMode("edit");
    setOrganizationFormModalActive(true);
  };

  const openViewOrganizationModal = (organization) => {
    setSelectedOrganization(organization);
    setOrganizationDetailsModalActive(true);
  };

  const openDeleteOrganizationModal = (organization) => {
    setSelectedOrganization(organization);
    setOrganizationDeleteModalActive(true);
  };

  const closeOrganizationFormModal = () => {
    setOrganizationFormModalActive(false);
    setSelectedOrganization(null);
    setOrganizationFormMode("create");
  };

  const closeOrganizationDetailsModal = () => {
    setOrganizationDetailsModalActive(false);
    setSelectedOrganization(null);
  };

  const closeOrganizationDeleteModal = () => {
    if (isDeleteOrganizationLoading) return;

    setOrganizationDeleteModalActive(false);
    setSelectedOrganization(null);
  };

  const isCurrentTableLoading =
    currentTableTab == "Superadmins"
      ? canManageSuperadmins && isAdminsLoading
      : currentTableTab == "Users"
      ? canViewUsers && isUsersLoading
      : currentTableTab == "Organizations"
      ? (canManageSuperadmins && isAdminsLoading) ||
        (canViewUsers && isUsersLoading) ||
        isOrganizationsLoading
      : false;

  const isToolbarTotalLoading =
    isCurrentTableLoading || (isAnalyticsTab && isAccountAnalyticsLoading);

  const currentTableSkeletonColumns = currentTableTab == "Superadmins" ? 6 : 8;

  const handleSaveOrganization = async (payload) => {
    const isEditMode = organizationFormMode === "edit" && selectedOrganization?.id;

    const response = isEditMode
      ? await updateOrganization({
          id: selectedOrganization.id,
          ...payload,
        })
      : await createOrganization(payload);

    if ("error" in response) {
      const detail = response.error?.data?.detail;

      return {
        ok: false,
        errors: Array.isArray(detail)
          ? detail
          : [{ field: "error", error: detail || "Failed to save organization." }],
      };
    }

    toast(
      <Snackbar
        iconName="CheckCircle"
        size="snackbar-sm"
        color="success"
        message={
          isEditMode
            ? "Organization updated successfully"
            : "Organization added successfully" 
        }
      />
    );

    await log_activity({
      user_id: user.id,
      entry: isEditMode
        ? `Updated organization: ${payload.name}`
        : `Added organization: ${payload.name}`,
      module: "User Management",
    });

    return { ok: true };
  };

  const handleDeleteOrganization = async () => {
    if (!selectedOrganization?.id) return;

    const response = await deleteOrganization(selectedOrganization.id);

    if ("error" in response) {
      const detail = response.error?.data?.detail;
      const message = Array.isArray(detail)
        ? detail[0]?.error || "Failed to delete organization."
        : detail || "Failed to delete organization.";

      toast(
        <Snackbar
          iconName="Error"
          size="snackbar-sm"
          color="destructive"
          message={message}
        />
      );

      return;
    }

    toast(
      <Snackbar
        iconName="CheckCircle"
        size="snackbar-sm"
        color="success"
        message="Organization deleted successfully"
      />
    );

    await log_activity({
      user_id: user.id,
      entry: `Deleted organization: ${selectedOrganization.name}`,
      module: "User Management",
    });

    closeOrganizationDeleteModal();
  };

  return (
    <>
      <div className="flex flex-col gap-[10px]">
        {/* PAGE HEADER */}
        <div>
          <h1 className="text-[24px] font-semibold text-gray-800">
            User Management
          </h1>
          <p className="text-gray-500 text-[14px]">
            Manage superadmins, users, access permissions, and account status.
          </p>
        </div>

        {/* SUBTABS */}
        <div className="bg-white rounded-[12px] border border-[#E5E5E5] p-[12px]">
          <div
            className={`grid gap-[8px] rounded-[10px] bg-[#F5F5F5] p-[6px] ${
              visibleTabs.length === 4
                ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
                : visibleTabs.length === 3
                ? "grid-cols-1 sm:grid-cols-3"
                : visibleTabs.length === 2
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1"
            }`}
          >
            {visibleTabs.map(({ label }) => (
              <UserManagementTabButton
                key={label}
                label={label}
                active={currentTableTab == label}
                onClick={() => handleChangeTab(label)}
              />
            ))}
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
          <div className="mb-[20px] flex flex-col gap-[16px] xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-[12px]">
              {!isAnalyticsTab && (
                <ToolbarSearch
                  id="search"
                  placeholder={searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              )}

              {!isAnalyticsTab && (
                <div className="flex items-center text-sm text-gray-500">
                  {toolbarTotalLabel}:{" "}
                  <span className="ml-[4px] font-semibold text-gray-800">
                    {isToolbarTotalLoading
                      ? "-"
                      : currentTabTotal
                    }
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-[8px]">
              <button
                type="button"
                className="flex items-center gap-[8px] rounded-[10px] border border-[#E5E5E5] bg-[#F8F9FA] px-[16px] py-[10px] text-sm text-gray-800"
                onClick={handlePrint}
                disabled={isPrinting || !isAccountTableTab}
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

              {canManageUsers && isOrganizationsTab && (
                <button
                  type="button"
                  className="flex items-center gap-[8px] rounded-[10px] bg-[#32418C] px-[16px] py-[10px] text-sm text-white"
                  onClick={() => openCreateOrganizationModal()}
                >
                  <Icon
                    iconName="Plus"
                    height="16px"
                    width="16px"
                    fill="#FFF"
                  />
                  <span>Add Organization</span>
                </button>
              )}

              <PrintComponent
                showPrint={showPrint}
                ref={printRef}
                pageName="User Management"
                tableName={currentTableTab}
                data={
                  currentTableTab == "Superadmins"
                    ? currentAdminsData
                    : currentUsersData
                }
                columns={
                  currentTableTab == "Superadmins"
                    ? ["FULL NAME", "EMAIL", "ACCOUNT TYPE", "STATUS", "DATE CREATED"]
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

                  if (currentTableTab == "Superadmins") {
                    data.push("SUPERADMIN");
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

                    data.push(regions[value.region] || value.region || "-");
                    data.push(value.role_label || "-");
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
            ) : currentTableTab == "Superadmins" ? (
              <AdminsTable
                admins={admins}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setCurrentData={setCurrentAdminsData}
                organizationOptions={organizationOptions}
              />
            ) : currentTableTab == "Users" ? (
              <UsersTable
                users={users}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setCurrentData={setCurrentUsersData}
                organizationOptions={organizationOptions}
                roleLabelOptions={roleLabelOptions}
              />
            ) : currentTableTab == "Organizations" ? (
              <OrganizationsPanel 
                organizations={filteredOrganizations}
                isSuperadmin={isSuperadmin}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onCreateOrganization={openCreateOrganizationModal}
                onViewOrganization={openViewOrganizationModal}
                onEditOrganization={openEditOrganizationModal}
                onDeleteOrganization={openDeleteOrganizationModal}
              />
            ) : (
              <AccountAnalyticsPanel
                accountAnalytics={accountAnalytics}
                organizations={organizationList}
                isAccountAnalyticsLoading={isAccountAnalyticsLoading}
                viewerType={
                  isSuperadmin ? "SUPERADMIN" : isAdminRole ? "Admin" : "USER"
                }
                getRegionLabel={getRegionLabel}
                roleDefinitions={accountRoleDefinitions}
              />
            )}
          </div>
        </div>

        {addUserModalActive && (
          <UserAccountModal
            mode={addUserMode}
            currentUser={user}
            organizationOptions={organizationOptions}
            roleLabelOptions={roleLabelOptions}
            isRoleLabelsLoading={isRoleLabelsLoading && roleLabels.length > 0}
            isRoleLabelsError={isRoleLabelsError}
            onCreated={handleAccountCreated}
            onClose={() => setAddUserModalActive(false)}
          />
        )}

        {organizationFormModalActive && (
          <OrganizationFormModal
            mode={organizationFormMode}
            organization={selectedOrganization}
            isLoading={isCreateOrganizationLoading || isUpdateOrganizationLoading}
            onClose={closeOrganizationFormModal}
            onSubmit={handleSaveOrganization}
          />
        )}

        {organizationDetailsModalActive && selectedOrganization && (
          <OrganizationDetailsModal
            organization={selectedOrganization}
            isSuperadmin={isSuperadmin}
            getRegionLabel={getRegionLabel}
            onClose={closeOrganizationDetailsModal}
            onEdit={() => {
              setOrganizationDetailsModalActive(false);
              openEditOrganizationModal(selectedOrganization);
            }}
          />
        )}

        {organizationDeleteModalActive && selectedOrganization && (
          <Modal
            onLoading={isDeleteOrganizationLoading}
            onLoadingLabel="Deleting"
            onConfirm={handleDeleteOrganization}
            onConfirmLabel="Delete"
            onCancel={closeOrganizationDeleteModal}
            heading={`Delete ${selectedOrganization.name}?`}
            content={
              selectedOrganization.totalAccounts > 0
                ? `This organization has ${selectedOrganization.totalAccounts} connected account(s). Remove or transfer those accounts before deleting this organization.`
                : "This will permanently remove the organization from the official organization list."
            }
            color="destructive"
          />
        )}
      </div>
    </>
  );
};

const UserAccountModal = ({ 
  mode,
  currentUser,
  organizationOptions = [],
  roleLabelOptions = [],
  isRoleLabelsLoading = false,
  isRoleLabelsError = false,
  onCreated,
  onClose,
}) => {
  const isSuperadminMode = mode == "SUPERADMIN";

  const [createUser] = useCreateUserMutation();
  const [log_activity] = useCreateActivityLogMutation();

  const initialFormData = {
    user_type: isSuperadminMode ? "SUPERADMIN" : "USER",
    role_label: "",
    region: isSuperadminMode ? "ALL" : "",
    accessible_regions: isSuperadminMode
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

  const title = isSuperadminMode ? "Add Superadmin" : "Add User";

  const hasOrganizationOptions = organizationOptions.length > 0;
  const hasAvailableRoleOptions = isSuperadminMode || roleLabelOptions.length > 0;

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
    if (!isSuperadminMode && !formData.role_label) {
      nextErrors.role_label = "Must choose role.";
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
      nextErrors.organization = "Must choose organization.";
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

    const payload = {
      ...formData,
      role_label: isSuperadminMode ? "" : formData.role_label,
    };

    const response = await createUser(payload);

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
        message={`${isSuperadminMode ? "Superadmin" : "User"} added successfully`}
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
      entry: `Added ${isSuperadminMode ? "SUPERADMIN" : formData.role_label} account: ${formData.first_name} ${formData.last_name}`,
      module: "User Management",
    });

    if (onCreated) {
      await onCreated(payload.user_type);
    }

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
            {isSuperadminMode
              ? "Create a superadmin account with full platform access."
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
                  [
                    {
                      label: isSuperadminMode ? "SUPERADMIN" : "USER",
                      value: isSuperadminMode ? "SUPERADMIN" : "USER",
                    },
                  ]
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

            {!isSuperadminMode && (
              <FieldGroup
                label="Role"
                labelFor="role-label"
                additionalClasses="mb-[16px]"
                caption={
                  formErrors.role_label ||
                  (isRoleLabelsLoading
                    ? "Loading role labels..."
                    : isRoleLabelsError
                    ? "Using default role labels until the role label list refreshes."
                    : !hasAvailableRoleOptions
                    ? "No role labels available."
                    : "")
                }
                state={
                  formErrors.role_label
                    ? "error"
                    : isRoleLabelsLoading || !hasAvailableRoleOptions
                    ? "warning"
                    : ""
                }
              >
                <CustomSelect
                  options={roleLabelOptions}
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

            {!isSuperadminMode && (
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
                selectAll={isSuperadminMode}
                additionalClassname="mt-[8px] w-full"
                editable={!isSuperadminMode}
                state={formErrors.accessible_regions ? "error" : ""}
              />
            </FieldGroup>

            <FieldGroup
              label="Organization"
              labelFor="organization"
              additionalClasses="mb-[16px]"
              caption={
                formErrors.organization ||
                (!hasOrganizationOptions
                  ? "Add an organization first from the Organizations tab."
                  : "If the organization is not listed, add it in the Organizations tab first."
                )
              }
              state={
                formErrors.organization
                  ? "error"
                  : !hasOrganizationOptions
                  ? "warning"
                  : "" 
              }
            >
              <CustomSelect
                options={organizationOptions}
                id="organization"
                placeholder={
                  hasOrganizationOptions
                    ? "Select organization"
                    : "No organizations available" 
                }
                size="input-select-md"
                value={formData.organization}
                handleChange={(value) => {
                  setFormData({ ...formData, organization: value });
                  resetFieldError("organization");
                }}
                additionalClasses="mt-[8px] w-full"
                state={formErrors.organization ? "error" : ""}
                editable={hasOrganizationOptions}
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
            className="rounded-[8px] bg-[#32418C] px-[14px] py-[9px] text-sm text-white disabled:cursor-not-allowed disabled:bg-[#98A2B3]"
            disabled={isLoading || !hasOrganizationOptions || !hasAvailableRoleOptions}
          >
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
};

const OrganizationFormModal = ({
  mode = "create",
  organization,
  isLoading,
  onClose,
  onSubmit,
}) => {
  const regionOptions = Regions.regions.filter(
    (region) => region.value !== "N/A"
  );

  const isEditMode = mode === "edit";

  const initialFormErrors = {
    name: "",
    description: "",
    main_region: "",
    region_coverage: "",
    partnership_status: "",
  };

  const [formData, setFormData] = useState({
    name: organization?.name || "",
    description: organization?.description || "",
    main_region: organization?.main_region || "",
    region_coverage: organization?.region_coverage || [],
    partnership_status: organization?.partnership_status || "ACTIVE",
  });

  const [formErrors, setFormErrors] = useState(initialFormErrors);
  const [error, setError] = useState("");

  const resetFieldError = (field) => {
    setFormErrors((errors) => ({
      ...errors,
      [field]: "",
    }));
    setError("");
  };

  const handleCoverageChange = (value) => {
    setFormData((data) => ({
      ...data,
      region_coverage: value.map((region) => region.value),
    }));

    resetFieldError("region_coverage");
  };

  const checkError = () => {
    let hasError = false;
    const nextErrors = { ...initialFormErrors };

    if (!formData.name.trim()) {
      nextErrors.name = "Must enter organization name.";
      hasError = true;
    }

    if (!formData.main_region) {
      nextErrors.main_region = "Must choose main region.";
      hasError = true;
    }

    if (formData.region_coverage.length === 0) {
      nextErrors.region_coverage = "Must choose at least one covered region.";
      hasError = true;
    }

    if (!formData.partnership_status) {
      nextErrors.partnership_status = "Must choose partnership status.";
      hasError = true;
    }

    setFormErrors(nextErrors);
    return hasError;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (checkError()) return;

    const response = await onSubmit({
      name: formData.name.trim(),
      description: formData.description.trim(),
      main_region: formData.main_region,
      region_coverage: formData.region_coverage.join(","),
      partnership_status: formData.partnership_status,
    });

    if (response.ok) {
      onClose();
      return;
    }

    const nextErrors = { ...initialFormErrors };
    let nextError = "";

    response.errors.forEach(({ field, error }) => {
      if (field in nextErrors) {
        nextErrors[field] = error;
      } else {
        nextError = error;
      }
    });

    setFormErrors(nextErrors);
    setError(nextError);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-[49px] z-50 flex items-center justify-center px-[20px] py-[32px]">
      <button
        type="button"
        className="absolute inset-0 bg-[#34405499] backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close organization modal"
        disabled={isLoading}
      />

      <form
        method="post"
        onSubmit={handleSubmit}
        className="relative flex max-h-[calc(100vh-113px)] w-full max-w-[900px] flex-col overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white shadow-xl"
      >
        <div className="border-b border-[#E5E5E5] px-[20px] py-[16px]">
          <h3 className="text-[18px] font-semibold text-gray-800">
            {isEditMode ? "Edit Organization" : "Add Organization"}
          </h3>
          <p className="mt-[2px] text-sm text-gray-500">
            {isEditMode
              ? "Update organization details and region coverage."
              : "Create an official organization option for admin and user accounts."}
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
              label="Organization Name"
              labelFor="organization-name"
              additionalClasses="mb-[16px]"
              caption={formErrors.name}
              state={formErrors.name ? "error" : ""}
            >
              <Input
                size="input-md"
                id="organization-name"
                type="text"
                additionalClasses="mt-[8px] w-full"
                placeholder="Enter organization name"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  resetFieldError("name");
                }}
                state={formErrors.name ? "error" : ""}
              />
            </FieldGroup>

            <FieldGroup
              label="Main Region"
              labelFor="organization-main-region"
              additionalClasses="mb-[16px]"
              caption={formErrors.main_region}
              state={formErrors.main_region ? "error" : ""}
            >
              <CustomSelect
                options={regionOptions}
                id="organization-main-region"
                placeholder="Select main region"
                size="input-select-md"
                value={formData.main_region}
                handleChange={(value) => {
                  setFormData({ ...formData, main_region: value});
                  resetFieldError("main_region");
                }}
                additionalClasses="mt-[8px] w-full"
                state={formErrors.main_region ? "error" : ""}
                menuMaxHeight="max-h-[250px]"
              />
            </FieldGroup>

            <FieldGroup
              label="Partnership Status"
              labelFor="organization-status"
              additionalClasses="mb-[16px]"
              caption={formErrors.partnership_status}
              state={formErrors.partnership_status ? "error" : ""}
            >
              <CustomSelect
                options={[
                  { label: "Active", value: "ACTIVE" },
                  { label: "Inactive", value: "INACTIVE" },
                ]}
                id="organization-status"
                placeholder="Select status"
                size="input-select-md"
                value={formData.partnership_status}
                handleChange={(value) => {
                  setFormData({ ...formData, partnership_status: value });
                  resetFieldError("partnership_status");
                }}
                additionalClasses="mt-[8px] w-full"
                state={formErrors.partnership_status ? "error" : ""}
              />
            </FieldGroup>

            <div className="md:col-span-2">
                <FieldGroup
                  label="Region Coverage"
                  labelFor="organization-region-coverage"
                  additionalClasses="mb-[16px]"
                  caption={formErrors.region_coverage}
                  state={formErrors.region_coverage ? "error" : ""}
                >
                  <MultiSelect
                    options={regionOptions}
                    defaultValue={formData.region_coverage}
                    placeHolder="Select covered region/s"
                    onChange={handleCoverageChange}
                    selectAllLabel="All Regions"
                    selectAll={false}
                    additionalClassname="mt-[8px] w-full"
                    editable={true}
                    state={formErrors.region_coverage ? "error" : ""}
                  />
                </FieldGroup>
            </div>

            <div className="md:col-span-2">
              <FieldGroup
                label="Description"
                labelFor="organization-description"
                optional="Optional"
                additionalClasses="mb-[16px]"
                caption={formErrors.description}
                state={formErrors.description ? "error" : ""}
              >
                <Input
                  size="input-md"
                  id="organization-description"
                  type="text"
                  additionalClasses="mt-[8px] w-full"
                  placeholder="Enter short organization description"
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    resetFieldError("description");
                  }}
                  state={formErrors.description ? "error" : ""}
                />
              </FieldGroup>
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
            className="rounded-[8px] bg-[#32418C] px-[14px] py-[9px] text-sm text-white disabled:cursor-not-allowed disabled:bg-[#98A2B3]"
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : isEditMode ? "Update" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
};

const OrganizationDetailsModal = ({
  organization,
  isSuperadmin,
  getRegionLabel,
  onClose,
  onEdit,
}) => {
  const coveredRegions = organization.region_coverage?.length
    ? organization.region_coverage.map(getRegionLabel)
    : organization.regions || [];

  return (
    <div className="fixed inset-x-0 bottom-0 top-[49px] z-50 flex items-center justify-center px-[20px] py-[32px]">
      <button
        type="button"
        className="absolute inset-0 bg-[#34405499] backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close organization details modal"
      />

      <div className="relative flex max-h-[calc(100vh-113px)] w-full max-w-[900px] flex-col overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white shadow-xl">
        <div className="border-b border-[#E5E5E5] px-[20px] py-[16px]">
          <h3 className="text-[18px] font-semibold text-gray-800">
            {organization.name}
          </h3>
          <p className="mt-[2px] text-sm text-gray-500">
            Organization details and linked account summary.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-[20px]">
          <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
            <DetailItem label="Main Region" value={getRegionLabel(organization.main_region)} />
            <DetailItem label="Partnership Status" value={organization.partnership_status === "INACTIVE" ? "Inactive" : "Active"} />
            <DetailItem
              label="Users"
              value={organization.users}
              className={isSuperadmin ? "" : "md:col-span-2"}
            />
            {isSuperadmin && (
              <DetailItem label="Superadmins" value={organization.superadmins} />
            )}
            <DetailItem label="Active Accounts" value={organization.activeAccounts} />
            <DetailItem label="Disabled Accounts" value={organization.disabledAccounts} />
          </div>

          <div className="mt-[16px] rounded-[10px] border border-[#E5E5E5] bg-[#F8FAFC] p-[14px]">
            <p className="text-sm font-medium text-gray-800">Region Coverage</p>
            <div className="mt-[10px] flex flex-wrap gap-[8px]">
              {coveredRegions.length > 0 ? (
                coveredRegions.map((region) => (
                  <span
                    key={region}
                    className="rounded-full bg-white px-[10px] py-[5px] text-xs text-gray-700 ring-1 ring-[#E5E5E5]"
                  >
                    {region}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-500">No covered regions listed.</span>
              )}
            </div>
          </div>

          <div className="mt-[16px] rounded-[10px] border border-[#E5E5E5] bg-white p-[14px]">
            <p className="text-sm font-medium text-gray-800">Description</p>
            <p className="mt-[6px] text-sm text-gray-600">
              {organization.description || "No description provided."}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-[10px] border-t border-[#E5E5E5] px-[20px] py-[14px]">
          <button
            type="button"
            className="rounded-[8px] border border-[#D0D5DD] bg-white px-[14px] py-[9px] text-sm text-gray-700"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="rounded-[8px] bg-[#32418C] px-[14px] py-[9px] text-sm text-white"
            onClick={onEdit}
          >
            Edit Organization
          </button>
        </div>
      </div>
    </div>
  );
};

const DetailItem = ({ label, value, className = "" }) => (
  <div className={`rounded-[10px] border border-[#E5E5E5] bg-white p-[14px] ${className}`}>
    <p className="text-xs font-medium uppercase tracking-[0.04em] text-gray-500">
      {label}
    </p>
    <p className="mt-[6px] text-sm font-semibold text-gray-900">
      {value || "-"}
    </p>
  </div>
);

const OrganizationsPanel = ({ 
  organizations, 
  isSuperadmin,
  searchQuery,
  setSearchQuery,
  onCreateOrganization,
  onViewOrganization,
  onEditOrganization,
  onDeleteOrganization,
}) => {
  if (organizations.length === 0) {
    const hasSearch = searchQuery.trim().length > 0;

    return (
      <EmptyState
        iconName={hasSearch ? "Search" : "Users"}
        heading={hasSearch ? "No Results Found" : "No Organizations Found"}
        content={
          hasSearch
            ? "We couldn't find any matches for your search. Please try adjusting your search terms or criteria."
            : "There are currently no organizations listed. Add an organization first so admins and users can select it during account creation."
        }
      >
        {hasSearch ? (
          <button
            type="button"
            className="rounded-[10px] border border-[#E5E5E5] bg-white px-[14px] py-[9px] text-sm text-gray-700"
            onClick={() => setSearchQuery("")}
          >
            Clear Search
          </button>
        ) : (
          <button
            type="button"
            className="rounded-[10px] bg-[#32418C] px-[14px] py-[9px] text-sm text-white"
            onClick={onCreateOrganization}
          >
            Add Organization
          </button>
        )}
      </EmptyState>
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
                <div className={isSuperadmin ? "" : "col-span-2"}>
                  <p className="text-gray-500">Users</p>
                  <p className="mt-[2px] font-semibold text-gray-900">
                    {organization.users}
                  </p>
                </div>
                {isSuperadmin && (
                  <div>
                    <p className="text-gray-500">Superadmins</p>
                    <p className="mt-[2px] font-semibold text-gray-900">
                      {organization.superadmins}
                    </p>
                  </div>
                )}
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

            <div className="flex flex-wrap items-center justify-between gap-[10px] border-t border-[#E5E5E5] px-[16px] py-[12px]">
              <span
                className={`rounded-full px-[8px] py-[4px] text-xs font-medium ${
                  organization.partnership_status === "INACTIVE"
                    ? "bg-[#F2F4F7] text-gray-600"
                    : "bg-[#ECFDF3] text-[#027A48]"
                }`}
              >
                {organization.partnership_status === "INACTIVE" ? "Inactive" : "Active"}
              </span>

              <div className="flex flex-wrap gap-[8px]">
                <button
                  type="button"
                  className="rounded-[8px] border border-[#D0D5DD] bg-white px-[10px] py-[7px] text-xs text-gray-700"
                  onClick={() => onViewOrganization(organization)}
                >
                  View Details
                </button>

                <button
                  type="button"
                  className="rounded-[8px] border border-[#D0D5DD] bg-white px-[10px] py-[7px] text-xs text-gray-700"
                  onClick={() => onEditOrganization(organization)}
                >
                  Edit
                </button>

                <button
                  type="button"
                  className="rounded-[8px] border border-[#FEE4E2] bg-white px-[10px] py-[7px] text-xs text-[#B42318] disabled:cursor-not-allowed disabled:border-[#E5E5E5] disabled:text-gray-400"
                  onClick={() => onDeleteOrganization(organization)}
                  disabled={organization.totalAccounts > 0}
                  title={
                    organization.totalAccounts > 0
                      ? "Cannot delete an organization with connected accounts."
                      : "Delete organization"
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AccountAnalyticsPanel = ({
  accountAnalytics = {},
  organizations = [],
  isAccountAnalyticsLoading,
  viewerType,
  getRegionLabel,
  roleDefinitions = [],
}) => {
  const activityByDay = accountAnalytics.activity_by_day || [];

  const roleRegionDistribution = (
    accountAnalytics.role_region_distribution || []
  ).map((row) => ({
    ...row,
    region: getRegionLabel(row.region),
  }));

  const recentActivityLogs = accountAnalytics.recent_activity || [];
  const showRecentActivity = accountAnalytics.show_recent_activity === true;
  const isActivityLogsLoading = isAccountAnalyticsLoading;

  const totalActivityActions = activityByDay.reduce(
    (total, day) => total + day.actions,
    0
  );

  const derivedTotalUserAccounts = roleRegionDistribution.reduce((total, row) => {
    return (
      total +
      roleDefinitions.reduce(
        (roleTotal, role) => roleTotal + Number(row[role.value] || 0),
        0
      )
    );
  }, 0);

  const reportedTotalUserAccounts = Number(accountAnalytics.total_user_accounts);
  const totalUserAccounts = Number.isFinite(reportedTotalUserAccounts)
    ? reportedTotalUserAccounts
    : derivedTotalUserAccounts;

  const hasUserAccounts = totalUserAccounts > 0;

  const hasRoleDistribution = roleRegionDistribution.some((row) =>
    roleDefinitions.some((role) => Number(row[role.value] || 0) > 0)
  );

  const recentActivityEmptyState =
    viewerType === "SUPERADMIN"
      ? {
        heading: "No Recent Account Activity",
        content: "No account activity has been recorded yet.",
        }
      : {
        heading: "No Organization Activity Yet",
        content: "No account activity has been recorded for users in your organization yet.",
        };
 
  const scopeDescription = 
    viewerType === "SUPERADMIN"
      ? "Graphs show all user activity and role distribution. Recent Activity includes superadmins, admins, and users."
      : viewerType === "Admin"
      ? "Graphs show all user activity and role distribution. Recent activity is limited to users in your organization."
      : "Graphs show all user activity and role distribution. Detailed recent activity is hidden for user accounts.";

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
      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
        <h2 className="text-[18px] font-semibold text-gray-800">
          Account Analytics
        </h2>
        <p className="mt-[4px] text-sm text-gray-500">
          {scopeDescription}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2 xl:grid-cols-4">
        <AnalyticsSummaryCard
          label="Total User Accounts"
          value={totalUserAccounts}
          helper="User accounts only"
        />
        <AnalyticsSummaryCard
          label="Organizations"
          value={organizations.length}
          helper="Official organization records"
        />
        <AnalyticsSummaryCard
          label="Roles"
          value={roleDefinitions.length}
          helper="Configured account roles"
        />
        <AnalyticsSummaryCard
          label="Activity This Week"
          value={totalActivityActions}
          helper="Recorded account actions"
        />
      </div>

      <div className="grid grid-cols-1 gap-[16px] xl:grid-cols-2">
        <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
          <h2 className="text-[18px] font-semibold text-gray-800">All User Activity</h2>
          <p className="text-sm text-gray-500">
            Aggregated activity volume from all user accounts over the past week.
          </p>

          <div className="mt-[16px] h-[300px]">
            {isActivityLogsLoading ? (
              <div className="flex h-full items-center">
                <SkeletonBody columns={4} rows={4} />
              </div>
            ) : totalActivityActions > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityByDay}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="actions"
                    name="Account Actions"
                    stroke="#32418C"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                iconName={hasUserAccounts ? "ActivityLog" : "Users"}
                heading={hasUserAccounts ? "No Activity This Week" : "No User Accounts Yet"}
                content={
                  hasUserAccounts
                    ? "User accounts exist, but no account activity has been recorded in the last seven days."
                    : "Add user accounts to begin tracking account activity."
                }
              />
            )}
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
            {isActivityLogsLoading ? (
              <div className="flex h-full items-center">
                <SkeletonBody columns={4} rows={4} />
              </div>
            ) : hasRoleDistribution ? (
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
            ) : (
              <EmptyState
                iconName="Users"
                heading={hasUserAccounts ? "No Regional Distribution Yet" : "No User Accounts Yet"}
                content={
                  hasUserAccounts
                    ? "User accounts exist, but role and region data is not ready for charting yet."
                    : "Add user accounts with assigned roles and regions to generate this chart." 
                }
              />
            )}
          </div>
        </div>
      </div>

      {showRecentActivity && (
        <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
          <h2 className="text-[18px] font-semibold text-gray-800">
            Recent Account Activity
          </h2>
          <p className="text-sm text-gray-500">
            Detailed activity logs based on your account access level.
          </p>

          {isActivityLogsLoading ? (
            <div className="mt-[16px]">
              <SkeletonBody columns={6} rows={5} />
            </div>
          ) : recentActivityLogs.length > 0 ? (
            <div className="mt-[16px] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5E5E5] text-left text-gray-500">
                    <th className="px-[10px] py-[12px] font-medium">User</th>
                    <th className="px-[10px] py-[12px] font-medium">Entry</th>
                    <th className="px-[10px] py-[12px] font-medium">Module</th>
                    <th className="px-[10px] py-[12px] font-medium">Time</th>
                    <th className="px-[10px] py-[12px] font-medium">IP Address</th>
                    <th className="px-[10px] py-[12px] font-medium">Logged At</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivityLogs.map((log) => (
                    <tr key={log.id} className="border-b border-[#F0F0F0]">
                      <td className="px-[10px] py-[14px] font-medium text-gray-800">
                        <div>{log.user_name || "-"}</div>
                        <div className="text-xs font-normal text-gray-500">
                          {log.user_type === "SUPERADMIN"
                            ? "SUPERADMIN"
                            : log.role_label || log.user_type || "-"}
                        </div>
                      </td>
                      <td className="px-[10px] py-[14px] text-gray-600">
                        <span className="block max-w-[360px] truncate">
                          {log.entry || "-"}
                        </span>
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
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              iconName="ActivityLog"
              heading={recentActivityEmptyState.heading}
              content={recentActivityEmptyState.content}
            />
          )}
        </div>
      )}
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
