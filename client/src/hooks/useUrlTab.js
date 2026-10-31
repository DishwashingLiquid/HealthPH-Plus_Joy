import { useSearchParams } from "react-router-dom";

// The URL is the source of truth so refresh and browser navigation retain tabs.
export default function useUrlTab(parameter, allowedTabs, defaultTab) {
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = searchParams.get(parameter);
    const activeTab = allowedTabs.includes(requestedTab)
        ? requestedTab
        : defaultTab;

    const setActiveTab = (tab) => {
        if (!allowedTabs.includes(tab) || tab === requestedTab) return;

        setSearchParams((previous) => {
            const next = new URLSearchParams(previous);
            next.set(parameter, tab);
            return next;
        });
    };

    return [activeTab, setActiveTab];
}
