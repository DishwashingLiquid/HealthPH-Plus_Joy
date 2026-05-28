/* eslint-disable react/prop-types */
import { useState } from "react";
import {
  AnalyticsBarList,
  AnalyticsPanel,
  AnalyticsTable,
  RelatedContentModal,
} from "../AnalyticsShared";
import {
  buildTopSearchTopicItems,
  filterAnalyticsRows,
  normalizeSearchTopicAnalyticsRows,
} from "../shared";

const SearchTopicAnalyticsPage = ({ filters, report }) => {
  const [relatedContentModal, setRelatedContentModal] = useState(null);
  const searchRows = filterAnalyticsRows(
    normalizeSearchTopicAnalyticsRows(),
    filters
  );
  const searchTopicTableRows = report.rows.map((row) =>
    row.map((cell) => {
      if (cell?.type !== "related-content" || cell.disabled) return cell;

      return {
        ...cell,
        onClick: () =>
          setRelatedContentModal({
            searchTerm: cell.searchTerm,
            matches: cell.matches,
          }),
      };
    })
  );

  return (
    <>
      <div className="grid grid-cols-1 gap-[16px] xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <AnalyticsPanel title="Top Search Topics">
          <AnalyticsBarList
            items={buildTopSearchTopicItems(searchRows)}
            labelKey="label"
            valueKey="value"
          />
        </AnalyticsPanel>
        <AnalyticsPanel title="Search and Topic Analysis">
          <AnalyticsTable
            columns={report.columns}
            rows={searchTopicTableRows}
            emptyMessage="No search activity matches the selected filters."
          />
        </AnalyticsPanel>
      </div>
      {relatedContentModal && (
        <RelatedContentModal
          searchTerm={relatedContentModal.searchTerm}
          matches={relatedContentModal.matches}
          onClose={() => setRelatedContentModal(null)}
        />
      )}
    </>
  );
};

export default SearchTopicAnalyticsPage;
