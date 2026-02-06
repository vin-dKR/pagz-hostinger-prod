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
    type Category,
    type PaginatedCategories,
} from '@/lib/api/categories.service';
import { formatDate } from '@/lib/utils/format';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { Search, Grid3x3, List, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

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

    if (isLoading && !hasLoadedOnce) {
        return <PageLoading />;
    }

    return (
        <Card>
            <CardContent className="p-0">
                {/* Search + Pagination Header */}
                <div className="flex flex-col gap-3 border-b bg-gray-50/60 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="Search categories by name, slug, or description..."
                            className="pl-9"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 rounded-md border border-gray-300 p-1">
                            <Button
                                variant={viewMode === 'table' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('table')}
                                className="h-7 px-2"
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('grid')}
                                className="h-7 px-2"
                            >
                                <Grid3x3 className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-2 flex-nowrap text-xs text-[var(--color-foreground-secondary)]">
                            <span className="whitespace-nowrap">
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
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Image</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Slug</TableHead>
                                    <TableHead>Parent</TableHead>
                                    <TableHead>Stats</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.map((category) => (
                                    <TableRow key={category.id}>
                                        <TableCell>
                                            {category.primaryImage || category.images?.[0] ? (
                                                <div className="relative h-12 w-12 overflow-hidden rounded-md border border-gray-200">
                                                    <Image
                                                        src={category.primaryImage?.url || category.images?.[0]?.url || ''}
                                                        alt={category.primaryImage?.alt || category.name || ''}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="flex h-12 w-12 items-center justify-center rounded-md border border-gray-200 bg-gray-100">
                                                    <ImageIcon className="h-5 w-5 text-gray-400" />
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <Link
                                                href={`/categories/${category.id}`}
                                                className="text-blue-600 hover:underline"
                                            >
                                                {category.name}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">{category.slug}</TableCell>
                                        <TableCell>{category.parent?.name || '-'}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1 text-xs text-gray-600">
                                                <span>{category._count?.specifications || 0} specs</span>
                                                <span>{category._count?.pricingRules || 0} rules</span>
                                                <span className="font-medium text-blue-600">
                                                    {category._count?.publishedPricingRules || 0} products
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{formatDate(category.createdAt)}</TableCell>
                                        <TableCell className="text-right">
                                            <Link href={`/categories/${category.id}`}>
                                                <Button variant="outline" size="sm">
                                                    Manage
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
                            {categories.map((category) => (
                                <Card key={category.id} className="overflow-hidden">
                                    <div className="relative h-48 w-full bg-gray-100">
                                        {category.primaryImage || category.images?.[0] ? (
                                            <Image
                                                src={category.primaryImage?.url || category.images?.[0]?.url || ''}
                                                alt={category.primaryImage?.alt || category.name || ''}
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full items-center justify-center">
                                                <ImageIcon className="h-12 w-12 text-gray-400" />
                                            </div>
                                        )}
                                    </div>
                                    <CardContent className="p-4">
                                        <Link
                                            href={`/categories/${category.id}`}
                                            className="block"
                                        >
                                            <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600">
                                                {category.name}
                                            </h3>
                                        </Link>
                                        <p className="mt-1 text-xs font-mono text-gray-500">{category.slug}</p>
                                        {category.parent && (
                                            <p className="mt-1 text-xs text-gray-600">
                                                Parent: {category.parent.name}
                                            </p>
                                        )}
                                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                            <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">
                                                {category._count?.specifications || 0} Specs
                                            </span>
                                            <span className="rounded bg-green-50 px-2 py-1 text-green-700">
                                                {category._count?.pricingRules || 0} Rules
                                            </span>
                                            <span className="rounded bg-purple-50 px-2 py-1 text-purple-700">
                                                {category._count?.publishedPricingRules || 0} Products
                                            </span>
                                        </div>
                                        <div className="mt-3 flex justify-end">
                                            <Link href={`/categories/${category.id}`}>
                                                <Button variant="outline" size="sm">
                                                    Manage
                                                </Button>
                                            </Link>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

