'use client';

/**
 * Category Detail & Configuration Management
 */

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import Link from 'next/link';
import {
    getCategoryById,
    updateCategory,
    getCategories,
    getCategoryConfigurationApi,
    upsertCategoryConfigurationApi,
    type Category,
    type CategoryConfiguration,
    type UpsertCategoryConfigurationData,
} from '@/lib/api/categories.service';
import { CategorySpecifications } from './category-specifications';
import { CategoryPricing } from './category-pricing';
import { CategoryImages } from './category-images';
import { CategoryTemplatesForms } from './category-templates-forms';
import { ParentCategorySelector } from './parent-category-selector';
import { ChildCategoriesSelector } from './child-categories-selector';
import { CategoryPageController } from './category-page-controller';
import { getProducts, type Product } from '@/lib/api/products.service';

interface CategoryDetailProps {
    categoryId: string;
}

type TabType = 'overview' | 'specifications' | 'pricing' | 'products' | 'images' | 'templates' | 'page-controller';

export function CategoryDetail({ categoryId }: CategoryDetailProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [loading, setLoading] = useState(true);
    const [savingBasic, setSavingBasic] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);
    const [isEditingParent, setIsEditingParent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);

    const [category, setCategory] = useState<Category | null>(null);
    const [config, setConfig] = useState<CategoryConfiguration | null>(null);
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _config = config; // Keep for potential future use

    const [basicForm, setBasicForm] = useState<{
        name: string;
        slug: string;
        description: string;
        priority: number;
        parentId: string | null;
    }>({
        name: '',
        slug: '',
        description: '',
        priority: 0,
        parentId: null,
    });

    const [configForm, setConfigForm] = useState<{
        pageTitle: string;
        pageDescription: string;
        featuresText: string;
        fileUploadRequired: boolean;
        comingSoon: boolean;
    }>({
        pageTitle: '',
        pageDescription: '',
        featuresText: '',
        fileUploadRequired: false,
        comingSoon: false,
    });

    const [childCategoryIds, setChildCategoryIds] = useState<string[]>([]);
    const [savedChildCategoryIds, setSavedChildCategoryIds] = useState<string[]>([]);

    const fetchAllCategories = async () => {
        const pageLimit = 100;
        let page = 1;
        const items: Category[] = [];

        while (true) {
            const res = await getCategories({ page, limit: pageLimit });
            items.push(...res.items);

            if (page >= res.pagination.totalPages) break;
            page += 1;
        }

        return items;
    };

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                setError(null);

                const [cat, cfg, categories] = await Promise.all([
                    getCategoryById(categoryId),
                    getCategoryConfigurationApi(categoryId),
                    fetchAllCategories(),
                ]);

                setCategory(cat);
                setConfig(cfg);
                setAllCategories(categories);

                setBasicForm({
                    name: cat.name,
                    slug: cat.slug,
                    description: cat.description || '',
                    priority: cat.priority ?? 0,
                    parentId: cat.parentId || null,
                });
                setIsEditingParent(false);

                setConfigForm({
                    pageTitle: cfg?.pageTitle || cat.name,
                    pageDescription: cfg?.pageDescription || cat.description || '',
                    featuresText: (cfg?.features || []).join('\n'),
                    fileUploadRequired: cfg?.fileUploadRequired ?? false,
                    comingSoon: cfg?.layoutConfig?.comingSoon ?? false,
                });

                const children = categories.filter((c) => c.parentId === categoryId);
                const childIds = children.map((c) => c.id);
                setChildCategoryIds(childIds);
                setSavedChildCategoryIds(childIds);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load category');
            } finally {
                setLoading(false);
            }
        }

        void load();
    }, [categoryId]);

    useEffect(() => {
        if (activeTab === 'products') {
            loadProducts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, categoryId]);

    const loadProducts = async () => {
        try {
            setLoadingProducts(true);
            const data = await getProducts({ category: categoryId, limit: 100 });
            setProducts(data.products);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load products');
        } finally {
            setLoadingProducts(false);
        }
    };

    const handleSaveBasic = async (e: FormEvent) => {
        e.preventDefault();
        if (!category) return;

        try {
            setSavingBasic(true);
            setError(null);

            const currentCategoryId = category.id;
            await updateCategory(currentCategoryId, {
                name: basicForm.name.trim(),
                description: basicForm.description.trim() || undefined,
                priority: basicForm.priority,
                parentId: basicForm.parentId || null,
            });

            // Persist child categories relationship as the "final" step with Basic Info.
            const toAdd = childCategoryIds.filter((id) => !savedChildCategoryIds.includes(id));
            const toRemove = savedChildCategoryIds.filter((id) => !childCategoryIds.includes(id));

            await Promise.all([
                ...toAdd.map((id) => updateCategory(id, { parentId: currentCategoryId })),
                ...toRemove.map((id) => updateCategory(id, { parentId: null })),
            ]);

            // Reload so labels and relationships are consistent with the saved state.
            const [cat, cfg, categories] = await Promise.all([
                getCategoryById(currentCategoryId),
                getCategoryConfigurationApi(currentCategoryId),
                fetchAllCategories(),
            ]);

            const children = categories.filter((c) => c.parentId === currentCategoryId);
            const childIds = children.map((c) => c.id);

            setCategory(cat);
            setConfig(cfg);
            setAllCategories(categories);

            setBasicForm({
                name: cat.name,
                slug: cat.slug,
                description: cat.description || '',
                priority: cat.priority ?? 0,
                parentId: cat.parentId || null,
            });

            setConfigForm({
                pageTitle: cfg?.pageTitle || cat.name,
                pageDescription: cfg?.pageDescription || cat.description || '',
                featuresText: (cfg?.features || []).join('\n'),
                fileUploadRequired: cfg?.fileUploadRequired ?? false,
                comingSoon: cfg?.layoutConfig?.comingSoon ?? false,
            });

            setChildCategoryIds(childIds);
            setSavedChildCategoryIds(childIds);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save category');
        } finally {
            setSavingBasic(false);
        }
    };

    const handleSaveConfig = async (e: FormEvent) => {
        e.preventDefault();
        if (!category) return;

        try {
            setSavingConfig(true);
            setError(null);

            const payload: UpsertCategoryConfigurationData = {
                pageTitle: configForm.pageTitle.trim() || undefined,
                pageDescription: configForm.pageDescription.trim() || undefined,
                features: configForm.featuresText
                    ? configForm.featuresText.split('\n').map((f) => f.trim()).filter(Boolean)
                    : [],
                fileUploadRequired: configForm.fileUploadRequired,
                layoutConfig: {
                    ...(config?.layoutConfig && typeof config.layoutConfig === 'object' ? config.layoutConfig : {}),
                    comingSoon: configForm.comingSoon,
                },
            };

            const updatedConfig = await upsertCategoryConfigurationApi(category.id, payload);
            setConfig(updatedConfig);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save configuration');
        } finally {
            setSavingConfig(false);
        }
    };

    const excludedChildCategoryIds = (() => {
        // Prevent obvious cycles: do not allow selecting the category itself or its ancestors as a child.
        const exclude = new Set<string>();
        exclude.add(categoryId);

        const byId = new Map(allCategories.map((c) => [c.id, c]));
        let cursorId: string | undefined | null = category?.parentId ?? null;

        while (cursorId) {
            exclude.add(cursorId);
            cursorId = byId.get(cursorId)?.parentId ?? null;
        }

        return [...exclude];
    })();

    if (loading) {
        return (
            <div className="flex min-h-[200px] items-center justify-center">
                <p className="text-sm text-gray-500">Loading category...</p>
            </div>
        );
    }

    if (!category) {
        return (
            <Alert variant="error">
                Category not found.
                <Button variant="outline" className="ml-4" onClick={() => router.push('/categories')}>
                    Back to categories
                </Button>
            </Alert>
        );
    }

    const tabs: { id: TabType; label: string }[] = [
        { id: 'overview', label: 'Overview' },
        { id: 'specifications', label: 'Specifications' },
        { id: 'pricing', label: 'Pricing' },
        { id: 'products', label: 'Products' },
        { id: 'images', label: 'Images' },
        { id: 'templates', label: 'Templates & Forms' },
        { id: 'page-controller', label: 'Page Controller' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Manage category details, UI configuration, specifications, and pricing.
                    </p>
                </div>
            </div>

            {error && (
                <Alert variant="error">
                    {error}
                </Alert>
            )}

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium
                ${activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                }
              `}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Basic info */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Basic Information</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveBasic} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        value={basicForm.name}
                                        onChange={(e) =>
                                            setBasicForm((prev) => ({
                                                ...prev,
                                                name: e.target.value,
                                            }))
                                        }
                                        required
                                    />
                                </div>


                                <div className="space-y-2">
                                    <Label htmlFor="description">Description</Label>
                                    <Input
                                        id="description"
                                        value={basicForm.description}
                                        onChange={(e) =>
                                            setBasicForm((prev) => ({
                                                ...prev,
                                                description: e.target.value,
                                            }))
                                        }
                                    />
                                </div>

                                {/* Parent Category: read-only until Edit */}
                                {!isEditingParent && (
                                    <div className="space-y-2">
                                        <Label>Parent Category</Label>
                                        <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                                            <div className="text-sm text-gray-700">
                                                {category?.parent ? (
                                                    <span>
                                                        {category.parent.name} <span className="text-gray-400">({category.parent.slug})</span>
                                                    </span>
                                                ) : basicForm.parentId ? (
                                                    <span className="text-gray-700">Selected</span>
                                                ) : (
                                                    <span className="text-gray-500">No parent (Standalone)</span>
                                                )}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsEditingParent(true)}
                                            >
                                                Edit
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {isEditingParent && (
                                    <ParentCategorySelector
                                        value={basicForm.parentId}
                                        onChange={(parentId) => {
                                            setBasicForm((prev) => ({
                                                ...prev,
                                                parentId,
                                            }));
                                            // After a selection, keep it read-only again
                                            setIsEditingParent(false);
                                        }}
                                        excludeCategoryId={categoryId}
                                        label="Search parent category"
                                        placeholder="Type to search..."
                                    />
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="priority">Display Order</Label>
                                    <Input
                                        id="priority"
                                        type="number"
                                        value={basicForm.priority}
                                        onChange={(e) =>
                                            setBasicForm((prev) => ({
                                                ...prev,
                                                priority: Number(e.target.value) || 0,
                                            }))
                                        }
                                        placeholder="0"
                                        min="0"
                                    />
                                    <p className="text-xs text-gray-500">
                                        Higher values appear first in the services page. Default: 0
                                    </p>
                                </div>

                                {/* Child Categories */}
                                <div className="space-y-3 pt-4 border-t border-gray-200">
                                    <ChildCategoriesSelector
                                        value={childCategoryIds}
                                        onChange={(next) => setChildCategoryIds(next)}
                                        excludeCategoryIds={excludedChildCategoryIds}
                                        allCategories={allCategories}
                                        label="Child Categories"
                                        placeholder="Type to search and add children..."
                                    />
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button type="submit" isLoading={savingBasic}>
                                        Save Basic Info
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Configuration */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Service Page Configuration</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveConfig} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="pageTitle">Page Title</Label>
                                    <Input
                                        id="pageTitle"
                                        value={configForm.pageTitle}
                                        onChange={(e) =>
                                            setConfigForm((prev) => ({
                                                ...prev,
                                                pageTitle: e.target.value,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="pageDescription">Page Description</Label>
                                    <Input
                                        id="pageDescription"
                                        value={configForm.pageDescription}
                                        onChange={(e) =>
                                            setConfigForm((prev) => ({
                                                ...prev,
                                                pageDescription: e.target.value,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="features">
                                        Features (one per line)
                                    </Label>
                                    <textarea
                                        id="features"
                                        className="min-h-[120px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                        value={configForm.featuresText}
                                        onChange={(e) =>
                                            setConfigForm((prev) => ({
                                                ...prev,
                                                featuresText: e.target.value,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        id="fileUploadRequired"
                                        type="checkbox"
                                        checked={configForm.fileUploadRequired}
                                        onChange={(e) =>
                                            setConfigForm((prev) => ({
                                                ...prev,
                                                fileUploadRequired: e.target.checked,
                                            }))
                                        }
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <Label htmlFor="fileUploadRequired">File upload required</Label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        id="comingSoon"
                                        type="checkbox"
                                        checked={configForm.comingSoon}
                                        onChange={(e) =>
                                            setConfigForm((prev) => ({
                                                ...prev,
                                                comingSoon: e.target.checked,
                                            }))
                                        }
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <Label htmlFor="comingSoon">Show coming soon page</Label>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <Button type="submit" isLoading={savingConfig}>
                                        Save Configuration
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeTab === 'specifications' && (
                <CategorySpecifications categoryId={categoryId} />
            )}

            {activeTab === 'pricing' && (
                <CategoryPricing categoryId={categoryId} />
            )}

            {activeTab === 'products' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Products in this Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingProducts ? (
                            <div className="py-8 text-center text-gray-500">Loading products...</div>
                        ) : products.length === 0 ? (
                            <div className="py-8 text-center text-gray-500">
                                <p>No products found in this category.</p>
                                <p className="mt-2 text-sm">
                                    Publish pricing rules as products from the Pricing tab.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {products.map((product) => (
                                    <div
                                        key={product.id}
                                        className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                                    >
                                        <div>
                                            <Link
                                                href={`/products/${product.id}`}
                                                className="font-medium text-blue-600 hover:underline"
                                            >
                                                {product.name}
                                            </Link>
                                            <p className="text-sm text-gray-500">
                                                SKU: {product.sku || 'N/A'} • Stock: {product.stock} • Price: ₹{product.basePrice}
                                            </p>
                                            {product.generatedFromPricingRule && (
                                                <span className="mt-1 inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                                                    Generated from Category
                                                </span>
                                            )}
                                        </div>
                                        <Link href={`/products/${product.id}`}>
                                            <Button variant="outline" size="sm">
                                                View
                                            </Button>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {activeTab === 'images' && (
                <CategoryImages categoryId={categoryId} />
            )}

            {activeTab === 'templates' && (
                <CategoryTemplatesForms categoryId={categoryId} />
            )}

            {activeTab === 'page-controller' && (
                <CategoryPageController categoryId={categoryId} />
            )}
        </div>
    );
}


