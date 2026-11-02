/* eslint-disable react/prop-types */
const ModalWithBody = ({
  onConfirm,
  onConfirmDisabled,
  onConfirmLabel,
  onCancelLabel = "Cancel",
  confirmButtonStyle,
  cancelButtonStyle,
  onCancel,
  onBackdrop,
  closeOnBackdrop = true,
  onLoading,
  onLoadingLabel,
  heading,
  color,
  additionalClasses,
  leadingActions,
  headerActions,
  children,
}) => {
  return (
    <div className={`modal ${additionalClasses}`}>
      <div
        className="modal-backdrop"
        onClick={onLoading || !closeOnBackdrop ? undefined : onBackdrop ?? onCancel}
      ></div>
      <div className="modal-container">
        <div className="modal-body !p-0">
          {headerActions ? (
            <div className="flex items-start justify-between gap-[12px] border-b-2 border-gray-50 p-[20px]">
              <p className="modal-heading min-w-0 !mb-0">{heading}</p>
              <div className="ml-auto flex shrink-0 flex-col items-end gap-[6px]">
                {headerActions}
              </div>
            </div>
          ) : (
            <p className="modal-heading !p-[20px] border-b-2 border-gray-50">{heading}</p>
          )}
          {children}
        </div>
        <div className="modal-actions">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-auto">{leadingActions}</div>
            <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:items-center">
              {onCancel && (
                <button
                  className="prod-btn-base prod-btn-secondary"
                  onClick={onCancel}
                  disabled={onLoading}
                  style={cancelButtonStyle}
                >
                  {onCancelLabel}
                </button>
              )}
              <button
                className={`prod-btn-base prod-btn-${color ?? "primary"}`}
                onClick={onConfirm}
                disabled={onLoading || onConfirmDisabled}
                style={confirmButtonStyle}
              >
                {onLoading ? onLoadingLabel : onConfirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ModalWithBody;
