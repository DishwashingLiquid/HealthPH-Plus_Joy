/* eslint-disable react/prop-types */
import Icon from "./Icon";

export const ToolbarSearch = ({
    placeholder = "Search...",
    value,
    onChange,
    className = "",
}) => {
    return (
        <div className={`relative w-full xl:w-[320px] ${className}`}>
            <Icon
                iconName="Search"
                height="18px"
                width="18px"
                fill="none"
                stroke="#8693A0"
                className="absolute left-[12px] top-1/2 -translate-y-1/2"
            />
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                className="border border-[#E5E5E5] rounded-[10px] pl-[40px] pr-[14px] py-[10px] text-sm w-full"
            />
        </div>
    );
};

export const ToolbarButton = ({
    children,
    iconName,
    variant = "secondary",
    onClick,
    className = "",
}) => {
    const isPrimary = variant === "primary";

    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-[10px] px-[16px] py-[10px] text-sm flex items-center gap-[8px] ${
                isPrimary
                    ? "bg-[#32418C] text-white"
                    : "border border-[#E5E5E5] bg-[#F8F9FA] text-gray-800"
            } ${className}`}
        >
            {iconName && (
                <Icon
                    iconName={iconName}
                    height="16px"
                    width="16px"
                    fill="none"
                    stroke="#FFF"
                />
            )}
            <span>{children}</span>
        </button>
    );
};

export const ToolbarSelect = ({
    children,
    className = "",
    value,
    onChange,
}) => {
    return (
        <select
            value={value}
            onChange={onChange}
            className={`border border-[#E5E5E5] rounded-[10px] px-[14px] py-[10px] text-sm bg-white ${className}`}
        >
            {children}
        </select>
    );
};
