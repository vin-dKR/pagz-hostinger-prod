'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { imageLoader } from '@/lib/utils/image-loader';
import { X } from 'lucide-react';

interface ProductGalleryProps {
    images: Array<{
        id: string;
        src: string;
        alt: string;
        thumbnailSrc?: string;
    }>;
    fallbackIcon?: React.ReactNode;
    className?: string;
}

export const ProductGallery: React.FC<ProductGalleryProps> = ({
    images,
    fallbackIcon,
    className,
}) => {
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);

    const nextImage = () => {
        setSelectedImageIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = () => {
        setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    const openExpand = () => {
        setIsExpanded(true);
    };

    const closeExpand = () => {
        setIsExpanded(false);
    };

    // Handle ESC key to close modal
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isExpanded) {
                closeExpand();
            }
        };

        if (isExpanded) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden'; // Prevent body scroll
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isExpanded]);

    return (
        <div className={cn('space-y-4', className)}>
            {/* Desktop: Thumbnails and Main Image */}
            <div className="hidden lg:flex gap-4">
                {/* Vertical Thumbnails */}
                {images.length > 1 && (
                    <div className="flex flex-col gap-3">
                        {images.map((image, index) => (
                            <button
                                key={image.id}
                                onClick={() => setSelectedImageIndex(index)}
                                className={`shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden transition-all cursor-pointer relative ${selectedImageIndex === index
                                    ? "border-blue-600 scale-105 shadow-md"
                                    : "border-gray-200 hover:border-gray-300"
                                    }`}
                            >
                                <Image
                                    src={image.thumbnailSrc || image.src}
                                    alt={`Thumbnail ${index + 1}`}
                                    fill
                                    className="object-cover"
                                    sizes="80px"
                                    loader={imageLoader}
                                />
                            </button>
                        ))}
                    </div>
                )}

                {/* Main Image Container */}
                <div className="flex-1">
                    <div className="aspect-square relative overflow-hidden rounded-lg bg-gray-50">
                        {images[selectedImageIndex] ? (
                            <Image
                                src={images[selectedImageIndex].src}
                                alt={images[selectedImageIndex].alt}
                                fill
                                className="object-contain"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                onError={() => {
                                    // Error handling is done via CSS fallback
                                }}
                                loader={imageLoader}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                {fallbackIcon || 'No image available'}
                            </div>
                        )}

                        {/* Expand Button */}
                        {images[selectedImageIndex] && (
                            <button
                                className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors cursor-pointer z-10"
                                onClick={openExpand}
                                aria-label="Expand image"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                                </svg>
                            </button>
                        )}

                        {/* Image Navigation Controls */}
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={prevImage}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors cursor-pointer"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M15 18l-6-6 6-6" />
                                    </svg>
                                </button>

                                <button
                                    onClick={nextImage}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors cursor-pointer"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 18l6-6-6-6" />
                                    </svg>
                                </button>

                                {/* Image Counter */}
                                <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-xs">
                                    {selectedImageIndex + 1} / {images.length}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile: Main Image */}
            <div className="lg:hidden">
                <div className="aspect-square relative overflow-hidden rounded-lg bg-gray-50">
                    {images[selectedImageIndex] ? (
                        <Image
                            src={images[selectedImageIndex].src}
                            alt={images[selectedImageIndex].alt}
                            fill
                            className="object-contain"
                            sizes="(max-width: 768px) 100vw, 50vw"
                            onError={() => {
                                // Error handling is done via CSS fallback
                            }}
                            loader={imageLoader}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            {fallbackIcon || 'No image available'}
                        </div>
                    )}

                    {/* Image Navigation Controls */}
                    {images.length > 1 && (
                        <>
                            <button
                                onClick={prevImage}
                                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors cursor-pointer"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M15 18l-6-6 6-6" />
                                </svg>
                            </button>

                            <button
                                onClick={nextImage}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors cursor-pointer"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </button>

                            {/* Image Counter */}
                            <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-xs">
                                {selectedImageIndex + 1} / {images.length}
                            </div>
                        </>
                    )}
                </div>

                {/* Mobile Thumbnails */}
                {images.length > 1 && (
                    <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
                        {images.map((image, index) => (
                            <button
                                key={image.id}
                                onClick={() => setSelectedImageIndex(index)}
                                className={`shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden transition-all cursor-pointer relative ${selectedImageIndex === index
                                    ? "border-blue-600 scale-105 shadow-md"
                                    : "border-gray-200 hover:border-gray-300"
                                    }`}
                            >
                                <Image
                                    src={image.thumbnailSrc || image.src}
                                    alt={`Thumbnail ${index + 1}`}
                                    fill
                                    className="object-cover"
                                    sizes="80px"
                                    loader={imageLoader}
                                />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Expanded Image Modal */}
            {isExpanded && images[selectedImageIndex] && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                    onClick={closeExpand}
                >
                    {/* Close Button */}
                    <button
                        onClick={closeExpand}
                        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
                        aria-label="Close expanded view"
                    >
                        <X size={24} />
                    </button>

                    {/* Image Container */}
                    <div
                        className="relative w-full h-full max-w-7xl max-h-[90vh] flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Image
                            src={images[selectedImageIndex].src}
                            alt={images[selectedImageIndex].alt}
                            fill
                            className="object-contain"
                            sizes="100vw"
                            loader={imageLoader}
                        />

                        {/* Navigation Controls in Modal */}
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        prevImage();
                                    }}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full text-white transition-colors z-20 border border-white/20 shadow-lg"
                                    aria-label="Previous image"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M15 18l-6-6 6-6" />
                                    </svg>
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        nextImage();
                                    }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-full text-white transition-colors z-20 border border-white/20 shadow-lg"
                                    aria-label="Next image"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M9 18l6-6-6-6" />
                                    </svg>
                                </button>

                                {/* Image Counter in Modal */}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-sm rounded-full text-white text-sm">
                                    {selectedImageIndex + 1} / {images.length}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
