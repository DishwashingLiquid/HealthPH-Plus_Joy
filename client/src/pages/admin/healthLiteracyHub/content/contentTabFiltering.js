import {
  getAnalyticsRegionValue,
  normalizeApiContent,
} from "../shared";

export const filterContentItems = (content, searchQuery) => {
  if (!searchQuery) return content;

  const searchTerms = searchQuery
    .toLowerCase()
    .split(" ")
    .filter((term) => term.length > 0);

  return content.filter((item) => {
    const searchableText = [
      item.title,
      item.description,
      item.source,
      item.author,
      item.language,
      item.tags ? item.tags.join(" ") : "",
      item.topics ? item.topics.join(" ") : "",
      item.diseases ? item.diseases.join(" ") : "",
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

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
  }));

  return filterContentItems(apiContent, searchQuery);
};
