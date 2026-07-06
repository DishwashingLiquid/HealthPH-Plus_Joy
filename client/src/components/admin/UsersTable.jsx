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

import Regions from "../../assets/data/regions.json";
import MultiSelect from "../MultiSelect";

const UsersTable = ({
  users,
  setCurrentData,
  tableTabs,
  searchQuery,
  setSearchQuery,
}) => {
  const user = useSelector((state) => state.auth.user);

  const [tableData, setTableData] = useState([]);

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

  const [deleteUser] = useDeleteUsersMutation();

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

  const handleDeleteUser = async () => {
    setIsModalLoading(true);

    const response = await deleteUser(modalData.id);

    if (!response) {
      toast(
        <Snackbar
          iconName="Error"
          size="snackbar-sm"
          color="destructive"
          message={`Failed to delete user`}
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
        message={`User deleted successfully`}
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

  const [updateModalActive, setUpdateModalActive] = useState(false);

  const [updateModalData, setUpdateModalData] = useState({
    id: "",
    name: "",
    accessible_regions: [],
  });

  const [updateModalErrors, setUpdateModalErrors] = useState({
    accessible_regions: "",
  });

  const [updateUser] = useUpdateUserMutation();

  const handleUpdateUser = async () => {
    const payload = {
      id: updateModalData.id,
      accessible_regions: updateModalData.accessible_regions.join(","),
    };

    if (payload.accessible_regions == "" || updateModalData.length == 0) {
      setUpdateModalErrors((errors) => {
        return {
          ...errors,
          accessible_regions: "Must choose at least one accessible region.",
        };
      });

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

      detail.map(({ field, error }, i) => {
        if (field in updateModalData) {
          setUpdateModalErrors((formErrors) => ({
            ...formErrors,
            [field]: error,
          }));
        } else if (field == "error") {
          setError(error);
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

  return (
    <>
      <div className="overflow-x-auto">
        {users.length > 0 ? (
          tableData.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E5E5] text-left text-gray-500">
                  <th className="px-[10px] py-[12px] font-medium">Full Name</th>
                  <th className="px-[10px] py-[12px] font-medium">Email</th>
                  <th className="px-[10px] py-[12px] font-medium">Regional Office</th>
                  <th className="px-[10px] py-[12px] font-medium">Organization</th>
                  <th className="px-[10px] py-[12px] font-medium">Date Created</th>
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
                    region,
                    accessible_regions,
                    organization,
                    role_label,
                    created_at,
                    is_disabled,
                    user_type,
                  }) => {
                    const fullName = `${first_name} ${last_name}`;
                    const normalizedAccessibleRegions = Array.isArray(accessible_regions)
                      ? accessible_regions
                      : String(accessible_regions || "").split(",").filter(Boolean);

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
                          {displayRegion(region)}
                        </td>
                        <td className="px-[10px] py-[14px] text-gray-600">
                          <Highlighter
                            highlightClassName="rounded-[2px] bg-[#FFE81A] p-[2px] font-medium text-[#000]"
                            searchWords={searchWords}
                            autoEscape={true}
                            textToHighlight={
                              role_label
                                ? `${organization} (${role_label})`
                                : organization
                            }
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
                        <td className="px-[10px] py-[14px]">
                          <div className="flex flex-wrap gap-[8px]">
                           {/*  <button
                              type="button"
                              className="rounded-[8px] bg-[#32418C] px-[10px] py-[7px] text-xs font-medium text-white"
                              onClick={() => {
                                setUpdateModalActive({
                                  id,
                                  name: fullName,
                                  accessible_regions: normalizedAccessibleRegions,
                                });
                                setUpdateModalActive(true);
                              }}
                            >
                              Update
                            </button> */}
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
                          </div>
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

      {deleteModalActive && (
        <Modal
          onLoading={isModalLoading}
          onLoadingLabel="Deleting..."
          onConfirm={() => {
            handleDeleteUser();
          }}
          onConfirmLabel="Delete"
          onCancel={() => {
            setModalData({ id: "", name: "", user_type: "" });
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
          onLoadingLabel={"Disabling"}
          onConfirm={() => {
            handleChangeStatus(true);
          }}
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
          onLoadingLabel={"Enabling"}
          onConfirm={() => {
            handleChangeStatus(false);
          }}
          onConfirmLabel="Enable"
          onCancel={() => {
            setModalData({ id: "", name: "", user_type: "" });
            setEnableModalActive(false);
          }}
          heading={`Are you sure you want to enable ${modalData.name}'s account?`}
          content="This user will receive full access to HealthPH+ such as the Analytics, Trends Map, and other modules."
          color="primary"
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
            setUpdateModalData({ id: "", name: "", accessible_regions: [] });
            setUpdateModalActive(false);
          }}
          heading={`Update ${updateModalData.name}'s account`}
          content="This user will receive full access to HealthPH+ such as the Analytics, Trends Map, and other modules."
          color="primary"
        >
          <div className="p-[20px]">
            <FieldGroup
              label="Accessible Regions"
              labelFor="accessible-regions"
              additionalClasses="w-full mb-[20px]"
              caption={
                updateModalErrors.accessible_regions != ""
                  ? updateModalErrors.accessible_regions
                  : ""
              }
              state={updateModalErrors.accessible_regions != "" ? "error" : ""}
            >
              <MultiSelect
                options={Regions.regions}
                defaultValue={updateModalData.accessible_regions}
                placeHolder="Select Region/s"
                onChange={(e) => {
                  setUpdateModalErrors((errors) => {
                    return { ...errors, accessible_regions: "" };
                  });
                  setUpdateModalData((data) => {
                    return {
                      ...data,
                      accessible_regions: e.map((v, i) => v.value),
                    };
                  });
                }}
                selectAllLabel="All Regions"
                selectAll={false}
                additionalClassname="w-full mt-[8px]"
                editable={true}
                state={
                  updateModalErrors.accessible_regions != "" ? "error" : ""
                }
              />
            </FieldGroup>
          </div>
        </ModalWithBody>
      )}
    </>
  );
};

export default UsersTable;
