'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Spinner, PageLoading } from '@/app/components/ui/loading';
import { Alert } from '@/app/components/ui/alert';
import { getProducts, deleteProduct, type Product, type ProductListResponse } from '@/lib/api/products.service';
import { getCategories, type Category, type PaginatedCategories } from '@/lib/api/categories.service';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { getPublicFileUrl } from '@/lib/utils/fileUrl';
import { ChevronLeft, ChevronRight, Edit3, Eye, ImageIcon, PackageSearch, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { toastError, toastSuccess, toastLoading, toastDismiss } from '@/lib/utils/toast';

const filterClass = 'h-9 w-full appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-foreground)] shadow-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 sm:w-auto sm:min-w-32';

function ProductImage({ product, size = 'md' }: { product: Product; size?: 'md' | 'lg' }) {
    const image = product.images?.find((item) => item.isPrimary)?.url || product.images?.[0]?.url;
    return (
        <div className={`${size === 'lg' ? 'h-14 w-14' : 'h-11 w-11'} flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)]`}>
            {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getPublicFileUrl(image)} alt={product.name} className="h-full w-full object-cover" />
            ) : <ImageIcon className="h-4 w-4 text-[var(--color-foreground-tertiary)]" aria-hidden="true" />}
        </div>
    );
}

function ProductStatus({ product }: { product: Product }) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={product.isActive ? 'success' : 'outline'}>{product.isActive ? 'Active' : 'Inactive'}</Badge>
            {product.isFeatured && <Badge variant="outline">Featured</Badge>}
            {product.isNewArrival && <Badge variant="outline">New</Badge>}
            {product.isBestSeller && <Badge variant="outline">Best seller</Badge>}
        </div>
    );
}

function ProductActions({ product, deleting, onDelete }: { product: Product; deleting: boolean; onDelete: (id: string) => void }) {
    return (
        <div className="flex items-center justify-end gap-0.5">
            <Link href={`/products/${product.id}`} aria-label={`View ${product.name}`} title="View product"><Button variant="ghost" size="icon" className="h-8 w-8 border border-[var(--color-border)] bg-white"><Eye className="h-4 w-4" /></Button></Link>
            <Link href={`/products/${product.id}/edit`} aria-label={`Edit ${product.name}`} title="Edit product"><Button variant="ghost" size="icon" className="h-8 w-8 border border-[var(--color-border)] bg-white"><Edit3 className="h-4 w-4" /></Button></Link>
            <Button variant="ghost" size="icon" className="h-8 w-8 border border-[var(--color-border)] bg-white text-[var(--color-destructive)]" aria-label={`Delete ${product.name}`} title="Delete product" onClick={() => onDelete(product.id)} disabled={deleting}>{deleting ? <Spinner size="sm" /> : <Trash2 className="h-4 w-4" />}</Button>
        </div>
    );
}

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
        const loadCategories = async () => {
            try {
                setError(null);
                setIsLoading(true);
                const data: PaginatedCategories = await getCategories({ page: 1, limit: 200 });
                setCategories(data.items);
            } catch {
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
                page: pageParam, limit: 20, search: searchParam || undefined,
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
        await confirm({
            title: 'Delete Product',
            description: 'Are you sure you want to delete this product? This action cannot be undone.',
            confirmText: 'Delete', cancelText: 'Cancel', variant: 'destructive',
            onConfirm: async () => {
                try {
                    setDeletingId(id);
                    const toastId = toastLoading('Deleting product...');
                    await deleteProduct(id);
                    toastDismiss(toastId);
                    toastSuccess('Product deleted successfully');
                    setProducts(products.filter((product) => product.id !== id));
                } catch (err) {
                    toastError(err instanceof Error ? err.message : 'Failed to delete product');
                } finally {
                    setDeletingId(null);
                }
            },
        });
    };

    if (!hasLoadedOnce && isLoading) return <PageLoading />;

    const firstItem = products.length > 0 ? (page - 1) * 20 + 1 : 0;
    const lastItem = products.length > 0 ? firstItem + products.length - 1 : 0;

    return (
        <div className="space-y-4">
            {ConfirmDialog}
            <div className="admin-panel">
                <div className="admin-panel-interior">
                <div className="admin-toolbar flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:px-5 sm:py-4 xl:flex-row xl:items-end">
                    <div className="relative w-full xl:min-w-56 xl:max-w-sm xl:flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-foreground-tertiary)]" aria-hidden="true" />
                        <input type="search" aria-label="Search products" className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] pl-10 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-foreground-tertiary)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" placeholder="Search products by name, slug, or SKU" value={searchInput} onChange={(event) => { setPage(1); setSearchInput(event.target.value); }} />
                    </div>
                    <span className="order-2 inline-flex shrink-0 items-center gap-2 self-start rounded-md border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-medium tabular-nums text-[var(--color-foreground)] xl:order-3 xl:mb-1 xl:ml-auto"><span className="h-1.5 w-1.5 rounded-full bg-[var(--color-foreground-secondary)]" />{totalItems.toLocaleString()} products</span>
                    <div className="order-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:order-2 xl:flex xl:shrink-0 xl:items-end xl:gap-3">
                        <label className="col-span-2 flex min-w-0 flex-col gap-1.5 text-xs font-medium text-[var(--color-foreground-secondary)] sm:col-span-1">Category
                            <select className={filterClass} value={selectedCategoryId || ''} onChange={(event) => { setPage(1); setSelectedCategoryId(event.target.value || undefined); }}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
                        </label>
                        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-[var(--color-foreground-secondary)]">Status
                            <select className={filterClass} value={isActiveFilter} onChange={(event) => { setPage(1); setIsActiveFilter(event.target.value as typeof isActiveFilter); }}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
                        </label>
                        <label className="flex min-w-0 flex-col gap-1.5 text-xs font-medium text-[var(--color-foreground-secondary)]">Merchandising
                            <select className={filterClass} value={flagFilter} onChange={(event) => { setPage(1); setFlagFilter(event.target.value as typeof flagFilter); }}><option value="all">All products</option><option value="featured">Featured</option><option value="new">New arrival</option><option value="bestseller">Best seller</option></select>
                        </label>
                    </div>
                </div>

                {error && <div className="p-4"><Alert variant="error">{error}<Button onClick={() => loadProducts(page, debouncedSearch)} variant="outline" size="sm" className="ml-3">Retry</Button></Alert></div>}

                <div className="relative">
                    {isLoading && hasLoadedOnce && <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-card)]/75 text-sm font-medium text-[var(--color-foreground-secondary)] backdrop-blur-[1px]">Updating results…</div>}
                    {products.length === 0 && !isLoading && !error ? (
                        <div className="flex flex-col items-center px-6 py-16 text-center">
                            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-background-secondary)] text-[var(--color-foreground-secondary)]"><PackageSearch className="h-6 w-6" /></span>
                            <h2 className="text-base font-semibold text-[var(--color-foreground)]">No products found</h2>
                            <p className="mt-1 max-w-sm text-sm text-[var(--color-foreground-secondary)]">Try another search or adjust the filters to find a product.</p>
                            <Link href="/products/new" className="mt-5"><Button size="sm">Create your first product</Button></Link>
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:hidden">
                                {products.map((product) => (
                                    <article key={product.id} className="flex min-w-0 flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:bg-[var(--color-background-secondary)]">
                                        <div className="flex min-w-0 items-start gap-3"><ProductImage product={product} size="lg" /><div className="min-w-0 flex-1"><Link href={`/products/${product.id}`} className="line-clamp-2 text-sm font-semibold leading-5 text-[var(--color-foreground)] hover:text-[var(--color-primary)]">{product.name}</Link><p className="mt-1 truncate font-mono text-[11px] text-[var(--color-foreground-tertiary)]">{product.slug || '—'}</p><p className="mt-0.5 text-[11px] text-[var(--color-foreground-tertiary)]">SKU {product.sku || '—'}</p></div></div>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                                            <div><p className="text-[var(--color-foreground-tertiary)]">Category</p><p className="mt-1 font-medium text-[var(--color-foreground)]">{product.category?.name || 'Unassigned'}</p></div>
                                            <div><p className="text-[var(--color-foreground-tertiary)]">Price</p><p className="mt-1 font-semibold tabular-nums text-[var(--color-foreground)]">{formatCurrency(product.sellingPrice || product.basePrice)}</p><p className="mt-0.5 text-[11px] tabular-nums text-[var(--color-foreground-tertiary)]">Base {formatCurrency(product.basePrice)}{product.mrp ? ` · MRP ${formatCurrency(product.mrp)}` : ''}</p></div>
                                            <div><p className="text-[var(--color-foreground-tertiary)]">Inventory</p><p className="mt-1 font-medium tabular-nums text-[var(--color-foreground)]">{product.stock.toLocaleString()} in stock · {product.variants.length} variants</p><p className="mt-0.5 text-[11px] tabular-nums text-[var(--color-foreground-tertiary)]">MOQ {product.minOrderQuantity} · Max {product.maxOrderQuantity ?? '—'}</p></div>
                                            <div><p className="text-[var(--color-foreground-tertiary)]">Updated</p><p className="mt-1 font-medium text-[var(--color-foreground)]">{formatDate(product.updatedAt)}</p><p className="mt-0.5 text-[11px] text-[var(--color-foreground-tertiary)]">Created {formatDate(product.createdAt)}</p></div>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3"><ProductStatus product={product} /><ProductActions product={product} deleting={deletingId === product.id} onDelete={handleDelete} /></div>
                                    </article>
                                ))}
                            </div>
                            <div className="hidden overflow-x-auto xl:block">
                                <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                                    <thead className="text-[11px] text-[var(--color-foreground-secondary)]"><tr><th className="px-5 py-3 font-medium">Product</th><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 font-medium">Pricing</th><th className="px-4 py-3 font-medium">Inventory</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Updated</th><th className="px-5 py-3 text-right font-medium">Actions</th></tr></thead>
                                    <tbody className="divide-y divide-[var(--color-border)]">
                                        {products.map((product) => (
                                            <tr key={product.id} className="transition-colors hover:bg-[var(--color-background-secondary)]">
                                                <td className="max-w-[350px] px-5 py-3"><div className="flex min-w-0 items-center gap-3"><ProductImage product={product} /><div className="min-w-0"><Link href={`/products/${product.id}`} className="block truncate font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]">{product.name}</Link><p className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-foreground-tertiary)]">{product.slug || '—'}</p><p className="mt-0.5 text-[11px] text-[var(--color-foreground-tertiary)]">SKU {product.sku || '—'}</p></div></div></td>
                                                <td className="px-4 py-3 text-xs text-[var(--color-foreground-secondary)]">{product.category?.name || 'Unassigned'}</td>
                                                <td className="px-4 py-3"><p className="font-semibold tabular-nums text-[var(--color-foreground)]">{formatCurrency(product.sellingPrice || product.basePrice)}</p><p className="mt-1 text-xs tabular-nums text-[var(--color-foreground-tertiary)]">Base {formatCurrency(product.basePrice)}</p>{product.mrp && <p className="text-xs tabular-nums text-[var(--color-foreground-tertiary)] line-through">{formatCurrency(product.mrp)}</p>}</td>
                                                <td className="px-4 py-3"><p className="font-medium tabular-nums text-[var(--color-foreground)]">{product.stock.toLocaleString()} in stock</p><p className="mt-1 text-xs tabular-nums text-[var(--color-foreground-tertiary)]">MOQ {product.minOrderQuantity} · Max {product.maxOrderQuantity ?? '—'}</p><p className="text-xs tabular-nums text-[var(--color-foreground-tertiary)]">{product.variants.length} variants</p></td>
                                                <td className="px-4 py-3"><ProductStatus product={product} /></td>
                                                <td className="px-4 py-3 text-xs text-[var(--color-foreground-secondary)]"><p>{formatDate(product.updatedAt)}</p><p className="mt-1 text-[var(--color-foreground-tertiary)]">Created {formatDate(product.createdAt)}</p></td>
                                                <td className="px-5 py-3"><ProductActions product={product} deleting={deletingId === product.id} onDelete={handleDelete} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
                <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-foreground-secondary)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <span className="tabular-nums">Showing {firstItem.toLocaleString()}–{lastItem.toLocaleString()} of {totalItems.toLocaleString()} products</span>
                    <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-8 gap-1"><ChevronLeft className="h-3.5 w-3.5" />Previous</Button><span className="min-w-16 text-center tabular-nums">{page} / {Math.max(totalPages, 1)}</span><Button variant="outline" size="sm" disabled={page >= totalPages || isLoading} onClick={() => setPage((current) => Math.min(totalPages || 1, current + 1))} className="h-8 gap-1">Next<ChevronRight className="h-3.5 w-3.5" /></Button></div>
                </div>
                </div>
            </div>
        </div>
    );
}
