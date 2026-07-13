import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { format } from "date-fns";

import Highlighter from "react-highlight-words";

import EmptyState from "./EmptyState";
import Icon from "../Icon";
import Modal from "./Modal";
import Snackbar from "../Snackbar";

import {
  useDeleteUsersMutation,
  useDisableUserMutation,
  useUpdateUserMutation,
} from "../../features/api/userSlice";
import { useCreateActivityLogMutation } from "../../features/api/activityLogsSlice";
import ModalWithBody from "./ModalWithBody";
import FieldGroup from "../FieldGroup";
import Checkbox from "../Checkbox";
import Input from "../Input";
import CustomSelect from "../CustomSelect";

import Regions from "../../assets/data/regions.json";
import MultiSelect from "../MultiSelect";

const UsersTable = ({
  users,
  setCurrentData,
  searchQuery,
  setSearchQuery,
}) => {
  const user = useSelector((state) => state.auth.user);

  const [tableData, setTableData] = useState([]);
  
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [bulkActionModalActive, setBulkActionModalActive] = useState(false);
  const [bulkActionType, setBulkActionType] = useState("");

  useEffect(() => {
    if (users) {
      setTableData(users);
      setCurrentData(users);
    }
  }, [users]);

  useEffect(() => {
    if (users) {
      let searchQuerySplit = searchQuery.split(" ");
      searchQuerySplit = searchQuerySplit.filter((s) => s.length > 0);

      const filteredRows = users.filter((user) => {
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

      setTableData(searchQuery.length > 0 ? filteredRows : users);
      setCurrentData(searchQuery.length > 0 ? filteredRows : users);
    }
  }, [searchQuery]);

  const displayRegion = (region) => {
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

    return regions[region];
  };

  const displayRoleLabel = (roleLabel) => {
    const roleLabels = {
      ANALYST: "Analyst",
      DOH: "DOH Official",
      LGU: "LGU Worker",
      RESEARCHER: "Researcher",
      VIEWER: "Viewer",
      FIELD_WORKER: "Field Worker",
    };

    return roleLabels[roleLabel] || roleLabel;
  };

  const getRolePillClass = (roleLabel) => {
    const roleClasses = {
      ANALYST: "bg-[#D1FAE5] text-[#059669]",
      DOH: "bg-[#FEF3C7] text-[#D97706]",
      LGU: "bg-[#FEE2E2] text-[#DC2626]",
      RESEARCHER: "bg-[#E0F2FE] text-[#0284C7]",
      VIEWER: "bg-[#F3F4F6] text-[#4B5563]",
      FIELD_WORKER: "bg-[#FEF3C7] text-[#B45309]",
    };

    return roleClasses[roleLabel] || "bg-[#F2F4F7] text-gray-600";
  };

  const [isModalLoading, setIsModalLoading] = useState(false);

  const [updateUserStatus] = useDisableUserMutation();

  const [deleteUser] = useDeleteUsersMutation();

  const [log_activity] = useCreateActivityLogMutation();

  const searchWords = searchQuery.split(" ").filter((search) => search.length > 0);

  const selectedUsers = users.filter((user) => selectedUserIds.includes(user.id));

  const selectedDisabledUsers = selectedUsers.filter(
    (user) => user.is_disabled
  );

  const selectedActiveUsers = selectedUsers.filter(
    (user) => !user.is_disabled
  );

  const canEnableSelectedUsers = selectedDisabledUsers.length > 0;
  const canDisableSelectedUsers = selectedActiveUsers.length > 0;

  const allVisibleUsersSelected =
    tableData.length > 0 &&
    tableData.every((user) => selectedUserIds.includes(user.id));

  const toggleUserSelection = (id) => {
    setSelectedUserIds((currentIds) =>
      currentIds.includes(id)
        ? currentIds.filter((currentId) => currentId !== id)
        : [...currentIds, id]
    );
  };

  const toggleAllVisibleUsers = () => {
    const visibleIds = tableData.map((user) => user.id);

    setSelectedUserIds((currentIds) =>
      allVisibleUsersSelected
        ? currentIds.filter((id) => !visibleIds.includes(id))
        : [...new Set([...currentIds, ...visibleIds])]
    );
  };

  const normalizeAccessibleRegions = (accessibleRegions) =>
    Array.isArray(accessibleRegions)
      ? accessibleRegions
      : String(accessibleRegions || "").split(",").filter(Boolean);

  const openUpdateModal = (row) => {
    const fullName = `${row.first_name} ${row.last_name}`;

    setUpdateModalData({
      id: row.id,
      name: fullName,
      first_name: row.first_name || "",
      last_name: row.last_name || "",
      email: row.email || "",
      region: row.region || "",
      organization: row.organization || "",
      role_label: row.role_label || "",
      accessible_regions: normalizeAccessibleRegions(row.accessible_regions),
      created_at: row.created_at || "",
      is_disabled: row.is_disabled || false,
    });

    setUpdateModalErrors(emptyUpdateModalErrors);
    setUpdateModalActive(true);
  };

  const openBulkActionModal = (actionType) => {
    if (selectedUserIds.length === 0) return;
    if (actionType === "enable" && !canEnableSelectedUsers) return;
    if (actionType === "disable" && !canDisableSelectedUsers) return;

    setBulkActionType(actionType);
    setBulkActionModalActive(true);
  };

  const closeBulkActionModal = () => {
    if (isModalLoading) return;

    setBulkActionType("");
    setBulkActionModalActive(false);
  };

  const [updateModalActive, setUpdateModalActive] = useState(false);

  const emptyUpdateModalData = {
    id: "",
    name: "",
    first_name: "",
    last_name: "",
    email: "",
    region: "",
    organization: "",
    role_label: "",
    accessible_regions: [],
    created_at: "",
    is_disabled: false,
  };

  const emptyUpdateModalErrors = {
    first_name: "",
    last_name: "",
    email: "",
    region: "",
    organization: "",
    role_label: "",
    accessible_regions: "",
  };

  const [updateModalData, setUpdateModalData] = useState(emptyUpdateModalData);
  const [updateModalErrors, setUpdateModalErrors] = useState(emptyUpdateModalErrors);

  const [updateUser] = useUpdateUserMutation();

  const handleUpdateUser = async () => {
    const payload = {
      id: updateModalData.id,
      first_name: updateModalData.first_name.trim(),
      last_name: updateModalData.last_name.trim(),
      email: updateModalData.email.trim().toLowerCase(),
      region: updateModalData.region,
      organization: updateModalData.organization.trim(),
      role_label: updateModalData.role_label,
      accessible_regions: updateModalData.accessible_regions.join(","),
    };

    const nextErrors = { ...emptyUpdateModalErrors };
    let hasError = false;

    if (!payload.first_name) {
      nextErrors.first_name = "Must enter first name.";
      hasError = true;
    }

    if (!payload.last_name) {
      nextErrors.last_name = "Must enter last name.";
      hasError = true;
    }

    if (!payload.email) {
      nextErrors.email = "Must enter email address.";
      hasError = true;
    }

    if (!payload.region) {
      nextErrors.region = "Must choose region.";
      hasError = true;
    }

    if (!payload.organization) {
      nextErrors.organization = "Must enter organization.";
       hasError = true;
    }

    if (!payload.accessible_regions) {
      nextErrors.accessible_regions = "Must choose at least one accessible region.";
      hasError = true;
    }

    if (hasError) {
      setUpdateModalErrors(nextErrors);
      return;
    }

    setIsModalLoading(true);

    const response = await updateUser(payload);

    if (!response) {
      toast(
        <Snackbar
          iconName="Error"
          size="snackbar-sm"
          color="destructive"
          message={"Failed to update User"}
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
      setIsModalLoading(false);
      return;
    }

    if ("error" in response) {
      const { detail } = response["error"]["data"];

      detail.map(({ field, error }) => {
        if (field in updateModalData) {
          setUpdateModalErrors((formErrors) => ({
            ...formErrors,
            [field]: error,
          }));
        } else if (field == "error") {
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
        } else {
          toast(
            <Snackbar
              iconName="Error"
              size="snackbar-sm"
              color="destructive"
              message={detail}
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

      setIsModalLoading(false);
      return;
    }

    toast(
      <Snackbar
        iconName="CheckCircle"
        size="snackbar-sm"
        color="success"
        message={`User updated successfully`}
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
      user_id: user.id,
      entry: `Updated USER : ${updateModalData.name}`,
      module: "User Management",
    });

    setIsModalLoading(false);
    setUpdateModalData({ id: "", name: "", accessible_regions: [] });
    setUpdateModalActive(false);
  };

  const handleBulkAction = async () => {
    setIsModalLoading(true);

    try {
      if (bulkActionType === "delete") {
        for (const selectedUser of selectedUsers) {
          const response = await deleteUser(selectedUser.id);

          if (!response || "error" in response) {
            throw new Error("Failed to delete selected users.");
          }
        }
      }
      
      if (bulkActionType === "disable" || bulkActionType === "enable") {
        const status = bulkActionType === "disable";

        for (const selectedUser of selectedUsers) {
          const response = await updateUserStatus({
            id: selectedUser.id,
            status,
          });

          if (!response || "error" in response) {
            throw new Error("Failed to update selected users.");
          }
        }
      }

      const actionLabel =
        bulkActionType === "delete"
          ? "Deleted"
          : bulkActionType === "disable"
          ? "Disabled"
          : "Enabled";

      toast(
        <Snackbar
          iconName="CheckCircle"
          size="snackbar-sm"
          color="success"
          message={`${actionLabel} ${selectedUsers.length} selected user${
            selectedUsers.length === 1 ? "" : "s"
          } successfully`}
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
        user_id: user.id,
        entry: `${actionLabel} ${selectedUsers.length} USER account${
          selectedUsers.length == 1 ? "" : "s"
        }`,
        module: "User Management",
      });

      setSelectedUserIds([]);
      closeBulkActionModal();
    } catch (error) {
      toast(
        <Snackbar
          iconName="Error"
          size="snackbar-sm"
          color="destructive"
          message={error.message || "Bulk action failed. Please try again."}
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

    setIsModalLoading(false);
  };

  return (
    <>
      {selectedUserIds.length > 0 && (
        <div className="mb-[16px] flex flex-col gap-[10px] rounded-[8px] border border-[#E5E5E5] bg-[#F8FAFC] px-[14px] py-[12px] md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-800">
              {selectedUserIds.length}
            </span>{" "}
            selected
          </p>

          <div className="flex flex-wrap gap-[8px]">
            <button
              type="button"
              disabled={!canEnableSelectedUsers}
              className={`rounded-[8px] border px-[12px] py-[8px] text-sm ${
                canEnableSelectedUsers
                  ? "border-[#E5E5E5] bg-white text-gray-700 hover:bg-[#F8FAFC]"
                  : "cursor-not-allowed border-[#E5E5E5] bg-[#F2F4F7] text-gray-400"
              }`}
              onClick={() => openBulkActionModal("enable")}
            >
              Enable
            </button>
            <button
              type="button"
              disabled={!canDisableSelectedUsers}
              className={`rounded-[8px] border px-[12px] py-[8px] text-sm ${
                canDisableSelectedUsers
                  ? "border-[#E5E5E5] bg-white text-gray-700 hover:bg-[#F8FAFC]"
                  : "cursor-not-allowed border-[#E5E5E5] bg-[#F2F4F7] text-gray-400"
              }`}
              onClick={() => openBulkActionModal("disable")}
            >
              Disable
            </button>
            <button
              type="button"
              className="rounded-[8px] bg-[#DC2626] px-[12px] py-[8px] text-sm text-white"
              onClick={() => openBulkActionModal("delete")}
            >
              Delete
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        {users.length > 0 ? (
          tableData.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E5E5] text-left text-gray-500">
                  <th className="w-[44px] px-[10px] py-[12px]">
                    <div onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        size="input-checkbox-sm"
                        checked={allVisibleUsersSelected}
                        handleChange={toggleAllVisibleUsers}
                      />
                    </div>
                  </th>
                  <th className="px-[10px] py-[12px] font-medium">Full Name</th>
                  <th className="px-[10px] py-[12px] font-medium">Email</th>
                  <th className="px-[10px] py-[12px] font-medium">Regional Office</th>
                  <th className="px-[10px] py-[12px] font-medium">Role</th>
                  <th className="px-[10px] py-[12px] font-medium">Organization</th>
                  <th className="px-[10px] py-[12px] font-medium">Date Created</th>
                  <th className="px-[10px] py-[12px] font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map(
                  ({
                    id,
                    first_name,
                    last_name,
                    email,
                    region,
                    accessible_regions,
                    organization,
                    role_label,
                    created_at,
                    is_disabled,
                  }) => {
                    const fullName = `${first_name} ${last_name}`;

                    return (
                      <tr
                        key={id}
                        className={`cursor-pointer border-b border-[#F0F0F0] hover:bg-[#F8FAFC] ${
                          selectedUserIds.includes(id) ? "bg-[#F8FAFC]" : ""
                        }`}
                        onClick={() =>
                          openUpdateModal({
                            id,
                            first_name,
                            last_name,
                            email,
                            region,
                            accessible_regions,
                            organization,
                            role_label,
                            created_at,
                            is_disabled,
                          })
                        }
                      >
                        <td className="px-[10px] py-[14px]" onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            size="input-checkbox-sm"
                            checked={selectedUserIds.includes(id)}
                            handleChange={() => toggleUserSelection(id)}
                          />
                        </td>
                        <td className="px-[10px] py-[14px] font-medium text-gray-800">
                          <Highlighter
                            highlightClassName="rounded-[2px] bg-[#FFE81A] p-[2px] font-medium text-[#000]"
                            searchWords={searchWords}
                            autoEscape={true}
                            textToHighlight={fullName}
                          />
                        </td>
                        <td className="px-[10px] py-[14px] text-gray-600">
                          <Highlighter
                            highlightClassName="rounded-[2px] bg-[#FFE81A] p-[2px] font-medium text-[#000]"
                            searchWords={searchWords}
                            autoEscape={true}
                            textToHighlight={email}
                          />
                        </td>
                        <td className="px-[10px] py-[14px] text-gray-600">
                          {displayRegion(region)}
                        </td>
                        <td className="px-[10px] py-[14px] text-gray-600">
                          {role_label ? (
                            <span
                              className={`rounded-full px-[8px] py-[4px] text-xs font-medium ${getRolePillClass(
                                role_label
                              )}`}
                            >
                              {displayRoleLabel(role_label)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-[10px] py-[14px] text-gray-600">
                          <Highlighter
                            highlightClassName="rounded-[2px] bg-[#FFE81A] p-[2px] font-medium text-[#000]"
                            searchWords={searchWords}
                            autoEscape={true}
                            textToHighlight={organization || ""}
                          />
                        </td>
                        <td className="px-[10px] py-[14px] text-gray-600">
                          {format(new Date(created_at), "MMM dd, yyyy hh:mm a")}
                        </td>
                        <td className="px-[10px] py-[14px]">
                          <span
                            className={`rounded-full px-[8px] py-[4px] text-xs font-medium ${
                              is_disabled
                                ? "bg-[#FEF2F2] text-[#B42318]"
                                : "bg-[#ECFDF3] text-[#027A48]"
                            }`}
                          >
                            {is_disabled ? "Disabled" : "Active"}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          ) : (
            <EmptyState
              iconName="Search"
              heading="No Results Found"
              content="We couldn't find any matches for your search. Please try adjusting your search terms or criteria."
            >
              <button
                type="button"
                className="rounded-[10px] border border-[#E5E5E5] bg-white px-[14px] py-[9px] text-sm text-gray-700"
                onClick={() => setSearchQuery("")}
              >
                Clear Search
              </button>
            </EmptyState>
          )
        ) : (
          <EmptyState
            iconName="UserThree"
            heading="No Users Found"
            content="No users are currently created. Add users to manage the platform effectively."
          />
        )}
      </div>

      {/* MODALS */}
      {bulkActionModalActive && (
        <Modal
          onLoading={isModalLoading}
          onLoadingLabel={
            bulkActionType === "delete"
              ? "Deleting..."
              : bulkActionType === "disable"
              ? "Disabling..."
              : "Enabling..."
          }
          onConfirm={handleBulkAction}
          onConfirmLabel={
            bulkActionType === "delete"
              ? "Delete"
              : bulkActionType === "disable"
              ? "Disable"
              : "Enable"
          }
          onCancel={closeBulkActionModal}
          heading={`Are you sure you want to ${
            bulkActionType === "delete"
              ? "delete"
              : bulkActionType === "disable"
              ? "disable"
              : "enable"
          } ${selectedUserIds.length} selected user${
            selectedUserIds.length === 1 ? "" : "s"
          }?`}
          content={
            bulkActionType === "delete"
              ? "Selected users will no longer be able to use their HealthPH+ accounts."
              : bulkActionType === "disable"
              ? "Selected users will be unable to sign in to HealthPH+ until enabled again."
              : "Selected users will regain access to HealthPH+."
          }
          color={bulkActionType === "enable" ? "primary" : "destructive"}
        />
      )}

      {updateModalActive && (
        <ModalWithBody
          onLoading={isModalLoading}
          onLoadingLabel={"Updating"}
          onConfirm={() => {
            handleUpdateUser();
          }}
          onConfirmLabel="Update"
          onCancel={() => {
            setUpdateModalData(emptyUpdateModalData);
            setUpdateModalErrors(emptyUpdateModalErrors);
            setUpdateModalActive(false);
          }}
          heading={`Update ${updateModalData.name}'s account`}
          content="This user will receive full access to HealthPH+ such as the Analytics, Trends Map, and other modules."
          color="primary"
        >
          <div className="p-[20px]">
            <div className="grid grid-cols-1 gap-x-[16px] p-[20px] md:grid-cols-2">
              <FieldGroup 
                label="First Name" 
                labelFor="update-first-name" 
                additionalClasses="mb-[16px]" 
                caption={updateModalErrors.first_name} 
                state={updateModalErrors.first_name ? "error" : ""}
              >
                <Input 
                  size="input-md" 
                  id="update-first-name" 
                  type="text" 
                  additionalClasses="mt-[8px] w-full" 
                  value={updateModalData.first_name} 
                  onChange={(e) => setUpdateModalData({ ...updateModalData, first_name: e.target.value })} 
                  state={updateModalErrors.first_name ? "error" : ""} 
                />
              </FieldGroup>

              <FieldGroup 
                label="Last Name" 
                labelFor="update-last-name" 
                additionalClasses="mb-[16px]" 
                caption={updateModalErrors.last_name} 
                state={updateModalErrors.last_name ? "error" : ""}
              >
                <Input 
                  size="input-md" 
                  id="update-last-name" 
                  type="text" 
                  additionalClasses="mt-[8px] w-full" 
                  value={updateModalData.last_name} 
                  onChange={(e) => setUpdateModalData({ ...updateModalData, last_name: e.target.value })} 
                  state={updateModalErrors.last_name ? "error" : ""}
                />
              </FieldGroup>

              <FieldGroup
                label="Email" 
                labelFor="update-email" 
                additionalClasses="mb-[16px]" 
                caption={updateModalErrors.email} 
                state={updateModalErrors.email ? "error" : ""}
              >
                <Input 
                  size="input-md" 
                  id="update-email" 
                  type="email" 
                  additionalClasses="mt-[8px] w-full" 
                  value={updateModalData.email} 
                  onChange={(e) => setUpdateModalData({ ...updateModalData, email: e.target.value })} 
                  state={updateModalErrors.email ? "error" : ""}
                />
              </FieldGroup>

              <FieldGroup 
                label="Regional Office"
                labelFor="update-region" 
                additionalClasses="mb-[16px]" 
                caption={updateModalErrors.region} 
                state={updateModalErrors.region ? "error" : ""}
              >
                <CustomSelect 
                  options={Regions.regions} 
                  id="update-region" 
                  placeholder="Select region" 
                  size="input-select-md" 
                  value={updateModalData.region} 
                  handleChange={(value) => setUpdateModalData({ ...updateModalData, region: value })} additionalClasses="mt-[8px] w-full" state={updateModalErrors.region ? "error" : ""} menuMaxHeight="max-h-[250px]"
                />
              </FieldGroup>

              <FieldGroup 
                label="Organization" 
                labelFor="update-organization" 
                additionalClasses="mb-[16px]" 
                caption={updateModalErrors.organization} 
                state={updateModalErrors.organization ? "error" : ""}
              >
                <Input 
                  size="input-md" 
                  id="update-organization" 
                  type="text" 
                  additionalClasses="mt-[8px] w-full" 
                  value={updateModalData.organization} 
                  onChange={(e) => setUpdateModalData({ ...updateModalData, organization: e.target.value })} 
                  state={updateModalErrors.organization ? "error" : ""}
                />
              </FieldGroup>

              <FieldGroup 
                label="Role" 
                labelFor="update-role-label" 
                additionalClasses="mb-[16px]" 
                caption={updateModalErrors.role_label} 
                state={updateModalErrors.role_label ? "error" : ""}
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
                  id="update-role-label" 
                  placeholder="Select role" 
                  size="input-select-md" 
                  value={updateModalData.role_label} 
                  handleChange={(value) => setUpdateModalData({ ...updateModalData, role_label: value })} 
                  additionalClasses="mt-[8px] w-full" 
                  state={updateModalErrors.role_label ? "error" : ""}
                />
              </FieldGroup>

              <div className="md:col-span-2">
                <FieldGroup 
                  label="Accessible Regions" 
                  labelFor="accessible-regions" 
                  additionalClasses="w-full mb-[16px]" 
                  caption={updateModalErrors.accessible_regions} 
                  state={updateModalErrors.accessible_regions ? "error" : ""}
                >
                  <MultiSelect 
                    options={Regions.regions} 
                    defaultValue={updateModalData.accessible_regions} 
                    placeHolder="Select Region/s" 
                    onChange={(e) => setUpdateModalData({ ...updateModalData, accessible_regions: e.map((v) => v.value) })} selectAllLabel="All Regions" 
                    selectAll={false} 
                    additionalClassname="w-full mt-[8px]" 
                    editable={true} 
                    state={updateModalErrors.accessible_regions ? "error" : ""}
                  />
                </FieldGroup>
              </div>
            </div>
          </div>
        </ModalWithBody>
      )}
    </>
  );
};

export default UsersTable;
