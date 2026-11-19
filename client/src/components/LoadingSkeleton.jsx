/* eslint-disable react/prop-types */

const LoadingSkeleton = ({ className = "h-[14px] w-[80px]", label = "Loading..." }) => (
    <span
        role="status"
        className={`inline-block max-w-full animate-pulse rounded-[6px] bg-[#E4E7EB] align-middle motion-reduce:animate-none ${className}`}
    >
        <span className="sr-only">{label}</span>
    </span>
);

export const ChartSkeleton = ({ height = 280, variant = "bars", label = "Loading chart data..." }) => (
    <div role="status" className="flex items-center justify-center p-4" style={{ height }}>
        <span className="sr-only">{label}</span>
        {variant === "pie" ? (
            <div aria-hidden="true" className="h-[220px] w-[220px] max-w-full animate-pulse rounded-full bg-[#E4E7EB] motion-reduce:animate-none" />
        ) : (
            <div aria-hidden="true" className="flex h-full w-full animate-pulse flex-col justify-around gap-4 motion-reduce:animate-none">
                {["w-[70%]", "w-[90%]", "w-[50%]", "w-[80%]", "w-[60%]"].map((width) => (
                    <div key={width} className={`h-[18px] rounded-[6px] bg-[#E4E7EB] ${width}`} />
                ))}
            </div>
        )}
    </div>
);

export default LoadingSkeleton;
