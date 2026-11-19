/* eslint-disable react/prop-types */
import LoadingSkeleton from "./LoadingSkeleton";
import { ToolbarButton } from "./ToolbarControls";

const TablePagination = ({
    page, pageCount, first, last, total, itemLabel,
    isLoading = false, isError = false, onPageChange,
    errorMessage = "Account range unavailable",
}) => (
    <nav aria-label={`${itemLabel} pagination`} className="mt-[16px] flex flex-wrap items-center justify-between gap-[12px] border-t border-[#E5E5E5] pt-[16px]">
        <p className="text-sm text-gray-500">
            {isLoading ? (
                <LoadingSkeleton className="h-[14px] w-[180px]" label={`Loading ${itemLabel} range...`} />
            ) : isError ? (
                errorMessage
            ) : (
                `Showing ${first.toLocaleString()}–${last.toLocaleString()} of ${total.toLocaleString()} ${itemLabel}`
            )}
        </p>
        <div className="flex items-center gap-[12px]">
            <ToolbarButton disabled={isLoading || isError || page <= 1} onClick={() => onPageChange(page - 1)}>
                Previous
            </ToolbarButton>
            <span className="text-sm text-gray-600">
                Page{" "}
                {isLoading ? <LoadingSkeleton className="h-[14px] w-[48px]" label="Loading page count..." />
                    : isError ? "unavailable" : `${page} of ${pageCount}`}
            </span>
            <ToolbarButton disabled={isLoading || isError || page >= pageCount} onClick={() => onPageChange(page + 1)}>
                Next
            </ToolbarButton>
        </div>
    </nav>
);

export default TablePagination;
