"use client";

import { BadgeCheck } from "lucide-react";
import { useRef } from "react";
import type { Testimonial } from "@/lib/api/reviews";

interface TestimonialsProps {
    testimonials: Testimonial[];
}

export default function Testimonials({ testimonials }: TestimonialsProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    if (!testimonials || testimonials.length === 0) {
        return null;
    }

    const scrollLeft = () => {
        if (scrollContainerRef.current) {
            const cardWidth = 380 + 24; // card width + gap
            scrollContainerRef.current.scrollBy({
                left: -cardWidth,
                behavior: 'smooth'
            });
        }
    };

    const scrollRight = () => {
        if (scrollContainerRef.current) {
            const cardWidth = 380 + 24; // card width + gap
            scrollContainerRef.current.scrollBy({
                left: cardWidth,
                behavior: 'smooth'
            });
        }
    };

    return (
        <section className="py-6 md:py-8 bg-white pb-0 sm:pb-40">
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header with Navigation Buttons */}
                <div className="flex items-center justify-between mb-4 md:mb-5">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900">
                            Our Happy Customers
                        </h2>
                        <p className="text-gray-500 mt-1 text-sm sm:text-base">
                            See what our customers are saying about us
                        </p>
                    </div>

                    {/* Navigation Buttons */}
                    <div className="hidden sm:flex items-center gap-2">
                        <button
                            onClick={scrollLeft}
                            className="w-11 h-11 bg-gray-50/50 border border-gray-100 hover:bg-gray-50 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow"
                            aria-label="Previous testimonials"
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-gray-700"
                            >
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </button>
                        <button
                            onClick={scrollRight}
                            className="w-11 h-11 bg-[#008ECC] hover:bg-blue-700 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm hover:shadow"
                            aria-label="Next testimonials"
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-white"
                            >
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Testimonials Cards - Horizontal Scroll */}
                <div className="relative">
                    <div
                        ref={scrollContainerRef}
                        className="overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth"
                        style={{ scrollBehavior: 'smooth' }}
                    >
                        <div className="flex gap-4 sm:gap-6 pb-4" style={{ minWidth: "max-content" }}>
                            {testimonials.map((testimonial) => {
                                const customerName = testimonial.user?.name || "Anonymous";
                                const reviewText = testimonial.comment || testimonial.title || "";
                                return (
                                    <div
                                        key={testimonial.id}
                                        className="shrink-0 w-[320px] sm:w-[380px] bg-gray-50/50 rounded-2xl border border-gray-100 transition-all duration-200 p-6 sm:p-8"
                                    >
                                        {/* Customer Name */}
                                        <div className="flex items-center gap-2 mb-4 sm:mb-6">
                                            <h4 className="text-lg sm:text-xl font-semibold text-gray-900">
                                                {customerName}
                                            </h4>
                                            <BadgeCheck size={22} className="text-green-500" fill="currentColor" strokeWidth={2} />
                                        </div>

                                        {/* Star Rating */}
                                        <div className="flex items-center gap-1 mb-4 sm:mb-6">
                                            {Array.from({ length: testimonial.rating }).map((_, index) => (
                                                <svg
                                                    key={index}
                                                    width="18"
                                                    height="18"
                                                    viewBox="0 0 24 24"
                                                    fill="currentColor"
                                                    className="text-yellow-500"
                                                >
                                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                                </svg>
                                            ))}
                                        </div>

                                        {/* Review Text */}
                                        {reviewText && (
                                            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                                                &ldquo;{reviewText}&rdquo;
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
