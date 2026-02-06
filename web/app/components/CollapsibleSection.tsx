"use client";

import { useState, ReactNode } from "react";

interface CollapsibleSectionProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    defaultExpanded?: boolean;
}

export default function CollapsibleSection({
    title,
    subtitle,
    children,
    defaultExpanded = false,
}: CollapsibleSectionProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 mb-6">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between"
            >
                <div className="text-left">
                    <h3 className="text-lg font-hkgb font-bold text-gray-900">{title}</h3>
                    {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
                </div>
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-gray-600 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                >
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>

            {isExpanded && <div className="mt-4">{children}</div>}
        </div>
    );
}
