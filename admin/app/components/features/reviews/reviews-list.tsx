/**
 * Reviews List Component
 * Displays table of reviews with moderation actions
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
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
    updateReview,
    deleteReview,
    type Review,
    type PaginatedResponse,
} from '@/lib/api/reviews.service';
import { formatDate } from '@/lib/utils/format';
import { Check, X, Trash2, Star, Search } from 'lucide-react';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { toastError, toastPromise } from '@/lib/utils/toast';
import { useConfirm } from '@/lib/hooks/use-confirm';

export function ReviewsList() {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [searchInput, setSearchInput] = useState('');
    const debouncedSearch = useDebouncedValue(searchInput, 400);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const { confirm, ConfirmDialog } = useConfirm();

    useEffect(() => {
        loadReviews(page, debouncedSearch);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, debouncedSearch]);

    const loadReviews = async (pageParam = 1, searchParam = '') => {
        try {
            setIsLoading(true);
            setError(null);
            const data: PaginatedResponse<Review> = await getReviews({
                page: pageParam,
                limit: 20,
                search: searchParam || undefined,
            });
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
            await toastPromise(
                updateReview(id, { isApproved: true }),
                {
                    loading: 'Approving review...',
                    success: 'Review approved successfully',
                    error: 'Failed to approve review',
                }
            );
            // Reload reviews to reflect changes
            loadReviews(page, debouncedSearch);
        } catch (err) {
            // Error handled by toastPromise
        } finally {
            setUpdatingId(null);
        }
    };

    const handleReject = async (id: string) => {
        try {
            setUpdatingId(id);
            await toastPromise(
                updateReview(id, { isApproved: false }),
                {
                    loading: 'Rejecting review...',
                    success: 'Review rejected successfully',
                    error: 'Failed to reject review',
                }
            );
            // Reload reviews to reflect changes
            loadReviews(page, debouncedSearch);
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
                    await toastPromise(
                        deleteReview(id),
                        {
                            loading: 'Deleting review...',
                            success: 'Review deleted successfully',
                            error: 'Failed to delete review',
                        }
                    );
                    // Reload reviews to reflect deletion and potentially adjust pagination
                    loadReviews(page, debouncedSearch);
                } catch (err) {
                    // Error handled by toastPromise
                    toastError(err instanceof Error ? err.message : 'Failed to delete review');
                } finally {
                    setUpdatingId(null);
                }
            },
        });
    };

    if (isLoading && !hasLoadedOnce) {
        return <PageLoading />;
    }

    return (
        <>
            {ConfirmDialog}
            <Card>
                <CardContent className="p-0">
                    <div className="border-b bg-gray-50/50 p-4">
                        <div className="mb-3 flex items-center justify-between gap-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                    type="text"
                                    placeholder="Search orders by ID, customer email or name..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            <div className="flex items-center gap-2 flex-nowrap">
                                <div className="text-sm text-[var(--color-foreground-secondary)] whitespace-nowrap">
                                    {totalItems > 0 ? (
                                        <>
                                            <span className="font-medium">{totalItems}</span> result{totalItems !== 1 ? 's' : ''} • Page{' '}
                                            <span className="font-medium">{page}</span> of{' '}
                                            <span className="font-medium">{totalPages || 1}</span>
                                        </>
                                    ) : (
                                        'No results'
                                    )}
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
                        </div>

                    </div>

                    {error && (
                        <div className="px-4 pb-2">
                            <Alert variant="error">
                                {error}
                                <Button
                                    onClick={() => loadReviews(page, debouncedSearch)}
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
                            <div className="px-4 pb-6">
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
                                        <TableHead>Product</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Rating</TableHead>
                                        <TableHead>Comment</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reviews.map((review) => (
                                        <TableRow key={review.id}>
                                            <TableCell className="font-medium">
                                                {review.product?.name || 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                {review.user?.name || review.user?.email || 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                                    <span>{review.rating}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="max-w-md truncate">
                                                {review.comment || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={review.isApproved ? 'success' : 'secondary'}>
                                                    {review.isApproved ? 'Approved' : 'Pending'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{formatDate(review.createdAt)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {!review.isApproved && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleApprove(review.id)}
                                                            disabled={updatingId === review.id}
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


                </CardContent>
            </Card>
        </>
    );
}

