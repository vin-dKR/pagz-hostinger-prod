/**
 * Coupon Selection Manager
 * For selecting products/categories during coupon creation (before coupon ID exists)
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import {
    useAvailableProducts,
    useAvailableCategories,
} from '@/lib/hooks/use-coupon-products';
import { Plus, Loader2, X } from 'lucide-react';

interface CouponSelectionManagerProps {
    applicableTo: 'ALL' | 'CATEGORY' | 'PRODUCT';
    selectedProductIds: string[];
    selectedCategoryIds: string[];
    onProductIdsChange: (ids: string[]) => void;
    onCategoryIdsChange: (ids: string[]) => void;
}

export function CouponSelectionManager({
    applicableTo,
    selectedProductIds,
    selectedCategoryIds,
    onProductIdsChange,
    onCategoryIdsChange,
}: CouponSelectionManagerProps) {
    // Search states
    const [productSearch, setProductSearch] = useState('');
    const [categorySearch, setCategorySearch] = useState('');
    const [tempSelectedProductIds, setTempSelectedProductIds] = useState<Set<string>>(new Set());
    const [tempSelectedCategoryIds, setTempSelectedCategoryIds] = useState<Set<string>>(new Set());

    // Debounced search values
    const debouncedProductSearch = useDebouncedValue(productSearch, 300);
    const debouncedCategorySearch = useDebouncedValue(categorySearch, 300);

    const isProductMode = applicableTo === 'PRODUCT';
    const isCategoryMode = applicableTo === 'CATEGORY';

    // Available items queries
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

    // Extract products and categories from query data
    const availableProducts = useMemo(
        () => availableProductsData?.products || [],
        [availableProductsData]
    );
    const availableCategories = useMemo(
        () => availableCategoriesData?.items || [],
        [availableCategoriesData]
    );

    // Filter out already selected items
    const filteredAvailableProducts = useMemo(() => {
        const selectedIds = new Set([...selectedProductIds, ...Array.from(tempSelectedProductIds)]);
        return availableProducts.filter((p) => !selectedIds.has(p.id));
    }, [availableProducts, selectedProductIds, tempSelectedProductIds]);

    const filteredAvailableCategories = useMemo(() => {
        const selectedIds = new Set([...selectedCategoryIds, ...Array.from(tempSelectedCategoryIds)]);
        return availableCategories.filter((c) => !selectedIds.has(c.id));
    }, [availableCategories, selectedCategoryIds, tempSelectedCategoryIds]);

    // Get selected items for display
    const selectedProducts = useMemo(() => {
        return availableProducts.filter((p) => selectedProductIds.includes(p.id));
    }, [availableProducts, selectedProductIds]);

    const selectedCategories = useMemo(() => {
        return availableCategories.filter((c) => selectedCategoryIds.includes(c.id));
    }, [availableCategories, selectedCategoryIds]);

    const isSearchingProducts = loadingProducts || fetchingProducts;
    const isSearchingCategories = loadingCategories || fetchingCategories;

    const handleAddProducts = () => {
        if (tempSelectedProductIds.size === 0) return;
        const newIds = [...selectedProductIds, ...Array.from(tempSelectedProductIds)];
        onProductIdsChange(newIds);
        setTempSelectedProductIds(new Set());
        setProductSearch('');
    };

    const handleRemoveProduct = (productId: string) => {
        onProductIdsChange(selectedProductIds.filter((id) => id !== productId));
    };

    const handleAddCategories = () => {
        if (tempSelectedCategoryIds.size === 0) return;
        const newIds = [...selectedCategoryIds, ...Array.from(tempSelectedCategoryIds)];
        onCategoryIdsChange(newIds);
        setTempSelectedCategoryIds(new Set());
        setCategorySearch('');
    };

    const handleRemoveCategory = (categoryId: string) => {
        onCategoryIdsChange(selectedCategoryIds.filter((id) => id !== categoryId));
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

    return (
        <div className="space-y-6">
            {/* Products Management */}
            {isProductMode && (
                <Card>
                    <CardHeader>
                        <CardTitle>Select Products</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Search and Add Products</Label>
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
                                                const newSet = new Set(tempSelectedProductIds);
                                                if (newSet.has(product.id)) {
                                                    newSet.delete(product.id);
                                                } else {
                                                    newSet.add(product.id);
                                                }
                                                setTempSelectedProductIds(newSet);
                                            }}
                                        >
                                            <div className="flex items-center gap-2 flex-1">
                                                <input
                                                    type="checkbox"
                                                    checked={tempSelectedProductIds.has(product.id)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        const newSet = new Set(tempSelectedProductIds);
                                                        if (e.target.checked) {
                                                            newSet.add(product.id);
                                                        } else {
                                                            newSet.delete(product.id);
                                                        }
                                                        setTempSelectedProductIds(newSet);
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

                            {tempSelectedProductIds.size > 0 && (
                                <Button
                                    type="button"
                                    onClick={handleAddProducts}
                                    className="mt-2 cursor-pointer"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add {tempSelectedProductIds.size} Product(s)
                                </Button>
                            )}
                        </div>

                        {/* Selected Products */}
                        {selectedProducts.length > 0 && (
                            <div>
                                <Label>Selected Products ({selectedProducts.length})</Label>
                                <div className="mt-2 space-y-2">
                                    {selectedProducts.map((product) => (
                                        <div
                                            key={product.id}
                                            className="flex items-center justify-between p-2 border rounded"
                                        >
                                            <div>
                                                <span className="text-sm font-medium">
                                                    {product.name}
                                                </span>
                                                <span className="text-xs text-gray-500 ml-2">
                                                    ({product.category?.name || 'No category'})
                                                </span>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRemoveProduct(product.id)}
                                                className="cursor-pointer"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Categories Management */}
            {isCategoryMode && (
                <Card>
                    <CardHeader>
                        <CardTitle>Select Categories</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>Search and Add Categories</Label>
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
                                                const newSet = new Set(tempSelectedCategoryIds);
                                                if (newSet.has(category.id)) {
                                                    newSet.delete(category.id);
                                                } else {
                                                    newSet.add(category.id);
                                                }
                                                setTempSelectedCategoryIds(newSet);
                                            }}
                                        >
                                            <div className="flex items-center gap-2 flex-1">
                                                <input
                                                    type="checkbox"
                                                    checked={tempSelectedCategoryIds.has(category.id)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        const newSet = new Set(tempSelectedCategoryIds);
                                                        if (e.target.checked) {
                                                            newSet.add(category.id);
                                                        } else {
                                                            newSet.delete(category.id);
                                                        }
                                                        setTempSelectedCategoryIds(newSet);
                                                    }}
                                                    className="cursor-pointer"
                                                />
                                                <span className="text-sm flex-1">{category.name}</span>
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

                            {tempSelectedCategoryIds.size > 0 && (
                                <Button
                                    type="button"
                                    onClick={handleAddCategories}
                                    className="mt-2 cursor-pointer"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add {tempSelectedCategoryIds.size} Category(ies)
                                </Button>
                            )}
                        </div>

                        {/* Selected Categories */}
                        {selectedCategories.length > 0 && (
                            <div>
                                <Label>Selected Categories ({selectedCategories.length})</Label>
                                <div className="mt-2 space-y-2">
                                    {selectedCategories.map((category) => (
                                        <div
                                            key={category.id}
                                            className="flex items-center justify-between p-2 border rounded"
                                        >
                                            <span className="text-sm font-medium">{category.name}</span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRemoveCategory(category.id)}
                                                className="cursor-pointer"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
