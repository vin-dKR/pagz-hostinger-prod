'use client';

/**
 * Category Pricing Rules Management
 */

import { useEffect, useState, FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import {
    getCategoryById,
    getCategoryPricingRulesApi,
    createCategoryPricingRuleApi,
    updateCategoryPricingRuleApi,
    deleteCategoryPricingRuleApi,
    getCategorySpecificationsApi,
    publishPricingRuleAsProductApi,
    type Category,
    type CategoryPricingRule,
    type PricingRuleType,
    type CategorySpecification,
} from '@/lib/api/categories.service';
import { Package, ExternalLink, Edit2, Trash2, Upload, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { toastPromise } from '@/lib/utils/toast';

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

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                setError(null);
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
            } finally {
                setLoading(false);
            }
        }

        void load();
    }, [categoryId]);

    const resetForm = () => {
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
            } else {
                const created = await createCategoryPricingRuleApi(categoryId, payload);
                setRules((prev) => [...prev, created].sort((a, b) => b.priority - a.priority));
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

    const handlePublishProduct = async (ruleId: string) => {
        const confirmed = await confirm({
            title: 'Publish Product',
            description: 'Publish this pricing rule as a product? You can set stock and other details after publishing.',
            confirmText: 'Publish',
            cancelText: 'Cancel',
            variant: 'default',
            onConfirm: async () => {
                try {
                    setSaving(true);
                    setError(null);
                    // For now, publish with default values. In a full implementation, you'd show a modal/form
                    const product = await toastPromise(
                        publishPricingRuleAsProductApi(categoryId, ruleId, {
                            stock: 0, // Admin can update this later
                        }),
                        {
                            loading: 'Publishing product...',
                            success: (data) => `Product "${data.name}" published successfully!`,
                            error: 'Failed to publish product',
                        }
                    );
                    // Reload rules to get updated isPublished status
                    const updatedRules = await getCategoryPricingRulesApi(categoryId);
                    setRules(updatedRules);
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to publish product');
                } finally {
                    setSaving(false);
                }
            },
        });
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
                                                {specs.map((spec) => (
                                                    <div
                                                        key={spec.id}
                                                        className="grid items-center gap-2 md:grid-cols-[1.2fr,minmax(0,1fr)]"
                                                    >
                                                        <div className="text-xs font-medium text-gray-700 md:text-sm">
                                                            {spec.name}{' '}
                                                            <span className="text-[11px] font-normal text-gray-400">
                                                                ({spec.slug})
                                                            </span>
                                                        </div>
                                                        <select
                                                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                            value={specFilters[spec.slug] ?? ''}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setSpecFilters((prev) => {
                                                                    const next = { ...prev };
                                                                    if (!value) {
                                                                        delete next[spec.slug];
                                                                    } else {
                                                                        next[spec.slug] = value;
                                                                    }
                                                                    return next;
                                                                });
                                                            }}
                                                        >
                                                            <option value="">Any</option>
                                                            {spec.options.map((opt) => (
                                                                <option key={opt.id} value={opt.value}>
                                                                    {opt.label} ({opt.value})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ))}
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
                                                    .sort((a, b) => b.priority - a.priority)
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
                                                                            <Link
                                                                                href={`/products/${rule.productId}`}
                                                                                className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-gray-100 transition-colors"
                                                                                title="View product"
                                                                            >
                                                                                <ExternalLink className="h-4 w-4 text-purple-600" />
                                                                            </Link>
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
