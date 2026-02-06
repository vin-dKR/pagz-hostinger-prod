/**
 * Coupon Products & Categories Manager
 * Optimized with TanStack Query for blazing fast performance
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import {
    useCouponProducts,
    useCouponCategories,
    useAvailableProducts,
    useAvailableCategories,
    useAddCouponProducts,
    useRemoveCouponProducts,
    useAddCouponCategories,
    useRemoveCouponCategories,
} from '@/lib/hooks/use-coupon-products';
import { X, Plus, Loader2 } from 'lucide-react';

interface CouponProductsManagerProps {
    couponId: string;
    applicableTo: 'ALL' | 'CATEGORY' | 'PRODUCT';
}

export function CouponProductsManager({ couponId, applicableTo }: CouponProductsManagerProps) {
    // Search states
    const [productSearch, setProductSearch] = useState('');
    const [categorySearch, setCategorySearch] = useState('');
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());

    // Debounced search values (reduced to 300ms for faster response)
    const debouncedProductSearch = useDebouncedValue(productSearch, 300);
    const debouncedCategorySearch = useDebouncedValue(categorySearch, 300);

    // TanStack Query hooks - automatically cached and optimized
    const isProductMode = applicableTo === 'PRODUCT';
    const isCategoryMode = applicableTo === 'CATEGORY';

    // Coupon data queries
    const {
        data: couponProducts = [],
        isLoading: loadingCouponProducts,
        error: couponProductsError,
    } = useCouponProducts(couponId, isProductMode);

    const {
        data: couponCategories = [],
        isLoading: loadingCouponCategories,
        error: couponCategoriesError,
    } = useCouponCategories(couponId, isCategoryMode);

    // Available items queries with aggressive caching
    const {
        data: availableProductsData,
        isLoading: loadingProducts,
        isFetching: fetchingProducts,
    } = useAvailableProducts(debouncedProductSearch, isProductMode);

    const {
        data: availableCategoriesData,
        isLoading: loadingCategories,
        isFetching: fetchingCategories,
    } = useAvailableCategories(debouncedCategorySearch, isCategoryMode);

    // Mutations with optimistic updates
    const addProductsMutation = useAddCouponProducts(couponId);
    const removeProductMutation = useRemoveCouponProducts(couponId);
    const addCategoriesMutation = useAddCouponCategories(couponId);
    const removeCategoryMutation = useRemoveCouponCategories(couponId);

    // Extract products and categories from query data (memoized)
    const availableProducts = useMemo(
        () => availableProductsData?.products || [],
        [availableProductsData]
    );
    const availableCategories = useMemo(
        () => availableCategoriesData?.items || [],
        [availableCategoriesData]
    );

    // Filter out already added items (computed with useMemo for performance)
    const filteredAvailableProducts = useMemo(() => {
        const couponProductIds = new Set(couponProducts.map((cp) => cp.product.id));
        return availableProducts.filter((p) => !couponProductIds.has(p.id));
    }, [availableProducts, couponProducts]);

    const filteredAvailableCategories = useMemo(() => {
        const couponCategoryIds = new Set(couponCategories.map((cc) => cc.id));
        return availableCategories.filter((c) => !couponCategoryIds.has(c.id));
    }, [availableCategories, couponCategories]);

    // Error handling
    const error = couponProductsError || couponCategoriesError;
    const errorMessage =
        error instanceof Error ? error.message : error ? String(error) : null;

    // Handlers
    const handleAddProducts = async () => {
        if (selectedProductIds.size === 0) return;

        try {
            await addProductsMutation.mutateAsync(Array.from(selectedProductIds));
            setSelectedProductIds(new Set());
            setProductSearch('');
        } catch {
            // Error handled by mutation
        }
    };

    const handleRemoveProduct = async (productId: string) => {
        try {
            await removeProductMutation.mutateAsync([productId]);
        } catch {
            // Error handled by mutation
        }
    };

    const handleAddCategories = async () => {
        if (selectedCategoryIds.size === 0) return;

        try {
            await addCategoriesMutation.mutateAsync(Array.from(selectedCategoryIds));
            setSelectedCategoryIds(new Set());
            setCategorySearch('');
        } catch {
            // Error handled by mutation
        }
    };

    const handleRemoveCategory = async (categoryId: string) => {
        try {
            await removeCategoryMutation.mutateAsync([categoryId]);
        } catch {
            // Error handled by mutation
        }
    };

    if (applicableTo === 'ALL') {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Applicability</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-600">
                        This coupon applies to all products. No restrictions configured.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const isSearchingProducts = loadingProducts || fetchingProducts;
    const isSearchingCategories = loadingCategories || fetchingCategories;

    return (
        <div className="space-y-6">
            {errorMessage && <Alert variant="error">{errorMessage}</Alert>}

            {/* Products Management */}
            {isProductMode && (
                <Card>
                    <CardHeader>
                        <CardTitle>Coupon Products</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Add Products</Label>
                            <div className="relative mt-2">
                                <Input
                                    placeholder="Search products... (type to search)"
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className="pr-10"
                                />
                                {isSearchingProducts && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                    </div>
                                )}
                            </div>

                            {filteredAvailableProducts.length > 0 && (
                                <div className="mt-4 border rounded-lg max-h-60 overflow-y-auto">
                                    {filteredAvailableProducts.map((product) => (
                                        <div
                                            key={product.id}
                                            className="flex items-center justify-between p-2 border-b hover:bg-gray-50 cursor-pointer"
                                            onClick={() => {
                                                const newSet = new Set(selectedProductIds);
                                                if (newSet.has(product.id)) {
                                                    newSet.delete(product.id);
                                                } else {
                                                    newSet.add(product.id);
                                                }
                                                setSelectedProductIds(newSet);
                                            }}
                                        >
                                            <div className="flex items-center gap-2 flex-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedProductIds.has(product.id)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        const newSet = new Set(selectedProductIds);
                                                        if (e.target.checked) {
                                                            newSet.add(product.id);
                                                        } else {
                                                            newSet.delete(product.id);
                                                        }
                                                        setSelectedProductIds(newSet);
                                                    }}
                                                    className="cursor-pointer"
                                                />
                                                <span className="text-sm flex-1">{product.name}</span>
                                                <span className="text-xs text-gray-500">
                                                    ({product.category?.name || 'No category'})
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {filteredAvailableProducts.length === 0 && !isSearchingProducts && (
                                <p className="text-sm text-gray-500 mt-2">
                                    {productSearch
                                        ? 'No products found matching your search'
                                        : 'No available products'}
                                </p>
                            )}

                            {selectedProductIds.size > 0 && (
                                <Button
                                    type="button"
                                    onClick={handleAddProducts}
                                    disabled={addProductsMutation.isPending}
                                    className="mt-2 cursor-pointer"
                                >
                                    {addProductsMutation.isPending ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add {selectedProductIds.size} Product(s)
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>

                        {/* Current Products */}
                        <div>
                            <Label>Current Products ({couponProducts.length})</Label>
                            {loadingCouponProducts ? (
                                <div className="mt-2 flex items-center justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                                    <span className="ml-2 text-sm text-gray-500">
                                        Loading products...
                                    </span>
                                </div>
                            ) : couponProducts.length === 0 ? (
                                <p className="text-sm text-gray-500 mt-2">No products added yet</p>
                            ) : (
                                <div className="mt-2 space-y-2">
                                    {couponProducts.map((cp) => (
                                        <div
                                            key={cp.id}
                                            className="flex items-center justify-between p-2 border rounded"
                                        >
                                            <div>
                                                <span className="text-sm font-medium">
                                                    {cp.product.name}
                                                </span>
                                                <span className="text-xs text-gray-500 ml-2">
                                                    ({cp.product.category?.name || 'No category'})
                                                </span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRemoveProduct(cp.product.id)}
                                                disabled={
                                                    removeProductMutation.isPending &&
                                                    removeProductMutation.variables?.includes(
                                                        cp.product.id
                                                    )
                                                }
                                                className="cursor-pointer"
                                            >
                                                {removeProductMutation.isPending &&
                                                    removeProductMutation.variables?.includes(
                                                        cp.product.id
                                                    ) ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <X className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Categories Management */}
            {isCategoryMode && (
                <Card>
                    <CardHeader>
                        <CardTitle>Coupon Categories</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Add Categories</Label>
                            <div className="relative mt-2">
                                <Input
                                    placeholder="Search categories... (type to search)"
                                    value={categorySearch}
                                    onChange={(e) => setCategorySearch(e.target.value)}
                                    className="pr-10"
                                />
                                {isSearchingCategories && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                    </div>
                                )}
                            </div>

                            {filteredAvailableCategories.length > 0 && (
                                <div className="mt-4 border rounded-lg max-h-60 overflow-y-auto">
                                    {filteredAvailableCategories.map((category) => (
                                        <div
                                            key={category.id}
                                            className="flex items-center justify-between p-2 border-b hover:bg-gray-50 cursor-pointer"
                                            onClick={() => {
                                                const newSet = new Set(selectedCategoryIds);
                                                if (newSet.has(category.id)) {
                                                    newSet.delete(category.id);
                                                } else {
                                                    newSet.add(category.id);
                                                }
                                                setSelectedCategoryIds(newSet);
                                            }}
                                        >
                                            <div className="flex items-center gap-2 flex-1">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCategoryIds.has(category.id)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        const newSet = new Set(selectedCategoryIds);
                                                        if (e.target.checked) {
                                                            newSet.add(category.id);
                                                        } else {
                                                            newSet.delete(category.id);
                                                        }
                                                        setSelectedCategoryIds(newSet);
                                                    }}
                                                    className="cursor-pointer"
                                                />
                                                <span className="text-sm flex-1">{category.name}</span>
                                                <span className="text-xs text-gray-500">
                                                    ({category._count?.products || 0} products)
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {filteredAvailableCategories.length === 0 && !isSearchingCategories && (
                                <p className="text-sm text-gray-500 mt-2">
                                    {categorySearch
                                        ? 'No categories found matching your search'
                                        : 'No available categories'}
                                </p>
                            )}

                            {selectedCategoryIds.size > 0 && (
                                <Button
                                    type="button"
                                    onClick={handleAddCategories}
                                    disabled={addCategoriesMutation.isPending}
                                    className="mt-2 cursor-pointer"
                                >
                                    {addCategoriesMutation.isPending ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add {selectedCategoryIds.size} Category/Categories
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>

                        {/* Current Categories */}
                        <div>
                            <Label>Current Categories ({couponCategories.length})</Label>
                            {loadingCouponCategories ? (
                                <div className="mt-2 flex items-center justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                                    <span className="ml-2 text-sm text-gray-500">
                                        Loading categories...
                                    </span>
                                </div>
                            ) : couponCategories.length === 0 ? (
                                <p className="text-sm text-gray-500 mt-2">No categories added yet</p>
                            ) : (
                                <div className="mt-2 space-y-2">
                                    {couponCategories.map((cc) => (
                                        <div
                                            key={cc.id}
                                            className="flex items-center justify-between p-2 border rounded"
                                        >
                                            <div>
                                                <span className="text-sm font-medium">{cc.name}</span>
                                                <span className="text-xs text-gray-500 ml-2">
                                                    ({cc.productCount} products)
                                                </span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRemoveCategory(cc.id)}
                                                disabled={
                                                    removeCategoryMutation.isPending &&
                                                    removeCategoryMutation.variables?.includes(cc.id)
                                                }
                                                className="cursor-pointer"
                                            >
                                                {removeCategoryMutation.isPending &&
                                                    removeCategoryMutation.variables?.includes(cc.id) ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <X className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
