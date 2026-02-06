/**
 * Enhanced Reviews List Component
 * Displays comprehensive review management with statistics, filters, and bulk actions
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { Spinner, PageLoading } from '@/app/components/ui/loading';
import { Alert } from '@/app/components/ui/alert';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
    getReviews,
    approveReview,
    rejectReview,
    deleteReview,
    getReviewStatistics,
    bulkApproveReviews,
    bulkRejectReviews,
    bulkDeleteReviews,
    type Review,
    type PaginatedResponse,
    type ReviewQueryParams,
    type ReviewStatistics,
} from '@/lib/api/reviews.service';
import { formatDate } from '@/lib/utils/format';
import {
    Check,
    X,
    Trash2,
    Star,
    Search,
    Filter,
    CheckSquare,
    Square,
    Eye,
    User,
    Package,
} from 'lucide-react';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { toastError, toastPromise, toastSuccess } from '@/lib/utils/toast';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { useRouter } from 'next/navigation';

export function ReviewsListEnhanced() {
    const router = useRouter();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [statistics, setStatistics] = useState<ReviewStatistics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [searchInput, setSearchInput] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<ReviewQueryParams>({
        page: 1,
        limit: 20,
    });
    const debouncedSearch = useDebouncedValue(searchInput, 400);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const { confirm, ConfirmDialog } = useConfirm();

    useEffect(() => {
        loadStatistics();
    }, []);

    useEffect(() => {
        loadReviews();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, debouncedSearch, filters]);

    const loadStatistics = async () => {
        try {
            setIsLoadingStats(true);
            const stats = await getReviewStatistics();
            setStatistics(stats);
        } catch (err) {
            console.error('Failed to load statistics:', err);
        } finally {
            setIsLoadingStats(false);
        }
    };

    const loadReviews = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const params: ReviewQueryParams = {
                ...filters,
                page,
                limit: 20,
                search: debouncedSearch || undefined,
            };
            const data: PaginatedResponse<Review> = await getReviews(params);
            setReviews(data.items);
            setTotalPages(data.pagination.totalPages);
            setTotalItems(data.pagination.total);
            setHasLoadedOnce(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load reviews');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async (id: string) => {
        try {
            setUpdatingId(id);
            await toastPromise(approveReview(id), {
                loading: 'Approving review...',
                success: 'Review approved successfully',
                error: 'Failed to approve review',
            });
            await loadReviews();
            await loadStatistics();
        } catch (err) {
            // Error handled by toastPromise
        } finally {
            setUpdatingId(null);
        }
    };

    const handleReject = async (id: string) => {
        const reason = window.prompt('Please provide a reason for rejecting this review:');
        if (reason === null) {
            return; // User cancelled
        }
        if (!reason.trim()) {
            toastError('Please provide a rejection reason');
            return;
        }
        try {
            setUpdatingId(id);
            await toastPromise(rejectReview(id, reason.trim()), {
                loading: 'Rejecting review...',
                success: 'Review rejected successfully',
                error: 'Failed to reject review',
            });
            await loadReviews();
            await loadStatistics();
        } catch (err) {
            // Error handled by toastPromise
        } finally {
            setUpdatingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: 'Delete Review',
            description: 'Are you sure you want to delete this review? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    setUpdatingId(id);
                    await toastPromise(deleteReview(id), {
                        loading: 'Deleting review...',
                        success: 'Review deleted successfully',
                        error: 'Failed to delete review',
                    });
                    await loadReviews();
                    await loadStatistics();
                } catch (err) {
                    // Error handled by toastPromise
                    toastError(err instanceof Error ? err.message : 'Failed to delete review');
                } finally {
                    setUpdatingId(null);
                }
            },
        });
    };

    const toggleSelectReview = (id: string) => {
        setSelectedReviews((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedReviews.size === reviews.length) {
            setSelectedReviews(new Set());
        } else {
            setSelectedReviews(new Set(reviews.map((r) => r.id)));
        }
    };

    const handleBulkApprove = async () => {
        if (selectedReviews.size === 0) {
            toastError('Please select at least one review');
            return;
        }

        const confirmed = await confirm({
            title: 'Bulk Approve Reviews',
            description: `Are you sure you want to approve ${selectedReviews.size} review(s)?`,
            confirmText: 'Approve',
            cancelText: 'Cancel',
            onConfirm: async () => {
                try {
                    await toastPromise(bulkApproveReviews(Array.from(selectedReviews)), {
                        loading: `Approving ${selectedReviews.size} review(s)...`,
                        success: `Successfully approved ${selectedReviews.size} review(s)`,
                        error: 'Failed to approve reviews',
                    });
                    setSelectedReviews(new Set());
                    await loadReviews();
                    await loadStatistics();
                } catch (err) {
                    // Error handled by toastPromise
                }
            },
        });
    };

    const handleBulkReject = async () => {
        if (selectedReviews.size === 0) {
            toastError('Please select at least one review');
            return;
        }

        const reason = window.prompt(
            `Please provide a reason for rejecting ${selectedReviews.size} review(s):`
        );
        if (reason === null) {
            return; // User cancelled
        }
        if (!reason.trim()) {
            toastError('Please provide a rejection reason');
            return;
        }

        try {
            await toastPromise(bulkRejectReviews(Array.from(selectedReviews), reason.trim()), {
                loading: `Rejecting ${selectedReviews.size} review(s)...`,
                success: `Successfully rejected ${selectedReviews.size} review(s)`,
                error: 'Failed to reject reviews',
            });
            setSelectedReviews(new Set());
            await loadReviews();
            await loadStatistics();
        } catch (err) {
            // Error handled by toastPromise
        }
    };

    const handleBulkDelete = async () => {
        if (selectedReviews.size === 0) {
            toastError('Please select at least one review');
            return;
        }

        const confirmed = await confirm({
            title: 'Bulk Delete Reviews',
            description: `Are you sure you want to delete ${selectedReviews.size} review(s)? This action cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    await toastPromise(bulkDeleteReviews(Array.from(selectedReviews)), {
                        loading: `Deleting ${selectedReviews.size} review(s)...`,
                        success: `Successfully deleted ${selectedReviews.size} review(s)`,
                        error: 'Failed to delete reviews',
                    });
                    setSelectedReviews(new Set());
                    await loadReviews();
                    await loadStatistics();
                } catch (err) {
                    // Error handled by toastPromise
                }
            },
        });
    };

    const updateFilters = (newFilters: Partial<ReviewQueryParams>) => {
        setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
        setPage(1);
    };

    if (isLoading && !hasLoadedOnce) {
        return <PageLoading />;
    }

    return (
        <>
            {ConfirmDialog}
            <div className="space-y-6">
                {/* Statistics Dashboard */}
                {!isLoadingStats && statistics && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-gray-600">
                                    Total Reviews
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">{statistics.totalReviews}</div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {statistics.approvedReviews} approved, {statistics.pendingReviews} pending
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-gray-600">
                                    Average Rating
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-2">
                                    <div className="text-3xl font-bold">
                                        {statistics.avgRating.toFixed(1)}
                                    </div>
                                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Approval rate: {statistics.approvalRate.toFixed(1)}%
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-gray-600">
                                    Pending Reviews
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-orange-600">
                                    {statistics.pendingReviews}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Awaiting moderation</p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium text-gray-600">
                                    Verified Purchases
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold text-green-600">
                                    {statistics.verifiedPercentage.toFixed(0)}%
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Of approved reviews</p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Main Reviews Table */}
                <Card>
                    <CardContent className="p-0">
                        <div className="border-b bg-gray-50/50 p-4">
                            <div className="mb-3 flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowFilters(!showFilters)}
                                        className="h-10 flex-shrink-0"
                                    >
                                        <Filter className="h-4 w-4 mr-2" />
                                        Filters
                                    </Button>
                                    <div className="relative flex-1 min-w-[250px]">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                        <Input
                                            type="text"
                                            placeholder="Search reviews by title, comment, product, or user..."
                                            value={searchInput}
                                            onChange={(e) => setSearchInput(e.target.value)}
                                            className="pl-10 h-10"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">

                                    <div className="text-sm text-gray-600">
                                        {totalItems > 0 ? (
                                            <>
                                                <span className="font-medium">{totalItems}</span> result
                                                {totalItems !== 1 ? 's' : ''} • Page{' '}
                                                <span className="font-medium">{page}</span> of{' '}
                                                <span className="font-medium">{totalPages || 1}</span>
                                            </>
                                        ) : (
                                            'No results'
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Filters Panel */}
                            {showFilters && (
                                <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Approval Status
                                            </label>
                                            <select
                                                value={filters.isApproved !== undefined ? String(filters.isApproved) : ''}
                                                onChange={(e) =>
                                                    updateFilters({
                                                        isApproved:
                                                            e.target.value === ''
                                                                ? undefined
                                                                : e.target.value === 'true',
                                                    })
                                                }
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                            >
                                                <option value="">All</option>
                                                <option value="true">Approved</option>
                                                <option value="false">Pending</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Rating
                                            </label>
                                            <select
                                                value={filters.rating || ''}
                                                onChange={(e) =>
                                                    updateFilters({
                                                        rating: e.target.value ? parseInt(e.target.value) : undefined,
                                                    })
                                                }
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                            >
                                                <option value="">All Ratings</option>
                                                <option value="5">5 Stars</option>
                                                <option value="4">4 Stars</option>
                                                <option value="3">3 Stars</option>
                                                <option value="2">2 Stars</option>
                                                <option value="1">1 Star</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Verified Purchase
                                            </label>
                                            <select
                                                value={filters.isVerifiedPurchase !== undefined ? String(filters.isVerifiedPurchase) : ''}
                                                onChange={(e) =>
                                                    updateFilters({
                                                        isVerifiedPurchase:
                                                            e.target.value === ''
                                                                ? undefined
                                                                : e.target.value === 'true',
                                                    })
                                                }
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                            >
                                                <option value="">All</option>
                                                <option value="true">Verified Only</option>
                                                <option value="false">Non-Verified Only</option>
                                            </select>
                                        </div>
                                    </div>

                                    {(filters.isApproved !== undefined ||
                                        filters.rating ||
                                        filters.isVerifiedPurchase) && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setFilters({ page: 1, limit: 20 });
                                                    setPage(1);
                                                }}
                                            >
                                                Clear Filters
                                            </Button>
                                        )}
                                </div>
                            )}

                            {/* Bulk Actions */}
                            {selectedReviews.size > 0 && (
                                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                                    <span className="text-sm font-medium text-blue-900">
                                        {selectedReviews.size} review(s) selected
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleBulkApprove}
                                            className="text-green-700 border-green-300 hover:bg-green-50"
                                        >
                                            <Check className="h-4 w-4 mr-1" />
                                            Approve
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleBulkReject}
                                            className="text-orange-700 border-orange-300 hover:bg-orange-50"
                                        >
                                            <X className="h-4 w-4 mr-1" />
                                            Reject
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleBulkDelete}
                                            className="text-red-700 border-red-300 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4 mr-1" />
                                            Delete
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSelectedReviews(new Set())}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="px-4 pb-2 pt-4">
                                <Alert variant="error">
                                    {error}
                                    <Button
                                        onClick={loadReviews}
                                        variant="outline"
                                        size="sm"
                                        className="ml-4"
                                    >
                                        Retry
                                    </Button>
                                </Alert>
                            </div>
                        )}

                        <div className="relative">
                            {isLoading && hasLoadedOnce && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-sm py-4 text-xs text-gray-500">
                                    <Spinner size="md" />
                                    <span className="ml-2">Updating results...</span>
                                </div>
                            )}

                            {reviews.length === 0 && !isLoading && !error ? (
                                <div className="px-4 pb-6 pt-8">
                                    <Card>
                                        <CardContent className="py-8 text-center">
                                            <p className="text-gray-600">
                                                No reviews found. Try adjusting your search or filters.
                                            </p>
                                        </CardContent>
                                    </Card>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">
                                                <button
                                                    onClick={toggleSelectAll}
                                                    className="flex items-center justify-center"
                                                >
                                                    {selectedReviews.size === reviews.length &&
                                                        reviews.length > 0 ? (
                                                        <CheckSquare className="h-4 w-4" />
                                                    ) : (
                                                        <Square className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </TableHead>
                                            <TableHead>Product</TableHead>
                                            <TableHead>User</TableHead>
                                            <TableHead>Rating</TableHead>
                                            <TableHead>Title/Comment</TableHead>
                                            <TableHead>Images</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reviews.map((review) => (
                                            <TableRow key={review.id}>
                                                <TableCell>
                                                    <button
                                                        onClick={() => toggleSelectReview(review.id)}
                                                        className="flex items-center justify-center"
                                                    >
                                                        {selectedReviews.has(review.id) ? (
                                                            <CheckSquare className="h-4 w-4" />
                                                        ) : (
                                                            <Square className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <Package className="h-4 w-4 text-gray-400" />
                                                        {review.product?.name || 'N/A'}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4 text-gray-400" />
                                                        <div>
                                                            <div className="font-medium">
                                                                {review.user?.name || 'Anonymous'}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {review.user?.email}
                                                            </div>
                                                        </div>
                                                        {review.isVerifiedPurchase && (
                                                            <Badge variant="success" className="text-xs">
                                                                Verified
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                                        <span className="font-medium">{review.rating}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-md">
                                                    {review.title && (
                                                        <div className="font-medium mb-1 truncate">
                                                            {review.title}
                                                        </div>
                                                    )}
                                                    <div className="text-sm text-gray-600 line-clamp-2">
                                                        {review.comment || '-'}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {review.images && review.images.length > 0 ? (
                                                        <div className="flex items-center gap-1">
                                                            <div className="relative w-10 h-10 rounded border overflow-hidden">
                                                                <img
                                                                    src={review.images[0]}
                                                                    alt="Review"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                            {review.images.length > 1 && (
                                                                <span className="text-xs text-gray-500">
                                                                    +{review.images.length - 1}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 text-xs">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            review.isApproved ? 'success' : 'secondary'
                                                        }
                                                    >
                                                        {review.isApproved ? 'Approved' : 'Pending'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm">
                                                        {formatDate(review.createdAt)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => router.push(`/reviews/${review.id}`)}
                                                            title="View Details"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {!review.isApproved && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleApprove(review.id)}
                                                                disabled={updatingId === review.id}
                                                                title="Approve"
                                                            >
                                                                {updatingId === review.id ? (
                                                                    <Spinner size="sm" />
                                                                ) : (
                                                                    <Check className="h-4 w-4 text-green-600" />
                                                                )}
                                                            </Button>
                                                        )}
                                                        {review.isApproved && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleReject(review.id)}
                                                                disabled={updatingId === review.id}
                                                                title="Reject"
                                                            >
                                                                {updatingId === review.id ? (
                                                                    <Spinner size="sm" />
                                                                ) : (
                                                                    <X className="h-4 w-4 text-orange-600" />
                                                                )}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete(review.id)}
                                                            disabled={updatingId === review.id}
                                                            title="Delete"
                                                        >
                                                            {updatingId === review.id ? (
                                                                <Spinner size="sm" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="border-t p-4 flex items-center justify-between gap-4 flex-nowrap">
                                <div className="text-sm text-[var(--color-foreground-secondary)] whitespace-nowrap">
                                    Showing page {page} of {totalPages}
                                </div>
                                <div className="flex gap-2 flex-nowrap flex-shrink-0">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page === 1 || isLoading}
                                        className="flex-shrink-0"
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))}
                                        disabled={page >= totalPages || isLoading}
                                        className="flex-shrink-0"
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

