/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import LoadingSkeleton from "./LoadingSkeleton";

const SearchableSelect = ({
    id, value, selectedLabel, options = [], search = "", onSearchChange,
    onChange, onOpenChange, isLoading = false, isError = false,
    onRetry, hasMore = false, disabled = false,
}) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const buttonRef = useRef(null);
    const searchRef = useRef(null);
    const optionRefs = useRef([]);
    const choices = [{ value: "all", label: "All Accounts" }, ...(isLoading || isError ? [] : options)];
    const changeOpen = (next) => {
        setOpen(next);
        onOpenChange?.(next);
    };

    useEffect(() => {
        if (!open) return;
        searchRef.current?.focus();
        const outside = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setOpen(false);
                onOpenChange?.(false);
            }
        };
        document.addEventListener("pointerdown", outside);
        return () => document.removeEventListener("pointerdown", outside);
    }, [open, onOpenChange]);

    const select = (choice) => {
        onChange(choice);
        changeOpen(false);
        onSearchChange("");
        buttonRef.current?.focus();
    };

    return <div ref={rootRef} className="relative" onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
            event.preventDefault();
            changeOpen(false);
            buttonRef.current?.focus();
        }
    }}>
        <button
            ref={buttonRef} id={id} type="button" disabled={disabled}
            aria-label={`Account: ${selectedLabel || "All Accounts"}`}
            aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-popup`}
            className="flex h-[42px] w-full items-center justify-between gap-[8px] rounded-[10px] border border-[#E5E5E5] bg-white px-[12px] text-left text-sm text-[#333E4A] disabled:opacity-60"
            onClick={() => changeOpen(!open)}
            onKeyDown={(event) => {
                if (event.key === "ArrowDown") { event.preventDefault(); changeOpen(true); }
            }}
        >
            <span className="min-w-0 truncate">{selectedLabel || "All Accounts"}</span>
            <Icon iconName="ChevronDown" fill="#8693A0" className="h-[16px] w-[16px] shrink-0" />
        </button>
        {open && <div id={`${id}-popup`} role="dialog" aria-label="Choose an account" className="absolute left-0 top-full z-20 mt-[6px] w-full min-w-[240px] rounded-[10px] border border-[#E5E5E5] bg-white p-[8px] shadow-lg">
            <input
                ref={searchRef} type="search" aria-label="Search account names"
                placeholder="Search account names..." value={search} maxLength={100}
                onChange={(event) => onSearchChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "ArrowDown") { event.preventDefault(); optionRefs.current[0]?.focus(); }
                }}
                className="mb-[8px] h-[38px] w-full rounded-[8px] border border-[#E5E5E5] bg-white px-[10px] text-sm text-[#333E4A]"
            />
            <div className="max-h-[240px] overflow-y-auto" aria-label="Account choices">
                {choices.map((choice, index) => <button
                    key={choice.value} ref={(element) => { optionRefs.current[index] = element; }}
                    type="button" aria-pressed={choice.value === value}
                    onClick={() => select(choice)}
                    onKeyDown={(event) => {
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                            event.preventDefault();
                            optionRefs.current[(index + (event.key === "ArrowDown" ? 1 : choices.length - 1)) % choices.length]?.focus();
                        }
                    }}
                    className={`block w-full rounded-[6px] px-[10px] py-[8px] text-left text-sm text-[#333E4A] hover:bg-[#F5F5F5] focus-visible:bg-[#EEF2FF] ${choice.value === value ? "bg-[#EEF2FF] font-semibold" : "bg-white"}`}
                >
                    <span className="block break-words">{choice.label}</span>
                    {choice.description && <span className="mt-[2px] block text-xs font-normal text-[#687582]">{choice.description}</span>}
                </button>)}
                {isLoading && <div className="flex flex-col gap-[10px] p-[10px]"><LoadingSkeleton className="h-[14px] w-3/4" /><LoadingSkeleton className="h-[14px] w-2/3" /></div>}
                {isError && <div role="alert" className="p-[10px] text-xs text-[#B42318]">Unable to load accounts. <button type="button" className="underline" onClick={onRetry}>Retry</button></div>}
                {!isLoading && !isError && options.length === 0 && <p className="p-[10px] text-xs text-[#687582]">No matching account names.</p>}
            </div>
            {hasMore && !isLoading && <p className="px-[10px] pt-[8px] text-xs text-[#687582]">Type a name to find more accounts.</p>}
        </div>}
    </div>;
};

export default SearchableSelect;
