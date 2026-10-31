import { useId, useLayoutEffect, useRef, useState } from "react";
import Icon from "../Icon";
import LoadingSkeleton from "../LoadingSkeleton";

const PREVIEW_LIMIT = 5;
const BODY_HEIGHT = 240;

const FrequencyRows = ({
    rows, totalReports, isFetching, isError, onRetry, fixedLabels,
    emptyMessage, rowHeight = 48, fullList = false,
}) => {
    if (isError) {
        return (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center text-sm text-[#B42318]">
                <p>Unable to load results.</p>
                <button type="button" onClick={onRetry} className="mt-[8px] underline">
                    Retry
                </button>
            </div>
        );
    }

    if (!isFetching && (totalReports === 0 || rows.length === 0)) {
        return (
            <p className="py-[12px] text-sm text-gray-500">
                {totalReports === 0 ? "No processed reports available." : emptyMessage}
            </p>
        );
    }

    const displayedRows = isFetching && !fixedLabels
        ? Array.from({ length: PREVIEW_LIMIT }, (_, index) => ({ entity: `loading-${index}` }))
        : rows;

    return (
        <ul>
            {displayedRows.map(({ entity, report_count, color }) => (
                <li
                    key={entity}
                    className="flex flex-col justify-center py-[6px]"
                    style={{ minHeight: rowHeight }}
                >
                    <div className="mb-[4px] flex items-start justify-between gap-[12px]">
                        {isFetching && !fixedLabels ? (
                            <LoadingSkeleton className="h-[16px] w-[45%]" />
                        ) : (
                            <span
                                title={entity}
                                className={`min-w-0 text-sm font-medium text-gray-800 ${fullList ? "break-words" : "truncate"}`}
                            >
                                {entity}
                            </span>
                        )}
                        <span className="shrink-0 text-sm font-semibold text-gray-800">
                            {isFetching
                                ? <LoadingSkeleton className="h-[16px] w-[60px]" />
                                : `${report_count.toLocaleString()} ${report_count === 1 ? "report" : "reports"}`}
                        </span>
                    </div>
                    {isFetching ? (
                        <LoadingSkeleton className="h-[6px] w-full" />
                    ) : (
                        <div className="h-[6px] overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                            <div
                                className="h-full rounded-full"
                                style={{
                                    width: `${totalReports ? Math.min(100, report_count / totalReports * 100) : 0}%`,
                                    backgroundColor: color,
                                }}
                            />
                        </div>
                    )}
                </li>
            ))}
        </ul>
    );
};

const FrequencyListModal = ({ title, description, onClose, ...listProps }) => {
    const dialogRef = useRef(null);
    const closeButtonRef = useRef(null);
    const titleId = useId();
    const descriptionId = useId();

    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        const previouslyFocused = document.activeElement;
        const bodyOverflow = document.body.style.overflow;
        const htmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
        dialog.showModal();
        closeButtonRef.current?.focus();

        return () => {
            dialog.close();
            document.body.style.overflow = bodyOverflow;
            document.documentElement.style.overflow = htmlOverflow;
            if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
                previouslyFocused.focus();
            }
        };
    }, []);

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[440px] overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white p-0 text-gray-800 shadow-xl backdrop:bg-[#34405499] backdrop:backdrop-blur-sm"
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
            onClick={(event) => {
                if (event.target !== event.currentTarget) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                if (event.clientX < bounds.left || event.clientX > bounds.right
                    || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
            }}
        >
            <div className="flex max-h-[min(85dvh,800px)] flex-col">
                <div className="shrink-0 border-b border-[#E5E5E5] px-[28px] py-[20px]">
                    <div className="flex items-start justify-between gap-[12px]">
                        <h2 id={titleId} className="text-[18px] font-semibold text-gray-800">
                            {title}
                        </h2>
                        <button
                            ref={closeButtonRef}
                            type="button"
                            aria-label={`Close ${title.toLowerCase()} list`}
                            onClick={onClose}
                            className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[6px] text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#32418C]"
                        >
                            <Icon iconName="Close" height="20px" width="20px" stroke="currentColor" />
                        </button>
                    </div>
                    <p id={descriptionId} className="mt-[6px] text-sm text-gray-500">{description}</p>
                </div>
                <div
                    role="region"
                    aria-label={`All ${title.toLowerCase()} report counts`}
                    aria-busy={listProps.isFetching}
                    tabIndex={0}
                    className="min-h-0 overflow-y-auto overscroll-contain px-[28px] py-[16px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#32418C]"
                >
                    <FrequencyRows {...listProps} fullList />
                </div>
            </div>
        </dialog>
    );
};

const EntityFrequencyPanel = ({
    title, description, rows, totalReports, isFetching, isError, onRetry,
    fixedLabels = false, emptyMessage = "No matching results available.",
}) => {
    const [showAll, setShowAll] = useState(false);
    const previewRows = fixedLabels ? rows : rows.slice(0, PREVIEW_LIMIT);
    const canViewAll = !fixedLabels && rows.length > PREVIEW_LIMIT
        && totalReports > 0 && !isFetching && !isError;
    const listProps = { totalReports, isFetching, isError, onRetry, fixedLabels, emptyMessage };

    return (
        <section className="row-span-2 grid min-w-0 grid-rows-[subgrid] gap-y-[12px] rounded-[12px] border border-[#E5E5E5] bg-white p-[20px]">
            <div>
                <h2 className="mb-[6px] text-[18px] font-semibold text-gray-800">{title}</h2>
                <p className="text-sm text-gray-500">{description}</p>
            </div>
            <div>
                <div role="region" aria-label={`${title} report counts`} aria-busy={isFetching} style={{ height: BODY_HEIGHT }}>
                    <FrequencyRows {...listProps} rows={previewRows} rowHeight={fixedLabels ? 60 : 48} />
                </div>
                <div className="mt-[12px] flex h-[20px] justify-end">
                    {canViewAll && (
                        <button
                            type="button"
                            aria-label={`View all ${title.toLowerCase()}`}
                            aria-haspopup="dialog"
                            onClick={(event) => {
                                event.currentTarget.focus();
                                setShowAll(true);
                            }}
                            className="text-sm font-medium text-[#32418C] underline underline-offset-2 hover:text-[#27346F]"
                        >
                            View all
                        </button>
                    )}
                </div>
            </div>
            {showAll && (
                <FrequencyListModal
                    {...listProps}
                    title={title}
                    description={description}
                    rows={rows}
                    onClose={() => setShowAll(false)}
                />
            )}
        </section>
    );
};

export default EntityFrequencyPanel;
