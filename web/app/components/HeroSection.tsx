"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCategories } from "@/lib/hooks/use-categories";
import { type Category } from "@/lib/api/categories";
import { useCarousel } from "@/lib/hooks/use-carousel";
import Image from "next/image";

const EMPTY_CATEGORIES: Category[] = [];

export default function HeroSection() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [categories, setCategories] = useState<Array<{ name: string; href: string }>>([]);
    const [searchSuggestions, setSearchSuggestions] = useState<Category[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const { data: carousels = [], isLoading: carouselLoading } = useCarousel();
    const { data: allCategoriesData, isLoading: categoriesLoading } = useCategories();
    const allCategories = allCategoriesData ?? EMPTY_CATEGORIES;
    
    const [virtualIndex, setVirtualIndex] = useState(1); // Start at 1 (first real slide after duplicate)
    const [isTransitioning, setIsTransitioning] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState(0);
    const [dragOffset, setDragOffset] = useState(0);
    const [hasDragged, setHasDragged] = useState(false);
    const carouselRef = useRef<HTMLDivElement>(null);
    const autoRotateRef = useRef<NodeJS.Timeout | null>(null);
    const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Create extended carousel array with duplicates for infinite loop
    const extendedCarousels = carousels.length > 0 
        ? [carousels[carousels.length - 1], ...carousels, carousels[0]]
        : [];
    
    // Process categories when they're loaded from cache
    useEffect(() => {
        if (allCategories.length > 0) {
            // Sort by priority (ascending - lower number = higher priority)
            // Then take top 3
            const sortedCategories = allCategories
                .filter(cat => cat.isActive)
                .sort((a, b) => {
                    const priorityA = a.priority ?? 0;
                    const priorityB = b.priority ?? 0;
                    if (priorityA !== priorityB) {
                        return priorityA - priorityB;
                    }
                    // If priorities are equal, sort by name
                    return a.name.localeCompare(b.name);
                })
                .slice(0, 3)
                .map(cat => ({
                    name: cat.name,
                    href: `/services/${cat.slug}`,
                }));
            
            setCategories(sortedCategories);
        }
    }, [allCategories]);

    // Auto-rotate carousel (paused when dragging)
    useEffect(() => {
        if (carousels.length <= 1 || isDragging) return;

        autoRotateRef.current = setInterval(() => {
            setVirtualIndex((prev) => {
                const next = prev + 1;
                // If we reach the duplicate at the end, jump to real first slide without animation
                if (next >= extendedCarousels.length - 1) {
                    setTimeout(() => {
                        setIsTransitioning(false);
                        setVirtualIndex(1); // Jump to real first slide
                        setTimeout(() => setIsTransitioning(true), 50);
                    }, 300);
                    return next;
                }
                return next;
            });
        }, 5000); // Change slide every 5 seconds

        return () => {
            if (autoRotateRef.current) {
                clearInterval(autoRotateRef.current);
            }
        };
    }, [carousels.length, isDragging, extendedCarousels.length]);

    // Handle search suggestions
    useEffect(() => {
        if (searchQuery.trim().length > 0) {
            const query = searchQuery.toLowerCase().trim();
            const filtered = allCategories
                .filter(cat => 
                    cat.isActive && (
                        cat.name.toLowerCase().includes(query) ||
                        cat.slug.toLowerCase().includes(query) ||
                        (cat.description && cat.description.toLowerCase().includes(query))
                    )
                )
                .slice(0, 5); // Show top 5 suggestions
            setSearchSuggestions((prev) => {
                const isSame =
                    prev.length === filtered.length &&
                    prev.every((item, index) => item.id === filtered[index]?.id);
                return isSame ? prev : filtered;
            });
            setShowSuggestions((prev) => {
                const next = filtered.length > 0;
                return prev === next ? prev : next;
            });
        } else {
            setSearchSuggestions((prev) => (prev.length === 0 ? prev : []));
            setShowSuggestions((prev) => (prev ? false : prev));
        }
    }, [searchQuery, allCategories]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            // If there's a matching suggestion, go to the first one
            if (searchSuggestions.length > 0 && searchSuggestions[0]) {
                handleSuggestionClick(searchSuggestions[0]);
            } else {
                // Otherwise, go to services page to show all services
                router.push('/services');
                setSearchQuery('');
                setShowSuggestions(false);
            }
        }
    };

    const handleSuggestionClick = (category: Category) => {
        // Navigate immediately
        router.push(`/services/${category.slug}`);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchSuggestions.length > 0 && searchSuggestions[0]) {
            e.preventDefault();
            handleSuggestionClick(searchSuggestions[0]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    const goToSlide = (index: number, e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        // Convert real index to virtual index (add 1 for the duplicate at start)
        setVirtualIndex(index + 1);
    };

    const goToPrevious = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        setVirtualIndex((prev) => {
            const next = prev - 1;
            // If we go before the duplicate at start, jump to real last slide without animation
            if (next < 0) {
                setTimeout(() => {
                    setIsTransitioning(false);
                    setVirtualIndex(extendedCarousels.length - 2); // Jump to real last slide
                    setTimeout(() => setIsTransitioning(true), 50);
                }, 300);
                return 0; // Show duplicate
            }
            return next;
        });
    };

    const goToNext = (e?: React.MouseEvent) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        setVirtualIndex((prev) => {
            const next = prev + 1;
            // If we reach the duplicate at the end, jump to real first slide without animation
            if (next >= extendedCarousels.length - 1) {
                setTimeout(() => {
                    setIsTransitioning(false);
                    setVirtualIndex(1); // Jump to real first slide
                    setTimeout(() => setIsTransitioning(true), 50);
                }, 300);
                return extendedCarousels.length - 1; // Show duplicate
            }
            return next;
        });
    };

    // Mouse/Touch drag handlers
    const handleDragStart = (clientX: number) => {
        setIsDragging(true);
        setDragStart(clientX);
        setDragOffset(0);
        setHasDragged(false);
    };

    const handleDragMove = (clientX: number) => {
        if (!isDragging) return;
        const offset = clientX - dragStart;
        setDragOffset(offset);
        // Mark as dragged if movement is significant
        if (Math.abs(offset) > 5) {
            setHasDragged(true);
        }
    };

    const handleDragEnd = () => {
        if (!isDragging) return;
        
        const threshold = 50; // Minimum drag distance to trigger slide change
        const containerWidth = carouselRef.current?.offsetWidth || 1;
        const dragPercentage = (dragOffset / containerWidth) * 100;
        
        if (Math.abs(dragPercentage) > 10) { // 10% of container width
            if (dragOffset > 0) {
                // Dragged right, go to previous slide
                goToPrevious();
            } else {
                // Dragged left, go to next slide
                goToNext();
            }
        }
        
        setIsDragging(false);
        setDragOffset(0);
        setDragStart(0);
        // Reset hasDragged after a short delay to allow click handler to check it
        setTimeout(() => setHasDragged(false), 100);
    };

    // Mouse event handlers
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        handleDragStart(e.clientX);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            handleDragMove(e.clientX);
        }
    };

    const handleMouseUp = () => {
        handleDragEnd();
    };

    const handleMouseLeave = () => {
        if (isDragging) {
            handleDragEnd();
        }
    };

    // Touch event handlers
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches[0]) {
            handleDragStart(e.touches[0].clientX);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (isDragging && e.touches[0]) {
            handleDragMove(e.touches[0].clientX);
        }
    };

    return (
        <section className="bg-white w-full py-3 md:py-6 flex items-center justify-center">
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                {carouselLoading ? (
                    <div className="relative w-full aspect-1680/520 rounded-xl md:rounded-2xl bg-gray-200 animate-pulse flex items-center justify-center">
                        <div className="text-gray-400">Loading carousel...</div>
                    </div>
                ) : carousels.length === 0 ? (
                    <div className="relative w-full aspect-1680/520 rounded-xl md:rounded-2xl bg-gray-100 flex items-center justify-center">
                        <div className="text-gray-500 text-center">
                            <p className="text-lg font-medium mb-2">No carousel items available</p>
                            <p className="text-sm">Please add carousel items from the admin dashboard</p>
                        </div>
                    </div>
                ) : (
                    <div 
                        ref={carouselRef}
                        className="relative w-full aspect-1680/520 rounded-xl md:rounded-2xl overflow-hidden select-none cursor-grab active:cursor-grabbing"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseLeave}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleDragEnd}
                    >
                        {/* Carousel Images */}
                        <div 
                            className="relative w-full h-full"
                            style={{
                                transform: isDragging 
                                    ? `translateX(calc(-${virtualIndex * 100}% + ${dragOffset}px))` 
                                    : `translateX(-${virtualIndex * 100}%)`,
                                transition: isDragging || !isTransitioning 
                                    ? 'none' 
                                    : 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                        >
                            {extendedCarousels.map((carousel, index) => {
                                if (!carousel) return null;

                                const slug = carousel.category?.slug;
                                const handleSlideClick = () => {
                                    // Suppress navigation when the user was dragging —
                                    // hasDragged stays true for ~100ms after drag end.
                                    if (hasDragged) return;
                                    if (slug) {
                                        router.push(`/services/${slug}`);
                                    }
                                };

                                return (
                                    <div
                                        key={`${carousel.id}-${index}`}
                                        onClick={slug ? handleSlideClick : undefined}
                                        className={`absolute inset-0 ${slug ? 'cursor-pointer' : ''}`}
                                        style={{
                                            left: `${index * 100}%`,
                                            width: '100%',
                                        }}
                                    >
                                        <Image
                                            src={carousel.imageUrl}
                                            alt={carousel.alt || 'Carousel image'}
                                            fill
                                            /* Keep the original 1680x520 format without cropping. */
                                            className="object-contain"
                                            priority={index === 1} // Prioritize first real slide
                                            draggable={false}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Navigation Arrows */}
                        {carousels.length > 1 && (
                            <>
                                <button
                                    onClick={(e) => goToPrevious(e)}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-colors"
                                    aria-label="Previous slide"
                                >
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="15 18 9 12 15 6"></polyline>
                                    </svg>
                                </button>
                                <button
                                    onClick={(e) => goToNext(e)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-colors"
                                    aria-label="Next slide"
                                >
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <polyline points="9 18 15 12 9 6"></polyline>
                                    </svg>
                                </button>
                            </>
                        )}

                    </div>
                )}
            </div>
        </section>
    );
}
