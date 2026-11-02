import { accountStatusLabel } from "./accountStatus.js";
import { formatSelfReportPrintDate } from "./selfReportPrintHelpers.js";

const text = (value) => String(value ?? "").trim() || "Unavailable";
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const column = (key, label, width, align = "left") => ({ key, label, width, align });

// Use the protected, paginated activity endpoint. Never print just the visible page.
export const loadRecentActivityForPrint = async (fetchPage, filters = {}) => {
    const entries = [];
    const seen = new Set();
    let expectedTotal;
    do {
        const page = await fetchPage({ ...filters, limit: 100, offset: entries.length });
        if (!Array.isArray(page?.entries) || !Number.isSafeInteger(page.total) || page.total < 0) {
            throw new Error("Unable to prepare account activity: an invalid response was received.");
        }
        if (expectedTotal === undefined) expectedTotal = page.total;
        if (page.total !== expectedTotal || page.offset !== entries.length ||
            (!page.entries.length && entries.length < expectedTotal) ||
            entries.length + page.entries.length > expectedTotal) {
            throw new Error("Account activity changed while preparing the report. Please try printing again.");
        }
        for (const entry of page.entries) {
            if (!entry.id || seen.has(entry.id)) {
                throw new Error("Account activity changed while preparing the report. Please try printing again.");
            }
            seen.add(entry.id);
            entries.push(entry);
        }
    } while (entries.length < expectedTotal);
    return entries;
};

export const buildUserManagementPrintReport = ({
    view, user, accounts = [], organizations = [], roles = [], analytics = {},
    recentActivity = [], includeRecentActivity = false, includeSuperadmins = false,
    search = "", regionLabel = text, generatedAt = new Date().toISOString(),
    activityFilters = {},
}) => {
    const report = {
        title: `User Management — ${view}`,
        subtitle: `${view} report`,
        generatedAt,
        generatedBy: [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "Unavailable",
        totalLabel: `Matching ${view.toLowerCase()}`,
        totalReports: 0,
        filters: view === "Account Analytics" ? [] : [{ label: "Search", value: search.trim() || "None" }],
        notes: ["Includes all matching records across pages. Dates and times use Philippine time (UTC+8)."],
        sections: [],
    };

    if (view === "Users" || view === "Superadmins") {
        const isSuperadminList = view === "Superadmins";
        report.totalReports = accounts.length;
        report.notes.push("Pending Activation accounts cannot sign in until their invitation is completed.");
        report.sections.push({
            title: view,
            columns: [
                column("name", "Full Name", 14), column("email", "Email", 20),
                ...(!isSuperadminList ? [column("region", "Regional Office", 15), column("role", "Role", 11)] : [column("type", "Account Type", 12)]),
                column("organization", "Organization", 14), column("status", "Status", 12),
                column("created", "Date Created (PHT)", 14),
            ],
            rows: accounts.map((account) => ({
                id: account.id,
                name: text([account.first_name, account.last_name].filter(Boolean).join(" ")),
                email: text(account.email), region: regionLabel(account.region),
                role: text(account.role_label), type: text(account.user_type),
                organization: text(account.organization), status: accountStatusLabel(account),
                created: formatSelfReportPrintDate(account.created_at),
            })),
        });
    } else if (view === "Organizations") {
        report.totalReports = organizations.length;
        report.notes.push("Account counts reflect the account records you are permitted to view. Active counts exclude pending and disabled accounts.");
        report.sections.push({
            title: "Organizations",
            columns: [
                column("name", "Organization", 19), column("mainRegion", "Main Region", 14),
                column("coverage", "Region Coverage", 23), column("users", "Users", 7, "right"),
                ...(includeSuperadmins ? [column("superadmins", "Superadmins", 9, "right")] : []),
                column("active", "Active", 7, "right"), column("pending", "Pending", 7, "right"),
                column("disabled", "Disabled", 7, "right"), column("status", "Partnership Status", 10),
            ],
            rows: organizations.map((organization) => ({
                id: organization.id, name: text(organization.name), mainRegion: regionLabel(organization.main_region),
                coverage: text((organization.region_coverage || []).map(regionLabel).join(", ")),
                users: number(organization.users), superadmins: number(organization.superadmins),
                active: number(organization.activeAccounts), pending: number(organization.pendingAccounts),
                disabled: number(organization.disabledAccounts),
                status: organization.partnership_status === "INACTIVE" ? "Inactive" : "Active",
            })),
        });
    } else if (view === "Roles") {
        report.totalReports = roles.length;
        report.notes.push("Counts include USER accounts assigned to each role. Active counts exclude pending and disabled accounts.");
        report.sections.push({
            title: "Roles and Page Access",
            columns: [
                column("name", "Role", 12), column("description", "Description", 23),
                column("status", "Status", 8), column("users", "Users", 6, "right"),
                column("active", "Active", 6, "right"), column("pending", "Pending", 7, "right"),
                column("disabled", "Disabled", 7, "right"), column("pages", "Accessible Pages", 31),
            ],
            rows: roles.map((role) => ({
                id: role.id, name: text(role.name), description: text(role.description),
                status: role.isActive ? "Active" : "Inactive", users: number(role.totalUsers),
                active: number(role.activeUsers), pending: number(role.pendingUsers), disabled: number(role.disabledUsers),
                pages: (role.moduleCoverage || []).join(", ") || "No pages assigned",
            })),
        });
    } else if (view === "Account Analytics") {
        const allowRecentActivity = includeRecentActivity && (
            user?.user_type === "SUPERADMIN" || user?.role_label === "Admin"
        );
        const activeRoles = roles.filter((role) => role.isActive);
        const days = analytics.activity_by_day || [];
        const regionDistribution = analytics.role_region_distribution || [];
        const totalUsers = analytics.total_user_accounts === undefined
            ? regionDistribution.reduce((total, row) => total + activeRoles.reduce((sum, role) => sum + number(row[role.name]), 0), 0)
            : number(analytics.total_user_accounts);
        report.totalLabel = "Total User Accounts";
        report.totalReports = totalUsers;
        report.subtitle = allowRecentActivity
            ? "Account totals, daily activity, regional role distribution and permitted account activity"
            : "Account totals, daily activity and regional role distribution";
        report.filters = [{ label: "Activity chart period (PHT)", value: days.length ? `${days[0].key} to ${days[days.length - 1].key}` : "Unavailable" }];
        if (allowRecentActivity) {
            report.filters.push(
                { label: "Activity list — Account", value: activityFilters.accountLabel || "All Accounts" },
                { label: "Activity list — From date (PHT)", value: activityFilters.dateFrom || "Any start date" },
                { label: "Activity list — To date (PHT)", value: activityFilters.dateTo || "Any end date" },
                { label: "Activity list — Search", value: activityFilters.search?.trim() || "None" },
                { label: "Matching activity entries", value: recentActivity.length.toLocaleString() },
            );
        }
        report.notes = [
            "The daily activity table covers the dashboard's last seven calendar days. Regional distribution includes nonzero counts for active roles shown by the chart. Counts are USER accounts; superadmins are excluded from user-account totals.",
            "Dates and times use Philippine time (UTC+8). All available chart rows are included.",
            allowRecentActivity
                ? (user?.user_type === "SUPERADMIN" ? "The activity list includes all matching pages permitted to superadmins, using the account, date and search filters above. Date boundaries include the entire selected Philippine calendar day." : "The activity list includes all matching pages for USER accounts in your organization, using the account, date and search filters above. Date boundaries include the entire selected Philippine calendar day.")
                : "Detailed recent account activity is not available to this account's access level and is excluded from this report.",
        ];
        report.sections = [
            { title: "Account Summary", itemLabel: "Metric", countLabel: "Count", showShare: false, rows: [
                { label: "Total User Accounts", count: totalUsers },
                { label: "Organizations", count: organizations.length },
                { label: "Active Roles", count: activeRoles.length },
                { label: "Activity This Week", count: days.reduce((total, day) => total + number(day.actions), 0) },
            ] },
            { title: "All User Activity — Daily Counts", columns: [column("date", "Date (PHT)", 40), column("day", "Day", 25), column("actions", "Account Actions", 35, "right")],
                rows: days.map((day) => ({ id: day.key, date: day.key, day: day.day, actions: number(day.actions) })) },
            { title: "User Role Distribution by Region", columns: [column("region", "Regional Office", 50), column("role", "Role", 30), column("users", "Users", 20, "right")],
                rows: regionDistribution.flatMap((row) => activeRoles.filter((role) => number(row[role.name]) > 0).map((role) => ({ id: `${row.region}-${role.name}`, region: regionLabel(row.region), role: role.name, users: number(row[role.name]) }))) },
        ];
        if (allowRecentActivity) {
            report.sections.push({
                title: "Recent Account Activity — Matching Entries",
                columns: [column("name", "User", 15), column("role", "Account Type / Role", 12), column("entry", "Entry", 30), column("module", "Module", 13), column("ip", "IP Address", 12), column("logged", "Logged At (PHT)", 18)],
                rows: recentActivity.map((log) => ({
                    id: log.id, name: text(log.user_name), role: log.user_type === "SUPERADMIN" ? "SUPERADMIN" : text(log.role_label || log.user_type),
                    entry: text(log.entry), module: text(log.module), ip: text(log.ip_address || log.ip),
                    logged: formatSelfReportPrintDate(log.created_at),
                })),
            });
        }
    } else {
        throw new Error("This account report is not supported.");
    }
    return report;
};
