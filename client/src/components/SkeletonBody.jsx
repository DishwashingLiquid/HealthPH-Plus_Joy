const SkeletonBlock = ({ className = "" }) => (
  <div className={`animate-pulse rounded-[6px] bg-[#E4E7EB] motion-reduce:animate-none ${className}`} />
);

const SkeletonBody = ({ columns = 7, rows = 6, headers }) => {
  const columnCount = headers?.length ?? columns;
  return (
    <div role="status" className="w-full overflow-hidden">
      <span className="sr-only">Loading records...</span>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E5]">
              {Array.from({ length: columnCount }).map((_, index) => (
                <th key={index} className="px-[10px] py-[12px] text-left font-medium text-gray-500">
                  {headers ? headers[index] : <SkeletonBlock className="h-[14px] w-[70%]" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody aria-hidden="true">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-b border-[#F0F0F0]">
                {Array.from({ length: columnCount }).map((_, columnIndex) => (
                  <td key={columnIndex} className="px-[10px] py-[14px]">
                    <SkeletonBlock
                      className={
                        columnIndex === 0
                          ? "h-[16px] w-[42%]"
                          : columnIndex === columnCount - 1
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
