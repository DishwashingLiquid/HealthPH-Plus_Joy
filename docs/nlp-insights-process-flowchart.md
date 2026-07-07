# NLP Insights Process Flowchart

## Purpose

This document summarizes the current authenticated-user journey in the HealthPH+ NLP Insights dashboard. It simplifies the process from opening NLP Insights through reviewing Named Entity Recognition, Sentiment Analysis, Language Detection, and the region-filtered Top Words and Word Cloud reports.

## Scope

The flow focuses on the current dashboard-level NLP Insights interface for authenticated users. It documents the implemented tab navigation, visible static dashboard panels, live Top Words and Word Cloud report queries, loading states, empty states, and region-filter behavior only.

## Flowchart Symbol Legend

| Symbol | Meaning | Mermaid example |
| --- | --- | --- |
| Terminator | Start or end of a process | `([Start])` |
| Process | Action or system step | `[Open dashboard]` |
| Decision | Yes/no or branching question | `{Select tab}` |
| Input/Output | User input, visible output, or notification | `[/View chart/]` |
| Document/Report | Printable or exportable output | `[/View report/]` |
| Database | Stored system data | `[(Analytics API data)]` |
| Connector | Return point or continuation | `((NLP task selection))` |

## Main NLP Insights Flow

```mermaid
flowchart TD
    start([Start])
    openDashboard[Open authenticated dashboard]
    openInsights[Open NLP Insights]
    viewHeader[/View NLP Insights title and description/]
    viewTabs[/View Named Entity Recognition, Sentiment Analysis, and Language Detection tabs/]
    hub((NLP task selection))

    start --> openDashboard --> openInsights --> viewHeader --> viewTabs --> hub

    hub --> tab{Select tab}

    tab -- Named Entity Recognition --> ner[Open Named Entity Recognition tab]
    ner --> viewEntityPanels[/View Diseases, Symptom Frequency, and Locations panels/]
    viewEntityPanels --> reviewDemo[/Review Named Entity Recognition Demo posts and highlighted entities/]
    reviewDemo --> reportChoice{Review report}

    reportChoice -- Top Words --> topWordsFilter{Account type}
    topWordsFilter -- Admin or Superadmin --> topWordsDefault[/Use All Regions default filter/]
    topWordsFilter -- User --> topWordsUserDefault[/Use first accessible region as default filter/]
    topWordsDefault --> topWordsSelect[/Select available region filter/]
    topWordsUserDefault --> topWordsSelect
    topWordsSelect --> topWordsQuery[Fetch frequent words for selected region]
    topWordsQuery --> topWordsStore[(Analytics frequent words data)]
    topWordsStore --> topWordsLoading{Loading?}
    topWordsLoading -- Yes --> topWordsPlaceholder[/Show analytics loading placeholder/]
    topWordsPlaceholder --> topWordsStore
    topWordsLoading -- No --> topWordsData{Data available?}
    topWordsData -- Yes --> viewTopWords[/View Top Words vertical bar chart/]
    topWordsData -- No --> noTopWords[/Show no top words data available/]
    viewTopWords --> nerAction{Choose next action}
    noTopWords --> nerAction

    reportChoice -- Word Cloud --> wordCloudFilter{Account type}
    wordCloudFilter -- Admin or Superadmin --> wordCloudDefault[/Use All Regions default filter/]
    wordCloudFilter -- User --> wordCloudUserDefault[/Use first accessible region as default filter/]
    wordCloudDefault --> wordCloudSelect[/Select available region filter/]
    wordCloudUserDefault --> wordCloudSelect
    wordCloudSelect --> wordCloudQuery[Fetch word cloud for selected region]
    wordCloudQuery --> wordCloudStore[(Analytics word cloud data)]
    wordCloudStore --> wordCloudLoading{Loading?}
    wordCloudLoading -- Yes --> wordCloudPlaceholder[/Show analytics loading placeholder/]
    wordCloudPlaceholder --> wordCloudStore
    wordCloudLoading -- No --> wordCloudData{Data available?}
    wordCloudData -- Yes --> viewWordCloud[/View Word Cloud visualization/]
    wordCloudData -- No --> noWordCloud[/Show no word cloud data available/]
    viewWordCloud --> nerAction
    noWordCloud --> nerAction

    nerAction -- Review another NER report --> reportChoice
    nerAction -- Switch tab --> hub
    nerAction -- End review --> endInsights([End])

    tab -- Sentiment Analysis --> sentiment[Open Sentiment Analysis tab]
    sentiment --> viewSentimentDistribution[/View Sentiment Distribution pie chart/]
    viewSentimentDistribution --> viewSentimentRegion[/View Sentiment by Region bar chart/]
    viewSentimentRegion --> viewSentimentTrends[/View Sentiment Trends Over Time line chart/]
    viewSentimentTrends --> sentimentAction{Choose next action}
    sentimentAction -- Switch tab --> hub
    sentimentAction -- End review --> endInsights

    tab -- Language Detection --> language[Open Language Detection tab]
    language --> viewLanguageDistribution[/View Language Distribution pie chart/]
    viewLanguageDistribution --> viewLanguageRegion[/View Language Distribution by Region bar chart/]
    viewLanguageRegion --> viewModelPerformance[/View Language Processing Model Performance cards/]
    viewModelPerformance --> languageAction{Choose next action}
    languageAction -- Switch tab --> hub
    languageAction -- End review --> endInsights
```

## Notes

- NLP Insights is available to authenticated dashboard users through the `/dashboard/nlp-insights` route.
- The dashboard includes three tabs: Named Entity Recognition, Sentiment Analysis, and Language Detection.
- Named Entity Recognition opens by default.
- The Diseases, Symptom Frequency, Locations, and Named Entity Recognition Demo panels use visible static dashboard content in the current component.
- Top Words uses `useGenerateFrequentWordsQuery` and displays a vertical bar chart when frequent word data is available.
- Word Cloud uses `useGenerateWordCloudQuery` and displays a `ReactWordCloud` visualization when word cloud data is available.
- Top Words and Word Cloud show the shared analytics loading placeholder while their report queries are fetching.
- Top Words shows "No top words data available" when no frequent word results are available.
- Word Cloud shows "No word cloud data available" when no word cloud results are available or the response indicates no datasets.
- Admin and Superadmin users default Top Words and Word Cloud filters to `all`.
- USER accounts default Top Words and Word Cloud filters to the first accessible region.
- The shared `Report` component limits USER region filter options to regions included in `user.accessible_regions`; other authenticated users can choose from all listed regions.
- Sentiment Analysis displays static Sentiment Distribution, Sentiment by Region, and Sentiment Trends Over Time chart data in the current component.
- Language Detection displays static Language Distribution, Language Distribution by Region, and Language Processing Model Performance data in the current component.
- The current component does not include export actions, report generation, persistence, activity logging, model execution controls, or editable NLP configuration.
