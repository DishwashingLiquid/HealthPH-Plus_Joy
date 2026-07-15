# User Management Process Flowchart

## Purpose

This document summarizes the current Admin and Superadmin journey in the HealthPH+ User Management dashboard. It simplifies the process from opening User Management through viewing account lists, searching records, generating reports, adding accounts, updating user access, enabling or disabling accounts, and deleting eligible accounts.

## Scope

The flow focuses on the current dashboard-level User Management interface for Admin and Superadmin users. It documents implemented role-based tab access, loading states, table search and pagination behavior, report generation, Add User navigation, account action confirmation modals, success and error notifications, and activity logging.

## Flowchart Symbol Legend

| Symbol | Meaning | Mermaid example |
| --- | --- | --- |
| Terminator | Start or end of a process | `([Start])` |
| Process | Action or system step | `[Open dashboard]` |
| Decision | Yes/no or branching question | `{Select tab}` |
| Input/Output | User input, visible output, or notification | `[/View table/]` |
| Document/Report | Printable or exportable output | `[/Generate report/]` |
| Database | Stored system data | `[(Users database)]` |
| Connector | Return point or continuation | `((User Management task selection))` |

## Main User Management Flow

```mermaid
flowchart TD
    start([Start])
    openDashboard[Open Admin or Superadmin dashboard]
    openUserManagement[Open User Management]
    allowed{Admin or Superadmin?}
    redirect[/Redirect to dashboard/]
    fetchAccounts[Fetch admins and users]
    loading{Admins or users loading?}
    showSkeleton[/Show table skeleton/]
    role{Account type}
    superadminDefault[/Default to Admins tab/]
    adminDefault[/Default to Users tab/]
    hub((User Management task selection))

    start --> openDashboard --> openUserManagement --> allowed
    allowed -- No --> redirect --> endRedirect([End])
    allowed -- Yes --> fetchAccounts --> loading
    loading -- Yes --> showSkeleton --> fetchAccounts
    loading -- No --> role
    role -- Superadmin --> superadminDefault --> hub
    role -- Admin --> adminDefault --> hub

    hub --> task{Choose task}

    task -- Switch or review tab --> tabChoice{Select tab}
    tabChoice -- Admins --> tabRole{Superadmin?}
    tabRole -- No --> usersOnly[/Show Users tab only/]
    usersOnly --> viewUsers
    tabRole -- Yes --> viewAdmins[/View Admins table with account counts/]
    viewAdmins --> adminsData{Admin records available?}
    adminsData -- No --> noAdmins[/Show no administrators found/]
    noAdmins --> hub
    adminsData -- Yes --> adminsSearch{Search query entered?}
    adminsSearch -- Yes --> filterAdmins[Filter admins by name or email]
    adminsSearch -- No --> paginateAdmins[Paginate admin rows]
    filterAdmins --> adminMatches{Matches found?}
    adminMatches -- No --> noAdminResults[/Show no results and Clear Search action/]
    noAdminResults --> clearAdminSearch[/Clear search query/] --> viewAdmins
    adminMatches -- Yes --> paginateAdmins
    paginateAdmins --> viewAdminRows[/View full name, email, date created, user type, and actions/]
    viewAdminRows --> hub

    tabChoice -- Users --> viewUsers[/View Users table with account counts/]
    viewUsers --> usersData{User records available?}
    usersData -- No --> noUsers[/Show no users found/]
    noUsers --> hub
    usersData -- Yes --> usersSearch{Search query entered?}
    usersSearch -- Yes --> filterUsers[Filter users by name, email, or organization]
    usersSearch -- No --> paginateUsers[Paginate user rows]
    filterUsers --> userMatches{Matches found?}
    userMatches -- No --> noUserResults[/Show no results and Clear Search action/]
    noUserResults --> clearUserSearch[/Clear search query/] --> viewUsers
    userMatches -- Yes --> paginateUsers
    paginateUsers --> viewUserRows[/View full name, email, regional office, organization, and actions/]
    viewUserRows --> hub

    task -- Print report --> reportData[Use active tab current filtered data]
    reportData --> device{Device type}
    device -- Desktop --> printReport[/Open browser print report/]
    printReport --> printComplete{Print completed?}
    printComplete -- Yes --> reportLog[(Activity Logs)]
    reportLog --> hub
    printComplete -- No --> hub
    device -- Mobile or tablet --> exportPages[Convert print pages to images]
    exportPages --> exportResult{Export successful?}
    exportResult -- No --> exportError[/Show failed to generate report snackbar/]
    exportError --> hub
    exportResult -- Yes --> printRoute[/Navigate to Print page with report images/]
    printRoute --> printRouteLog[(Activity Logs)]
    printRouteLog --> hub

    task -- Add account --> addUser[Open Add User]
    addUser --> creatorRole{Creator role}
    creatorRole -- Admin --> adminCreatesUser[/Set account type to USER/]
    creatorRole -- Superadmin --> superadminSelect[/Select ADMIN or SUPERADMIN account type/]
    adminCreatesUser --> userFields[/Enter role, regional office, accessible regions, organization, name, email, and password/]
    superadminSelect --> adminDefaults[/Use ALL region, admin organization, and all accessible regions/]
    adminDefaults --> adminFields[/Enter organization, name, email, and password/]
    userFields --> createValidation{Client validation passed?}
    adminFields --> createValidation
    createValidation -- No --> createErrors[/Show field validation errors/]
    createErrors --> addUser
    createValidation -- Yes --> createAccount[Submit account creation request]
    createAccount --> usersDb[(Users database)]
    usersDb --> createResult{Account created?}
    createResult -- No --> apiErrors[/Show API field errors, page error, or snackbar/]
    apiErrors --> addUser
    createResult -- Yes --> createSuccess[/Show user added successfully snackbar/]
    createSuccess --> createLog[(Activity Logs)]
    createLog --> returnUserManagement[Return to User Management]
    returnUserManagement --> fetchAccounts

    task -- Update user access --> updateUser[Open Update user modal]
    updateUser --> selectRegions[/Select accessible regions/]
    selectRegions --> regionsValid{At least one region selected?}
    regionsValid -- No --> regionError[/Show accessible regions validation error/]
    regionError --> selectRegions
    regionsValid -- Yes --> submitUpdate[Submit user access update]
    submitUpdate --> updateDb[(Users database)]
    updateDb --> updateResult{Update successful?}
    updateResult -- No --> updateError[/Show field error or failure snackbar/]
    updateError --> updateUser
    updateResult -- Yes --> updateSuccess[/Show user updated successfully snackbar/]
    updateSuccess --> updateLog[(Activity Logs)]
    updateLog --> hub

    task -- Enable or disable account --> statusAction[Choose Enable or Disable]
    statusAction --> statusConfirm{Confirm status change?}
    statusConfirm -- No --> hub
    statusConfirm -- Yes --> submitStatus[Submit account status update]
    submitStatus --> statusDb[(Users database)]
    statusDb --> statusResult{Status update successful?}
    statusResult -- No --> statusError[/Show error snackbar/]
    statusError --> hub
    statusResult -- Yes --> statusSuccess[/Show enabled or disabled successfully snackbar/]
    statusSuccess --> statusLog[(Activity Logs)]
    statusLog --> hub

    task -- Delete account --> deleteAction[Choose Delete]
    deleteAction --> deleteConfirm{Confirm deletion?}
    deleteConfirm -- No --> hub
    deleteConfirm -- Yes --> submitDelete[Submit account deletion request]
    submitDelete --> deleteDb[(Users database)]
    deleteDb --> deleteResult{Deletion successful?}
    deleteResult -- No --> deleteError[/Show error snackbar/]
    deleteError --> hub
    deleteResult -- Yes --> deleteSuccess[/Show user deleted successfully snackbar/]
    deleteSuccess --> deleteLog[(Activity Logs)]
    deleteLog --> hub

    task -- End review --> endUserManagement([End])
```

## Notes

- User Management is available through the `/dashboard/user-management` route when the signed-in account is an Admin or Superadmin and the app is not running in PWA mode.
- The page fetches both admin and user records with `useFetchAdminsQuery` and `useFetchUsersQuery`.
- The page shows a table skeleton while either the admins or users request is loading.
- Superadmin users default to the Admins tab and can switch between Admins and Users.
- Admin users default to the Users tab and only receive the Users tab option in the current interface.
- Tab counts update when a search query is entered.
- Admin search matches first name, last name, or email.
- User search matches first name, last name, email, or organization.
- The Admins table displays full name, email, date created, user type, and row actions.
- The Users table displays full name, email, regional office, organization with role label when available, and row actions.
- The table component paginates rows at 10 rows per page.
- Printing uses the active tab and current filtered dataset. The print report displays up to 25 rows per printed page.
- Desktop report generation opens the browser print flow and records a User Management activity log after printing completes.
- Mobile and tablet report generation converts print pages to images and navigates to the `/print` route with activity-log data.
- Failed mobile or tablet report image generation shows "Failed to generate report. Please try again."
- The Add User page is available from User Management for Admin and Superadmin users.
- Admin users create USER accounts. The form automatically sets the user type to `USER`.
- Superadmin users create ADMIN or SUPERADMIN accounts in the current Add User select options.
- USER account creation includes role, regional office, accessible regions, organization, first name, last name, email, and password.
- ADMIN and SUPERADMIN account creation defaults the region to `ALL`, organization to the configured admin organization, and accessible regions to all listed regions.
- Account creation validates required fields, email format, password requirements, and server-side API responses before returning to User Management.
- Successful account creation shows "User added successfully", logs the action in Activity Logs, and returns to `/dashboard/user-management`.
- USER row updates only change accessible regions through the Update modal.
- Enable, disable, and delete actions require confirmation modals before submitting the API request.
- Successful update, enable, disable, and delete actions show success snackbars and write User Management entries to Activity Logs.
- Failed update, enable, disable, delete, or account creation requests show field errors, page errors, or destructive snackbars depending on the API response.
- The current User Management component declares admin and user error flags but does not render a dedicated fetch-error state.
