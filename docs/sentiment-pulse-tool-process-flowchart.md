# Sentiment Pulse Tool Process Flowchart

## Purpose

This document summarizes the intended Admin and Superadmin journey in the HealthPH+ Sentiment Pulse Tool. It simplifies the process from opening the tool through dashboard filtering, sentiment review, regional analysis, mobile survey management, public response collection, result review, and CSV or PDF export actions.

## Scope

The flow focuses on dashboard-level Sentiment Pulse Tool actions for Admin and Superadmin users, with downstream visibility for mobile app and public website audiences. Scheduling surveys to the mobile app and public website is treated as one publishing feature so the chart stays aligned with the dashboard workflow.

## Flowchart Symbol Legend

| Symbol | Meaning | Mermaid example |
| --- | --- | --- |
| Terminator | Start or end of a process | `([Start])` |
| Process | Action or system step | `[Open dashboard]` |
| Decision | Yes/no or branching question | `{Valid survey?}` |
| Input/Output | User input, visible output, or notification | `[/Set filters/]` |
| Document/Report | Printable or exportable output | `[/Export report/]` |
| Database | Stored system data | `[(Survey responses)]` |
| Connector | Return point or continuation | `((Tool task selection))` |

## Main Sentiment Pulse Tool Flow

```mermaid
flowchart TD
    start([Start])
    openDashboard[Open Admin or Superadmin dashboard]
    openTool[Open Sentiment Pulse Tool]
    viewSummary[/View sentiment summary metrics/]
    sharedControls[/Set time range and region filters/]
    task((Tool task selection))

    start --> openDashboard --> openTool --> viewSummary --> sharedControls --> task

    task --> action{Choose action}

    action -- Export CSV --> csvDecision{Active tab}
    csvDecision -- Sentiment Trends --> exportTrendsCsv[/Download CSV trend report/]
    csvDecision -- Regional Analysis --> exportRegionalCsv[/Download CSV regional sentiment report/]
    csvDecision -- Mobile Surveys --> exportSurveysCsv[/Download CSV survey status and response report/]
    exportTrendsCsv --> task
    exportRegionalCsv --> task
    exportSurveysCsv --> task

    action -- Export PDF --> pdfDecision{Active tab}
    pdfDecision -- Sentiment Trends --> exportTrendsPdf[/Generate PDF trend report with current filters/]
    pdfDecision -- Regional Analysis --> exportRegionalPdf[/Generate PDF regional report with current filters/]
    pdfDecision -- Mobile Surveys --> exportSurveysPdf[/Generate PDF survey report with current filters/]
    exportTrendsPdf --> task
    exportRegionalPdf --> task
    exportSurveysPdf --> task

    action -- Sentiment Trends --> trends[Open Sentiment Trends tab]
    trends --> viewTrendCharts[/View sentiment trends over time/]
    viewTrendCharts --> viewCategories[/View sentiment categories/]
    viewCategories --> viewTopics[/View top health topics/]
    viewTopics --> trendAction{Adjust filters or export?}
    trendAction -- Adjust filters --> sharedControls
    trendAction -- Export --> action
    trendAction -- Return --> task

    action -- Regional Analysis --> regional[Open Regional Analysis tab]
    regional --> fetchRegional[Fetch regional sentiment analysis]
    fetchRegional --> applyRegions[/Apply selected regions/]
    applyRegions --> viewRegionalMap[/View regional sentiment map/]
    viewRegionalMap --> viewRegionalComparison[/View regional sentiment comparison/]
    viewRegionalComparison --> regionalAction{Adjust filters or export?}
    regionalAction -- Adjust filters --> sharedControls
    regionalAction -- Export --> action
    regionalAction -- Return --> task

    action -- Mobile Surveys --> surveys[Open Mobile Surveys tab]
    surveys --> loadSurveys[Load survey drafts, schedules, and published surveys]
    loadSurveys --> surveyAction{Choose survey action}

    surveyAction -- Create draft survey --> createSurvey[/Enter survey title, description, target responses, and questions/]
    createSurvey --> validateSurvey{Required survey details valid?}
    validateSurvey -- No --> surveyValidationError[/Show validation error/]
    surveyValidationError --> createSurvey
    validateSurvey -- Yes --> saveDraft[Save survey draft]
    saveDraft --> surveyStore[(Sentiment Pulse surveys)]
    surveyStore --> surveys

    surveyAction -- Schedule survey --> selectDrafts[/Select draft surveys and publish date/time/]
    selectDrafts --> scheduleCheck{Selected drafts and dates valid?}
    scheduleCheck -- No --> scheduleError[/Show schedule validation error/]
    scheduleError --> selectDrafts
    scheduleCheck -- Yes --> scheduleSurvey[Schedule selected surveys]
    scheduleSurvey --> publishFeature[/Publish surveys to mobile app and public website channels/]
    publishFeature --> publicSurveyStore[(Published Sentiment Pulse surveys)]
    publicSurveyStore --> surveys

    surveyAction -- View results --> openResults[/Open survey results/]
    openResults --> fetchResults[Fetch response totals, sentiment breakdown, and question results]
    fetchResults --> viewResults[/Review completion, dominant sentiment, and question summaries/]
    viewResults --> surveys

    surveyAction -- Edit survey --> editPlaceholder[/Show edit survey coming soon message/]
    editPlaceholder --> surveys
    surveyAction -- Export --> action
    surveyAction -- Return --> task

    publicSurveyStore --> audience{Audience response}
    audience -- Mobile app user --> mobileSurvey[/Open published survey in mobile app/]
    audience -- Public website visitor --> websiteSurvey[/Open published survey on public website/]
    mobileSurvey --> submitResponse[/Submit survey answers with platform and optional region/]
    websiteSurvey --> submitResponse
    submitResponse --> responseCheck{Answers valid?}
    responseCheck -- No --> responseError[/Show response validation error/]
    responseError --> audience
    responseCheck -- Yes --> responseStore[(Sentiment Pulse survey responses)]
    responseStore --> updateSurveyStats[Update response count and survey summaries]
    updateSurveyStats --> loadSurveys
    responseStore --> regionalEvents[(Mobile and website sentiment signals)]
    regionalEvents --> fetchRegional

    task --> exitTool([End])
```

## Notes

- The dashboard includes Sentiment Trends, Regional Analysis, and Mobile Surveys tabs.
- Shared controls include time range filtering, region filtering, CSV export, and PDF export.
- CSV export depends on the active tab: trend data for Sentiment Trends, regional sentiment rows for Regional Analysis, and survey status or response details for Mobile Surveys.
- PDF export is documented as the intended reporting workflow for the active tab, using the current filters and visible dashboard context.
- Sentiment Trends summarizes sentiment over time, sentiment categories, and top health topics.
- Regional Analysis uses the selected time range and regions to show regional sentiment map and comparison views.
- Mobile Surveys supports creating draft surveys, scheduling draft surveys, publishing scheduled surveys, and reviewing survey results.
- Scheduling a survey is documented as one publishing feature for both the mobile app and public website.
- Public mobile app users and public website visitors can open published surveys and submit responses.
- Submitted responses update survey response totals and can contribute to regional sentiment analysis when platform and region signals are available.
