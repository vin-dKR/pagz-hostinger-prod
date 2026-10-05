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
import { Edit, Trash2, Search, X, Eye, Loader2, TicketPercent } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { toastError } from '@/lib/utils/toast';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { CouponStatusBadge } from '@/app/components/ui/coupon-status-badge';
import { CouponDiscountDisplay } from '@/app/components/ui/coupon-discount-display';
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
                <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)] p-5" aria-label="Loading coupons">
                    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-9 animate-pulse rounded-md bg-[var(--color-background-secondary)]" />)}
                    </div>
                    {Array.from({ length: 6 }).map((_, index) => <div key={index} className="mb-3 h-12 animate-pulse rounded-md bg-[var(--color-background-secondary)]" />)}
                </div>
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
            <Card className="overflow-hidden rounded-[10px] shadow-none hover:shadow-none">
                <CardContent className="p-0">
                    {/* Filters */}
                    <div className="admin-toolbar border-b border-[var(--color-border)] p-4 sm:px-5">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-semibold text-[var(--color-foreground)]">Coupon directory</h2>
                                <p className="mt-0.5 text-xs text-[var(--color-foreground-tertiary)]">Search and manage store offers</p>
                            </div>
                            <span className="rounded-md border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs font-medium tabular-nums text-[var(--color-foreground)]">{filteredCoupons.length} of {coupons.length} coupons</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(250px,1.7fr)_repeat(3,minmax(0,1fr))]">
                        <div className="relative sm:col-span-2 xl:col-span-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-foreground-tertiary)]" />
                            <Input
                                placeholder="Search code, name or description..."
                                value={filters.search}
                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                aria-label="Search coupons"
                                className="h-9 pl-9"
                            />
                        </div>
                        <Select
                            aria-label="Coupon status"
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
                            aria-label="Discount type"
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
                            aria-label="Applicability"
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
                    </div>

                    {/* Bulk Actions */}
                    {selectedIds.size > 0 && (
                        <div className="mx-4 my-3 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-primary)]/15 bg-[var(--color-primary)]/5 p-3 sm:mx-5">
                            <span className="text-xs font-semibold text-[var(--color-foreground)]">
                                {selectedIds.size} coupon(s) selected
                            </span>
                            <div className="ml-auto flex flex-wrap gap-2">
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
                                    <span className="sr-only">Clear selection</span>
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    {filteredCoupons.length === 0 ? (
                        <EmptyState
                            icon={TicketPercent}
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
                        <div className="overflow-x-auto [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
                            <div className="divide-y divide-[var(--color-border)] sm:hidden">
                                <div className="bg-[var(--color-background-secondary)] px-4 py-2.5">
                                    <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-foreground-secondary)]">
                                        <input type="checkbox" checked={filteredCoupons.length > 0 && selectedIds.size === filteredCoupons.length} onChange={toggleSelectAll} className="cursor-pointer rounded border-[var(--color-border)] accent-[var(--color-primary)]" />
                                        Select all visible coupons
                                    </label>
                                </div>
                                {filteredCoupons.map((coupon) => {
                                    const usageCount = (coupon as Coupon & { _count?: { usages: number } })?._count?.usages || 0;
                                    return (
                                        <article key={coupon.id} onMouseEnter={() => prefetchCoupon(coupon.id)} className="p-4" data-state={selectedIds.has(coupon.id) ? 'selected' : undefined}>
                                            <div className="flex items-start gap-3">
                                                <input type="checkbox" checked={selectedIds.has(coupon.id)} onChange={() => toggleSelect(coupon.id)} aria-label={'Select coupon ' + coupon.code} className="mt-0.5 cursor-pointer rounded border-[var(--color-border)] accent-[var(--color-primary)]" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate font-mono text-xs font-semibold tracking-[0.02em] text-[var(--color-foreground)]">{coupon.code}</p>
                                                    <p className="mt-1 truncate text-xs text-[var(--color-foreground-secondary)]">{coupon.name}</p>
                                                </div>
                                                <CouponStatusBadge isActive={coupon.isActive} validFrom={coupon.validFrom} validUntil={coupon.validUntil} showIcon size="sm" />
                                            </div>
                                            <div className="mt-3 flex flex-wrap items-center gap-2 pl-6 text-xs text-[var(--color-foreground-secondary)]">
                                                <CouponDiscountDisplay discountType={coupon.discountType} discountValue={Number(coupon.discountValue)} maxDiscountAmount={coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : null} size="sm" />
                                                {coupon.firstOrderOnly && <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">First order only</span>}
                                            </div>
                                            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-3 text-[11px] text-[var(--color-foreground-tertiary)]">
                                                <span>Valid until {formatDate(coupon.validUntil)}</span>
                                                <span>·</span>
                                                <span>{usageCount}{coupon.usageLimit ? ' / ' + coupon.usageLimit : ''} uses</span>
                                                <div className="ml-auto flex gap-0.5">
                                                    <Link href={`/coupons/${coupon.id}`}><Button variant="ghost" size="icon" className="h-8 w-8" title="View coupon details" aria-label={'View coupon ' + coupon.code}><Eye className="h-4 w-4" /></Button></Link>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingId(coupon.id); router.push(`/coupons/${coupon.id}/edit`); }} disabled={editingId === coupon.id} title="Edit coupon" aria-label={'Edit coupon ' + coupon.code}>{editingId === coupon.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit className="h-4 w-4" />}</Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--color-destructive)]" onClick={() => handleDelete(coupon.id)} disabled={deletingId === coupon.id || deleteCouponMutation.isPending} title="Delete coupon" aria-label={'Delete coupon ' + coupon.code}>{deletingId === coupon.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                            <div className="hidden sm:block">
                            <Table className="min-w-[1080px]">
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
                                                aria-label="Select all visible coupons"
                                                className="cursor-pointer rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                                            />
                                        </TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Discount</TableHead>
                                        <TableHead>Valid Until</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Flags</TableHead>
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
                                                data-state={selectedIds.has(coupon.id) ? 'selected' : undefined}
                                            >
                                                <TableCell>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.has(coupon.id)}
                                                        onChange={() => toggleSelect(coupon.id)}
                                                        aria-label={'Select coupon ' + coupon.code}
                                                        className="cursor-pointer rounded border-[var(--color-border)] accent-[var(--color-primary)]"
                                                    />
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap font-mono text-xs font-semibold tracking-[0.02em]">
                                                    <span className="inline-flex rounded-md border border-[var(--color-border)] bg-[#f4f4f4] px-2 py-1 text-[var(--color-foreground)]">{coupon.code}</span>
                                                </TableCell>
                                                <TableCell><span className="block max-w-[190px] truncate font-medium" title={coupon.name}>{coupon.name}</span></TableCell>
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
                                                <TableCell className="whitespace-nowrap text-xs text-[var(--color-foreground-secondary)]">{formatDate(coupon.validUntil)}</TableCell>
                                                <TableCell>
                                                    <span className="inline-flex">
                                                        <CouponStatusBadge
                                                            isActive={coupon.isActive}
                                                            validFrom={coupon.validFrom}
                                                            validUntil={coupon.validUntil}
                                                            showIcon
                                                            size="sm"
                                                        />
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {coupon.firstOrderOnly ? (
                                                        <span className="inline-flex items-center whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
                                                            First order only
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-[var(--color-foreground-tertiary)]">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {usageLimit ? (
                                                        <span className="whitespace-nowrap text-xs tabular-nums">
                                                            {usageCount}/{usageLimit}
                                                            {usagePercentage !== null && (
                                                                <span className="ml-1 text-[var(--color-foreground-tertiary)]">
                                                                    ({usagePercentage}%)
                                                                </span>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs tabular-nums">{usageCount}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-0.5">
                                                        <Link href={`/coupons/${coupon.id}`}>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 cursor-pointer"
                                                                title="View coupon details"
                                                                aria-label={'View coupon ' + coupon.code}
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
                                                            className="h-8 w-8 cursor-pointer"
                                                            title="Edit coupon"
                                                            aria-label={'Edit coupon ' + coupon.code}
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
                                                            className="h-8 w-8 cursor-pointer text-[var(--color-destructive)]"
                                                            title="Delete coupon"
                                                            aria-label={'Delete coupon ' + coupon.code}
                                                        >
                                                            {deletingId === coupon.id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="h-4 w-4" />
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
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
