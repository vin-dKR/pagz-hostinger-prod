"use client";

import { useState } from "react";

interface Tab {
    id: string;
    label: string;
    content: React.ReactNode;
}

interface ProductTabsProps {
    tabs: Tab[];
    activeTab?: string;
    onTabChange?: (tabId: string) => void;
}

export default function ProductTabs({ tabs, activeTab: controlledActiveTab, onTabChange }: ProductTabsProps) {
    const [internalActiveTab, setInternalActiveTab] = useState(tabs[0]?.id || "");

    // Use controlled tab if provided, otherwise use internal state
    const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;

    const handleTabChange = (tabId: string) => {
        if (onTabChange) {
            onTabChange(tabId);
        } else {
            setInternalActiveTab(tabId);
        }
    };

    const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

    return (
        <div className="mt-12">
            {/* Tab Headers */}
            <div className="border-b border-gray-200">
                <div className="flex gap-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`pb-4 px-2 font-medium text-sm transition-colors relative ${activeTab === tab.id
                                ? "text-blue-600"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                        >
                            {tab.label}
                            {activeTab === tab.id && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#008ECC]"></span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="mt-8">{activeTabContent}</div>
        </div>
    );
}
