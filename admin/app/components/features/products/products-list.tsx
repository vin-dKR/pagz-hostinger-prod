/**
 * Products List Component
 * Displays table of products with actions
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
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Spinner, PageLoading } from '@/app/components/ui/loading';
import { Alert } from '@/app/components/ui/alert';
import {
    getProducts,
    deleteProduct,
    type Product,
    type ProductListResponse,
} from '@/lib/api/products.service';
import { getCategories, type Category, type PaginatedCategories } from '@/lib/api/categories.service';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Edit, Trash2, Eye } from 'lucide-react';
import Link from 'next/link';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { toastError, toastSuccess, toastLoading, toastDismiss } from '@/lib/utils/toast';

export function ProductsList() {
    const [products, setProducts] = useState<Product[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [searchInput, setSearchInput] = useState('');
    const debouncedSearch = useDebouncedValue(searchInput, 400);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);
    const [isActiveFilter, setIsActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [flagFilter, setFlagFilter] = useState<'all' | 'featured' | 'new' | 'bestseller'>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const { confirm, ConfirmDialog } = useConfirm();

    useEffect(() => {
        loadProducts(page, debouncedSearch);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, debouncedSearch, selectedCategoryId, isActiveFilter, flagFilter]);

    useEffect(() => {
        // Load categories for filter dropdown
        const loadCategories = async () => {
            try {
                setError(null);
                setIsLoading(true);
                const data: PaginatedCategories = await getCategories({
                    page: 1,
                    limit: 200,
                });
                setCategories(data.items);
            } catch {
                // Non-critical; silently fall back to no categories
                setCategories([]);
                setError('Failed to load categories for product filters');
            } finally {
                setIsLoading(false);
            }
        };

        loadCategories();
    }, []);

    const loadProducts = async (pageParam = 1, searchParam = '') => {
        try {
            setIsLoading(true);
            setError(null);
            const data: ProductListResponse = await getProducts({
                page: pageParam,
                limit: 20,
                search: searchParam || undefined,
                category: selectedCategoryId,
                isActive: isActiveFilter === 'all' ? undefined : isActiveFilter === 'active',
                isFeatured: flagFilter === 'featured' ? true : undefined,
                isNewArrival: flagFilter === 'new' ? true : undefined,
                isBestSeller: flagFilter === 'bestseller' ? true : undefined,
            });
            setProducts(data.products);
            setTotalPages(data.pagination.totalPages);
            setTotalItems(data.pagination.total);
            setHasLoadedOnce(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load products');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: 'Delete Product',
            description: 'Are you sure you want to delete this product? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    setDeletingId(id);
                    const toastId = toastLoading('Deleting product...');
                    await deleteProduct(id);
                    toastDismiss(toastId);
                    toastSuccess('Product deleted successfully');
                    setProducts(products.filter((p) => p.id !== id));
                } catch (err) {
                    toastError(err instanceof Error ? err.message : 'Failed to delete product');
                } finally {
                    setDeletingId(null);
                }
            },
        });
    };

    if (!hasLoadedOnce && isLoading) {
        return <PageLoading />;
    }

    return (
        <>
            {ConfirmDialog}
            <Card>
                <CardContent className="p-0">
                    {/* Header: search + filters + pagination */}
                    <div className="flex flex-row items-center gap-3 px-4 py-3 border-b bg-gray-50/80">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-3 flex-1 min-w-0">
                            <input
                                className="w-full lg:max-w-md rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                                placeholder="Search by name, slug, or SKU..."
                                value={searchInput}
                                onChange={(e) => {
                                    setPage(1);
                                    setSearchInput(e.target.value);
                                }}
                            />
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">Category</span>
                                    <select
                                        className="rounded-md border px-2 py-1 text-xs bg-white"
                                        value={selectedCategoryId || ''}
                                        onChange={(e) => {
                                            setPage(1);
                                            setSelectedCategoryId(e.target.value || undefined);
                                        }}
                                    >
                                        <option value="">All</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="font-medium">Status</span>
                                    <select
                                        className="rounded-md border px-2 py-1 text-xs bg-white"
                                        value={isActiveFilter}
                                        onChange={(e) => {
                                            setPage(1);
                                            setIsActiveFilter(e.target.value as typeof isActiveFilter);
                                        }}
                                    >
                                        <option value="all">All</option>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="font-medium">Merchandising</span>
                                    <select
                                        className="rounded-md border px-2 py-1 text-xs bg-white"
                                        value={flagFilter}
                                        onChange={(e) => {
                                            setPage(1);
                                            setFlagFilter(e.target.value as typeof flagFilter);
                                        }}
                                    >
                                        <option value="all">All</option>
                                        <option value="featured">Featured</option>
                                        <option value="new">New arrival</option>
                                        <option value="bestseller">Best seller</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 flex-nowrap text-xs text-[var(--color-foreground-secondary)] flex-shrink-0">
                            <span className="whitespace-nowrap">
                                {totalItems.toLocaleString()} results • Page {page} of{' '}
                                {Math.max(totalPages, 1)}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page <= 1 || isLoading}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= totalPages || isLoading}
                                    onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Inline error */}
                    {error && (
                        <div className="px-4 pb-2">
                            <Alert variant="error">
                                {error}
                                <Button
                                    onClick={() => loadProducts(page, debouncedSearch)}
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
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-[1px] text-xs text-gray-100 transition-opacity">
                                Updating results...
                            </div>
                        )}

                        {products.length === 0 && !isLoading && !error ? (
                            <div className="px-4 pb-6">
                                <Card>
                                    <CardContent className="py-8 text-center">
                                        <p className="text-gray-600">
                                            No products found. Try adjusting your search or filters.
                                        </p>
                                        <Link href="/products/new">
                                            <Button className="mt-4">Create your first product</Button>
                                        </Link>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px]">Product</TableHead>
                                        <TableHead>Details</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Pricing</TableHead>
                                        <TableHead>Stock</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Updated</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.map((product) => (
                                        <TableRow key={product.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    {product.images && product.images.length > 0 ? (
                                                        <img
                                                            src={
                                                                product.images.find((img) => img.isPrimary)?.url ||
                                                                product.images[0]?.url
                                                            }
                                                            alt={product.name}
                                                            className="h-12 w-12 rounded-md object-cover border"
                                                        />
                                                    ) : (
                                                        <div className="h-12 w-12 rounded-md bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 border">
                                                            No image
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <div className="flex flex-col gap-1">
                                                    <div className="font-medium text-sm line-clamp-1">
                                                        {product.name}
                                                    </div>
                                                    <div className="text-xs text-gray-500 font-mono">
                                                        {product.slug || '—'}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        SKU: {product.sku || '—'}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">
                                                    {product.category?.name || 'Unassigned'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-semibold text-gray-900">
                                                        {formatCurrency(product.sellingPrice || product.basePrice)}
                                                    </span>
                                                    {product.mrp && (
                                                        <span className="text-xs text-gray-400 line-through">
                                                            {formatCurrency(product.mrp)}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-gray-500">
                                                        Base: {formatCurrency(product.basePrice)}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <div className="flex flex-col gap-1 text-xs">
                                                    <span>Stock: {product.stock}</span>
                                                    <span>
                                                        MOQ: {product.minOrderQuantity} • Max:{' '}
                                                        {product.maxOrderQuantity ?? '—'}
                                                    </span>
                                                    <span>Variants: {product.variants.length}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top">
                                                <div className="flex flex-wrap gap-1">
                                                    <Badge variant={product.isActive ? 'success' : 'outline'}>
                                                        {product.isActive ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                    {product.isFeatured && (
                                                        <Badge variant="outline">Featured</Badge>
                                                    )}
                                                    {product.isNewArrival && (
                                                        <Badge variant="outline">New</Badge>
                                                    )}
                                                    {product.isBestSeller && (
                                                        <Badge variant="outline">Best seller</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top text-xs">
                                                <div className="flex flex-col">
                                                    <span>Created: {formatDate(product.createdAt)}</span>
                                                    <span>Updated: {formatDate(product.updatedAt)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link href={`/products/${product.id}`}>
                                                        <Button variant="ghost" size="icon">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <Link href={`/products/${product.id}/edit`}>
                                                        <Button variant="ghost" size="icon">
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(product.id)}
                                                        disabled={deletingId === product.id}
                                                    >
                                                        {deletingId === product.id ? (
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

