const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse rounded-[6px] bg-[#E5E7EB] ${className}`} />
);

const SkeletonTable = ({ columns = 7, rows = 6 }) => {
  return (
    <div className="flex flex-col gap-[10px]">
      <div>
        <SkeletonBlock className="h-[28px] w-[220px]" />
        <SkeletonBlock className="mt-[8px] h-[16px] w-[360px] max-w-full" />
      </div>

      <div className="rounded-[12px] border border-[#E5E5E5] bg-white p-[10px]">
        <div className="flex flex-col gap-[12px] xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-[12px]">
            <SkeletonBlock className="h-[38px] w-[240px]" />
            <SkeletonBlock className="h-[38px] w-[120px]" />
          </div>

          <div className="flex flex-wrap gap-[8px]">
            <SkeletonBlock className="h-[38px] w-[92px]" />
            <SkeletonBlock className="h-[38px] w-[92px]" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-[#E5E5E5] bg-white">
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
                          columnIndex === columns - 1
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

        <div className="flex items-center justify-between border-t border-[#E5E5E5] px-[16px] py-[14px]">
          <SkeletonBlock className="h-[16px] w-[140px]" />
          <SkeletonBlock className="h-[34px] w-[120px]" />
        </div>
      </div>
    </div>
  );
};

export default SkeletonTable;