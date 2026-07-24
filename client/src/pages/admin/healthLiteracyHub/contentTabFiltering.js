import {
  getAnalyticsRegionValue,
  normalizeApiContent,
} from "./shared";

export const filterContentItems = (content, searchQuery) => {
  if (!searchQuery) return content;

  const searchTerms = searchQuery
    .toLowerCase()
    .split(" ")
    .filter((term) => term.length > 0);

  return content.filter((item) => {
    const searchableText = `${item.title} ${item.description} ${
      item.tags ? item.tags.join(" ") : ""
    }`.toLowerCase();

    return searchTerms.some((term) => searchableText.includes(term));
  });
};

export const getFilteredContentItems = ({
  fetchedContent,
  contentTypeLabel,
  searchQuery,
}) => {
  const apiContent = normalizeApiContent(fetchedContent).map((item) => ({
    ...item,
    contentType: contentTypeLabel,
    region: getAnalyticsRegionValue(contentTypeLabel, item),
    tags: contentTypeLabel === "Infographics" ? [] : item.tags,
  }));

  return filterContentItems(apiContent, searchQuery);
};
