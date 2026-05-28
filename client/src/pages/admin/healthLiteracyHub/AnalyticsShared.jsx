/* eslint-disable react/prop-types */
import { useState } from "react";
import Icon from "../../../components/Icon";
import {
  REVIEWER_OPTIONS,
  formatNumber,
  getAnalyticsCellText,
} from "./shared";
export const AnalyticsSelect = ({ label, value, options, onChange }) => {
  return (
    <label className="flex flex-col gap-[6px]">
      <span className="text-[13px] font-semibold text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[40px] rounded-[8px] border border-[#D0D5DD] bg-white px-[12px] text-[14px] text-gray-800 outline-none focus:border-[#6A8EB5] focus:ring-2 focus:ring-[#6A8EB5]/20"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
};

export const AnalyticsMetricCard = ({ label, value, detail }) => {
  return (
    <div className="rounded-[8px] border border-[#E5E5E5] bg-white p-[16px]">
      <p className="text-[13px] font-medium text-gray-500">{label}</p>
      <p className="mt-[6px] text-[24px] font-semibold text-gray-900">{value}</p>
      {detail && <p className="mt-[4px] text-[12px] text-gray-500">{detail}</p>}
    </div>
  );
};

export const AnalyticsBarList = ({
  items,
  labelKey,
  valueKey,
  valueSuffix = "",
}) => {
  const maxValue = Math.max(...items.map((item) => Number(item[valueKey] ?? 0)), 1);

  return (
    <div className="flex flex-col gap-[12px]">
      {items.map((item) => {
        const value = Number(item[valueKey] ?? 0);
        return (
          <div key={item[labelKey]} className="flex flex-col gap-[6px]">
            <div className="flex items-center justify-between gap-[12px] text-[13px]">
              <span className="font-medium text-gray-700">{item[labelKey]}</span>
              <span className="text-gray-500">
                {formatNumber(value)}
                {valueSuffix}
              </span>
            </div>
            <div className="h-[8px] overflow-hidden rounded-full bg-[#EEF2F6]">
              <div
                className="h-full rounded-full bg-[#78C6B2]"
                style={{ width: `${Math.max((value / maxValue) * 100, 4)}%` }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TEXT_DETAILS_MIN_LENGTH = 32;

const isCustomAnalyticsCell = (cell) => {
  return Boolean(cell && typeof cell === "object" && cell.type);
};

const shouldShowTextDetails = (cell) => {
  if (isCustomAnalyticsCell(cell)) return false;

  return String(cell ?? "").trim().length >= TEXT_DETAILS_MIN_LENGTH;
};

const renderAnalyticsTableCell = (cell, options = {}) => {
  if (cell?.type === "content") {
    return (
      <div className="flex min-w-[220px] flex-col gap-[3px]">
        <span className="font-semibold text-gray-900">{cell.title}</span>
        {cell.description && (
          <span className="text-[12px] leading-[1.35] text-gray-500">
            {cell.description}
          </span>
        )}
      </div>
    );
  }

  if (cell?.type === "status") {
    return (
      <span
        className={`inline-flex min-w-[92px] items-center justify-center rounded-full border px-[10px] py-[4px] text-[12px] font-semibold ${cell.className}`}
      >
        {cell.label}
      </span>
    );
  }

  if (cell?.type === "result-status") {
    return (
      <span
        className={`inline-flex min-w-[96px] items-center justify-center rounded-full border px-[10px] py-[4px] text-[12px] font-semibold ${cell.className}`}
      >
        {cell.label}
      </span>
    );
  }

  if (cell?.type === "related-content") {
    return (
      <button
        type="button"
        onClick={cell.onClick}
        disabled={cell.disabled}
        className={`inline-flex min-h-[34px] items-center justify-center rounded-[8px] border px-[12px] text-[12px] font-semibold transition ${
          cell.disabled
            ? "cursor-not-allowed border-[#D0D5DD] bg-[#F8FAFC] text-gray-400"
            : "border-[#6A8EB5] bg-white text-[#315F8C] hover:bg-[#F0F6FC] focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]/30"
        }`}
      >
        {cell.label}
      </button>
    );
  }

  if (options.canOpenTextDetails) {
    return (
      <button
        type="button"
        onClick={options.onOpenTextDetails}
        className="block w-full rounded-[6px] text-left text-gray-700 transition hover:text-[#315F8C] focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]/30"
        aria-label={`View full ${options.columnLabel}`}
      >
        <span className="line-clamp-2">{cell}</span>
      </button>
    );
  }

  return <span className="line-clamp-2">{cell}</span>;
};

const AnalyticsTextDetailsModal = ({
  columnLabel,
  value,
  contextRows,
  onClose,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 top-[68px] z-30 flex items-center justify-center bg-transparent px-[16px] py-[20px]">
      <div
        className="absolute inset-0 bg-[rgba(52,64,84,0.6)] backdrop-blur-[8px]"
        onClick={onClose}
      ></div>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-text-details-title"
        className="relative z-10 flex max-h-[calc(100vh-40px)] w-full max-w-[720px] flex-col rounded-[8px] border-2 border-gray-50 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-[16px] border-b-2 border-gray-50 p-[16px] sm:p-[20px]">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-gray-500">
              Full Details
            </p>
            <h2
              id="analytics-text-details-title"
              className="mt-[4px] text-[18px] font-semibold text-gray-900"
            >
              {columnLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-[8px] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
            aria-label="Close full details"
          >
            <Icon
              iconName="Close"
              height="22px"
              width="22px"
              stroke="#344054"
            />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-[16px] sm:p-[20px]">
          <div className="rounded-[8px] border border-[#E5E5E5] bg-[#F8FAFC] p-[14px]">
            <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.55] text-gray-800">
              {value}
            </p>
          </div>

          <div className="mt-[16px]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-gray-500">
              Row Context
            </p>
            <div className="mt-[10px] grid grid-cols-1 gap-[10px] sm:grid-cols-2">
              {contextRows.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  className="rounded-[8px] border border-[#E5E5E5] p-[12px]"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500">
                    {item.label}
                  </p>
                  <p className="mt-[4px] break-words text-[13px] leading-[1.45] text-gray-800">
                    {item.value || "N/A"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AnalyticsTable = ({
  columns,
  rows,
  emptyMessage,
  onRowClick,
  getRowLabel,
}) => {
  const [textDetailsModal, setTextDetailsModal] = useState(null);

  const openTextDetailsModal = ({ cell, row, cellIndex }) => {
    setTextDetailsModal({
      columnLabel: columns[cellIndex],
      value: getAnalyticsCellText(cell),
      contextRows: columns.map((column, index) => ({
        label: column,
        value: getAnalyticsCellText(row[index]),
      })),
    });
  };

  return (
    <>
      <div className="overflow-hidden rounded-[8px] border border-[#E5E5E5] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#E5E5E5]">
            <thead className="bg-[#F8FAFC]">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column}
                    className="px-[14px] py-[12px] text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-gray-500"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-[14px] py-[28px] text-center text-[14px] text-gray-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIndex) => {
                  const isClickableRow = Boolean(onRowClick);

                  return (
                  <tr
                    key={`${row.map(getAnalyticsCellText).join("-")}-${rowIndex}`}
                    tabIndex={isClickableRow ? 0 : undefined}
                    role={isClickableRow ? "button" : undefined}
                    aria-label={
                      isClickableRow
                        ? getRowLabel?.(row, rowIndex) ?? "Open row actions"
                        : undefined
                    }
                    onClick={isClickableRow ? () => onRowClick(row, rowIndex) : undefined}
                    onKeyDown={
                      isClickableRow
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onRowClick(row, rowIndex);
                            }
                          }
                        : undefined
                    }
                    className={
                      isClickableRow
                        ? "cursor-pointer transition hover:bg-[#F8FAFC] focus:bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#6A8EB5]/30"
                        : undefined
                    }
                  >
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${cellIndex}-${getAnalyticsCellText(cell)}`}
                        className="max-w-[340px] px-[14px] py-[12px] text-[13px] text-gray-700"
                      >
                        {renderAnalyticsTableCell(cell, {
                          canOpenTextDetails:
                            !isClickableRow && shouldShowTextDetails(cell),
                          columnLabel: columns[cellIndex],
                          onOpenTextDetails: () =>
                            openTextDetailsModal({ cell, row, cellIndex }),
                        })}
                      </td>
                    ))}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {textDetailsModal && (
        <AnalyticsTextDetailsModal
          columnLabel={textDetailsModal.columnLabel}
          value={textDetailsModal.value}
          contextRows={textDetailsModal.contextRows}
          onClose={() => setTextDetailsModal(null)}
        />
      )}
    </>
  );
};

export const AnalyticsPanel = ({ title, children }) => {
  return (
    <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[16px]">
      <h3 className="mb-[14px] text-[16px] font-semibold text-gray-900">
        {title}
      </h3>
      {children}
    </div>
  );
};

export const RelatedContentModal = ({ searchTerm, matches, onClose }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 top-[68px] z-20 flex items-center justify-center bg-transparent px-[16px] py-[20px]">
      <div
        className="absolute inset-0 bg-[rgba(52,64,84,0.6)] backdrop-blur-[8px]"
        onClick={onClose}
      ></div>
      <div className="relative z-10 flex max-h-[calc(100vh-40px)] w-full max-w-[720px] flex-col rounded-[8px] border-2 border-gray-50 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-[16px] border-b-2 border-gray-50 p-[16px] sm:p-[20px]">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-gray-500">
              Related Content
            </p>
            <h2 className="mt-[4px] text-[18px] font-semibold text-gray-900">
              {searchTerm}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-[8px] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]"
            aria-label="Close related content"
          >
            <Icon
              iconName="Close"
              height="22px"
              width="22px"
              stroke="#344054"
            />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-[16px] sm:p-[20px]">
          <div className="flex flex-col gap-[10px]">
            {matches.map((item) => (
              <div
                key={`${item.contentType}-${item.id}-${item.title}`}
                className="rounded-[8px] border border-[#E5E5E5] p-[12px]"
              >
                <div className="flex flex-col gap-[6px] sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[14px] font-semibold text-gray-900">
                      {item.title}
                    </p>
                    <p className="mt-[3px] text-[12px] text-gray-500">
                      {item.contentType}
                    </p>
                  </div>
                  {item.matchedTags.length > 0 && (
                    <span className="rounded-full bg-[#EAF3FF] px-[10px] py-[4px] text-[12px] font-semibold text-[#175CD3]">
                      {item.matchedTags.join(", ")}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="mt-[8px] text-[13px] leading-[1.45] text-gray-600">
                    {item.description}
                  </p>
                )}
                {item.tags.length > 0 && (
                  <div className="mt-[10px] flex flex-wrap gap-[6px]">
                    {item.tags.slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-[4px] bg-[#F5F5F5] px-[8px] py-[4px] text-[11px] font-medium text-gray-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ReviewQueueActionModal = ({
  reviewItem,
  selectedReviewer,
  onReviewerChange,
  onEdit,
  onSendForReview,
  onMarkReviewed,
  onArchive,
  onCreateRelatedContent,
  onPinToHub,
  onClose,
  isLoading,
}) => {
  const reasons = reviewItem.reasons.join("; ");

  const actionButtonClass =
    "flex min-h-[42px] items-center justify-center gap-[8px] rounded-[8px] border border-[#D0D5DD] bg-white px-[12px] text-[13px] font-semibold text-gray-700 transition hover:bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#6A8EB5]/30 disabled:cursor-not-allowed disabled:text-gray-400";

  return (
    <div className="fixed bottom-0 left-0 right-0 top-[68px] z-30 flex items-center justify-center bg-transparent px-[16px] py-[20px]">
      <div
        className="absolute inset-0 bg-[rgba(52,64,84,0.6)] backdrop-blur-[8px]"
        onClick={isLoading ? undefined : onClose}
      ></div>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-queue-action-title"
        className="relative z-10 flex max-h-[calc(100vh-40px)] w-full max-w-[760px] flex-col rounded-[8px] border-2 border-gray-50 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-[16px] border-b-2 border-gray-50 p-[16px] sm:p-[20px]">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.04em] text-gray-500">
              Review Queue
            </p>
            <h2
              id="review-queue-action-title"
              className="mt-[4px] text-[18px] font-semibold text-gray-900"
            >
              {reviewItem.title}
            </h2>
            <p className="mt-[6px] text-[13px] text-gray-500">
              {reviewItem.contentType} - {reviewItem.lastReviewDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-[8px] hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#6A8EB5] disabled:cursor-not-allowed"
            aria-label="Close review queue actions"
          >
            <Icon iconName="Close" height="22px" width="22px" stroke="#344054" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-[16px] sm:p-[20px]">
          <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2">
            <div className="rounded-[8px] border border-[#E5E5E5] bg-[#F8FAFC] p-[12px]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500">
                Reason for Review
              </p>
              <p className="mt-[5px] text-[13px] leading-[1.45] text-gray-800">
                {reasons}
              </p>
            </div>
            <label className="rounded-[8px] border border-[#E5E5E5] bg-[#F8FAFC] p-[12px]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-500">
                Assigned Reviewer
              </span>
              <select
                value={selectedReviewer}
                onChange={(event) => onReviewerChange(event.target.value)}
                disabled={isLoading}
                className="mt-[8px] min-h-[38px] w-full rounded-[8px] border border-[#D0D5DD] bg-white px-[10px] text-[13px] text-gray-800 outline-none focus:border-[#6A8EB5] focus:ring-2 focus:ring-[#6A8EB5]/20"
              >
                {REVIEWER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-[16px] grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={onEdit}
              disabled={isLoading}
              className={actionButtonClass}
            >
              <Icon iconName="Document" height="16px" width="16px" fill="#344054" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={onSendForReview}
              disabled={isLoading}
              className={actionButtonClass}
            >
              <Icon iconName="User" height="16px" width="16px" fill="#344054" />
              <span>Send for Review</span>
            </button>
            <button
              type="button"
              onClick={onMarkReviewed}
              disabled={isLoading}
              className={actionButtonClass}
            >
              <Icon iconName="Check" height="16px" width="16px" fill="#344054" />
              <span>Mark as Reviewed</span>
            </button>
            <button
              type="button"
              onClick={onArchive}
              disabled={isLoading}
              className={`${actionButtonClass} border-[#F8B4B4] text-[#B42318] hover:bg-[#FEECEC]`}
            >
              <Icon iconName="Minus" height="16px" width="16px" fill="#B42318" />
              <span>Archive</span>
            </button>
            <button
              type="button"
              onClick={onCreateRelatedContent}
              disabled={isLoading}
              className={actionButtonClass}
            >
              <Icon iconName="Plus" height="16px" width="16px" fill="#344054" />
              <span>Create Related Content</span>
            </button>
            <button
              type="button"
              onClick={onPinToHub}
              disabled={isLoading}
              className={actionButtonClass}
            >
              <Icon iconName="ArrowUp" height="16px" width="16px" fill="#344054" />
              <span>Pin to Hub</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
