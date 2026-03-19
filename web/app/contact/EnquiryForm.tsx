'use client';
import { useMemo, useState } from "react";
import { useCategories } from "@/lib/hooks/use-categories";

export function EnquiryForm() {
    const { data: categories = [], isLoading: loadingCategories } = useCategories();
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
    const [notes, setNotes] = useState<string>("");

    const categoryOptions = useMemo(
        () =>
            categories.map((c: any) => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
            })),
        [categories]
    );

    const toggleCategory = (id: string) => {
        setSelectedCategoryIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleSendWhatsApp = () => {
        const phone = "7500905010";
        const selected = categoryOptions.filter((opt) => selectedCategoryIds.includes(opt.id));
        const categoryList =
            selected.length > 0 ? selected.map((s) => s.name).join(", ") : "General";

        const bodyLines = [
            "Hey Pagz,",
            `I'd like to enquire about: ${categoryList}.`,
            notes ? `Notes: ${notes}` : undefined,
            "",
            "- Sent from Contact page",
        ].filter(Boolean);

        const text = encodeURIComponent(bodyLines.join("\n"));
        const url = `https://wa.me/91${phone}?text=${text}`;
        if (typeof window !== "undefined") {
            window.open(url, "_blank");
        }
    };

    return (
        <section className="mt-6 rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-hkgb font-medium text-gray-900">Quick WhatsApp Enquiry</h2>
            <p className="mt-2 text-sm text-gray-600">
                Choose one or more service categories and send us a WhatsApp message with your enquiry.
            </p>

            <div className="mt-4 space-y-4">
                <div>
                    <p className="text-sm font-medium text-gray-800 mb-2">Select Categories</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {loadingCategories ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-9 w-full animate-pulse rounded-md bg-gray-200" />
                            ))
                        ) : categoryOptions.length > 0 ? (
                            categoryOptions.map((opt) => (
                                <label
                                    key={opt.id}
                                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${selectedCategoryIds.includes(opt.id)
                                            ? "border-[#008ECC] bg-blue-50"
                                            : "border-gray-200 hover:bg-gray-50"
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedCategoryIds.includes(opt.id)}
                                        onChange={() => toggleCategory(opt.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-[#008ECC] focus:ring-[#008ECC]"
                                    />
                                    <span className="truncate">{opt.name}</span>
                                </label>
                            ))
                        ) : (
                            <p className="col-span-full text-sm text-gray-500">
                                No categories available right now.
                            </p>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">
                        Notes (optional)
                    </label>
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Tell us more about your enquiry…"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#008ECC]"
                    />
                </div>

                <div>
                    <button
                        type="button"
                        onClick={handleSendWhatsApp}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-white hover:bg-[#1EBE59] transition-colors"
                    >
                        <svg style={{ color: 'white' }} className="w-7 h-7 align-middle shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
                            <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" fill="white"></path>
                        </svg>
                        <span className="leading-none font-bold">Send WhatsApp Message</span>
                    </button>
                </div>
            </div>
        </section>
    );
}

