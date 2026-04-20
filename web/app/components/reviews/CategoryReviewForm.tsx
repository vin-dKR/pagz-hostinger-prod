"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Star, Upload, X, Play } from "lucide-react";
import {
    CreateCategoryReviewData,
    createCategoryReview,
} from "@/lib/api/reviews";
import { uploadReviewImages } from "@/lib/api/uploads";
import { BarsSpinner } from "../shared/BarsSpinner";
import { toastError, toastInfo, toastSuccess } from "@/lib/utils/toast";

const MAX_TITLE_LENGTH = 100;
const MAX_COMMENT_LENGTH = 1000;
const MAX_FILES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB
const ACCEPT_ATTR =
    "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime";
const ACCEPTED_MIMES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
]);

interface CategoryReviewFormProps {
    categoryId: string;
    productId?: string;
    onSuccess?: () => void;
    onCancel?: () => void;
}

interface PendingFile {
    file: File;
    previewUrl: string;
    isVideo: boolean;
}

export default function CategoryReviewForm({
    categoryId,
    productId,
    onSuccess,
    onCancel,
}: CategoryReviewFormProps) {
    const [rating, setRating] = useState(0);
    const [hoveredRating, setHoveredRating] = useState(0);
    const [title, setTitle] = useState("");
    const [comment, setComment] = useState("");
    const [files, setFiles] = useState<PendingFile[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Revoke object URLs on unmount
    useEffect(() => {
        return () => {
            files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resetForm = () => {
        setRating(0);
        setTitle("");
        setComment("");
        files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleFilesSelected = (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const picked = e.target.files ? Array.from(e.target.files) : [];
        if (picked.length === 0) return;

        const remainingSlots = MAX_FILES - files.length;
        if (picked.length > remainingSlots) {
            toastError(
                `You can attach at most ${MAX_FILES} files (${remainingSlots} slot${remainingSlots === 1 ? "" : "s"} left).`,
            );
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        const accepted: PendingFile[] = [];
        for (const file of picked) {
            if (!ACCEPTED_MIMES.has(file.type)) {
                toastError(`Unsupported file type: ${file.name}`);
                continue;
            }
            const isVideo = file.type.startsWith("video/");
            const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
            if (file.size > limit) {
                toastError(
                    `${file.name} is too large (max ${isVideo ? "50MB" : "5MB"}).`,
                );
                continue;
            }
            accepted.push({
                file,
                previewUrl: URL.createObjectURL(file),
                isVideo,
            });
        }

        if (accepted.length > 0) {
            setFiles((prev) => [...prev, ...accepted]);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeFile = (index: number) => {
        setFiles((prev) => {
            const next = [...prev];
            const [removed] = next.splice(index, 1);
            if (removed) URL.revokeObjectURL(removed.previewUrl);
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (rating < 1 || rating > 5) {
            toastError("Please select a rating");
            return;
        }

        if (!title.trim() && !comment.trim()) {
            toastError("Please provide either a title or comment");
            return;
        }

        setIsSubmitting(true);
        try {
            let uploadedUrls: string[] = [];
            if (files.length > 0) {
                const uploadResp = await uploadReviewImages(
                    files.map((f) => f.file),
                    productId,
                );
                if (!uploadResp.success || !uploadResp.data) {
                    throw new Error(uploadResp.error || "Failed to upload media");
                }
                uploadedUrls = uploadResp.data.files.map((f) => f.url);
            }

            const payload: CreateCategoryReviewData = {
                rating,
                title: title.trim() || undefined,
                comment: comment.trim() || undefined,
                images: uploadedUrls.length > 0 ? uploadedUrls : undefined,
                productId,
            };

            const response = await createCategoryReview(categoryId, payload);

            if (response.success) {
                toastSuccess("Review submitted successfully");
                setTimeout(() => {
                    toastInfo("Your review is pending admin approval.", 5000);
                }, 400);
                resetForm();
                onSuccess?.();
            } else {
                throw new Error(response.error || "Failed to submit review");
            }
        } catch (err) {
            const statusCode = (err as { statusCode?: number }).statusCode;
            if (statusCode === 403) {
                toastError("You must purchase from this category before reviewing");
            } else {
                toastError(
                    err instanceof Error ? err.message : "Failed to submit review",
                );
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        resetForm();
        onCancel?.();
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 space-y-4 mb-6"
        >
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rating <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-1">
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
                                size={28}
                                className={
                                    star <= (hoveredRating || rating)
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-gray-300"
                                }
                            />
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                </label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={MAX_TITLE_LENGTH}
                    placeholder="Give your review a title"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your Review
                </label>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={MAX_COMMENT_LENGTH}
                    rows={4}
                    placeholder="Share your experience..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Photos / Videos
                    <span className="ml-1 font-normal text-xs text-gray-500">
                        (optional, up to {MAX_FILES})
                    </span>
                </label>
                <div className="flex flex-wrap items-start gap-3">
                    {files.map((f, idx) => (
                        <div
                            key={`${f.file.name}-${idx}`}
                            className="relative w-20 h-20 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden"
                        >
                            {f.isVideo ? (
                                <>
                                    <video
                                        src={f.previewUrl}
                                        className="w-full h-full object-cover"
                                        muted
                                        playsInline
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
                                        <Play size={20} className="text-white fill-current" />
                                    </div>
                                </>
                            ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={f.previewUrl}
                                    alt={f.file.name}
                                    className="w-full h-full object-cover"
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => removeFile(idx)}
                                disabled={isSubmitting}
                                aria-label={`Remove ${f.file.name}`}
                                className="absolute -top-2 -right-2 bg-white border border-gray-200 rounded-full p-1 shadow hover:bg-gray-50 disabled:opacity-50"
                            >
                                <X size={12} className="text-gray-600" />
                            </button>
                        </div>
                    ))}

                    {files.length < MAX_FILES && (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isSubmitting}
                            className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                        >
                            <Upload size={18} />
                            <span className="text-[10px] mt-1">Add</span>
                        </button>
                    )}
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT_ATTR}
                    multiple
                    onChange={handleFilesSelected}
                    className="hidden"
                />
                <p className="text-xs text-gray-500 mt-2">
                    Images up to 5MB, videos up to 50MB. JPG, PNG, WEBP, MP4, WEBM, MOV.
                </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting || rating === 0}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <BarsSpinner />
                            Submitting...
                        </>
                    ) : (
                        <>
                            <CheckCircle2 size={16} />
                            Submit
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
