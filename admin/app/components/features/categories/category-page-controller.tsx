'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Alert } from '@/app/components/ui/alert';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { toastSuccess } from '@/lib/utils/toast';
import {
    getCategorySpecificationsApi,
    type CategorySpecification,
} from '@/lib/api/categories.service';
import {
    getCategoryPageControllerRules,
    createCategoryPageControllerRule,
    updateCategoryPageControllerRule,
    deleteCategoryPageControllerRule,
    getCategoryPageControllerSettings,
    updateCategoryPageControllerSettings,
    type CategoryPageControllerRule,
} from '@/lib/api/categoryPageController.service';

interface CategoryPageControllerProps {
    categoryId: string;
}

export function CategoryPageController({ categoryId }: CategoryPageControllerProps) {
    const [rules, setRules] = useState<CategoryPageControllerRule[]>([]);
    const [specs, setSpecs] = useState<CategorySpecification[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [settingsForm, setSettingsForm] = useState({
        showBulkToggle: true,
        bulkToggleLabel: 'Do you need in bulks?',
        copiesLabel: 'Number of Quantity/Copies',
    });
    const { confirm, ConfirmDialog } = useConfirm();

    const [form, setForm] = useState({
        specificationSlug: '',
        optionValue: '',
        maxPages: 1,
        displayOrder: 0,
        isActive: true,
        independent: false,
    });

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                setError(null);
                const [nextRules, nextSpecs] = await Promise.all([
                    getCategoryPageControllerRules(categoryId),
                    getCategorySpecificationsApi(categoryId),
                ]);
                setRules(nextRules);
                setSpecs(nextSpecs);
                const nextSettings = await getCategoryPageControllerSettings(categoryId);
                setSettingsForm(nextSettings);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load page controller data');
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [categoryId]);

    const availableOptions = useMemo(() => {
        if (form.independent || !form.specificationSlug) return [];
        const spec = specs.find((s) => s.slug === form.specificationSlug);
        return (spec?.options || []).filter((o) => o.isActive);
    }, [form.independent, form.specificationSlug, specs]);

    const eligibleSpecs = useMemo(() => {
        return specs.filter((s) => {
            const normalizedType = String(s.type || '').toUpperCase();
            const isSelectableType = normalizedType === 'SELECT' || normalizedType === 'MULTI_SELECT';
            return isSelectableType && (s.options?.length || 0) > 0;
        });
    }, [specs]);

    const resetForm = () => {
        setEditingId(null);
        setForm({
            specificationSlug: '',
            optionValue: '',
            maxPages: 1,
            displayOrder: rules.length,
            isActive: true,
            independent: false,
        });
    };

    const startEdit = (rule: CategoryPageControllerRule) => {
        setEditingId(rule.id);
        setForm({
            specificationSlug: rule.specificationSlug || '',
            optionValue: rule.optionValue || '',
            maxPages: rule.maxPages,
            displayOrder: rule.displayOrder,
            isActive: rule.isActive,
            independent: !rule.specificationSlug && !rule.optionValue,
        });
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            setSaving(true);
            setError(null);

            const payload = {
                specificationSlug: form.independent ? null : form.specificationSlug || null,
                optionValue: form.independent ? null : form.optionValue || null,
                maxPages: form.maxPages,
                displayOrder: form.displayOrder,
                isActive: form.isActive,
            };

            if (editingId) {
                const updated = await updateCategoryPageControllerRule(categoryId, editingId, payload);
                setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
                toastSuccess('Page controller rule updated');
            } else {
                const created = await createCategoryPageControllerRule(categoryId, payload);
                setRules((prev) => [...prev, created]);
                toastSuccess('Page controller rule created');
            }

            resetForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save rule');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (ruleId: string) => {
        const approved = await confirm({
            title: 'Delete Rule',
            description: 'Are you sure you want to delete this rule?',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    await deleteCategoryPageControllerRule(categoryId, ruleId);
                    setRules((prev) => prev.filter((r) => r.id !== ruleId));
                    toastSuccess('Page controller rule deleted');
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed to delete rule');
                }
            },
        });
        if (!approved) return;
    };

    const handleSettingsSave = async (e: FormEvent) => {
        e.preventDefault();
        try {
            setSettingsSaving(true);
            setError(null);
            const updated = await updateCategoryPageControllerSettings(categoryId, settingsForm);
            setSettingsForm(updated);
            toastSuccess('Page controller settings updated');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update settings');
        } finally {
            setSettingsSaving(false);
        }
    };

    if (loading) {
        return <div className="text-sm text-gray-500">Loading page controller...</div>;
    }

    return (
        <div className="space-y-6">
            {ConfirmDialog}

            {error && <Alert variant="error">{error}</Alert>}

            <Card>
                <CardHeader>
                    <CardTitle>Page Controller Rules</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2 flex items-center gap-2">
                            <input
                                id="independent"
                                type="checkbox"
                                checked={form.independent}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        independent: e.target.checked,
                                        specificationSlug: e.target.checked ? '' : prev.specificationSlug,
                                        optionValue: e.target.checked ? '' : prev.optionValue,
                                    }))
                                }
                            />
                            <Label htmlFor="independent">Independent rule (no spec dependency)</Label>
                        </div>

                        {!form.independent && (
                            <>
                                <div>
                                    <Label htmlFor="spec">Specification</Label>
                                    <select
                                        id="spec"
                                        className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                                        value={form.specificationSlug}
                                        onChange={(e) =>
                                            setForm((prev) => ({ ...prev, specificationSlug: e.target.value, optionValue: '' }))
                                        }
                                        required
                                    >
                                        <option value="">Select specification</option>
                                        {eligibleSpecs.map((spec) => (
                                            <option key={spec.id} value={spec.slug}>
                                                {spec.name}
                                            </option>
                                        ))}
                                    </select>
                                    {eligibleSpecs.length === 0 && (
                                        <p className="mt-1 text-xs text-amber-700">
                                            No selectable specifications found. Add options to a SELECT or MULTI_SELECT specification first.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="option">Option</Label>
                                    <select
                                        id="option"
                                        className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                                        value={form.optionValue}
                                        onChange={(e) => setForm((prev) => ({ ...prev, optionValue: e.target.value }))}
                                        required
                                    >
                                        <option value="">Select option</option>
                                        {availableOptions.map((opt) => (
                                            <option key={opt.id} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        )}

                        <div>
                            <Label htmlFor="maxPages">Max Pages</Label>
                            <Input
                                id="maxPages"
                                type="number"
                                min={1}
                                value={form.maxPages}
                                onChange={(e) => setForm((prev) => ({ ...prev, maxPages: Number(e.target.value) || 1 }))}
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="displayOrder">Display Order</Label>
                            <Input
                                id="displayOrder"
                                type="number"
                                value={form.displayOrder}
                                onChange={(e) => setForm((prev) => ({ ...prev, displayOrder: Number(e.target.value) || 0 }))}
                            />
                        </div>

                        <div className="md:col-span-2 flex items-center gap-2">
                            <input
                                id="isActive"
                                type="checkbox"
                                checked={form.isActive}
                                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                            />
                            <Label htmlFor="isActive">Active</Label>
                        </div>

                        <div className="md:col-span-2 flex gap-2 justify-end">
                            {editingId && (
                                <Button type="button" variant="outline" onClick={resetForm}>
                                    Cancel
                                </Button>
                            )}
                            <Button type="submit" isLoading={saving}>
                                {editingId ? 'Update Rule' : 'Create Rule'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Page Controller UI Settings</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSettingsSave} className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2 flex items-center gap-2">
                            <input
                                id="showBulkToggle"
                                type="checkbox"
                                checked={settingsForm.showBulkToggle}
                                onChange={(e) =>
                                    setSettingsForm((prev) => ({ ...prev, showBulkToggle: e.target.checked }))
                                }
                            />
                            <Label htmlFor="showBulkToggle">Show bulk/copies toggle in web selector</Label>
                        </div>
                        <div>
                            <Label htmlFor="bulkToggleLabel">Bulk Toggle Label</Label>
                            <Input
                                id="bulkToggleLabel"
                                value={settingsForm.bulkToggleLabel}
                                onChange={(e) =>
                                    setSettingsForm((prev) => ({ ...prev, bulkToggleLabel: e.target.value }))
                                }
                                placeholder="Do you need in bulks?"
                            />
                        </div>
                        <div>
                            <Label htmlFor="copiesLabel">Copies Input Label</Label>
                            <Input
                                id="copiesLabel"
                                value={settingsForm.copiesLabel}
                                onChange={(e) =>
                                    setSettingsForm((prev) => ({ ...prev, copiesLabel: e.target.value }))
                                }
                                placeholder="Number of Quantity/Copies"
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                            <Button type="submit" isLoading={settingsSaving}>
                                Save UI Settings
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Existing Rules</CardTitle>
                </CardHeader>
                <CardContent>
                    {rules.length === 0 ? (
                        <p className="text-sm text-gray-500">No rules configured.</p>
                    ) : (
                        <div className="space-y-3">
                            {rules.map((rule) => (
                                <div key={rule.id} className="rounded-md border p-3 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">
                                            {!rule.specificationSlug
                                                ? 'Independent rule'
                                                : `${rule.specificationSlug}: ${rule.optionValue}`}
                                        </p>
                                        <p className="text-xs text-gray-600">
                                            maxPages={rule.maxPages}, order={rule.displayOrder}, active={String(rule.isActive)}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => startEdit(rule)}>
                                            Edit
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => void handleDelete(rule.id)}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
