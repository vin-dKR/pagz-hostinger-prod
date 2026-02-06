"use client";

import { Share2, Check } from "lucide-react";
import { useState } from "react";
import { toastSuccess } from "@/lib/utils/toast";

interface ProductShareButtonProps {
    onShare: () => Promise<boolean>;
    onCopy: () => Promise<boolean>;
    className?: string;
    showLabel?: boolean;
}

export default function ProductShareButton({
    onShare,
    onCopy,
    className = "",
    showLabel = false,
}: ProductShareButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleClick = async () => {
        const shared = await onShare();
        toastSuccess("Link copied to clipboard!");

        if (!shared) {
            // If share failed, try copy as fallback
            const copied = await onCopy();
            if (copied) {
                setCopied(true);
                toastSuccess("Link copied to clipboard!");
                setTimeout(() => setCopied(false), 2000);
            }
        }
    };

    return (
        <button
            onClick={handleClick}
            className={`flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer ${className}`}
        >
            {copied ? (
                <>
                    <Check size={showLabel ? 18 : 20} className="text-green-600" />
                    {showLabel && <span className="text-sm font-medium text-green-600">Copied!</span>}
                </>
            ) : (
                <>
                    <Share2 size={showLabel ? 18 : 20} />
                    {showLabel && <span className="text-sm font-medium">Share</span>}
                </>
            )}
        </button>
    );
}

