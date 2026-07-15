/* eslint-disable react/prop-types */
import ModalWithBody from "../../../components/admin/ModalWithBody";
import {
  DASHBOARD_CARD_SUBTITLE_CLASS,
  DASHBOARD_CARD_TITLE_CLASS,
} from "../dashboardTypography";

const formatTargetResponses = (target) =>
  `${Number(target || 0).toLocaleString()} target responses`;

export default function MobileSurveyScheduleModal({
  scheduleItems,
  scheduleError,
  isScheduling,
  onSelectionChange,
  onScheduledAtChange,
  onConfirm,
  onClose,
}) {
  const hasScheduleItems = scheduleItems.length > 0;
  const selectedCount = scheduleItems.filter((item) => item.selected).length;

  return (
    <ModalWithBody
      onConfirm={onConfirm}
      onConfirmLabel="Schedule Selected"
      onConfirmDisabled={!hasScheduleItems || selectedCount === 0}
      onCancel={onClose}
      onLoading={isScheduling}
      onLoadingLabel="Scheduling..."
      heading="Schedule Mobile Surveys"
      color="primary"
      additionalClasses="health-literacy-content-modal admin-brand-modal !top-[68px] !h-[calc(100vh-68px)] !pt-[20px]"
    >
      <div className="space-y-5 px-5 py-5">
        {!hasScheduleItems && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            Create a draft survey before scheduling publication.
          </div>
        )}

        {hasScheduleItems && (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={DASHBOARD_CARD_TITLE_CLASS}>
                  Draft Surveys
                </p>
                <p className={DASHBOARD_CARD_SUBTITLE_CLASS}>
                  {selectedCount} of {scheduleItems.length} selected
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="hidden grid-cols-[minmax(0,1fr)_220px] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500 md:grid">
                <span>Survey</span>
                <span>Publish Date and Time</span>
              </div>

              <div className="divide-y divide-gray-200">
                {scheduleItems.map((item) => {
                  const isScheduledSuccessfully = item.status === "success";

                  return (
                    <div
                      key={item.surveyId}
                      className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-start md:gap-4"
                    >
                      <label className="flex min-w-0 items-start gap-3">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          disabled={isScheduling || isScheduledSuccessfully}
                          onChange={(event) =>
                            onSelectionChange(
                              item.surveyId,
                              event.target.checked
                            )
                          }
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-gray-900">
                            {item.title || "Untitled survey"}
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">
                            {formatTargetResponses(item.target)}
                          </span>
                          {isScheduledSuccessfully && (
                            <span className="mt-2 inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                              Scheduled
                            </span>
                          )}
                          {item.error && (
                            <span className="mt-2 block text-xs font-semibold text-red-700">
                              {item.error}
                            </span>
                          )}
                        </span>
                      </label>

                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase text-gray-500 md:hidden">
                          Publish Date and Time
                        </label>
                        <input
                          type="datetime-local"
                          value={item.scheduledAt}
                          disabled={isScheduling || isScheduledSuccessfully}
                          onChange={(event) =>
                            onScheduledAtChange(
                              item.surveyId,
                              event.target.value
                            )
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {scheduleError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {scheduleError}
          </div>
        )}
      </div>
    </ModalWithBody>
  );
}
