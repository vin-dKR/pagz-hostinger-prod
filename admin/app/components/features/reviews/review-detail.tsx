/**
 * Review Detail Component
 * Comprehensive review information with moderation actions
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Alert } from '@/app/components/ui/alert';
import { PageLoading } from '@/app/components/ui/loading';
import {
    getReview,
    approveReview,
    rejectReview,
    deleteReview,
    editAdminReview,
    type Review,
} from '@/lib/api/reviews.service';
import { getProduct, type Product } from '@/lib/api/products.service';
import { getUser, type User } from '@/lib/api/users.service';
import { formatDate, formatDateTime } from '@/lib/utils/format';
import {
    ArrowLeft,
    Star,
    Check,
    X,
    Trash2,
    Edit,
    Package,
    User as UserIcon,
    Mail,
    Phone,
    Calendar,
    ThumbsUp,
    Image as ImageIcon,
    CheckCircle2,
    ExternalLink,
} from 'lucide-react';
import { toastError, toastPromise, toastSuccess } from '@/lib/utils/toast';
import { useConfirm } from '@/lib/hooks/use-confirm';
import Link from 'next/link';

interface ReviewDetailProps {
    reviewId: string;
    initialReview?: Review;
}

interface ReviewDetailData extends Review {
    helpfulVotes?: Array<{
        id: string;
        userId: string;
        isHelpful: boolean;
        createdAt: string;
        user?: {
            id: string;
            name?: string;
            email: string;
        };
    }>;
}

export function ReviewDetail({ reviewId, initialReview }: ReviewDetailProps) {
    const router = useRouter();
    const [review, setReview] = useState<ReviewDetailData | null>(initialReview ? (initialReview as ReviewDetailData) : null);
    const [product, setProduct] = useState<Product | null>(null);
    const [userInfo, setUserInfo] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(!initialReview);
    const [error, setError] = useState<string | null>(null);
    const [isActioning, setIsActioning] = useState(false);
    const [imageViewer, setImageViewer] = useState<{ images: string[]; index: number } | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const { confirm, ConfirmDialog } = useConfirm();

    useEffect(() => {
        if (!initialReview) {
            loadReviewData();
        } else {
            // Still load product and user info if available
            if (initialReview.productId) {
                loadProductAndUser(initialReview.productId, initialReview.userId);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reviewId, initialReview]);

    const loadProductAndUser = async (productId: string, userId: string) => {
        try {
            const [productData, userData] = await Promise.all([
                getProduct(productId).catch(() => null),
                getUser(userId).catch(() => null),
            ]);
            if (productData) setProduct(productData);
            if (userData) setUserInfo(userData);
        } catch (err) {
            console.error('Failed to load related data:', err);
        }
    };

    const loadReviewData = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Load review
            const reviewData = await getReview(reviewId);
            setReview(reviewData as ReviewDetailData);

            // Load product details if available
            if (reviewData.productId) {
                try {
                    const productData = await getProduct(reviewData.productId);
                    setProduct(productData);
                } catch (err) {
                    console.error('Failed to load product:', err);
                }
            }

            // Load user details
            if (reviewData.userId) {
                try {
                    const userData = await getUser(reviewData.userId);
                    setUserInfo(userData);
                } catch (err) {
                    console.error('Failed to load user:', err);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load review');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!review) return;

        const confirmed = await confirm({
            title: 'Approve Review',
            description: 'Are you sure you want to approve this review? It will be visible on the product page.',
            confirmText: 'Approve',
            cancelText: 'Cancel',
            onConfirm: async () => {
                try {
                    setIsActioning(true);
                    await toastPromise(approveReview(review.id), {
                        loading: 'Approving review...',
                        success: 'Review approved successfully',
                        error: 'Failed to approve review',
                    });
                    await loadReviewData();
                } catch (err) {
                    // Error handled by toastPromise
                } finally {
                    setIsActioning(false);
                }
            },
        });
    };

    const handleReject = async () => {
        if (!review) return;

        const reason = window.prompt('Please provide a reason for rejecting this review:');
        if (reason === null) {
            return; // User cancelled
        }
        if (!reason.trim()) {
            toastError('Please provide a rejection reason');
            return;
        }

        try {
            setIsActioning(true);
            await toastPromise(rejectReview(review.id, reason.trim()), {
                loading: 'Rejecting review...',
                success: 'Review rejected successfully',
                error: 'Failed to reject review',
            });
            router.push('/reviews');
        } catch (err) {
            // Error handled by toastPromise
        } finally {
            setIsActioning(false);
        }
    };

    const handleDelete = async () => {
        if (!review) return;

        const confirmed = await confirm({
            title: 'Delete Review',
            description: 'Are you sure you want to delete this review? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    setIsActioning(true);
                    await toastPromise(deleteReview(review.id), {
                        loading: 'Deleting review...',
                        success: 'Review deleted successfully',
                        error: 'Failed to delete review',
                    });
                    router.push('/reviews');
                } catch (err) {
                    // Error handled by toastPromise
                } finally {
                    setIsActioning(false);
                }
            },
        });
    };

    const handleEdit = async (editData: {
        rating?: number;
        title?: string;
        comment?: string;
        isApproved?: boolean;
        isVerifiedPurchase?: boolean;
    }) => {
        if (!review) return;

        try {
            setIsActioning(true);
            await toastPromise(editAdminReview(review.id, editData), {
                loading: 'Updating review...',
                success: 'Review updated successfully',
                error: 'Failed to update review',
            });
            await loadReviewData();
            setIsEditModalOpen(false);
        } catch (err) {
            // Error handled by toastPromise
        } finally {
            setIsActioning(false);
        }
    };

    const handleImageClick = (index: number) => {
        if (review?.images && review.images.length > 0) {
            setImageViewer({ images: review.images, index });
        }
    };

    const getInitials = (name?: string, email?: string) => {
        if (name) {
            return name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
        }
        return email ? email[0]?.toUpperCase() : 'U';
    };

    if (isLoading) {
        return <PageLoading />;
    }

    if (error || !review) {
        return (
            <div className="space-y-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <Alert variant="error">{error || 'Review not found'}</Alert>
            </div>
        );
    }

    return (
        <>
            {ConfirmDialog}
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => router.back()}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold">Review Details</h1>
                            <p className="text-sm text-gray-600 mt-1">Review ID: {review.id}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant={review.isApproved ? 'success' : 'secondary'}>
                            {review.isApproved ? 'Approved' : 'Pending'}
                        </Badge>
                        {review.isVerifiedPurchase && (
                            <Badge variant="success" className="flex items-center gap-1">
                                <CheckCircle2 size={14} />
                                Verified Purchase
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                    {!review.isApproved && (
                        <Button onClick={handleApprove} disabled={isActioning} className="bg-green-600 hover:bg-green-700">
                            <Check className="h-4 w-4 mr-2" />
                            Approve Review
                        </Button>
                    )}
                    {review.isApproved && (
                        <Button
                            onClick={handleReject}
                            disabled={isActioning}
                            variant="outline"
                            className="border-orange-300 text-orange-700 hover:bg-orange-50"
                        >
                            <X className="h-4 w-4 mr-2" />
                            Reject Review
                        </Button>
                    )}
                    <Button
                        onClick={() => setIsEditModalOpen(true)}
                        disabled={isActioning}
                        variant="outline"
                    >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Review
                    </Button>
                    <Button
                        onClick={handleDelete}
                        disabled={isActioning}
                        variant="destructive"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Review
                    </Button>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Review Information */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Review Content Card */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="text-4xl font-bold">{review.rating}</div>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <Star
                                                    key={i}
                                                    size={24}
                                                    className={
                                                        i < review.rating
                                                            ? 'fill-yellow-400 text-yellow-400'
                                                            : 'text-gray-300'
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-right text-sm text-gray-500">
                                        <div>Created: {formatDate(review.createdAt)}</div>
                                        {review.updatedAt !== review.createdAt && (
                                            <div>Updated: {formatDate(review.updatedAt)}</div>
                                        )}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {review.title && (
                                    <div>
                                        <h3 className="text-xl font-semibold mb-2">{review.title}</h3>
                                    </div>
                                )}

                                {review.comment && (
                                    <div>
                                        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                            {review.comment}
                                        </p>
                                    </div>
                                )}

                                {/* Review Images */}
                                {review.images && review.images.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-700 mb-3">
                                            Review Images ({review.images.length})
                                        </h4>
                                        <div className="grid grid-cols-4 gap-3">
                                            {review.images.map((image, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => handleImageClick(index)}
                                                    className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-blue-300 transition-colors group"
                                                >
                                                    <img
                                                        src={image}
                                                        alt={`Review image ${index + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                                        <ImageIcon size={20} className="text-white opacity-0 group-hover:opacity-100" />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Helpful Votes */}
                                <div className="flex items-center gap-2 pt-4 border-t">
                                    <ThumbsUp size={18} className="text-gray-400" />
                                    <span className="text-sm text-gray-600">
                                        {review.isHelpful || 0} people found this helpful
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Helpful Votes List */}
                        {review.helpfulVotes && review.helpfulVotes.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Helpful Votes</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {review.helpfulVotes.slice(0, 10).map((vote) => (
                                            <div
                                                key={vote.id}
                                                className="flex items-center justify-between p-2 border rounded"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <ThumbsUp size={16} className="text-green-600" />
                                                    <span className="text-sm text-gray-600">
                                                        {vote.user?.name || vote.user?.email || 'Unknown User'}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-gray-500">
                                                    {formatDate(vote.createdAt)}
                                                </span>
                                            </div>
                                        ))}
                                        {review.helpfulVotes.length > 10 && (
                                            <p className="text-sm text-gray-500 text-center pt-2">
                                                ... and {review.helpfulVotes.length - 10} more
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Right Column - Product & User Info */}
                    <div className="space-y-6">
                        {/* Product Information Card */}
                        {product && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Package className="h-5 w-5" />
                                        Product Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {product.images && product.images.length > 0 && product.images[0] && (
                                        <div className="relative w-full aspect-square rounded-lg overflow-hidden border">
                                            <img
                                                src={product.images[0].url}
                                                alt={product.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
                                        <div className="space-y-1 text-sm text-gray-600">
                                            {product.sku && <div>SKU: {product.sku}</div>}
                                            {product.category && (
                                                <div>Category: {product.category.name}</div>
                                            )}
                                            {product.rating !== null && (
                                                <div className="flex items-center gap-1">
                                                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                                                    {Number(product.rating).toFixed(1)} ({product.totalReviews} reviews)
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <Link href={`/products/${product.id}`}>
                                        <Button variant="outline" className="w-full">
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            View Product
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        )}

                        {/* User Information Card */}
                        {(review.user || userInfo) && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <UserIcon className="h-5 w-5" />
                                        User Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                            {getInitials(
                                                review.user?.name || userInfo?.name,
                                                review.user?.email || userInfo?.email
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-semibold">
                                                {review.user?.name || userInfo?.name || 'Anonymous'}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                {review.user?.email || userInfo?.email}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        {userInfo?.phone && (
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Phone size={16} />
                                                {userInfo.phone}
                                            </div>
                                        )}
                                        {userInfo?.createdAt && (
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Calendar size={16} />
                                                Joined: {formatDate(userInfo.createdAt)}
                                            </div>
                                        )}
                                        {userInfo && (
                                            <Link href={`/users/${userInfo.id}`}>
                                                <Button variant="outline" className="w-full mt-3">
                                                    <ExternalLink className="h-4 w-4 mr-2" />
                                                    View User Profile
                                                </Button>
                                            </Link>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Review Metadata */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Review Metadata</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Review ID:</span>
                                    <span className="font-mono text-xs">{review.id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Product ID:</span>
                                    <span className="font-mono text-xs">{review.productId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">User ID:</span>
                                    <span className="font-mono text-xs">{review.userId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Created:</span>
                                    <span>{formatDateTime(review.createdAt)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Last Updated:</span>
                                    <span>{formatDateTime(review.updatedAt)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Helpful Count:</span>
                                    <span className="font-medium">{review.isHelpful || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">Images Count:</span>
                                    <span className="font-medium">{review.images?.length || 0}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Image Viewer Modal */}
            {imageViewer && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setImageViewer(null)}
                >
                    <div className="relative max-w-4xl max-h-full w-full">
                        <button
                            onClick={() => setImageViewer(null)}
                            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-black/50 rounded-full p-2"
                        >
                            <X size={24} />
                        </button>
                        <img
                            src={imageViewer.images[imageViewer.index]}
                            alt={`Review image ${imageViewer.index + 1}`}
                            className="max-w-full max-h-[90vh] object-contain mx-auto rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                        {imageViewer.images.length > 1 && (
                            <>
                                {imageViewer.index > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setImageViewer({ ...imageViewer, index: imageViewer.index - 1 });
                                        }}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full p-2 hover:bg-black/70"
                                    >
                                        ←
                                    </button>
                                )}
                                {imageViewer.index < imageViewer.images.length - 1 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setImageViewer({ ...imageViewer, index: imageViewer.index + 1 });
                                        }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full p-2 hover:bg-black/70"
                                    >
                                        →
                                    </button>
                                )}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                                    {imageViewer.index + 1} / {imageViewer.images.length}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Modal - Simple inline edit for now */}
            {isEditModalOpen && (
                <EditReviewModal
                    review={review}
                    onSave={handleEdit}
                    onClose={() => setIsEditModalOpen(false)}
                />
            )}
        </>
    );
}

// Edit Review Modal Component
function EditReviewModal({
    review,
    onSave,
    onClose,
}: {
    review: Review;
    onSave: (data: any) => void;
    onClose: () => void;
}) {
    const [rating, setRating] = useState(review.rating);
    const [title, setTitle] = useState(review.title || '');
    const [comment, setComment] = useState(review.comment || '');
    const [isApproved, setIsApproved] = useState(review.isApproved);
    const [isVerifiedPurchase, setIsVerifiedPurchase] = useState(review.isVerifiedPurchase);
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave({
                rating,
                title: title || undefined,
                comment: comment || undefined,
                isApproved,
                isVerifiedPurchase,
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <CardHeader>
                    <CardTitle>Edit Review</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Rating</label>
                            <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className="transition-transform hover:scale-110"
                                    >
                                        <Star
                                            size={32}
                                            className={
                                                star <= rating
                                                    ? 'fill-yellow-400 text-yellow-400'
                                                    : 'text-gray-300'
                                            }
                                        />
                                    </button>
                                ))}
                                <span className="ml-2 font-medium">{rating} / 5</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md"
                                maxLength={100}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Comment</label>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={6}
                                className="w-full px-3 py-2 border rounded-md resize-none"
                                maxLength={1000}
                            />
                            <div className="text-xs text-gray-500 mt-1 text-right">
                                {comment.length} / 1000
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isApproved}
                                    onChange={(e) => setIsApproved(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm font-medium">Approved</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isVerifiedPurchase}
                                    onChange={(e) => setIsVerifiedPurchase(e.target.checked)}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm font-medium">Verified Purchase</span>
                            </label>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

