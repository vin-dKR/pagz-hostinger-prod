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
import { Spinner } from '@/app/components/ui/loading';
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
import { getPublicFileUrl } from '@/lib/utils/fileUrl';
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
    FolderTree,
} from 'lucide-react';
import { getCategories, type Category } from '@/lib/api/categories.service';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { toastError, toastPromise, toastSuccess } from '@/lib/utils/toast';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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
    const [categories, setCategories] = useState<Category[]>([]);
    const debouncedSearch = useDebouncedValue(searchInput, 400);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const { confirm, ConfirmDialog } = useConfirm();

    useEffect(() => {
        loadStatistics();
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const data = await getCategories({ page: 1, limit: 200 });
            setCategories(data.items);
        } catch (err) {
            console.error('Failed to load categories:', err);
        }
    };

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
        return (
            <div className="space-y-5" aria-label="Loading reviews">
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)]" />)}
                </div>
                <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                    <div className="mb-6 h-9 w-full max-w-md animate-pulse rounded-md bg-[var(--color-background-secondary)]" />
                    {Array.from({ length: 6 }).map((_, index) => <div key={index} className="mb-3 h-12 animate-pulse rounded-md bg-[var(--color-background-secondary)]" />)}
                </div>
            </div>
        );
    }

    return (
        <>
            {ConfirmDialog}
            <div className="space-y-5">
                {/* Statistics Dashboard */}
                {!isLoadingStats && statistics && (
                    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
                        <Card className="rounded-[10px] shadow-none hover:shadow-none">
                            <CardHeader className="p-4 pb-0"><CardTitle className="text-xs font-medium text-[var(--color-foreground-secondary)]">Total reviews</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-3">
                                <div className="text-[27px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{statistics.totalReviews}</div>
                                <p className="mt-2 text-xs text-[var(--color-foreground-tertiary)]">{statistics.approvedReviews} approved · {statistics.pendingReviews} pending</p>
                            </CardContent>
                        </Card>
                        <Card className="rounded-[10px] shadow-none hover:shadow-none">
                            <CardHeader className="p-4 pb-0"><CardTitle className="text-xs font-medium text-[var(--color-foreground-secondary)]">Average rating</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-3">
                                <div className="flex items-center gap-2 text-[27px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
                                    {statistics.avgRating.toFixed(1)} <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                                </div>
                                <p className="mt-2 text-xs text-[var(--color-foreground-tertiary)]">{statistics.approvalRate.toFixed(1)}% approval rate</p>
                            </CardContent>
                        </Card>
                        <Card className="rounded-[10px] shadow-none hover:shadow-none">
                            <CardHeader className="p-4 pb-0"><CardTitle className="text-xs font-medium text-[var(--color-foreground-secondary)]">Pending reviews</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-3">
                                <div className="text-[27px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{statistics.pendingReviews}</div>
                                <p className="mt-2 text-xs text-[var(--color-foreground-tertiary)]">Awaiting moderation</p>
                            </CardContent>
                        </Card>
                        <Card className="rounded-[10px] shadow-none hover:shadow-none">
                            <CardHeader className="p-4 pb-0"><CardTitle className="text-xs font-medium text-[var(--color-foreground-secondary)]">Verified purchases</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-3">
                                <div className="text-[27px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{statistics.verifiedPercentage.toFixed(0)}%</div>
                                <p className="mt-2 text-xs text-[var(--color-foreground-tertiary)]">Of approved reviews</p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Main Reviews Table */}
                <Card className="overflow-hidden rounded-[10px] shadow-none hover:shadow-none">
                    <CardContent className="p-0">
                        <div className="admin-toolbar border-b border-[var(--color-border)] p-4 sm:px-5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowFilters(!showFilters)}
                                        className="h-9 flex-shrink-0"
                                    >
                                        <Filter className="mr-2 h-4 w-4" />
                                        Filters
                                    </Button>
                                    <div className="relative min-w-0 flex-1 basis-full sm:basis-64">
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-foreground-tertiary)]" />
                                        <Input
                                            type="text"
                                            placeholder="Search reviews, products or users..."
                                            value={searchInput}
                                            onChange={(e) => setSearchInput(e.target.value)}
                                            className="h-9 pl-9"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="whitespace-nowrap text-xs tabular-nums text-[var(--color-foreground-tertiary)]">
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
                                <div className="mt-4 space-y-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-3 sm:p-4">
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-[var(--color-foreground-secondary)]">
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
                                                aria-label="Approval status"
                                                className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-xs text-[var(--color-foreground)]"
                                            >
                                                <option value="">All</option>
                                                <option value="true">Approved</option>
                                                <option value="false">Pending</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-[var(--color-foreground-secondary)]">
                                                Rating
                                            </label>
                                            <select
                                                value={filters.rating || ''}
                                                onChange={(e) =>
                                                    updateFilters({
                                                        rating: e.target.value ? parseInt(e.target.value) : undefined,
                                                    })
                                                }
                                                aria-label="Rating"
                                                className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-xs text-[var(--color-foreground)]"
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
                                            <label className="mb-1.5 block text-xs font-medium text-[var(--color-foreground-secondary)]">
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
                                                aria-label="Verified purchase"
                                                className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-xs text-[var(--color-foreground)]"
                                            >
                                                <option value="">All</option>
                                                <option value="true">Verified Only</option>
                                                <option value="false">Non-Verified Only</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="mb-1.5 block text-xs font-medium text-[var(--color-foreground-secondary)]">
                                                Category
                                            </label>
                                            <select
                                                value={filters.categoryId || ''}
                                                onChange={(e) =>
                                                    updateFilters({
                                                        categoryId: e.target.value || undefined,
                                                    })
                                                }
                                                aria-label="Category"
                                                className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-xs text-[var(--color-foreground)]"
                                            >
                                                <option value="">All Categories</option>
                                                {categories.map((category) => (
                                                    <option key={category.id} value={category.id}>
                                                        {category.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {(filters.isApproved !== undefined ||
                                        filters.rating ||
                                        filters.isVerifiedPurchase ||
                                        filters.categoryId) && (
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
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-primary)]/15 bg-[var(--color-primary)]/5 p-3">
                                    <span className="text-xs font-semibold text-[var(--color-foreground)]">
                                        {selectedReviews.size} review(s) selected
                                    </span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleBulkApprove}
                                            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                        >
                                            <Check className="h-4 w-4 mr-1" />
                                            Approve
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleBulkReject}
                                            className="border-amber-200 text-amber-700 hover:bg-amber-50"
                                        >
                                            <X className="h-4 w-4 mr-1" />
                                            Reject
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleBulkDelete}
                                            className="border-red-200 text-red-700 hover:bg-red-50"
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

                        <div className="relative [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
                            {isLoading && hasLoadedOnce && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-card)]/80 py-4 text-xs text-[var(--color-foreground-secondary)] backdrop-blur-[2px]">
                                    <Spinner size="md" />
                                    <span className="ml-2">Updating results...</span>
                                </div>
                            )}

                            {reviews.length === 0 && !isLoading && !error ? (
                                <div className="px-4 py-14 text-center">
                                    <Star className="mx-auto h-5 w-5 text-[var(--color-foreground-tertiary)]" aria-hidden="true" />
                                    <p className="mt-3 text-sm font-medium text-[var(--color-foreground)]">No reviews found</p>
                                    <p className="mt-1 text-xs text-[var(--color-foreground-tertiary)]">Try adjusting your search or filters.</p>
                                </div>
                            ) : (
                                <>
                                <div className="divide-y divide-[var(--color-border)] sm:hidden">
                                    <div className="bg-[var(--color-background-secondary)] px-4 py-2.5">
                                        <button onClick={toggleSelectAll} className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-foreground-secondary)]" aria-label="Select all reviews on this page">
                                            {selectedReviews.size === reviews.length && reviews.length > 0 ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                            Select all on this page
                                        </button>
                                    </div>
                                    {reviews.map((review) => (
                                        <article key={review.id} className="p-4" data-state={selectedReviews.has(review.id) ? 'selected' : undefined}>
                                            <div className="flex items-start gap-3">
                                                <button onClick={() => toggleSelectReview(review.id)} aria-label={'Select review ' + review.id} className="mt-0.5 shrink-0 text-[var(--color-foreground-secondary)]">
                                                    {selectedReviews.has(review.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                                </button>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-xs font-semibold text-[var(--color-foreground)]" title={review.product?.name || undefined}>{review.product?.name || review.category?.name || 'Review'}</p>
                                                    <p className="mt-1 truncate text-[11px] text-[var(--color-foreground-tertiary)]">{review.user?.name || 'Anonymous'}{review.user?.email ? ' · ' + review.user.email : ''}</p>
                                                </div>
                                                <Badge variant={review.isApproved ? 'success' : 'secondary'}>{review.isApproved ? 'Approved' : 'Pending'}</Badge>
                                            </div>
                                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-foreground-tertiary)]">
                                                <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-foreground)]"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{review.rating}</span>
                                                <span>·</span><span>{formatDate(review.createdAt)}</span>
                                                {review.isVerifiedPurchase && <Badge variant="success" className="px-1.5 text-[10px]">Verified purchase</Badge>}
                                            </div>
                                            {review.title && <p className="mt-3 text-xs font-semibold text-[var(--color-foreground)]">{review.title}</p>}
                                            <p className="mt-1 line-clamp-3 text-xs leading-5 text-[var(--color-foreground-secondary)]">{review.comment || '—'}</p>
                                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3">
                                                <span className="min-w-0 truncate text-[11px] text-[var(--color-foreground-tertiary)]">{review.category?.name || 'No category'}</span>
                                                {!!review.images?.length && <span className="text-[11px] text-[var(--color-foreground-tertiary)]">· {review.images.length} image{review.images.length === 1 ? '' : 's'}</span>}
                                                <div className="ml-auto flex items-center gap-0.5">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push(`/reviews/${review.id}`)} title="View details" aria-label={'View review ' + review.id}><Eye className="h-4 w-4" /></Button>
                                                    {!review.isApproved ? (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-700" onClick={() => handleApprove(review.id)} disabled={updatingId === review.id} title="Approve" aria-label={'Approve review ' + review.id}>{updatingId === review.id ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}</Button>
                                                    ) : (
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-700" onClick={() => handleReject(review.id)} disabled={updatingId === review.id} title="Reject" aria-label={'Reject review ' + review.id}>{updatingId === review.id ? <Spinner size="sm" /> : <X className="h-4 w-4" />}</Button>
                                                    )}
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--color-destructive)]" onClick={() => handleDelete(review.id)} disabled={updatingId === review.id} title="Delete" aria-label={'Delete review ' + review.id}>{updatingId === review.id ? <Spinner size="sm" /> : <Trash2 className="h-4 w-4" />}</Button>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                                <div className="hidden sm:block">
                                <Table className="min-w-[1260px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">
                                                <button
                                                    onClick={toggleSelectAll}
                                                    className="flex items-center justify-center text-[var(--color-foreground-secondary)]"
                                                    aria-label="Select all reviews on this page"
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
                                            <TableHead>Category</TableHead>
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
                                            <TableRow key={review.id} data-state={selectedReviews.has(review.id) ? 'selected' : undefined}>
                                                <TableCell>
                                                    <button
                                                        onClick={() => toggleSelectReview(review.id)}
                                                        className="flex items-center justify-center text-[var(--color-foreground-secondary)]"
                                                        aria-label={'Select review ' + review.id}
                                                    >
                                                        {selectedReviews.has(review.id) ? (
                                                            <CheckSquare className="h-4 w-4" />
                                                        ) : (
                                                            <Square className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    <div className="flex max-w-[180px] items-center gap-2">
                                                        <Package className="h-4 w-4 shrink-0 text-[var(--color-foreground-tertiary)]" />
                                                        <span className="truncate" title={review.product?.name || undefined}>{review.product?.name || '—'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    <div className="flex max-w-[145px] items-center gap-2">
                                                        <FolderTree className="h-4 w-4 shrink-0 text-[var(--color-foreground-tertiary)]" />
                                                        <span className="truncate" title={review.category?.name || undefined}>{review.category?.name ?? '—'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex max-w-[210px] items-center gap-2">
                                                        <User className="h-4 w-4 shrink-0 text-[var(--color-foreground-tertiary)]" />
                                                        <div className="min-w-0">
                                                            <div className="truncate font-medium" title={review.user?.name || undefined}>
                                                                {review.user?.name || 'Anonymous'}
                                                            </div>
                                                            <div className="truncate text-[11px] text-[var(--color-foreground-tertiary)]" title={review.user?.email || undefined}>
                                                                {review.user?.email}
                                                            </div>
                                                        </div>
                                                        {review.isVerifiedPurchase && (
                                                            <Badge variant="success" className="px-1.5 text-[10px]">
                                                                Verified
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 tabular-nums">
                                                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                                        <span className="font-semibold">{review.rating}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="max-w-[250px]">
                                                    {review.title && (
                                                        <div className="mb-0.5 truncate font-medium" title={review.title}>
                                                            {review.title}
                                                        </div>
                                                    )}
                                                    <div className="line-clamp-2 text-xs text-[var(--color-foreground-secondary)]">
                                                        {review.comment || '-'}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {review.images && review.images.length > 0 ? (
                                                        <div className="flex items-center gap-1">
                                                            <div className="relative h-9 w-9 overflow-hidden rounded-md border border-[var(--color-border)]">
                                                                <Image
                                                                    src={getPublicFileUrl(review.images[0] || '')}
                                                                    alt="Review attachment"
                                                                    width={36}
                                                                    height={36}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                            </div>
                                                            {review.images.length > 1 && (
                                                                <span className="text-xs text-[var(--color-foreground-tertiary)]">
                                                                    +{review.images.length - 1}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-[var(--color-foreground-tertiary)]">—</span>
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
                                                    <div className="whitespace-nowrap text-xs text-[var(--color-foreground-secondary)]">
                                                        {formatDate(review.createdAt)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-0.5">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => router.push(`/reviews/${review.id}`)}
                                                            title="View details"
                                                            aria-label={'View review ' + review.id}
                                                            className="h-8 w-8"
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
                                                                aria-label={'Approve review ' + review.id}
                                                                className="h-8 w-8"
                                                            >
                                                                {updatingId === review.id ? (
                                                                    <Spinner size="sm" />
                                                                ) : (
                                                                    <Check className="h-4 w-4 text-emerald-700" />
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
                                                                aria-label={'Reject review ' + review.id}
                                                                className="h-8 w-8"
                                                            >
                                                                {updatingId === review.id ? (
                                                                    <Spinner size="sm" />
                                                                ) : (
                                                                    <X className="h-4 w-4 text-amber-700" />
                                                                )}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete(review.id)}
                                                            disabled={updatingId === review.id}
                                                            title="Delete"
                                                            aria-label={'Delete review ' + review.id}
                                                            className="h-8 w-8"
                                                        >
                                                            {updatingId === review.id ? (
                                                                <Spinner size="sm" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                </div>
                                </>
                            )}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] p-4 sm:px-5">
                                <div className="whitespace-nowrap text-xs tabular-nums text-[var(--color-foreground-secondary)]">
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
