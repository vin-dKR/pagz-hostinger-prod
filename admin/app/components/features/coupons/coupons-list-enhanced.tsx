/**
 * Enhanced Coupons List Component
 * Displays table of coupons with filters, search, and bulk operations
 * Optimized with TanStack Query
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/app/components/ui/table';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { useCoupons, useDeleteCoupon, useBulkCouponOperation, usePrefetchCoupon } from '@/lib/hooks/use-coupons';
import type { Coupon } from '@/lib/api/coupons.service';
import { formatDate } from '@/lib/utils/format';
import { Edit, Trash2, Search, X, Eye, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { toastError } from '@/lib/utils/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { CouponStatusBadge } from '@/app/components/ui/coupon-status-badge';
import { CouponDiscountDisplay } from '@/app/components/ui/coupon-discount-display';
import { LoadingState } from '@/app/components/ui/loading-state';
import { ErrorState } from '@/app/components/ui/error-state';
import { EmptyState } from '@/app/components/ui/empty-state';

interface CouponListFilters {
    search: string;
    status: 'all' | 'active' | 'expired' | 'upcoming' | 'inactive';
    discountType: 'all' | 'PERCENTAGE' | 'FIXED';
    applicableTo: 'all' | 'ALL' | 'CATEGORY' | 'PRODUCT';
}

export function CouponsListEnhanced() {
    const router = useRouter();
    const { data: coupons = [], isLoading, error, refetch } = useCoupons();
    const deleteCouponMutation = useDeleteCoupon();
    const bulkOperationMutation = useBulkCouponOperation();
    const prefetchCoupon = usePrefetchCoupon();

    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState<CouponListFilters>({
        search: '',
        status: 'all',
        discountType: 'all',
        applicableTo: 'all',
    });
    const { confirm, ConfirmDialog } = useConfirm();
    const debouncedSearch = useDebouncedValue(filters.search, 300);

    const filteredCoupons = useMemo(() => {
        let filtered = [...coupons];

        // Search filter
        if (debouncedSearch) {
            const searchLower = debouncedSearch.toLowerCase();
            filtered = filtered.filter(
                (c) =>
                    c.code.toLowerCase().includes(searchLower) ||
                    c.name.toLowerCase().includes(searchLower) ||
                    (c.description && c.description.toLowerCase().includes(searchLower))
            );
        }

        // Status filter
        if (filters.status !== 'all') {
            const now = new Date();
            filtered = filtered.filter((c) => {
                const validFrom = new Date(c.validFrom);
                const validUntil = new Date(c.validUntil);
                switch (filters.status) {
                    case 'active':
                        return c.isActive && now >= validFrom && now <= validUntil;
                    case 'expired':
                        return now > validUntil;
                    case 'upcoming':
                        return now < validFrom;
                    case 'inactive':
                        return !c.isActive;
                    default:
                        return true;
                }
            });
        }

        // Discount type filter
        if (filters.discountType !== 'all') {
            filtered = filtered.filter((c) => c.discountType === filters.discountType);
        }

        // Applicable to filter
        if (filters.applicableTo !== 'all') {
            filtered = filtered.filter((c) => c.applicableTo === filters.applicableTo);
        }

        return filtered;
    }, [coupons, debouncedSearch, filters]);

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: 'Delete Coupon',
            description: 'Are you sure you want to delete this coupon? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    setDeletingId(id);
                    await deleteCouponMutation.mutateAsync(id);
                    setSelectedIds((prev) => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                    });
                } catch {
                    // Error handled by mutation
                } finally {
                    setDeletingId(null);
                }
            },
        });
    };

    const handleBulkOperation = async (operation: 'activate' | 'deactivate' | 'delete') => {
        if (selectedIds.size === 0) {
            toastError('Please select at least one coupon');
            return;
        }

        const operationText = operation === 'delete' ? 'delete' : `${operation}`;
        const confirmed = await confirm({
            title: `${operation.charAt(0).toUpperCase() + operation.slice(1)} ${selectedIds.size} Coupon(s)`,
            description: `Are you sure you want to ${operationText} ${selectedIds.size} coupon(s)?${operation === 'delete' ? ' This action cannot be undone.' : ''
                }`,
            confirmText: operation.charAt(0).toUpperCase() + operation.slice(1),
            cancelText: 'Cancel',
            variant: operation === 'delete' ? 'destructive' : 'default',
            onConfirm: async () => {
                try {
                    await bulkOperationMutation.mutateAsync({
                        ids: Array.from(selectedIds),
                        operation,
                    });
                    setSelectedIds(new Set());
                } catch {
                    // Error handled by mutation
                }
            },
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredCoupons.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredCoupons.map((c) => c.id)));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    if (isLoading) {
        return (
            <>
                {ConfirmDialog}
                <LoadingState message="Loading coupons..." />
            </>
        );
    }

    if (error) {
        return (
            <>
                {ConfirmDialog}
                <ErrorState
                    message={error instanceof Error ? error.message : 'Failed to load coupons'}
                    onRetry={() => refetch()}
                />
            </>
        );
    }

    return (
        <>
            {ConfirmDialog}
            <Card>
                <CardContent className="p-6 space-y-4">
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search coupons..."
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                className="pl-10"
                            />
                        </div>
                        <Select
                            value={filters.status}
                            onChange={(e) =>
                                setFilters({
                                    ...filters,
                                    status: e.target.value as CouponListFilters['status'],
                                })
                            }
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="expired">Expired</option>
                            <option value="upcoming">Upcoming</option>
                            <option value="inactive">Inactive</option>
                        </Select>
                        <Select
                            value={filters.discountType}
                            onChange={(e) =>
                                setFilters({
                                    ...filters,
                                    discountType: e.target.value as CouponListFilters['discountType'],
                                })
                            }
                        >
                            <option value="all">All Types</option>
                            <option value="PERCENTAGE">Percentage</option>
                            <option value="FIXED">Fixed</option>
                        </Select>
                        <Select
                            value={filters.applicableTo}
                            onChange={(e) =>
                                setFilters({
                                    ...filters,
                                    applicableTo: e.target.value as CouponListFilters['applicableTo'],
                                })
                            }
                        >
                            <option value="all">All Applicability</option>
                            <option value="ALL">All Products</option>
                            <option value="CATEGORY">Category</option>
                            <option value="PRODUCT">Product</option>
                        </Select>
                    </div>

                    {/* Bulk Actions */}
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg">
                            <span className="text-sm font-medium">
                                {selectedIds.size} coupon(s) selected
                            </span>
                            <div className="flex gap-2 ml-auto">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleBulkOperation('activate')}
                                    disabled={bulkOperationMutation.isPending}
                                >
                                    Activate
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleBulkOperation('deactivate')}
                                    disabled={bulkOperationMutation.isPending}
                                >
                                    Deactivate
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleBulkOperation('delete')}
                                    disabled={bulkOperationMutation.isPending}
                                >
                                    Delete
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSelectedIds(new Set())}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    {filteredCoupons.length === 0 ? (
                        <EmptyState
                            title={coupons.length === 0 ? 'No coupons found' : 'No coupons match your filters'}
                            description={
                                coupons.length === 0
                                    ? 'Get started by creating your first coupon'
                                    : 'Try adjusting your filters to see more results'
                            }
                            action={
                                coupons.length === 0
                                    ? {
                                        label: 'Create your first coupon',
                                        href: '/coupons/new',
                                    }
                                    : undefined
                            }
                        />
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    filteredCoupons.length > 0 &&
                                                    selectedIds.size === filteredCoupons.length
                                                }
                                                onChange={toggleSelectAll}
                                                className="rounded border-gray-300 cursor-pointer"
                                            />
                                        </TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Discount</TableHead>
                                        <TableHead>Valid Until</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Usage</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCoupons.map((coupon) => {
                                        const usageCount = (coupon as Coupon & { _count?: { usages: number } })?._count?.usages || 0;
                                        const usageLimit = coupon.usageLimit;
                                        const usagePercentage =
                                            usageLimit && usageLimit > 0
                                                ? Math.round((usageCount / usageLimit) * 100)
                                                : null;

                                        return (
                                            <TableRow
                                                key={coupon.id}
                                                onMouseEnter={() => prefetchCoupon(coupon.id)}
                                                className="hover:bg-gray-50"
                                            >
                                                <TableCell>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(coupon.id)}
                                                        onChange={() => toggleSelect(coupon.id)}
                                                        className="rounded border-gray-300 cursor-pointer"
                                                    />
                                                </TableCell>
                                                <TableCell className="font-mono font-medium">
                                                    {coupon.code}
                                                </TableCell>
                                                <TableCell>{coupon.name}</TableCell>
                                                <TableCell>
                                                    <CouponDiscountDisplay
                                                        discountType={coupon.discountType}
                                                        discountValue={Number(coupon.discountValue)}
                                                        maxDiscountAmount={
                                                            coupon.maxDiscountAmount
                                                                ? Number(coupon.maxDiscountAmount)
                                                                : null
                                                        }
                                                        size="sm"
                                                    />
                                                </TableCell>
                                                <TableCell>{formatDate(coupon.validUntil)}</TableCell>
                                                <TableCell>
                                                    <CouponStatusBadge
                                                        isActive={coupon.isActive}
                                                        validFrom={coupon.validFrom}
                                                        validUntil={coupon.validUntil}
                                                        showIcon
                                                        size="sm"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {usageLimit ? (
                                                        <span className="text-sm">
                                                            {usageCount}/{usageLimit}
                                                            {usagePercentage !== null && (
                                                                <span className="text-gray-500 ml-1">
                                                                    ({usagePercentage}%)
                                                                </span>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm">{usageCount}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Link href={`/coupons/${coupon.id}`}>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="cursor-pointer"
                                                                title="View coupon details"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => {
                                                                setEditingId(coupon.id);
                                                                router.push(`/coupons/${coupon.id}/edit`);
                                                            }}
                                                            disabled={editingId === coupon.id}
                                                            className="cursor-pointer"
                                                            title="Edit coupon"
                                                        >
                                                            {editingId === coupon.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Edit className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete(coupon.id)}
                                                            disabled={
                                                                deletingId === coupon.id ||
                                                                deleteCouponMutation.isPending
                                                            }
                                                            className="cursor-pointer"
                                                            title="Delete coupon"
                                                        >
                                                            {deletingId === coupon.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
