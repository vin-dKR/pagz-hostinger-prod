"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { imageLoader } from "@/lib/utils/image-loader";
import { Star, Upload, X, Image as ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { createReview, CreateReviewData } from "@/lib/api/reviews";
import { uploadReviewImages } from "@/lib/api/uploads";
import { toastError, toastSuccess, toastPromise, toastInfo } from "@/lib/utils/toast";
import { useAuth } from "@/contexts/AuthContext";
import { BarsSpinner } from "../shared/BarsSpinner";

interface ReviewFormProps {
    productId: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export default function ReviewForm({ productId, onSuccess, onCancel }: ReviewFormProps) {
    const { user, isAuthenticated } = useAuth();
    const [rating, setRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [title, setTitle] = useState("");
    const [comment, setComment] = useState("");
    const [images, setImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);

    const MAX_IMAGES = 5;
    const MAX_IMAGE_SIZE_MB = 5;
    const MAX_TITLE_LENGTH = 100;
    const MAX_COMMENT_LENGTH = 1000;
    const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (rating < 1 || rating > 5) {
            newErrors.rating = "Please select a rating";
        }

        if (!title.trim() && !comment.trim()) {
            newErrors.content = "Please provide either a title or comment";
        }

        if (title.length > MAX_TITLE_LENGTH) {
            newErrors.title = `Title must be ${MAX_TITLE_LENGTH} characters or less`;
        }

        if (comment.length > MAX_COMMENT_LENGTH) {
            newErrors.comment = `Comment must be ${MAX_COMMENT_LENGTH} characters or less`;
        }

        if (images.length > MAX_IMAGES) {
            newErrors.images = `Maximum ${MAX_IMAGES} images allowed`;
        }

        images.forEach((img, index) => {
            if (img.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
                newErrors[`image_${index}`] = `Image ${index + 1} exceeds ${MAX_IMAGE_SIZE_MB}MB limit`;
            }
            if (!ACCEPTED_IMAGE_TYPES.includes(img.type)) {
                newErrors[`image_${index}`] = `Image ${index + 1} must be JPG, PNG, or WebP`;
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newImages: File[] = [];
        const newPreviews: string[] = [];

        files.forEach((file) => {
            // Validate file type
            if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
                toastError(`${file.name} must be JPG, PNG, or WebP format`);
                return;
            }

            // Validate file size
            if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
                toastError(`${file.name} exceeds ${MAX_IMAGE_SIZE_MB}MB size limit`);
                return;
            }

            // Check total image count
            if (images.length + newImages.length >= MAX_IMAGES) {
                toastError(`Maximum ${MAX_IMAGES} images allowed`);
                return;
            }

            newImages.push(file);

            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                setImagePreviews((prev) => [...prev, result]);
            };
            reader.readAsDataURL(file);
        });

        setImages((prev) => [...prev, ...newImages]);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemoveImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
        setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isAuthenticated) {
            toastError("Please login to submit a review");
            return;
        }

        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);

        try {
            // Upload images first if any
            let imageUrls: string[] = [];
            if (images.length > 0) {
                const uploadResponse = await toastPromise(
                    uploadReviewImages(images, productId),
                    {
                        loading: "Uploading images...",
                        success: "Images uploaded successfully",
                        error: "Failed to upload images",
                    }
                );

                if (uploadResponse.success && uploadResponse.data) {
                    // Extract URLs from uploaded files
                    imageUrls = uploadResponse.data.files.map((file) => file.url);
                } else {
                    throw new Error("Failed to upload images");
                }
            }

            // Prepare review data
            const reviewData: CreateReviewData = {
                rating,
                title: title.trim() || undefined,
                comment: comment.trim() || undefined,
                images: imageUrls.length > 0 ? imageUrls : undefined,
            };

            // Submit review
            try {
                const response = await toastPromise(
                    createReview(productId, reviewData),
                    {
                        loading: "Submitting review...",
                        success: "Review submitted successfully! Your review will be visible on the product page after admin approval.",
                        error: (err: any) => {
                            // Extract error message from API response
                            // The API client throws an error object with a 'message' property
                            if (err?.message) {
                                return err.message;
                            }
                            if (err?.error) {
                                return err.error;
                            }
                            if (typeof err === 'string') {
                                return err;
                            }
                            return "Failed to submit review";
                        },
                    }
                );

                if (response.success) {
                    // Show additional info message about admin approval
                    setTimeout(() => {
                        toastInfo("Your review is pending admin approval and will be visible on the product page once approved.", 6000);
                    }, 500);

                    // Reset form
                    setRating(0);
                    setTitle("");
                    setComment("");
                    setImages([]);
                    setImagePreviews([]);
                    setErrors({});

                    if (onSuccess) {
                        onSuccess();
                    }
                }
            } catch (err) {
                // toastPromise should have already shown the error toast
                // But if it didn't, show it here as a fallback
                const errorMessage = err instanceof Error
                    ? err.message
                    : (err && typeof err === 'object' && 'message' in err)
                        ? (err as any).message
                        : "Failed to submit review";

                // Only show if toastPromise didn't handle it (shouldn't happen, but safety net)
                console.error('Review submission error:', err);
            } finally {
                setIsSubmitting(false);
            }
        } catch (err) {
            // Outer catch for any unexpected errors
            const errorMessage = err instanceof Error ? err.message : "Failed to submit review";
            toastError(errorMessage);
            setIsSubmitting(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Login Required
                </h3>
                <p className="text-gray-600 mb-4">
                    Please login to write a review
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-6">
            <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Write a Review</h3>
                <p className="text-sm text-gray-600">
                    Share your experience with this product
                </p>
            </div>

            {/* Rating Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rating <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoveredRating(star)}
                            onMouseLeave={() => setHoveredRating(0)}
                            className="transition-transform hover:scale-110"
                        >
                            <Star
                                size={32}
                                className={
                                    star <= (hoveredRating || rating)
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-gray-300"
                                }
                            />
                        </button>
                    ))}
                    {rating > 0 && (
                        <span className="ml-2 text-sm text-gray-600">
                            {rating} {rating === 1 ? "star" : "stars"}
                        </span>
                    )}
                </div>
                {errors.rating && (
                    <p className="mt-1 text-sm text-red-600">{errors.rating}</p>
                )}
            </div>

            {/* Review Title */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Title <span className="text-gray-400 text-xs">(Optional)</span>
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={MAX_TITLE_LENGTH}
                    placeholder="Give your review a title"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="flex items-center justify-between mt-1">
                    {errors.title && (
                        <p className="text-sm text-red-600">{errors.title}</p>
                    )}
                    <p className="text-xs text-gray-500 ml-auto">
                        {title.length}/{MAX_TITLE_LENGTH}
                    </p>
                </div>
            </div>

            {/* Review Comment */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Review <span className="text-gray-400 text-xs">(Optional but recommended)</span>
                </label>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={MAX_COMMENT_LENGTH}
                    rows={5}
                    placeholder="Share your experience with this product..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                <div className="flex items-center justify-between mt-1">
                    {errors.comment && (
                        <p className="text-sm text-red-600">{errors.comment}</p>
                    )}
                    {errors.content && (
                        <p className="text-sm text-red-600">{errors.content}</p>
                    )}
                    <p className="text-xs text-gray-500 ml-auto">
                        {comment.length}/{MAX_COMMENT_LENGTH}
                    </p>
                </div>
            </div>

            {/* Image Upload */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Photos <span className="text-gray-400 text-xs">(Optional, max {MAX_IMAGES})</span>
                </label>
                <div className="space-y-3">
                    {imagePreviews.length > 0 && (
                        <div className="grid grid-cols-3 gap-3">
                            {imagePreviews.map((preview, index) => (
                                <div
                                    key={index}
                                    className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group"
                                >
                                    <Image
                                        src={preview}
                                        alt={`Preview ${index + 1}`}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 33vw, 150px"
                                        loader={imageLoader}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveImage(index)}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {images.length < MAX_IMAGES && (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        >
                            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-600 mb-1">
                                Click to upload or drag and drop
                            </p>
                            <p className="text-xs text-gray-500">
                                JPG, PNG, WebP (max {MAX_IMAGE_SIZE_MB}MB each)
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept={ACCEPTED_IMAGE_TYPES.join(",")}
                                multiple
                                onChange={handleImageSelect}
                                className="hidden"
                            />
                        </div>
                    )}

                    {errors.images && (
                        <p className="text-sm text-red-600">{errors.images}</p>
                    )}
                </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="submit"
                    disabled={isSubmitting || rating === 0}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <BarsSpinner />
                            Submitting...
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={16} />
                            Submit Review
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}

