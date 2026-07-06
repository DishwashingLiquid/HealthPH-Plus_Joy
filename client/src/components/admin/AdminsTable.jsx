import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Highlighter from "react-highlight-words";
import { format } from "date-fns";

import EmptyState from "./EmptyState";
import Icon from "../Icon";
import Modal from "./Modal";
import Snackbar from "../Snackbar";

import {
     useDeleteAdminMutation,
     useDisableUserMutation,
} from "../../features/api/userSlice";
import { useCreateActivityLogMutation } from "../../features/api/activityLogsSlice";

const AdminsTable = ({
    admins = [],
    setCurrentData,
    searchQuery,
    setSearchQuery,
}) => {
    const user = useSelector((state) => state.auth.user);

    const [tableData, setTableData] = useState([]);

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

    const [modalData, setModalData] = useState({
        id: "",
        name: "",
        user_type: "",
    });

    const [deleteModalActive, setDeleteModalActive] = useState(false);
    const [disableModalActive, setDisableModalActive] = useState(false);
    const [enableModalActive, setEnableModalActive] = useState(false);
    const [isModalLoading, setIsModalLoading] = useState(false);

    const [updateUserStatus] = useDisableUserMutation();
    const [deleteAdmin] = useDeleteAdminMutation();
    const [log_activity] = useCreateActivityLogMutation();

    const searchWords = searchQuery.split(" ").filter((search) => search.length > 0);

    const handleChangeStatus = async (status) => {
        setIsModalLoading(true);

        const response = await updateUserStatus({ id: modalData.id, status });

        if (!response) {
            toast(
                <Snackbar
                    iconName="Error"
                    size="snackbar-sm"
                    color="destructive"
                    message={status ? "Failed to disable user" : "Failed to enable user"}
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

            setIsModalLoading(false);
            return;
        }

        toast(
            <Snackbar
                iconName="CheckCircle"
                size="snackbar-sm"
                color="success"
                message={`User ${status ? "disabled" : "enabled"} successfully`}
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
            entry: `${status ? "Disabled" : "Enabled"} ${modalData.user_type} : ${
                modalData.name
            }`,
            module: "User Management",
        });

        setIsModalLoading(false);
        setModalData({ id: "", name: "", user_type: "" });

        if (status) {
            setDisableModalActive(false);
        } else {
            setEnableModalActive(false);
        }
    };

    const handleDeleteAdmin = async () => {
        setIsModalLoading(true);

        const response = await deleteAdmin(modalData.id);

        if (!response) {
            toast(
                <Snackbar
                    iconName="Error"
                    size="snackbar-sm"
                    color="destructive"
                    message="Failed to delete user"
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

            setIsModalLoading(false);
            return;
        }

        toast(
            <Snackbar
                iconName="CheckCircle"
                size="snackbar-sm"
                color="success"
                message="User deleted successfully"
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
            entry: `Deleted ${modalData.user_type} : ${modalData.name}`,
            module: "User Management",
        });

        setIsModalLoading(false);
        setModalData({ id: "", name: "", user_type: "" });
        setDeleteModalActive(false);
    };

    return (
        <>
            <div className="overflow-x-auto">
                {admins.length > 0 ? (
                    tableData.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[#E5E5E5] text-left text-gray-500">
                                    <th className="px-[10px] py-[12px] font-medium">Full Name</th>
                                    <th className="px-[10px] py-[12px] font-medium">Email</th>
                                    <th className="px-[10px] py-[12px] font-medium">Date Created</th>
                                    <th className="px-[10px] py-[12px] font-medium">User Type</th>
                                    <th className="px-[10px] py-[12px] font-medium">Status</th>
                                    <th className="px-[10px] py-[12px] font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.map(
                                    ({
                                        id,
                                        first_name,
                                        last_name,
                                        email,
                                        created_at,
                                        user_type,
                                        is_disabled,
                                    }) => {
                                        const fullName = `${first_name} ${last_name}`;
                                        const isCurrentUser = user.id == id;

                                        return (
                                            <tr
                                                key={id}
                                                className="border-b border-[#F0F0F0] hover:bg-[#F8FAFC]"
                                            >
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
                                                    <span className="rounded-full bg-[#EEF2FF] px-[8px] py-[4px] text-xs font-medium text-[#4F46E5]">
                                                        {user_type}
                                                    </span>
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
                                                <td className="px-[10px] py-[14px]">
                                                    {isCurrentUser ? (
                                                        <span className="text-sm text-gray-400">
                                                            Current account
                                                        </span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-[8px]">
                                                            <button
                                                                type="button"
                                                                className={`rounded-[8px] px-[10px] py-[7px] text-xs font-medium ${
                                                                    is_disabled
                                                                        ? "bg-[#32418C] text-white"
                                                                        : "border border-[#E5E5E5] bg-white text-gray-700"
                                                                }`}
                                                                onClick={() => {
                                                                    setModalData({
                                                                        id,
                                                                        name: fullName,
                                                                        user_type,
                                                                    });

                                                                    if (is_disabled) {
                                                                        setEnableModalActive(true);
                                                                    } else {
                                                                        setDisableModalActive(true);
                                                                    }
                                                                }}
                                                            >
                                                                {is_disabled ? "Enable" : "Disable"}
                                                            </button>

                                                            {user.user_type !== "ADMIN" && (
                                                                <button
                                                                    type="button"
                                                                    className="rounded-[8px] bg-[#DC2626] px-[10px] py-[7px] text-xs font-medium text-white"
                                                                    onClick={() => {
                                                                        setModalData({
                                                                            id,
                                                                            name: fullName,
                                                                            user_type,
                                                                        });
                                                                        setDeleteModalActive(true);
                                                                    }}
                                                                >
                                                                    Delete
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
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
                        heading="No Administrators Found"
                        content="There are currently no administrators listed. Add new administrators to manage the platform effectively."
                    />
                )}
            </div>

            {deleteModalActive && (
                <Modal
                    onLoading={isModalLoading}
                    onLoadingLabel="Deleting..."
                    onConfirm={handleDeleteAdmin}
                    onConfirmLabel="Delete"
                    onCancel={() => {
                        setModalData({ id: "", name: "", user_type: ""});
                        setDeleteModalActive(false);
                    }}
                    heading={`Are you sure you want to delete ${modalData.name}'s account?`}
                    content="This user can never use their account to HealthPH+ anymore."
                    color="destructive"
                />
            )}

            {disableModalActive && (
                <Modal
                    onLoading={isModalLoading}
                    onLoadingLabel="Disabling..."
                    onConfirm={() => handleChangeStatus(true)}
                    onConfirmLabel="Disable"
                    onCancel={() => {
                        setModalData({ id: "", name: "", user_type: "" });
                        setDisableModalActive(false);
                    }}
                    heading={`Are you sure you want to disable ${modalData.name}'s account?`}
                    content="This user will be unable to sign in to HealthPH+ and lose access to its modules."
                    color="destructive"
                />
            )}

            {enableModalActive && (
                <Modal
                    onLoading={isModalLoading}
                    onLoadingLabel="Enabling..."
                    onConfirm={() => handleChangeStatus(false)}
                    onConfirmLabel="Enable"
                    onCancel={() => {
                        setModalData({ id: "", name: "", user_type: "" });
                        setEnableModalActive(false);
                    }}
                    heading={`Are you sure you want to enable ${modalData.name}'s account?`}
                    content="This user will receive full access to HealthPH+ such as the AI Surveillance, NLP Insights and other modules."
                    color="primary"
                />
            )}
        </>
    );
};

export default AdminsTable;