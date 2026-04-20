"use client";

import { useEffect, useState } from "react";
import { PenSquare, X } from "lucide-react";
import CategoryReviewForm from "./CategoryReviewForm";
import { canReviewCategory } from "@/lib/api/reviews";

interface OrderItemReviewButtonProps {
    categoryId: string;
    productId?: string;
}

export default function OrderItemReviewButton({
    categoryId,
    productId,
}: OrderItemReviewButtonProps) {
    const [open, setOpen] = useState(false);
    const [alreadyReviewed, setAlreadyReviewed] = useState<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const resp = await canReviewCategory(categoryId);
                if (cancelled) return;
                if (resp.success && resp.data) {
                    setAlreadyReviewed(resp.data.alreadyReviewed === true);
                } else {
                    setAlreadyReviewed(false);
                }
            } catch {
                if (!cancelled) setAlreadyReviewed(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [categoryId]);

    if (alreadyReviewed) {
        return (
            <span className="mt-3 inline-flex items-center text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
                Review submitted
            </span>
        );
    }

    return (
        <div className="mt-3">
            {!open && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#008ECC] text-[#008ECC] rounded-lg hover:bg-blue-50 transition-colors"
                >
                    <PenSquare className="w-3.5 h-3.5" />
                    Write a Review
                </button>
            )}

            {open && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="bg-white rounded-2xl max-w-2xl w-full my-8 relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-2 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Write a Review
                            </h3>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="text-gray-400 hover:text-gray-600 rounded-full p-1"
                                aria-label="Close"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="px-4 sm:px-6 pb-4">
                            <CategoryReviewForm
                                categoryId={categoryId}
                                productId={productId}
                                onSuccess={() => {
                                    setAlreadyReviewed(true);
                                    setOpen(false);
                                }}
                                onCancel={() => setOpen(false)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
