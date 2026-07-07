# Health Literacy Hub Process Flowchart

## Purpose

This document summarizes the intended Admin and Superadmin journey in the HealthPH+ Health Literacy Hub. It simplifies the process from opening the hub through content management, publishing to public channels, analytics review, and CSV or PDF export actions.

## Scope

The flow focuses on dashboard-level Health Literacy Hub actions for Admin and Superadmin users, with downstream visibility for mobile app and public website audiences. Mobile app and public website publishing are treated as one publishing feature so the chart stays aligned with the dashboard workflow.

## Flowchart Symbol Legend

| Symbol | Meaning | Mermaid example |
| --- | --- | --- |
| Terminator | Start or end of a process | `([Start])` |
| Process | Action or system step | `[Open dashboard]` |
| Decision | Yes/no or branching question | `{Valid content?}` |
| Input/Output | User input, visible output, or notification | `[/Enter content details/]` |
| Document/Report | Printable or exportable output | `[/Export analytics report/]` |
| Database | Stored system data | `[(Health literacy content)]` |
| Connector | Return point or continuation | `((Hub task selection))` |

## Main Health Literacy Hub Flow

```mermaid
flowchart TD
    start([Start])
    openDashboard[Open Admin or Superadmin dashboard]
    openHub[Open Health Literacy Hub]
    hub((Hub task selection))

    start --> openDashboard --> openHub --> hub

    hub --> task{Select tab}

    task -- Articles --> articles[Open Articles tab]
    task -- Videos --> videos[Open Videos tab]
    task -- Infographics --> infographics[Open Infographics tab]

    articles --> reviewContent[/Search, filter, and review article content/]
    videos --> reviewContentMedia[/Search, filter, and review video content/]
    infographics --> reviewContentMedia
    reviewContentMedia --> reviewContent

    reviewContent --> contentAction{Choose content action}
    contentAction -- Create content --> createContent[/Enter title, description, language, media, fact-check, and publish details/]
    contentAction -- Edit content --> editContent[/Update existing content details/]
    contentAction -- Preview or view --> previewContent[/Open content preview/]
    contentAction -- Share article --> shareArticle[/Share article link or copy URL/]
    contentAction -- Download infographic --> downloadInfographic[/Download infographic media/]
    contentAction -- Return --> hub

    previewContent --> recordOpenEvent[Record content open event when applicable]
    recordOpenEvent --> reviewContent
    shareArticle --> recordShareEvent[Record content share event when applicable]
    recordShareEvent --> reviewContent
    downloadInfographic --> recordDownloadEvent[Record content download event when applicable]
    recordDownloadEvent --> reviewContent

    createContent --> validateContent{Required fields valid?}
    editContent --> validateContent
    validateContent -- No --> validationError[/Show validation error/]
    validationError --> reviewContent
    validateContent -- Yes --> mediaType{Media type allowed?}
    mediaType -- No --> mediaError[/Show unsupported media type error/]
    mediaError --> reviewContent
    mediaType -- Yes --> saveContent[Save Health Literacy Hub content]
    saveContent --> contentStore[(Health literacy content)]
    contentStore --> publishDecision{Publish Content selected?}
    publishDecision -- No --> savedDraft[/Content remains available in dashboard only/]
    savedDraft --> reviewContent
    publishDecision -- Yes --> publishContent[Publish Content]
    publishContent --> publishTargets[/Make content available to mobile app and public website targets/]
    publishTargets --> publicChannels[(Published channel content)]
    publicChannels --> reviewContent

    task -- Analytics --> analytics[Open Analytics tab]
    analytics --> setFilters[/Set time range, content type, and region filters/]
    setFilters --> viewAnalytics[/View content interactions, content pieces, engagement rate, and top-performing content/]
    viewAnalytics --> analyticsAction{Choose analytics action}
    analyticsAction -- Export CSV --> exportCsv[/Download CSV analytics report/]
    analyticsAction -- Export PDF --> exportPdf[/Generate printable PDF report/]
    analyticsAction -- Refresh or adjust filters --> setFilters
    analyticsAction -- Return --> hub

    exportCsv --> csvEvent[Record report_exported event]
    csvEvent --> viewAnalytics
    exportPdf --> printFlow[Open print report flow]
    printFlow --> pdfEvent[Record report_exported event]
    pdfEvent --> viewAnalytics

    publicChannels --> audience{Audience interaction}
    audience -- Mobile app user --> mobileUser[/Open, search, share, or download content/]
    audience -- Public website visitor --> websiteVisitor[/Open, search, share, or download content/]
    mobileUser --> analyticsEvents[(Health literacy analytics events)]
    websiteVisitor --> analyticsEvents
    analyticsEvents --> analyticsOverview[Update analytics overview]
    analyticsOverview --> setFilters

    hub --> exitHub([End])
```

## Notes

- The dashboard includes Articles, Videos, Infographics, and Analytics tabs.
- Articles support text content. Videos accept video media. Infographics accept image media and include a download action.
- Content creation and editing validate required title and description fields. Articles and videos require at least one supported language. Uploaded media must match the selected content type.
- Publish Content is one dashboard feature. The saved content may target the mobile app, the public website, or both, but the process is documented as a single publishing workflow.
- Published content excludes archived content and is available through the Health Literacy Hub mobile and website endpoints.
- Mobile app and public website interactions can create analytics events such as content opened, content shared, content downloaded, and search.
- Analytics supports filtering by time range, content type, and region. CSV export downloads a generated analytics report. PDF export sends the analytics report through the print report flow.
- CSV and PDF exports record `report_exported` analytics events so exported reports can contribute to administrative audit and engagement context.
