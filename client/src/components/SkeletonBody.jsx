const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse rounded-[6px] bg-[#E4E7EB] ${className}`} />
);

const SkeletonBody = ({ columns = 7, rows = 6 }) => {
  return (
    <div className="w-full overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E5]">
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index} className="px-[10px] py-[12px]">
                  <SkeletonBlock className="h-[14px] w-[70%]" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-[#F0F0F0]">
                {Array.from({ length: columns }).map((_, columnIndex) => (
                  <td key={columnIndex} className="px-[10px] py-[14px]">
                    <SkeletonBlock
                      className={
                        columnIndex === 0
                          ? "h-[16px] w-[42%]"
                          : columnIndex === columns - 1
                          ? "h-[22px] w-[78px] rounded-full"
                          : "h-[16px] w-[82%]"
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SkeletonBody;