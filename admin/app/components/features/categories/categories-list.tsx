/**
 * Categories List Component
 * Displays list of categories
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
import { PageLoading } from '@/app/components/ui/loading';
import { Alert } from '@/app/components/ui/alert';
import {
    getCategories,
    deleteCategory,
    type Category,
    type PaginatedCategories,
} from '@/lib/api/categories.service';
import { formatDate } from '@/lib/utils/format';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { Search, Grid3x3, List, Image as ImageIcon, Trash2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { toastPromise } from '@/lib/utils/toast';
import { getPublicFileUrl } from '@/lib/utils/fileUrl';

function normalizeImageSrc(src?: string | null): string {
    if (!src) return '/images/rows/row1.png';

    // Next.js Image requires src to be absolute or root-relative (starts with "/").
    if (src.startsWith('data:') || src.startsWith('blob:')) {
        return src;
    }

    if (src.startsWith('/')) return src;

    return getPublicFileUrl(src);
}

export function CategoriesList() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [searchInput, setSearchInput] = useState('');
    const debouncedSearch = useDebouncedValue(searchInput, 400);
    const [isLoading, setIsLoading] = useState(true);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
    const { confirm, ConfirmDialog } = useConfirm();

    useEffect(() => {
        if (window.matchMedia('(max-width: 639px)').matches) {
            setViewMode('grid');
        }
    }, []);

    useEffect(() => {
        loadCategories(page, debouncedSearch);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, debouncedSearch]);

    const loadCategories = async (pageParam = 1, searchParam = '') => {
        try {
            setIsLoading(true);
            setError(null);
            const data: PaginatedCategories = await getCategories({
                page: pageParam,
                limit: 20,
                search: searchParam || undefined,
            });
            setCategories(data.items);
            setTotalPages(data.pagination.totalPages);
            setTotal(data.pagination.total);
            setHasLoadedOnce(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load categories');
        } finally {
            setIsLoading(false);
        }
    };

    // Reset to first page when search changes and we already have data
    useEffect(() => {
        if (hasLoadedOnce) {
            setPage(1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    const handleDeleteCategory = async (category: Category) => {
        const productCount = category._count?.publishedPricingRules || 0;
        await confirm({
            title: 'Delete Category',
            description: `Are you sure you want to delete "${category.name}"? This will permanently delete the category and all ${productCount} product(s) associated with it. This action cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    await toastPromise(
                        deleteCategory(category.id),
                        {
                            loading: 'Deleting category and products...',
                            success: (data: { deletedProductsCount: number }) => `Category and ${data.deletedProductsCount} product(s) deleted successfully`,
                            error: 'Failed to delete category',
                        }
                    );
                    // Reload categories
                    await loadCategories(page, debouncedSearch);
                } catch {
                    // Error handled by toastPromise
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
                {/* Search + Pagination Header */}
                <div className="admin-toolbar flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="Search categories by name, slug, or description..."
                            className="pl-9"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-0.5 rounded-[8px] border border-[#dedede] bg-[#ededed] p-0.5 shadow-[inset_0_1px_2px_#00000006]">
                            <Button
                                variant={viewMode === 'table' ? 'outline' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('table')}
                                className="h-7 px-2"
                                aria-label="Table view"
                                title="Table view"
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'grid' ? 'outline' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('grid')}
                                className="h-7 px-2"
                                aria-label="Grid view"
                                title="Grid view"
                            >
                                <Grid3x3 className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-foreground-secondary)]">
                            <span>
                                {total.toLocaleString()} results • Page {page} of {Math.max(totalPages, 1)}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1 || isLoading}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="flex-shrink-0"
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages || isLoading}
                                onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))}
                                className="flex-shrink-0"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Inline error */}
                {error && (
                    <div className="px-4 pb-2 pt-3">
                        <Alert variant="error">
                            {error}
                            <Button
                                onClick={() => loadCategories(page, debouncedSearch)}
                                variant="outline"
                                size="sm"
                                className="ml-4"
                            >
                                Retry
                            </Button>
                        </Alert>
                    </div>
                )}

                {/* Table / empty state */}
                <div className="relative">
                    {isLoading && hasLoadedOnce && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-[1px] text-xs text-gray-100">
                            Updating results...
                        </div>
                    )}

                    {categories.length === 0 && !isLoading && !error ? (
                        <div className="px-4 pb-6 pt-4">
                            <Card>
                                <CardContent className="py-8 text-center">
                                    <p className="text-gray-600">
                                        No categories found. Try adjusting your search.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    ) : viewMode === 'table' ? (
                        <Table className="min-w-[800px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Catalog footprint</TableHead>
                                    <TableHead>Placement</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.map((category) => (
                                    <TableRow key={category.id}>
                                        <TableCell className="min-w-[260px]">
                                            <div className="flex items-center gap-3">
                                                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-[var(--color-border)] bg-[var(--color-background-tertiary)] ring-[3px] ring-[#f5f5f5]">
                                                    {category.primaryImage || category.images?.[0] ? (
                                                        <Image
                                                            src={normalizeImageSrc(category.primaryImage?.url || category.images?.[0]?.url || '')}
                                                            alt={category.primaryImage?.alt || category.name || ''}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        <ImageIcon className="h-5 w-5 text-[var(--color-foreground-tertiary)]" />
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <Link href={`/categories/${category.id}`} className="block truncate font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]">
                                                        {category.name}
                                                    </Link>
                                                    <span className="mt-0.5 block truncate font-mono text-[11px] text-[var(--color-foreground-tertiary)]">/{category.slug}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex w-fit items-center gap-4 rounded-lg border border-[#ededed] bg-[#fafafa] px-3 py-2 tabular-nums">
                                                <span className="flex flex-col"><strong className="text-sm font-semibold">{category._count?.publishedPricingRules || 0}</strong><span className="text-[10px] text-[var(--color-foreground-tertiary)]">Products</span></span>
                                                <span className="flex flex-col"><strong className="text-sm font-semibold">{category._count?.pricingRules || 0}</strong><span className="text-[10px] text-[var(--color-foreground-tertiary)]">Rules</span></span>
                                                <span className="flex flex-col"><strong className="text-sm font-semibold">{category._count?.specifications || 0}</strong><span className="text-[10px] text-[var(--color-foreground-tertiary)]">Specs</span></span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-background-tertiary)] px-2 py-1 font-mono text-[11px] text-[var(--color-foreground-secondary)]">#{category.priority ?? 0}</span>
                                                <span className="max-w-[120px] truncate text-xs text-[var(--color-foreground-secondary)]">{category.parent?.name || 'Top level'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap text-xs text-[var(--color-foreground-secondary)]">{formatDate(category.createdAt)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link href={`/categories/${category.id}`}>
                                                    <Button variant="outline" size="sm" className="h-8">
                                                        Manage
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteCategory(category)}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    aria-label={`Delete ${category.name}`}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 bg-[#f5f5f5] p-3 sm:grid-cols-2 2xl:grid-cols-3">
                            {categories.map((category) => (
                                <Card key={category.id} className="group relative overflow-hidden transition-[border-color,box-shadow] duration-200 hover:border-[#c9c9c9] hover:shadow-[var(--shadow-md)]">
                                    <CardContent className="p-4">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-background-tertiary)]">
                                                {category.primaryImage || category.images?.[0] ? (
                                                    <Image
                                                        src={normalizeImageSrc(category.primaryImage?.url || category.images?.[0]?.url || '')}
                                                        alt={category.primaryImage?.alt || category.name || ''}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <ImageIcon className="h-6 w-6 text-[var(--color-foreground-tertiary)]" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-foreground-tertiary)]">Catalog / #{category.priority ?? 0}</span>
                                                <Link href={`/categories/${category.id}`} className="mt-1 block truncate text-[15px] font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]">
                                                    {category.name}
                                                </Link>
                                                <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-foreground-tertiary)]">/{category.slug}</p>
                                            </div>
                                        </div>
                                        <p className="mt-3 truncate text-xs text-[var(--color-foreground-secondary)]">{category.parent ? `In ${category.parent.name}` : 'Top-level category'}</p>
                                        <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-[#e9e9e9] bg-[#f8f8f8] px-3 py-3 tabular-nums">
                                            <span className="flex flex-col"><strong className="text-[15px] font-semibold text-[var(--color-foreground)]">{category._count?.publishedPricingRules || 0}</strong><span className="text-[10px] text-[var(--color-foreground-tertiary)]">Products</span></span>
                                            <span className="flex flex-col"><strong className="text-[15px] font-semibold text-[var(--color-foreground)]">{category._count?.pricingRules || 0}</strong><span className="text-[10px] text-[var(--color-foreground-tertiary)]">Rules</span></span>
                                            <span className="flex flex-col"><strong className="text-[15px] font-semibold text-[var(--color-foreground)]">{category._count?.specifications || 0}</strong><span className="text-[10px] text-[var(--color-foreground-tertiary)]">Specs</span></span>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between gap-2">
                                            <span className="text-[11px] text-[var(--color-foreground-tertiary)]">Created {formatDate(category.createdAt)}</span>
                                            <div className="flex items-center gap-1">
                                            <Link href={`/categories/${category.id}`}>
                                                <Button variant="outline" size="sm" className="h-8">
                                                    Manage
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteCategory(category)}
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                aria-label={`Delete ${category.name}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
        </>
    );
}
