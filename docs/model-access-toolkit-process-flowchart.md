# Model Access Toolkit Process Flowchart

## Purpose

This document summarizes the intended Admin and Superadmin journey in the HealthPH+ Model Access and Toolkit dashboard. It simplifies the process from opening the toolkit through model comparison, dataset upload, AI dataset annotation, dataset administration, training log review, reporting, and export actions.

## Scope

The flow focuses on dashboard-level Model Access and Toolkit actions for Admin and Superadmin users. AI annotation is kept at process level so the chart remains readable and useful as a process reference.

## Flowchart Symbol Legend

| Symbol | Meaning | Mermaid example |
| --- | --- | --- |
| Terminator | Start or end of a process | `([Start])` |
| Process | Action or system step | `[Open dashboard]` |
| Decision | Yes/no or branching question | `{Valid file?}` |
| Input/Output | User input, visible output, or notification | `[/Upload CSV dataset/]` |
| Document/Report | Printable or exportable output | `[/Export training logs/]` |
| Database | Stored system data | `[(Datasets database)]` |
| Connector | Return point or continuation | `((Toolkit task selection))` |

## Main Model Access Toolkit Flow

```mermaid
flowchart TD
    start([Start])
    openDashboard[Open Admin or Superadmin dashboard]
    openToolkit[Open Model Access and Toolkit]
    hub((Toolkit task selection))

    start --> openDashboard --> openToolkit --> hub

    hub --> task{Select toolkit area}

    task -- Model Comparison --> comparison[Open Model Comparison tab]
    comparison --> searchModels[/Filter or search models/]
    searchModels --> viewMetrics[/View F1 score, precision, recall, and accuracy/]
    viewMetrics --> modelAction{Choose model action}
    modelAction -- View details --> modelDetails[/Review model details/]
    modelDetails --> compareDecision{Compare another model?}
    modelAction -- Compare models --> compareModels[Compare selected model metrics]
    compareModels --> compareDecision
    compareDecision -- Yes --> searchModels
    compareDecision -- No --> comparisonReportDecision{Export or report comparison?}
    comparisonReportDecision -- Yes --> comparisonReport[/Create model comparison report or export/]
    comparisonReport --> comparisonLog[(Activity Logs)]
    comparisonLog --> hub
    comparisonReportDecision -- No --> hub

    task -- Data Management --> dataManagement[Open Data Management tab]
    dataManagement --> viewDatasets[/View uploaded datasets and statuses/]
    viewDatasets --> datasetChoice{Choose dataset action}

    datasetChoice -- Upload dataset --> uploadDataset[/Select CSV dataset/]
    uploadDataset --> fileType{CSV file?}
    fileType -- No --> fileTypeError[/Show invalid file type error/]
    fileTypeError --> viewDatasets
    fileType -- Yes --> columnCheck{Required columns present?}
    columnCheck -- No --> columnError[/Show missing required columns error/]
    columnError --> viewDatasets
    columnCheck -- Yes --> previewUpload[/Show dataset preview and row count/]
    previewUpload --> confirmUpload{Confirm upload?}
    confirmUpload -- No --> cancelUpload[/Cancel upload/]
    cancelUpload --> viewDatasets
    confirmUpload -- Yes --> storeRaw[(Raw datasets storage)]
    storeRaw --> uploadResult{Upload successful?}
    uploadResult -- No --> uploadError[/Show upload failure/]
    uploadError --> viewDatasets
    uploadResult -- Yes --> annotateDataset[AI annotates dataset]
    annotateDataset --> annotationResult{Annotation successful?}
    annotationResult -- No --> annotationError[/Mark processing failed and show error/]
    annotationError --> uploadFailureLog[(Activity Logs)]
    uploadFailureLog --> viewDatasets
    annotationResult -- Yes --> storeAnnotated[(Annotated datasets storage)]
    storeAnnotated --> updateStatus[Update dataset status]
    updateStatus --> makeAvailable[/Dataset available for training, validation, evaluation, and dashboard use/]
    makeAvailable --> uploadLog[(Activity Logs)]
    uploadLog --> viewDatasets

    datasetChoice -- Preview dataset --> previewDataset[/Show stored dataset preview/]
    previewDataset --> viewDatasets

    datasetChoice -- Download dataset --> downloadDataset[/Download selected dataset/]
    downloadDataset --> downloadLog[(Activity Logs)]
    downloadLog --> viewDatasets

    datasetChoice -- Delete dataset --> deleteConfirm{Confirm dataset deletion?}
    deleteConfirm -- No --> cancelDelete[/Cancel deletion/]
    cancelDelete --> viewDatasets
    deleteConfirm -- Yes --> deleteDataset[Delete selected dataset]
    deleteDataset --> deleteResult{Delete successful?}
    deleteResult -- No --> deleteError[/Show delete failure/]
    deleteError --> viewDatasets
    deleteResult -- Yes --> datasetDb[(Datasets database)]
    datasetDb --> deleteLog[(Activity Logs)]
    deleteLog --> viewDatasets

    datasetChoice -- Return --> hub

    task -- Training Logs --> trainingLogs[Open Training Logs tab]
    trainingLogs --> viewRuns[/View model runs, datasets, statuses, start times, and durations/]
    viewRuns --> logAction{Choose log action}
    logAction -- View run --> runDetails[/Review run details or processing result/]
    runDetails --> viewRuns
    logAction -- Export run --> runExport[/Export selected run details/]
    runExport --> runExportLog[(Activity Logs)]
    runExportLog --> viewRuns
    logAction -- Download logs --> logsExport[/Download training logs/]
    logsExport --> logsExportLog[(Activity Logs)]
    logsExportLog --> viewRuns
    logAction -- Return --> hub

    task -- Exit toolkit --> endToolkit([End])
```

## Notes

- The flow targets Admin and Superadmin users because dataset upload, delete, export, and audit actions are administrative workflows.
- The dashboard includes Model Comparison, Data Management, and Training Logs areas.
- Uploaded datasets are validated before processing. Invalid file types and missing required columns stop the upload and return the user to Data Management.
- AI annotation is represented at process level. After a valid upload, the system annotates the dataset and makes successful outputs available for model training, validation, evaluation, and downstream dashboard use.
- Dataset management includes preview, download, and delete actions. Dataset deletion requires confirmation and returns to Data Management whether cancelled, failed, or completed.
- Model comparison and training log exports create report or export outputs and record the related administrative action in Activity Logs.
- Annotation or processing failures should be visible through dataset status and training or activity records so admins can review what happened.
