'use client';

/**
 * Category Pricing Rules Management
 */

import { useEffect, useState, FormEvent, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/app/components/ui/dialog';
import {
    getCategoryById,
    getCategoryPricingRulesApi,
    createCategoryPricingRuleApi,
    updateCategoryPricingRuleApi,
    deleteCategoryPricingRuleApi,
    getCategorySpecificationsApi,
    publishPricingRuleAsProductApi,
    updateProductFromPricingRuleApi,
    syncProductFromCategoryApi,
    type Category,
    type CategoryPricingRule,
    type PricingRuleType,
    type CategorySpecification,
} from '@/lib/api/categories.service';
import { Package, ExternalLink, Edit2, Trash2, Upload, CheckCircle2, XCircle, X, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { toastPromise } from '@/lib/utils/toast';
import { getProduct } from '@/lib/api/products.service';

interface CategoryPricingProps {
    categoryId: string;
} 

const RULE_TYPES: { value: PricingRuleType; label: string }[] = [
    { value: 'BASE_PRICE', label: 'Base Price' },
    { value: 'SPECIFICATION_COMBINATION', label: 'Specification Combination' },
    { value: 'QUANTITY_TIER', label: 'Quantity Tier' },
    { value: 'ADDON', label: 'Addon' },
];

export function CategoryPricing({ categoryId }: CategoryPricingProps) {
    const [category, setCategory] = useState<Category | null>(null);
    const [rules, setRules] = useState<CategoryPricingRule[]>([]);
    const [specs, setSpecs] = useState<CategorySpecification[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { confirm, ConfirmDialog } = useConfirm();

    // Selected spec filters for current rule (slug -> option value)
    const [specFilters, setSpecFilters] = useState<Record<string, string>>({});
    
    // Selected addons for the pricing rule (when product is published)
    const [ruleAddonIds, setRuleAddonIds] = useState<string[]>([]);
    
    // Store addon selections per rule ID (for persistence across form resets)
    const [ruleAddonsMap, setRuleAddonsMap] = useState<Record<string, string[]>>({});

    const [form, setForm] = useState<{
        id?: string;
        ruleType: PricingRuleType;
        basePrice: string;
        priceModifier: string;
        quantityMultiplier: boolean;
        minQuantity: string;
        maxQuantity: string;
        isActive: boolean;
        priority: string;
    }>({
        ruleType: 'BASE_PRICE',
        basePrice: '',
        priceModifier: '',
        quantityMultiplier: true,
        minQuantity: '',
        maxQuantity: '',
        isActive: true,
        priority: '0',
    });

    // Publish modal state
    const [publishModalOpen, setPublishModalOpen] = useState(false);
    const [publishRuleId, setPublishRuleId] = useState<string | null>(null);
    const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
    const [publishFormData, setPublishFormData] = useState({
        stock: '1000',
        sku: '',
        name: '',
        description: '',
        shortDescription: '',
    });
    const [publishImages, setPublishImages] = useState<Array<{ url: string; alt?: string; isPrimary?: boolean; displayOrder?: number }>>([]);

    const loadRules = async () => {
        try {
            const [cat, pricingRules, specifications] = await Promise.all([
                getCategoryById(categoryId),
                getCategoryPricingRulesApi(categoryId),
                getCategorySpecificationsApi(categoryId),
            ]);
            setCategory(cat);
            setRules(pricingRules);
            setSpecs(
                (specifications || []).slice().sort((a, b) => a.displayOrder - b.displayOrder),
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load pricing rules');
        }
    };

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                setError(null);
                await loadRules();
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load pricing rules');
            } finally {
                setLoading(false);
            }
        }

        void load();
    }, [categoryId]);

    const resetForm = () => {
        // Before resetting, save current addon selections to map if we have a rule ID
        // This ensures state persists even if user cancels and re-edits
        if (form.id && ruleAddonIds.length > 0) {
            setRuleAddonsMap(prev => ({ ...prev, [form.id!]: ruleAddonIds }));
        }
        
        setForm({
            ruleType: 'BASE_PRICE',
            basePrice: '',
            priceModifier: '',
            quantityMultiplier: true,
            minQuantity: '',
            maxQuantity: '',
            isActive: true,
            priority: '0',
        });
        setSpecFilters({});
        setRuleAddonIds([]);
    };

    // When rule type changes, clear fields that are not applicable
    useEffect(() => {
        setForm((prev) => {
            const next = { ...prev };

            if (prev.ruleType === 'SPECIFICATION_COMBINATION') {
                // SPECIFICATION_COMBINATION uses basePrice only
                next.priceModifier = '';
                next.minQuantity = '';
                next.maxQuantity = '';
            } else if (prev.ruleType === 'ADDON') {
                // ADDON uses priceModifier and optional quantity range
                next.basePrice = '';
            }

            return next;
        });
    }, [form.ruleType]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            setError(null);

            // Build specificationValues from selected spec filters
            const specificationValues: Record<string, any> = { ...specFilters };

            const payload = {
                ruleType: form.ruleType,
                specificationValues,
                basePrice: form.basePrice ? Number(form.basePrice) : null,
                priceModifier: form.priceModifier ? Number(form.priceModifier) : null,
                quantityMultiplier: form.quantityMultiplier,
                minQuantity: form.minQuantity ? Number(form.minQuantity) : null,
                maxQuantity: form.maxQuantity ? Number(form.maxQuantity) : null,
                isActive: form.isActive,
                priority: form.priority ? Number(form.priority) : 0,
            };

            if (form.id) {
                const updated = await updateCategoryPricingRuleApi(categoryId, form.id, payload);
                setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
                
                // Store addon selections in the map for persistence
                if (ruleAddonIds.length > 0) {
                    setRuleAddonsMap(prev => ({ ...prev, [form.id!]: ruleAddonIds }));
                }
                
                // If rule has a published product, update its addons
                const rule = rules.find(r => r.id === form.id);
                if (rule?.isPublished && rule?.productId && ruleAddonIds.length >= 0) {
                    try {
                        await updateProductFromPricingRuleApi(categoryId, form.id, {
                            addonIds: ruleAddonIds,
                        });
                    } catch (err) {
                        console.warn('Failed to update product addons:', err);
                    }
                }
            } else {
                const created = await createCategoryPricingRuleApi(categoryId, payload);
                setRules((prev) => [...prev, created].sort((a, b) => {
                    // Sort by priority descending, then by id (newest first when priority is same)
                    if (b.priority !== a.priority) {
                        return b.priority - a.priority;
                    }
                    // When priorities are equal, use id comparison (newer IDs typically come later)
                    return b.id.localeCompare(a.id);
                }));
                
                // Store addon selections in the map for the newly created rule
                if (ruleAddonIds.length > 0) {
                    setRuleAddonsMap(prev => ({ ...prev, [created.id]: ruleAddonIds }));
                }
            }

            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save pricing rule');
        } finally {
            setSaving(false);
        }
    };

    const handleEditRule = (rule: CategoryPricingRule) => {
        const existingValues = (rule.specificationValues || {}) as Record<string, any>;
        const nextFilters: Record<string, string> = {};
        Object.entries(existingValues).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                nextFilters[key] = String(value);
            }
        });

        setForm({
            id: rule.id,
            ruleType: rule.ruleType,
            basePrice: rule.ruleType === 'ADDON'
                ? ''
                : rule.basePrice != null
                    ? String(rule.basePrice)
                    : '',
            priceModifier: rule.ruleType === 'SPECIFICATION_COMBINATION'
                ? ''
                : rule.priceModifier != null
                    ? String(rule.priceModifier)
                    : '',
            quantityMultiplier: rule.quantityMultiplier,
            minQuantity:
                (rule.ruleType === 'ADDON' || rule.ruleType === 'QUANTITY_TIER') && rule.minQuantity != null
                    ? String(rule.minQuantity)
                    : '',
            maxQuantity:
                (rule.ruleType === 'ADDON' || rule.ruleType === 'QUANTITY_TIER') && rule.maxQuantity != null
                    ? String(rule.maxQuantity)
                    : '',
            isActive: rule.isActive,
            priority: String(rule.priority ?? 0),
        });
        setSpecFilters(nextFilters);
        
        // Load addons - prioritize map (unsaved changes) over product (saved state)
        // This ensures that if user made changes and cancelled, they're preserved
        const storedAddons = ruleAddonsMap[rule.id];
        
        if (storedAddons && storedAddons.length > 0) {
            // Use stored addons from map (may include unsaved changes)
            setRuleAddonIds(storedAddons);
        } else if (rule.isPublished && rule.productId) {
            // Load product addons if no stored addons
            import('@/lib/api/products.service').then(({ getProduct }) => {
                getProduct(rule.productId!)
                    .then((product: any) => {
                        const productAddons = product.addons || [];
                        const addonIds = productAddons.map((a: any) => a.addonRuleId || a.id);
                        setRuleAddonIds(addonIds);
                        // Also store in map for persistence
                        setRuleAddonsMap(prev => ({ ...prev, [rule.id]: addonIds }));
                    })
                    .catch(() => {
                        // If product not found, clear addons
                        setRuleAddonIds([]);
                        setRuleAddonsMap(prev => {
                            const next = { ...prev };
                            delete next[rule.id];
                            return next;
                        });
                    });
            });
        } else {
            // No stored addons and no product - clear
            setRuleAddonIds([]);
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        const confirmed = await confirm({
            title: 'Delete Pricing Rule',
            description: 'Are you sure you want to delete this pricing rule? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    await toastPromise(
                        deleteCategoryPricingRuleApi(categoryId, ruleId),
                        {
                            loading: 'Deleting pricing rule...',
                            success: 'Pricing rule deleted successfully',
                            error: 'Failed to delete pricing rule',
                        }
                    );
                    setRules((prev) => prev.filter((r) => r.id !== ruleId));
                } catch (err) {
                    // Error handled by toastPromise
                }
            },
        });
    };

    // Get available addons for the category
    const availableAddons = useMemo(() => {
        return rules.filter(rule => rule.ruleType === 'ADDON' && rule.isActive);
    }, [rules]);

    const handlePublishProduct = async (ruleId: string) => {
        const rule = rules.find(r => r.id === ruleId);
        if (!rule) return;
        
        setPublishRuleId(ruleId);
        
        // If product is already published, load its data
        if (rule.isPublished && rule.productId) {
            try {
                const product = await getProduct(rule.productId);
                
                // Load product addons
                const productAddons = (product as any).addons || [];
                const addonIds = productAddons.map((a: any) => a.addonRuleId || a.id);
                setSelectedAddonIds(addonIds);
                // Also update rule addons
                setRuleAddonIds(addonIds);
                
                // Load product data
                setPublishFormData({
                    stock: String(product.stock || 1000),
                    sku: product.sku || '',
                    name: product.name || '',
                    description: product.description || '',
                    shortDescription: product.shortDescription || '',
                });
                
                // Load product images
                if (product.images && product.images.length > 0) {
                    setPublishImages(product.images.map((img: any, index: number) => ({
                        url: img.url,
                        alt: img.alt || undefined,
                        isPrimary: img.isPrimary || index === 0,
                        displayOrder: img.displayOrder || index,
                    })));
                } else {
                    // Fallback to category images
                    const categoryImages = category?.images || [];
                    const initialImages = categoryImages.map((img, index) => ({
                        url: img.url,
                        alt: img.alt || undefined,
                        isPrimary: index === 0,
                        displayOrder: index,
                    }));
                    setPublishImages(initialImages);
                }
            } catch (err) {
                // If product not found, use defaults
                setSelectedAddonIds([]);
                setPublishFormData({
                    stock: '1000',
                    sku: '',
                    name: '',
                    description: '',
                    shortDescription: '',
                });
                const categoryImages = category?.images || [];
                const initialImages = categoryImages.map((img, index) => ({
                    url: img.url,
                    alt: img.alt || undefined,
                    isPrimary: index === 0,
                    displayOrder: index,
                }));
                setPublishImages(initialImages);
            }
        } else {
            // New product - check if this rule has addons stored in the map or is currently being edited
            // Priority: 1) ruleAddonsMap, 2) ruleAddonIds if currently editing this rule, 3) empty
            const storedAddons = ruleAddonsMap[ruleId] || [];
            const currentFormAddons = (form.id === ruleId && ruleAddonIds.length > 0) ? ruleAddonIds : [];
            const addonIdsToUse = storedAddons.length > 0 ? storedAddons : currentFormAddons;
            
            setSelectedAddonIds(addonIdsToUse);
            setPublishFormData({
                stock: '1000',
                sku: '',
                name: '',
                description: '',
                shortDescription: '',
            });
            
            // Initialize with category images (if available)
            const categoryImages = category?.images || [];
            const initialImages = categoryImages.map((img, index) => ({
                url: img.url,
                alt: img.alt || undefined,
                isPrimary: index === 0,
                displayOrder: index,
            }));
            setPublishImages(initialImages);
        }
        
        setPublishModalOpen(true);
    };

    // Filter addons based on the pricing rule's specification values
    const filteredAvailableAddons = useMemo(() => {
        if (!publishRuleId) return availableAddons;
        
        const rule = rules.find(r => r.id === publishRuleId);
        if (!rule) return availableAddons;
        
        const ruleSpecValues = (rule.specificationValues || {}) as Record<string, any>;
        
        // Filter addons that match the rule's specification values
        return availableAddons.filter(addon => {
            const addonSpecValues = (addon.specificationValues || {}) as Record<string, any>;
            
            // Check if addon's specification values match the rule's values
            // If rule has a spec value, addon should either match it or not have that spec
            for (const [specSlug, specValue] of Object.entries(ruleSpecValues)) {
                if (addonSpecValues[specSlug] !== undefined && addonSpecValues[specSlug] !== specValue) {
                    return false; // Addon has different value for this spec
                }
            }
            
            return true;
        });
    }, [availableAddons, publishRuleId, rules]);

    const handlePublishSubmit = async () => {
        if (!publishRuleId) return;

        const rule = rules.find(r => r.id === publishRuleId);
        const isUpdate = rule?.isPublished && rule?.productId;

        try {
            setSaving(true);
            setError(null);
            
            // Use addons from rule form if available, otherwise use selected addons from modal
            const addonIdsToUse = ruleAddonIds.length > 0 ? ruleAddonIds : selectedAddonIds;
            
            const payload = {
                stock: Number(publishFormData.stock) || 1000,
                sku: publishFormData.sku || undefined,
                name: publishFormData.name || undefined,
                description: publishFormData.description || undefined,
                shortDescription: publishFormData.shortDescription || undefined,
                images: publishImages.length > 0 ? publishImages : undefined,
                addonIds: addonIdsToUse,
            };

            if (isUpdate) {
                // Update existing product
                await toastPromise(
                    updateProductFromPricingRuleApi(categoryId, publishRuleId, payload),
                    {
                        loading: 'Updating product...',
                        success: (data: any) => `Product "${data.name}" updated successfully!`,
                        error: 'Failed to update product',
                    }
                );
            } else {
                // Create new product
                await toastPromise(
                    publishPricingRuleAsProductApi(categoryId, publishRuleId, payload),
                    {
                        loading: 'Publishing product...',
                        success: (data: any) => `Product "${data.name}" published successfully!`,
                        error: 'Failed to publish product',
                    }
                );
            }
            
            // Reload rules to get updated isPublished status
            const updatedRules = await getCategoryPricingRulesApi(categoryId);
            setRules(updatedRules);
            setPublishModalOpen(false);
            setPublishRuleId(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to publish/update product');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <>
                {ConfirmDialog}
                <div className="flex min-h-[200px] items-center justify-center">
                    <p className="text-sm text-gray-500">Loading pricing rules...</p>
                </div>
            </>
        );
    }

    if (!category) {
        return (
            <>
                {ConfirmDialog}
                <Alert variant="error">Category not found.</Alert>
            </>
        );
    }

    return (
        <>
            {ConfirmDialog}
            {/* Publish Product Modal */}
            <Dialog open={publishModalOpen} onOpenChange={setPublishModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogClose onClose={() => setPublishModalOpen(false)} />
                    <DialogHeader>
                        <DialogTitle>
                            {publishRuleId && rules.find(r => r.id === publishRuleId)?.isPublished
                                ? 'Edit Product'
                                : 'Publish Product'}
                        </DialogTitle>
                        <DialogDescription>
                            {publishRuleId && rules.find(r => r.id === publishRuleId)?.isPublished
                                ? 'Update product details and addons. Changes will sync with the pricing rule.'
                                : 'Configure product details and select available addons for this product.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="publish-name">Product Name (optional)</Label>
                                <Input
                                    id="publish-name"
                                    value={publishFormData.name}
                                    onChange={(e) => setPublishFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Auto-generated if not provided"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="publish-sku">SKU (optional)</Label>
                                <Input
                                    id="publish-sku"
                                    value={publishFormData.sku}
                                    onChange={(e) => setPublishFormData(prev => ({ ...prev, sku: e.target.value }))}
                                    placeholder="Stock keeping unit"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="publish-stock">Stock</Label>
                            <Input
                                id="publish-stock"
                                type="number"
                                value={publishFormData.stock}
                                onChange={(e) => setPublishFormData(prev => ({ ...prev, stock: e.target.value }))}
                                min="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="publish-description">Description (optional)</Label>
                            <textarea
                                id="publish-description"
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                value={publishFormData.description}
                                onChange={(e) => setPublishFormData(prev => ({ ...prev, description: e.target.value }))}
                                rows={3}
                                placeholder="Product description"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="publish-short-description">Short Description (optional)</Label>
                            <Input
                                id="publish-short-description"
                                value={publishFormData.shortDescription}
                                onChange={(e) => setPublishFormData(prev => ({ ...prev, shortDescription: e.target.value }))}
                                placeholder="Brief description for listings"
                            />
                        </div>
                        

                        {filteredAvailableAddons.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Available Addons</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            const allSelected = filteredAvailableAddons.every(addon => selectedAddonIds.includes(addon.id));
                                            if (allSelected) {
                                                // Deselect all
                                                setSelectedAddonIds(prev => prev.filter(id => !filteredAvailableAddons.some(addon => addon.id === id)));
                                            } else {
                                                // Select all
                                                const addonIdsToAdd = filteredAvailableAddons.map(addon => addon.id);
                                                setSelectedAddonIds(prev => {
                                                    const newIds = [...prev];
                                                    addonIdsToAdd.forEach(id => {
                                                        if (!newIds.includes(id)) {
                                                            newIds.push(id);
                                                        }
                                                    });
                                                    return newIds;
                                                });
                                            }
                                        }}
                                        className="h-7 text-xs"
                                    >
                                        {filteredAvailableAddons.every(addon => selectedAddonIds.includes(addon.id)) ? 'Deselect All' : 'Select All'}
                                    </Button>
                                </div>
                                {filteredAvailableAddons.length < availableAddons.length && (
                                    <p className="text-xs text-blue-600">
                                        Showing {filteredAvailableAddons.length} of {availableAddons.length} addons (filtered by product specifications)
                                    </p>
                                )}
                                <div className="rounded-md border border-gray-200 bg-gray-50/60 p-4 space-y-2 max-h-60 overflow-y-auto">
                                    {filteredAvailableAddons.map((addon) => {
                                        const specValues = (addon.specificationValues || {}) as Record<string, any>;
                                        const specText = Object.entries(specValues)
                                            .map(([key, val]) => {
                                                const spec = specs.find(s => s.slug === key);
                                                if (spec) {
                                                    const option = spec.options.find(o => o.value === val);
                                                    return option ? option.label : val;
                                                }
                                                return val;
                                            })
                                            .join(', ');
                                        const rangeText = addon.minQuantity != null || addon.maxQuantity != null
                                            ? ` (${addon.minQuantity ?? 0}-${addon.maxQuantity ?? '∞'} pages)`
                                            : '';
                                        const priceText = addon.priceModifier != null
                                            ? `₹${Number(addon.priceModifier).toFixed(2)}`
                                            : addon.basePrice != null
                                                ? `₹${Number(addon.basePrice).toFixed(2)}`
                                                : 'Free';
                                        return (
                                            <div key={addon.id} className="flex items-start gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`addon-${addon.id}`}
                                                    checked={selectedAddonIds.includes(addon.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedAddonIds(prev => [...prev, addon.id]);
                                                        } else {
                                                            setSelectedAddonIds(prev => prev.filter(id => id !== addon.id));
                                                        }
                                                    }}
                                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <label htmlFor={`addon-${addon.id}`} className="flex-1 text-sm cursor-pointer">
                                                    <div className="font-medium text-gray-900">
                                                        {priceText}
                                                        {rangeText}
                                                    </div>
                                                    {specText && (
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            {specText}
                                                        </div>
                                                    )}
                                                </label>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-gray-500">
                                    Select which addons should be available for this product.
                                </p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setPublishModalOpen(false)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handlePublishSubmit}
                            isLoading={saving}
                            disabled={saving}
                        >
                            {publishRuleId && rules.find(r => r.id === publishRuleId)?.isPublished
                                ? 'Update Product'
                                : 'Publish Product'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Pricing Rules - {category.name}
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Configure how prices are calculated for this category based on specifications and
                        quantity.
                    </p>
                </div>

                {error && <Alert variant="error">{error}</Alert>}

                <div className="grid gap-6 md:grid-cols-3">
                    {/* Rule form */}
                    <div className="md:col-span-1">
                        <Card>
                            <CardHeader>
                                <CardTitle>{form.id ? 'Edit Pricing Rule' : 'Add Pricing Rule'}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="rule-type">Rule Type</Label>
                                        <select
                                            id="rule-type"
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                            value={form.ruleType}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    ruleType: e.target.value as PricingRuleType,
                                                }))
                                            }
                                        >
                                            {RULE_TYPES.map((t) => (
                                                <option key={t.value} value={t.value}>
                                                    {t.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {specs.length > 0 && (
                                        <div className="space-y-2">
                                            <Label>When these selections match (optional)</Label>
                                            <div className="space-y-2 rounded-md border border-gray-100 bg-gray-50/60 p-3">
                                                {specs
                                                    .slice()
                                                    .sort((a, b) => a.displayOrder - b.displayOrder)
                                                    .map((spec) => {
                                                        // Check if this spec depends on another
                                                        const dependsOn = spec.dependsOn as { specificationSlug?: string } | null;
                                                        const parentSlug = dependsOn?.specificationSlug;
                                                        
                                                        // Check if parent spec is selected
                                                        const isVisible = !parentSlug || specFilters[parentSlug];
                                                        
                                                        // Get available options based on parent selection
                                                        let availableOptions = spec.options;
                                                        if (parentSlug && specFilters[parentSlug]) {
                                                            // Filter options based on parent value
                                                            const parentValue = specFilters[parentSlug];
                                                            availableOptions = spec.options.filter((opt) => {
                                                                const metadata = opt.metadata as { allowedParentValues?: string[] } | null;
                                                                if (!metadata?.allowedParentValues || metadata.allowedParentValues.length === 0) {
                                                                    // If no restrictions, show all options
                                                                    return true;
                                                                }
                                                                // Only show options that allow this parent value
                                                                return metadata.allowedParentValues.includes(parentValue);
                                                            });
                                                        }
                                                        
                                                        // Clear dependent spec filters when parent changes
                                                        const handleChange = (value: string) => {
                                                            setSpecFilters((prev) => {
                                                                const next = { ...prev };
                                                                if (!value) {
                                                                    delete next[spec.slug];
                                                                } else {
                                                                    next[spec.slug] = value;
                                                                }
                                                                
                                                                // Clear all dependent spec filters when parent changes
                                                                const dependentSpecs = specs.filter((s) => {
                                                                    const sDependsOn = s.dependsOn as { specificationSlug?: string } | null;
                                                                    return sDependsOn?.specificationSlug === spec.slug;
                                                                });
                                                                dependentSpecs.forEach((depSpec) => {
                                                                    delete next[depSpec.slug];
                                                                });
                                                                
                                                                return next;
                                                            });
                                                        };
                                                        
                                                        if (!isVisible) {
                                                            return null;
                                                        }
                                                        
                                                        return (
                                                            <div
                                                                key={spec.id}
                                                                className="grid items-center gap-2 md:grid-cols-[1.2fr,minmax(0,1fr)]"
                                                            >
                                                                <div className="text-xs font-medium text-gray-700 md:text-sm">
                                                                    {spec.name}{' '}
                                                                    <span className="text-[11px] font-normal text-gray-400">
                                                                        ({spec.slug})
                                                                    </span>
                                                                    {parentSlug && (
                                                                        <span className="text-[10px] text-blue-600 ml-1">
                                                                            (depends on {specs.find(s => s.slug === parentSlug)?.name || parentSlug})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <select
                                                                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                                    value={specFilters[spec.slug] ?? ''}
                                                                    onChange={(e) => handleChange(e.target.value)}
                                                                    disabled={!!(parentSlug && !specFilters[parentSlug])}
                                                                >
                                                                    <option value="">Any</option>
                                                                    {availableOptions.map((opt) => (
                                                                        <option key={opt.id} value={opt.value}>
                                                                            {opt.label} ({opt.value})
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                            <p className="text-[11px] text-gray-400">
                                                Leave a field as “Any” to not restrict this rule by that specification.
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="base-price">Base Price (₹)</Label>
                                            <Input
                                                id="base-price"
                                                type="number"
                                                step="0.01"
                                                value={form.basePrice}
                                                disabled={form.ruleType === 'ADDON'}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        basePrice: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="price-modifier">Price Modifier (₹)</Label>
                                            <Input
                                                id="price-modifier"
                                                type="number"
                                                step="0.01"
                                                value={form.priceModifier}
                                                disabled={form.ruleType === 'SPECIFICATION_COMBINATION'}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        priceModifier: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="min-qty">Min Quantity</Label>
                                            <Input
                                                id="min-qty"
                                                type="number"
                                                value={form.minQuantity}
                                                disabled={
                                                    !(
                                                        form.ruleType === 'ADDON' ||
                                                        form.ruleType === 'QUANTITY_TIER'
                                                    )
                                                }
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        minQuantity: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="max-qty">Max Quantity</Label>
                                            <Input
                                                id="max-qty"
                                                type="number"
                                                value={form.maxQuantity}
                                                disabled={
                                                    !(
                                                        form.ruleType === 'ADDON' ||
                                                        form.ruleType === 'QUANTITY_TIER'
                                                    )
                                                }
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        maxQuantity: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="priority">Priority</Label>
                                            <Input
                                                id="priority"
                                                type="number"
                                                value={form.priority}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        priority: e.target.value,
                                                    }))
                                                }
                                            />
                                        </div>
                                        <div className="flex flex-col justify-end gap-2">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    id="qty-multiplier"
                                                    type="checkbox"
                                                    checked={form.quantityMultiplier}
                                                    onChange={(e) =>
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            quantityMultiplier: e.target.checked,
                                                        }))
                                                    }
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <Label htmlFor="qty-multiplier">Multiply by quantity</Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    id="is-active"
                                                    type="checkbox"
                                                    checked={form.isActive}
                                                    onChange={(e) =>
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            isActive: e.target.checked,
                                                        }))
                                                    }
                                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <Label htmlFor="is-active">Active</Label>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Addon Selection (only for rules with published products or when creating new rule) */}
                                    {form.ruleType !== 'ADDON' && (form.id ? rules.find(r => r.id === form.id)?.isPublished : true) && availableAddons.length > 0 && (
                                        <div className="space-y-2 border-t pt-4">
                                            <Label>Product Addons (when published)</Label>
                                            <p className="text-xs text-gray-500 mb-2">
                                                Select which addons should be available for products published from this pricing rule.
                                            </p>
                                            <div className="rounded-md border border-gray-200 bg-gray-50/60 p-4 space-y-2 max-h-60 overflow-y-auto">
                                                {availableAddons.map((addon) => {
                                                    const specValues = (addon.specificationValues || {}) as Record<string, any>;
                                                    const specText = Object.entries(specValues)
                                                        .map(([key, val]) => {
                                                            const spec = specs.find(s => s.slug === key);
                                                            if (spec) {
                                                                const option = spec.options.find(o => o.value === val);
                                                                return option ? option.label : val;
                                                            }
                                                            return val;
                                                        })
                                                        .join(', ');
                                                    const rangeText = addon.minQuantity != null || addon.maxQuantity != null
                                                        ? ` (${addon.minQuantity ?? 0}-${addon.maxQuantity ?? '∞'} pages)`
                                                        : '';
                                                    const priceText = addon.priceModifier != null
                                                        ? `₹${Number(addon.priceModifier).toFixed(2)}`
                                                        : addon.basePrice != null
                                                            ? `₹${Number(addon.basePrice).toFixed(2)}`
                                                            : 'Free';
                                                    return (
                                                        <div key={addon.id} className="flex items-start gap-2">
                                                            <input
                                                                type="checkbox"
                                                                id={`rule-addon-${addon.id}`}
                                                                checked={ruleAddonIds.includes(addon.id)}
                                                                onChange={(e) => {
                                                                    const newAddonIds = e.target.checked
                                                                        ? [...ruleAddonIds, addon.id]
                                                                        : ruleAddonIds.filter(id => id !== addon.id);
                                                                    setRuleAddonIds(newAddonIds);
                                                                    // Also update the map for persistence immediately
                                                                    // This ensures state persists even if user cancels and re-edits
                                                                    if (form.id) {
                                                                        setRuleAddonsMap(prev => ({ ...prev, [form.id!]: newAddonIds }));
                                                                    } else {
                                                                        // For new rules, we'll store them when the rule is saved
                                                                        // But we can also store them temporarily in a pending state
                                                                    }
                                                                }}
                                                                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <label htmlFor={`rule-addon-${addon.id}`} className="flex-1 text-sm cursor-pointer">
                                                                <div className="font-medium text-gray-900">
                                                                    {addon.ruleType === 'ADDON' ? 'Addon' : addon.ruleType}
                                                                    {specText && (
                                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                                            {specText}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-gray-600 mt-1">
                                                                    {priceText}{rangeText}
                                                                </div>
                                                            </label>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-2">
                                        {form.id && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={resetForm}
                                                disabled={saving}
                                            >
                                                Cancel edit
                                            </Button>
                                        )}
                                        <Button type="submit" isLoading={saving}>
                                            {form.id ? 'Update Rule' : 'Add Rule'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>


                    {/* Rules list */}
                    <div className="md:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Existing Rules ({rules.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {rules.length === 0 ? (
                                    <p className="text-sm text-gray-500 py-8 text-center">
                                        No pricing rules yet. Add rules to define how prices are calculated.
                                    </p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b-2 border-gray-300 bg-gray-50">
                                                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Type</th>
                                                    {/* Dynamic specification columns */}
                                                    {specs.length > 0 && specs.map((spec) => (
                                                        <th key={spec.id} className="text-left py-3 px-2 font-semibold text-gray-700 text-xs min-w-[100px]">
                                                            <div className="font-medium">{spec.name}</div>
                                                            <div className="text-[10px] font-normal text-gray-500 mt-0.5">{spec.slug}</div>
                                                        </th>
                                                    ))}
                                                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Price</th>
                                                    <th className="text-left py-3 px-3 font-semibold text-gray-700">Qty Range</th>
                                                    <th className="text-center py-3 px-3 font-semibold text-gray-700">Priority</th>
                                                    <th className="text-center py-3 px-3 font-semibold text-gray-700">Status</th>
                                                    <th className="text-center py-3 px-3 font-semibold text-gray-700">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rules
                                                    .slice()
                                                    .sort((a, b) => {
                                                        // Sort by priority descending, then by id (newest first when priority is same)
                                                        if (b.priority !== a.priority) {
                                                            return b.priority - a.priority;
                                                        }
                                                        // When priorities are equal, use id comparison (newer IDs typically come later)
                                                        return b.id.localeCompare(a.id);
                                                    })
                                                    .map((rule) => {
                                                        const specEntries = Object.entries(rule.specificationValues || {});
                                                        const specValuesMap = new Map(specEntries);

                                                        return (
                                                            <tr
                                                                key={rule.id}
                                                                className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors"
                                                            >
                                                                {/* Rule Type */}
                                                                <td className="py-3 px-3 align-top">
                                                                    <div className="font-medium text-gray-900 text-[10px]">
                                                                        {RULE_TYPES.find(t => t.value === rule.ruleType)?.label || rule.ruleType}
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-400 mt-1">
                                                                        {rule.quantityMultiplier ? '× Qty' : 'Fixed'}
                                                                    </div>
                                                                </td>

                                                                {/* Dynamic specification cells - show value or "Any" */}
                                                                {specs.map((spec) => {
                                                                    const value = specValuesMap.get(spec.slug);
                                                                    const option = value ? spec.options.find((o) => o.value === value) : null;
                                                                    const hasValue = value !== undefined && value !== null;

                                                                    return (
                                                                        <td key={spec.id} className="py-3 px-2 align-top">
                                                                            {hasValue && option ? (
                                                                                <div className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-medium border border-blue-300 max-w-full">
                                                                                    <span className="truncate" title={option.label}>
                                                                                        {option.label}
                                                                                    </span>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-xs text-gray-400 italic">Any</span>
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}

                                                                {/* Price */}
                                                                <td className="py-3 px-3 align-top">
                                                                    <div className="space-y-0.5">
                                                                        {rule.basePrice != null && (
                                                                            <div className="text-gray-900 font-semibold text-sm">
                                                                                ₹{Number(rule.basePrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                            </div>
                                                                        )}
                                                                        {rule.priceModifier != null && rule.priceModifier !== 0 && (
                                                                            <div className="text-xs text-gray-600">
                                                                                {rule.priceModifier >= 0 ? '+' : ''}₹{Number(rule.priceModifier).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                            </div>
                                                                        )}
                                                                        {rule.basePrice == null && rule.priceModifier == null && (
                                                                            <span className="text-xs text-gray-400">-</span>
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                {/* Quantity */}
                                                                <td className="py-3 px-3 align-top">
                                                                    {rule.minQuantity != null || rule.maxQuantity != null ? (
                                                                        <div className="text-gray-700 text-xs font-medium">
                                                                            {rule.minQuantity ?? '0'} - {rule.maxQuantity ?? '∞'}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-400">Any</span>
                                                                    )}
                                                                </td>

                                                                {/* Priority */}
                                                                <td className="py-3 px-3 text-center align-top">
                                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-800 font-bold text-xs">
                                                                        {rule.priority ?? 0}
                                                                    </span>
                                                                </td>

                                                                {/* Status */}
                                                                <td className="py-3 px-3 align-top">
                                                                    <div className="flex flex-col items-center gap-1.5">
                                                                        {rule.isActive ? (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-medium border border-green-200">
                                                                                <CheckCircle2 className="h-3 w-3" />
                                                                                Active
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-medium border border-red-200">
                                                                                <XCircle className="h-3 w-3" />
                                                                                Inactive
                                                                            </span>
                                                                        )}
                                                                        {rule.isPublished && (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-medium border border-purple-200">
                                                                                <Package className="h-3 w-3" />
                                                                                Published
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                {/* Actions */}
                                                                <td className="py-3 px-3">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => handleEditRule(rule)}
                                                                            className="h-8 w-8 p-0"
                                                                            title="Edit rule"
                                                                        >
                                                                            <Edit2 className="h-4 w-4 text-blue-600" />
                                                                        </Button>
                                                                        {!rule.isPublished && rule.basePrice && (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                onClick={() => handlePublishProduct(rule.id)}
                                                                                className="h-8 w-8 p-0"
                                                                                title="Publish as product"
                                                                            >
                                                                                <Upload className="h-4 w-4 text-green-600" />
                                                                            </Button>
                                                                        )}
                                                                        {rule.isPublished && rule.productId && (
                                                                            <>
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="ghost"
                                                                                    onClick={async () => {
                                                                                        try {
                                                                                            await toastPromise(
                                                                                                syncProductFromCategoryApi(categoryId, rule.id),
                                                                                                {
                                                                                                    loading: 'Syncing product...',
                                                                                                    success: () => `Product synced successfully`,
                                                                                                    error: (err) => err.message || 'Failed to sync product',
                                                                                                }
                                                                                            );
                                                                                            // Reload rules to show updated data
                                                                                            loadRules();
                                                                                        } catch (err) {
                                                                                            // Error handled by toast
                                                                                        }
                                                                                    }}
                                                                                    className="h-8 w-8 p-0"
                                                                                    title="Sync product with category updates"
                                                                                >
                                                                                    <RefreshCw className="h-4 w-4 text-blue-600" />
                                                                                </Button>
                                                                                <Link
                                                                                    href={`/products/${rule.productId}`}
                                                                                    className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-gray-100 transition-colors"
                                                                                    title="View product"
                                                                                >
                                                                                    <ExternalLink className="h-4 w-4 text-purple-600" />
                                                                                </Link>
                                                                            </>
                                                                        )}
                                                                        <Button
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            onClick={() => handleDeleteRule(rule.id)}
                                                                            className="h-8 w-8 p-0"
                                                                            title="Delete rule"
                                                                        >
                                                                            <Trash2 className="h-4 w-4 text-red-600" />
                                                                        </Button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}
