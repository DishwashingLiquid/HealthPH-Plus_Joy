# Superadmin Process Flowchart

## Purpose

This document summarizes the full Superadmin journey in HealthPH+. It simplifies the process from sign in through dashboard navigation, account administration, reporting, settings, and sign out.

## Scope

The flow focuses on what a Superadmin can do inside the dashboard. Module internals are kept high-level so the chart remains readable and useful as a process reference.

## Flowchart Symbol Legend

| Symbol | Meaning | Mermaid example |
| --- | --- | --- |
| Terminator | Start or end of a process | `([Start])` |
| Process | Action or system step | `[Open dashboard]` |
| Decision | Yes/no or branching question | `{Valid login?}` |
| Input/Output | User input, visible output, or notification | `[/Enter credentials/]` |
| Document/Report | Printable or exportable output | `[/Generate report/]` |
| Database | Stored system data | `[(Users database)]` |
| Connector | Return point or continuation | `((Dashboard))` |

## Main Superadmin Flow

```mermaid
flowchart TD
    start([Start])
    login[/Enter email and password/]
    valid{Valid credentials?}
    loginError[/Show login error/]
    role{Role is SUPERADMIN?}
    roleExit([Redirect to allowed experience])
    disabled{Account disabled?}
    denied[/Show Access Denied/]
    dashboard[Open Superadmin dashboard]
    hub((Dashboard task selection))

    start --> login --> valid
    valid -- No --> loginError --> login
    valid -- Yes --> role
    role -- No --> roleExit
    role -- Yes --> disabled
    disabled -- Yes --> denied --> endDenied([End])
    disabled -- No --> dashboard --> hub

    hub --> task{Select task area}

    task -- Monitor and analyze --> monitoring[Open monitoring and analysis modules]
    monitoring --> monitorModules[/AI Surveillance<br/>NLP Insights<br/>Misinformation Tracker<br/>Trends Map<br/>Model Access and Toolkit<br/>Disease Watch Feed<br/>Health Literacy Hub<br/>Sentiment Pulse Tool/]
    monitorModules --> reportDecision{Generate report or export?}
    reportDecision -- Yes --> report[/Create printable report or export/]
    reportDecision -- No --> hub
    report --> logReport[(Activity Logs)] --> hub

    task -- Manage accounts --> userManagement[Open User Management]
    userManagement --> viewAccounts[/View all users, admins, and superadmins/]
    viewAccounts --> accountChoice{Add or manage account?}

    accountChoice -- Add account --> addUser[Open Add User]
    addUser --> accountType{Choose account type}
    accountType -- USER --> createUser[Enter user profile, region, and accessible regions]
    accountType -- ADMIN --> createAdmin[Enter admin profile]
    accountType -- SUPERADMIN --> createSuperadmin[Enter superadmin profile]
    createUser --> validateAccount{Form valid and email unique?}
    createAdmin --> validateAccount
    createSuperadmin --> validateAccount
    validateAccount -- No --> formError[/Show validation errors/]
    formError --> addUser
    validateAccount -- Yes --> saveAccount[(Users database)]
    saveAccount --> credentialsEmail[/Send account credentials email/]
    credentialsEmail --> addLog[(Activity Logs)]
    addLog --> hub

    accountChoice -- Manage existing account --> manageAction{Selected action}
    manageAction -- Enable or disable --> statusChange[Update account status]
    statusChange --> usersDb[(Users database)]
    usersDb --> statusEmail[/Send enabled or disabled email/]
    statusEmail --> statusLog[(Activity Logs)]
    statusLog --> hub

    manageAction -- Delete account --> deleteDecision{Deleting own account?}
    deleteDecision -- Yes --> blockDelete[/Block deletion/]
    blockDelete --> hub
    deleteDecision -- No --> deleteAccount[Delete selected account]
    deleteAccount --> deleteDb[(Users database)]
    deleteDb --> deleteEmail[/Send deletion email/]
    deleteEmail --> deleteLog[(Activity Logs)]
    deleteLog --> hub

    manageAction -- Update user access --> updateAccess[Update accessible regions]
    updateAccess --> updateDb[(Users database)]
    updateDb --> updateLog[(Activity Logs)]
    updateLog --> hub

    task -- Review Activity Logs --> activityLogs[Open Activity Logs]
    activityLogs --> searchLogs[/Search user, entry, or module/]
    searchLogs --> logsReportDecision{Print activity report?}
    logsReportDecision -- Yes --> logsReport[/Generate Activity Logs report/]
    logsReport --> reportLog[(Activity Logs)] --> hub
    logsReportDecision -- No --> hub

    task -- Help --> help[Open Help]
    help --> hub

    task -- Settings --> settings[Open Settings]
    settings --> settingsAction{Choose settings action}
    settingsAction -- Edit profile --> editProfile[Update personal information]
    settingsAction -- Edit email --> editEmail[Change email]
    settingsAction -- Edit password --> editPassword[Change password]
    settingsAction -- Report issue --> issue[/Open email to HealthPH support/]
    settingsAction -- Delete own account --> ownDelete[Delete own account]
    editProfile --> settingsDb[(Users database)] --> hub
    editEmail --> settingsDb
    editPassword --> settingsDb
    issue --> hub
    ownDelete --> ownDeleteEmail[/Send deletion email/] --> endOwnDelete([End])

    task -- Sign out --> logoutConfirm{Confirm sign out?}
    logoutConfirm -- No --> hub
    logoutConfirm -- Yes --> logoutLog[(Activity Logs)]
    logoutLog --> logout([End])
```

## Notes

- Superadmins can access the same dashboard modules as admins, plus elevated account management actions.
- Superadmins can create `USER`, `ADMIN`, and `SUPERADMIN` accounts.
- Superadmins can view all users, admins, and superadmins.
- Superadmins can enable, disable, and delete eligible accounts, but the system blocks deletion of the currently signed-in account from the admin deletion flow.
- Account creation, deletion, enable, and disable actions update stored user data and send email notifications.
- Administrative actions are recorded in Activity Logs when the related screen logs the action.
