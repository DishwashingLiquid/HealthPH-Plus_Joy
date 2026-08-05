import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Highlighter from "react-highlight-words";
import { format } from "date-fns";

import EmptyState from "./EmptyState";
import Icon from "../Icon";
import Modal from "./Modal";
import Snackbar from "../Snackbar";
import Checkbox from "../Checkbox";
import ModalWithBody from "./ModalWithBody";
import FieldGroup from "../FieldGroup";
import Input from "../Input";
import CustomSelect from "../CustomSelect";
import MultiSelect from "../MultiSelect";

import Regions from "../../assets/data/regions.json";

import {
     useDeleteAdminMutation,
     useDisableUserMutation,
     useUpdateUserMutation,
} from "../../features/api/userSlice";
import { useCreateActivityLogMutation } from "../../features/api/activityLogsSlice";

const AdminsTable = ({
    admins = [],
    setCurrentData,
    searchQuery,
    setSearchQuery,
    organizationOptions = [],
}) => {
    const user = useSelector((state) => state.auth.user);

    const [tableData, setTableData] = useState([]);
    const [selectedAdminIds, setSelectedAdminIds] = useState([]);
    const [bulkActionModalActive, setBulkActionModalActive] = useState(false);
    const [bulkActionType, setBulkActionType] = useState("");

    const emptyUpdateModalData = {
        id: "",
        name: "",
        first_name: "",
        last_name: "",
        email: "",
        user_type: "SUPERADMIN",
        role_label: "",
        region: "ALL",
        organization: "",
        accessible_regions: [],
        created_at: "",
        is_disabled: false,
    };

    const emptyUpdateModalErrors = {
        first_name: "",
        last_name: "",
        email: "",
        organization: "",
    };

    const [updateModalActive, setUpdateModalActive] = useState(false);
    const [updateModalData, setUpdateModalData] = useState(emptyUpdateModalData);
    const [updateModalErrors, setUpdateModalErrors] = useState(emptyUpdateModalErrors);

    useEffect(() => {
        if (admins) {
            setTableData(admins);
            setCurrentData(admins);
        }
    }, [admins]);

    useEffect(() => {
        if (admins) {
            const searchQuerySplit = searchQuery
                .split(" ")
                .filter((search) => search.length > 0);

            const filteredRows = admins.filter((admin) => {
                return searchQuerySplit.some((search) => {
                    const reg = new RegExp("^.*" + search + ".*$", "i");

                    return (
                        reg.test(admin["last_name"]) ||
                        reg.test(admin["first_name"]) ||
                        reg.test(admin["email"]) ||
                        reg.test(admin["user_type"])
                    );
                });
            });

            const nextData = searchQuery.length > 0 ? filteredRows : admins;

            setTableData(nextData);
            setCurrentData(nextData);
        }
    }, [searchQuery, admins]);

    const [isModalLoading, setIsModalLoading] = useState(false);

    const [updateUserStatus] = useDisableUserMutation();
    const [deleteAdmin] = useDeleteAdminMutation();
    const [updateAdmin] = useUpdateUserMutation();
    const [log_activity] = useCreateActivityLogMutation();

    const searchWords = searchQuery.split(" ").filter((search) => search.length > 0);

    const selectedAdmins = admins.filter((admin) =>
        selectedAdminIds.includes(admin.id)
    );

    const selectedDisabledAdmins = selectedAdmins.filter(
        (admin) => admin.is_disabled
    );

    const selectedActiveAdmins = selectedAdmins.filter(
        (admin => !admin.is_disabled)
    );

    const canEnableSelectedAdmins = selectedDisabledAdmins.length > 0;
    const canDisableSelectedAdmins = selectedActiveAdmins.length > 0;

    const visibleSelectableAdmins = tableData.filter((admin) => user.id != admin.id);

    const hasOrganizationOptions = organizationOptions.length > 0;

    const normalizeOrganizationValue = (organizationName) =>
        organizationOptions.some((option) => option.value === organizationName)
            ? organizationName
            : "";

    const allVisibleAdminsSelected =
        visibleSelectableAdmins.length > 0 &&
        visibleSelectableAdmins.every((admin) => selectedAdminIds.includes(admin.id));

    const toggleAdminSelection = (id) => {
        if (user.id == id) return;

        setSelectedAdminIds((currentIds) =>
            currentIds.includes(id)
                ? currentIds.filter((currentId) => currentId !== id)
                : [...currentIds, id]
        );
    };

    const toggleAllVisibleAdmins = () => {
        const visibleIds = visibleSelectableAdmins.map((admin) => admin.id);

        setSelectedAdminIds((currentIds) =>
            allVisibleAdminsSelected
                ? currentIds.filter((id) => !visibleIds.includes(id))
                : [...new Set([...currentIds, ...visibleIds])]
        );
    };

    const openBulkActionModal = (actionType) => {
        if (selectedAdminIds.length === 0) return;
        if (actionType === "enable" && !canEnableSelectedAdmins) return;
        if (actionType === "disable" && !canDisableSelectedAdmins) return;

        setBulkActionType(actionType);
        setBulkActionModalActive(true);
    };

    const closeBulkActionModal = () => {
        if (isModalLoading) return;

        setBulkActionType("");
        setBulkActionModalActive(false);
    };

    const normalizeAccessibleRegions = (accessibleRegions) =>
        Array.isArray(accessibleRegions)
            ? accessibleRegions
            : String(accessibleRegions || "").split(",").filter(Boolean);

    const getAllRegionValues = () => Regions.regions.map(({ value }) => value);

    const openUpdateModal = (row) => {
        const fullName = `${row.first_name} ${row.last_name}`;

        setUpdateModalData({
            id: row.id,
            name: fullName,
            first_name: row.first_name || "",
            last_name: row.last_name || "",
            email: row.email || "",
            user_type: "SUPERADMIN",
            role_label: "",
            region: row.region || "ALL",
            organization: normalizeOrganizationValue(row.organization || ""),
            accessible_regions:
                normalizeAccessibleRegions(row.accessible_regions).length > 0
                    ? normalizeAccessibleRegions(row.accessible_regions)
                    : getAllRegionValues(),
            created_at: row.created_at || "",
            is_disabled: row.is_disabled || false,
        });

        setUpdateModalErrors(emptyUpdateModalErrors);
        setUpdateModalActive(true);
    };

    const handleUpdateAdmin = async () => {
        const payload = {
            id: updateModalData.id,
            first_name: updateModalData.first_name.trim(),
            last_name: updateModalData.last_name.trim(),
            email: updateModalData.email.trim().toLowerCase(),
            region: updateModalData.region || "ALL",
            organization: updateModalData.organization.trim(),
            user_type: "SUPERADMIN",
            accessible_regions:
                updateModalData.accessible_regions.length > 0
                    ? updateModalData.accessible_regions.join(",")
                    : getAllRegionValues().join(","),
            role_label: "",
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

        if (!payload.organization) {
            nextErrors.organization = "Must choose organization.";
            hasError = true;
        }

        if (hasError) {
            setUpdateModalErrors(nextErrors);
            return;
        }

        setIsModalLoading(true);

        const response = await updateAdmin(payload);

        if (!response || "error" in response) {
            setIsModalLoading(false);
            toast(
                <Snackbar
                    iconName="Error"
                    size="snackbar-sm"
                    color="destructive"
                    message="Failed to update superadmin."
                />
            );
            return;
        }

        toast(
            <Snackbar
                iconName="CheckCircle"
                size="snackbar-sm"
                color="success"
                message="Superadmin updated successfully"
            />
        );

        await log_activity({
            user_id: user.id,
            entry: `Updated SUPERADMIN account: ${updateModalData.name}`,
            module: "User Management",
        });

        setIsModalLoading(false);
        setUpdateModalData(emptyUpdateModalData);
        setUpdateModalErrors(emptyUpdateModalErrors);
        setUpdateModalActive(false);
    };

    const handleBulkAction = async () => {
        setIsModalLoading(true);

        try {
            if (bulkActionType === "delete") {
                for (const selectedAdmin of selectedAdmins) {
                    const response = await deleteAdmin(selectedAdmin.id);

                    if (!response || "error" in response) {
                        throw new Error("Failed to delete selected superadmins.");
                    }
                }
            }

            if (bulkActionType === "disable" || bulkActionType === "enable") {
                const status = bulkActionType === "disable";

                for (const selectedAdmin of selectedAdmins) {
                    const response = await updateUserStatus({
                        id: selectedAdmin.id,
                        status,
                    });

                    if (!response || "error" in response) {
                        throw new Error("Failed to update selected superadmins.");
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
                    message={`${actionLabel} ${selectedAdmins.length} selected superadmin${
                        selectedAdmins.length === 1 ? "" : "s"
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
                entry: `${actionLabel} ${selectedAdmins.length} SUPERADMIN account${
                    selectedAdmins.length === 1 ? "" : "s"
                }`,
                module: "User Management",
            });

            setSelectedAdminIds([]);
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
            {selectedAdminIds.length > 0 && (
                <div className="mb-[16px] flex flex-col gap-[10px] rounded-[8px] border border-[#E5E5E5] bg-[#F8FAFC] px-[14px] py-[12px] md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-gray-600">
                        <span className="font-semibold text-gray-800">
                            {selectedAdminIds.length}
                        </span>{" "}
                        selected
                    </p>

                    <div className="flex flex-wrap gap-[8px]">
                        <button
                            type="button"
                            disabled={!canEnableSelectedAdmins}
                            className={`rounded-[8px] border px-[12px] py-[8px] text-sm ${
                                canEnableSelectedAdmins
                                    ? "border-[#E5E5E5] bg-white text-gray-700 hover:bg-[#F8FAFC]"
                                    : "cursor-not-allowed border-[#E5E5E5] bg-[#F2F4F7] text-gray-400"
                            }`}
                            onClick={() => openBulkActionModal("enable")}
                        >
                            Enable
                        </button>
                        <button
                            type="button"
                            disabled={!canDisableSelectedAdmins}
                            className={`rounded-[8px] border px-[12px] py-[8px] text-sm ${
                                canDisableSelectedAdmins
                                    ? "border-[#E5E5E5] bg-white text-gray-700 hover:bg-[#F8FAFC]"
                                    : "cursor-not-allowed border-[#E5E5E5] bg-[#F2F4F7] text-gray-400"
                            }`}
                            onClick={() => openBulkActionModal("disable")}
                        >
                            Disable
                        </button>
                        {user.user_type === "SUPERADMIN" && (
                            <button
                                type="button"
                                className="rounded-[8px] bg-[#DC2626] px-[12px] py-[8px] text-sm text-white"
                                onClick={() => openBulkActionModal("delete")}
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </div>
            )}
            <div className="overflow-x-auto">
                {admins.length > 0 ? (
                    tableData.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#E5E5E5] text-left text-gray-500">
                                    <th className="w-[44px] px-[10px] py-[12px]">
                                        <div onClick={(event) => event.stopPropagation()}>
                                            <Checkbox
                                                size="input-checkbox-sm"
                                                checked={allVisibleAdminsSelected}
                                                handleChange={toggleAllVisibleAdmins}
                                            />
                                        </div>
                                    </th>
                                    <th className="px-[10px] py-[12px] font-medium">Full Name</th>
                                    <th className="px-[10px] py-[12px] font-medium">Email</th>
                                    <th className="px-[10px] py-[12px] font-medium">Date Created</th>
                                    <th className="px-[10px] py-[12px] font-medium">Account Type</th>
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
                                        created_at,
                                        user_type,
                                        role_label,
                                        is_disabled,
                                    }) => {
                                        const fullName = `${first_name} ${last_name}`;
                                        const isCurrentUser = user.id == id;
                                        const accessLevel = "SUPERADMIN";

                                        return (
                                            <tr
                                                key={id}
                                                className={`border-b border-[#F0F0F0] hover:bg-[#F8FAFC] ${
                                                    isCurrentUser
                                                        ? ""
                                                        : "cursor-pointer"
                                                } ${
                                                    selectedAdminIds.includes(id)
                                                        ? "bg-[#F8FAFC]"
                                                        : ""
                                                }`}
                                                onClick={() => {
                                                    if (isCurrentUser) return;

                                                    openUpdateModal({
                                                        id,
                                                        first_name,
                                                        last_name,
                                                        email,
                                                        region,
                                                        accessible_regions,
                                                        organization,
                                                        created_at,
                                                        user_type,
                                                        role_label,
                                                        is_disabled,
                                                    });
                                                }}
                                            >
                                                <td
                                                    className="px-[10px] py-[14px]"
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    {isCurrentUser ? (
                                                        <span className="text-sm text-gray-300">-</span>
                                                    ) : (
                                                        <Checkbox
                                                            size="input-checkbox-sm"
                                                            checked={selectedAdminIds.includes(id)}
                                                            handleChange={() => toggleAdminSelection(id)}
                                                        />
                                                    )}
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
                                                    {format(new Date(created_at), "MMM dd, yyyy hh:mm a")}
                                                </td>
                                                <td className="px-[10px] py-[14px]">
                                                    <div className="flex flex-wrap gap-[6px]">
                                                        <span className="rounded-full bg-[#EEF2FF] px-[8px] py-[4px] text-xs font-medium text-[#4F46E5]">
                                                            {accessLevel}
                                                        </span>
                                                        {isCurrentUser && (
                                                            <span className="rounded-full bg-[#F2F4F7] px-[8px] py-[4px] text-xs font-medium text-gray-500">
                                                                Current
                                                            </span>
                                                        )}
                                                    </div>
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
                            iconName="UserTwo"
                            heading="No Superadmins Found"
                            content="There are currently no superadmins listed. Add fellow superadmins to manage platform-level access."
                        />
                )}
            </div>

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
                    } ${selectedAdminIds.length} selected superadmin${
                        selectedAdminIds.length === 1 ? "" : "s"
                    }?`}
                    content={
                        bulkActionType === "delete"
                            ? "Selected superadmins will no longer be able to use their HealthPH+ accounts."
                            : bulkActionType === "disable"
                            ? "Selected superadmins will be unable to sign in to HealthPH+ until enabled again."
                            : "Selected superadmins will regain access to HealthPH+."
                    }
                    color={bulkActionType === "enable" ? "primary" : "destructive"}
                />
            )}

            {updateModalActive && (
                <ModalWithBody
                    onLoading={isModalLoading}
                    onLoadingLabel="Updating"
                    onConfirm={handleUpdateAdmin}
                    onConfirmLabel="Update"
                    onConfirmDisabled={!hasOrganizationOptions}
                    onCancel={() => {
                        setUpdateModalData(emptyUpdateModalData);
                        setUpdateModalErrors(emptyUpdateModalErrors);
                        setUpdateModalActive(false);
                    }}
                    heading={`Update ${updateModalData.name}'s superadmin account`}
                    color="primary"
                >
                    <div className="p-[20px]">
                        <div className="grid grid-cols-1 gap-x-[16px] p-[20px] md:grid-cols-2">
                            <FieldGroup
                                label="First Name"
                                labelFor="update-admin-first-name"
                                additionalClasses="mb-[16px]"
                                caption={updateModalErrors.first_name}
                                state={updateModalErrors.first_name ? "error" : ""}
                            >
                                <Input
                                    size="input-md"
                                    id="update-admin-first-name"
                                    type="text"
                                    additionalClasses="mt-[8px] w-full"
                                    value={updateModalData.first_name}
                                    onChange={(e) => setUpdateModalData({ ...updateModalData, first_name: e.target.value })}
                                    state={updateModalErrors.first_name ? "error" : ""}
                                />
                            </FieldGroup>
                            <FieldGroup
                                label="Last Name"
                                labelFor="update-admin-last-name"
                                additionalClasses="mb-[16px]"
                                caption={updateModalErrors.last_name}
                                state={updateModalErrors.last_name ? "error" : ""}
                            >
                                <Input
                                    size="input-md"
                                    id="update-admin-last-name"
                                    type="text"
                                    additionalClasses="mt-[8px] w-full"
                                    value={updateModalData.last_name}
                                    onChange={(e) => setUpdateModalData({ ...updateModalData, last_name: e.target.value })}
                                    state={updateModalErrors.last_name ? "error" : ""}
                                />
                            </FieldGroup>
                            <FieldGroup
                                label="Email"
                                labelFor="update-admin-email"
                                additionalClasses="mb-[16px]"
                                caption={updateModalErrors.email}
                                state={updateModalErrors.email ? "error" : ""}
                            >
                                <Input
                                    size="input-md"
                                    id="update-admin-email"
                                    type="text"
                                    additionalClasses="mt-[8px] w-full"
                                    value={updateModalData.email}
                                    onChange={(e) => setUpdateModalData({ ...updateModalData, email: e.target.value })}
                                    state={updateModalErrors.email ? "error" : ""}
                                />
                            </FieldGroup>
                            <FieldGroup
                                label="Organization"
                                labelFor="update-admin-organization"
                                additionalClasses="mb-[16px]"
                                caption={
                                    updateModalErrors.organization ||
                                    (!hasOrganizationOptions
                                        ? "Add an organization first from the Organizations tab."
                                        : ""
                                    )
                                }
                                state={
                                    updateModalErrors.organization
                                        ? "error"
                                        : !hasOrganizationOptions
                                        ? "warning"
                                        : ""
                                }
                            >
                                <CustomSelect
                                    options={organizationOptions}
                                    id="update-admin-organization"
                                    placeholder={
                                        hasOrganizationOptions
                                            ? "Select organization"
                                            : "No organizations available"   
                                    }
                                    size="input-select-md"
                                    value={updateModalData.organization}
                                    handleChange={(value) => {
                                        setUpdateModalData({ ...updateModalData, organization: value });
                                        setUpdateModalErrors({ ...updateModalErrors, organization: ""});
                                    }}
                                    additionalClasses="mt-[8px] w-full"
                                    state={updateModalErrors.organization ? "error" : ""}
                                    editable={hasOrganizationOptions}
                                />
                            </FieldGroup>
                            <FieldGroup
                                label="Account Type"
                                labelFor="update-admin-user-type"
                                additionalClasses="mb-[16px]"
                            >
                                <Input
                                    size="input-md"
                                    id="update-admin-user-type"
                                    type="text"
                                    additionalClasses="mt-[8px] w-full"
                                    value={updateModalData.user_type}
                                    disabled
                                />
                            </FieldGroup>
                            <FieldGroup
                                label="Accessible Regions"
                                labelFor="update-admin-accessible-regions"
                                additionalClasses="mb-[16px]"
                            >
                                <MultiSelect
                                    options={Regions.regions}
                                    defaultValue={updateModalData.accessible_regions}
                                    placeHolder="Select region/s"
                                    onChange={() => {}}
                                    selectAllLabel="All Regions"
                                    selectAll={false}
                                    additionalClassname="mt-[8px] w-full"
                                    editable={false}
                                    selectable={false}
                                />
                            </FieldGroup>
                            <FieldGroup
                                label="Date Created"
                                labelFor="update-admin-created-at"
                                additionalClasses="mb-[16px]"
                            >
                                <Input
                                    size="input-md"
                                    id="update-admin-created-at"
                                    type="text"
                                    additionalClasses="mt-[8px] w-full"
                                    value={updateModalData.created_at ? format(new Date(updateModalData.created_at), "MMM dd, yyyy hh:mm a") : ""}
                                    disabled
                                />
                            </FieldGroup>
                        </div>
                    </div>
                </ModalWithBody>
            )}
        </>
    );
};

export default AdminsTable;
