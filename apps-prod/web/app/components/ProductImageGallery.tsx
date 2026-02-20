"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { imageLoader } from "@/lib/utils/image-loader";

interface ProductImageGalleryProps {
    images: string[];
    productName: string;
}

export default function ProductImageGallery({ images, productName }: ProductImageGalleryProps) {
    const [selectedImage, setSelectedImage] = useState(0);
    const [mainImage, setMainImage] = useState<string | undefined>("");
    const [isHoverEnabled, setIsHoverEnabled] = useState(true);

    // Set initial main image
    useEffect(() => {
        if (images && images.length > 0) {
            setMainImage(images[0]);
        }
    }, [images]);

    // Handle thumbnail click
    const handleThumbnailClick = (index: number) => {
        setSelectedImage(index);
        setMainImage(images[index]);
    };

    // Handle thumbnail hover
    const handleThumbnailHover = (index: number) => {
        if (isHoverEnabled) {
            setSelectedImage(index);
            setMainImage(images[index]);
        }
    };

    // Toggle hover functionality
    const toggleHoverMode = () => {
        setIsHoverEnabled(!isHoverEnabled);
    };

    // Handle next/previous image navigation
    const handleNextImage = () => {
        const nextIndex = (selectedImage + 1) % images.length;
        handleThumbnailClick(nextIndex);
    };

    const handlePrevImage = () => {
        const prevIndex = (selectedImage - 1 + images.length) % images.length;
        handleThumbnailClick(prevIndex);
    };

    // If no images provided, show a placeholder
    if (!images || images.length === 0) {
        return (
            <div className="flex gap-6 p-4">
                <div className="flex flex-col gap-3">
                    {[1, 2, 3].map((item) => (
                        <div
                            key={item}
                            className="w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center"
                        >
                            <span className="text-xs text-gray-400">No image</span>
                        </div>
                    ))}
                </div>
                <div className="flex-1 relative aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                    <p className="text-gray-500">No product images available</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 p-4">
            {/* Left side - Thumbnail Images (vertical) */}
            <div className="flex lg:flex-col gap-3 order-2 lg:order-1 overflow-x-auto lg:overflow-visible">
                {images.map((image, index) => (
                    <button
                        key={index}
                        onClick={() => handleThumbnailClick(index)}
                        onMouseEnter={() => handleThumbnailHover(index)}
                        className={`min-w-16 h-16 lg:w-20 lg:h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 flex-shrink-0 relative ${selectedImage === index
                            ? "border-orange-500 ring-2 ring-orange-100"
                            : "border-gray-200 hover:border-gray-400"
                            }`}
                    >
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center relative">
                            {image.startsWith('http') || image.startsWith('/') ? (
                                <Image
                                    src={image}
                                    alt={`${productName} thumbnail ${index + 1}`}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 1024px) 64px, 80px"
                                    loader={imageLoader}
                                    onError={() => {
                                        // Error handling is done via CSS fallback
                                    }}
                                />
                            ) : (
                                <span className="text-xs text-gray-500">Img {index + 1}</span>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {/* Main Product Image */}
            <div className="flex-1 relative order-1 lg:order-2">
                <div className="aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                    <div className="w-full h-full flex items-center justify-center relative">
                        {mainImage?.startsWith('http') || mainImage?.startsWith('/') ? (
                            <Image
                                src={mainImage}
                                alt={productName}
                                fill
                                className="object-contain"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                loader={imageLoader}
                                onError={() => {
                                    // Error handling is done via CSS fallback
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-8">
                                <p className="text-gray-400 text-lg mb-2 font-medium">{productName}</p>
                                <p className="text-gray-500 text-sm">Image {selectedImage + 1} of {images.length}</p>
                                <p className="text-gray-400 text-xs mt-4">(Image placeholder - actual image URL expected)</p>
                            </div>
                        )}

                        {/* Navigation arrows for larger screens */}
                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={handlePrevImage}
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-all hidden lg:flex"
                                    aria-label="Previous image"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                <button
                                    onClick={handleNextImage}
                                    className="absolute right-4 top-1/2 transform -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-gray-700 hover:bg-gray-50 transition-all hidden lg:flex"
                                    aria-label="Next image"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Image counter and controls */}
                <div className="flex justify-between items-center mt-4">
                    <div className="text-sm text-gray-500">
                        Image {selectedImage + 1} of {images.length}
                    </div>

                    {/* Hover mode toggle */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Hover mode:</span>
                        <button
                            onClick={toggleHoverMode}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full ${isHoverEnabled ? 'bg-orange-500' : 'bg-gray-300'}`}
                            aria-label={isHoverEnabled ? "Disable hover mode" : "Enable hover mode"}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isHoverEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                        <span className="text-xs font-medium">{isHoverEnabled ? "On" : "Off"}</span>
                    </div>
                </div>

                {/* Mobile navigation buttons */}
                {images.length > 1 && (
                    <div className="flex justify-center gap-4 mt-4 lg:hidden">
                        <button
                            onClick={handlePrevImage}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Previous
                        </button>
                        <button
                            onClick={handleNextImage}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 flex items-center gap-2"
                        >
                            Next
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

        </div>
    );
}
