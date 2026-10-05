/**
 * User Reviews Tab Component
 * Displays user's reviews
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { PageLoading } from '@/app/components/ui/loading';
import { getUserReviews, type PaginatedResponse } from '@/lib/api/users.service';
import { formatDate } from '@/lib/utils/format';
import { Star, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface UserReviewsProps {
    userId: string;
}

export function UserReviews({ userId }: UserReviewsProps) {
    const router = useRouter();
    const [reviews, setReviews] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        loadReviews();
    }, [userId, page]);

    const loadReviews = async () => {
        try {
            setIsLoading(true);
            const data = await getUserReviews(userId, { page, limit: 20 });
            setReviews(data.items);
            setTotalPages(data.pagination.totalPages);
        } catch (error) {
            console.error('Failed to load reviews:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderStars = (rating: number) => {
        return (
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                            }`}
                    />
                ))}
            </div>
        );
    };

    if (isLoading) {
        return <PageLoading />;
    }

    return (
        <div className="space-y-4">
            <Card className="overflow-hidden">
                <CardContent className="p-0">
                    <div className="border-b border-[var(--color-border)] px-5 py-4"><h2 className="text-sm font-semibold text-[var(--color-foreground)]">Review history</h2><p className="mt-1 text-xs text-[var(--color-foreground-secondary)]">Product feedback from this customer</p></div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Rating</TableHead>
                                <TableHead>Review</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reviews.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="py-12 text-center text-sm text-[var(--color-foreground-secondary)]">
                                        No reviews found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                reviews.map((review) => (
                                    <TableRow key={review.id}>
                                        <TableCell>
                                            {review.product ? (
                                                <button
                                                    onClick={() => router.push(`/products/${review.product.id}`)}
                                                    className="text-[var(--color-primary)] hover:underline"
                                                >
                                                    {review.product.name}
                                                </button>
                                            ) : (
                                                'N/A'
                                            )}
                                        </TableCell>
                                        <TableCell>{renderStars(review.rating)}</TableCell>
                                        <TableCell className="max-w-md">
                                            <div className="truncate">{review.comment || 'No comment'}</div>
                                        </TableCell>
                                        <TableCell>{formatDate(review.createdAt)}</TableCell>
                                        <TableCell>
                                            {review.isApproved ? (
                                                <Badge variant="default">Approved</Badge>
                                            ) : (
                                                <Badge variant="secondary">Pending</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {review.product && (
                                                <button
                                                    onClick={() => router.push(`/products/${review.product.id}`)}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-foreground-secondary)] hover:bg-[var(--color-accent)] hover:text-[var(--color-primary)]"
                                                    aria-label={`View product ${review.product.name}`}
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
