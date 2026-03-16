'use client';

/**
 * Category Page Controller Management
 * Manages page upload limits based on specification selections
 */

import { useEffect, useState, FormEvent, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import {
    getCategoryById,
    getCategorySpecificationsApi,
    type CategorySpecification, 
} from '@/lib/api/categories.service';
import {
    getCategoryPageControllerRules,
    createCategoryPageControllerRule,
    updateCategoryPageControllerRule,
    deleteCategoryPageControllerRule,
    type CategoryPageControllerRule,
} from '@/lib/api/categoryPageController.service';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { toastSuccess } from '@/lib/utils/toast';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface CategoryPageControllerProps {
    categoryId: string;
}

export function CategoryPageController({ categoryId }: CategoryPageControllerProps) {
    const [specifications, setSpecifications] = useState<CategorySpecification[]>([]);
    const [rules, setRules] = useState<CategoryPageControllerRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { confirm, ConfirmDialog } = useConfirm();

    // Rule form state
    const [ruleModalOpen, setRuleModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<CategoryPageControllerRule | null>(null);
    const [savingRule, setSavingRule] = useState(false);
    const [isIndependentRule, setIsIndependentRule] = useState(false);
    const [selectedSpecSlug, setSelectedSpecSlug] = useState<string>('');
    const [ruleForm, setRuleForm] = useState<{
        specificationSlug: string;
        optionValue: string;
        maxPages: number;
        displayOrder: number;
        isActive: boolean;
    }>({
        specificationSlug: '',
        optionValue: '',
        maxPages: 1,
        displayOrder: 0,
        isActive: true,
    });

    // Get available options for selected specification
    const availableOptions = useMemo(() => {
        if (!selectedSpecSlug || isIndependentRule) {
            return [];
        }
        const spec = specifications.find((s) => s.slug === selectedSpecSlug);
        return spec?.options?.filter((opt) => opt.isActive) || [];
    }, [selectedSpecSlug, specifications, isIndependentRule]);

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categoryId]);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [, specs, pageRules] = await Promise.all([
                getCategoryById(categoryId),
                getCategorySpecificationsApi(categoryId),
                getCategoryPageControllerRules(categoryId),
            ]);
            setSpecifications(specs);
            setRules(pageRules);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load page controller rules');
        } finally {
            setLoading(false);
        }
    };

    const resetRuleForm = () => {
        setRuleForm({
            specificationSlug: '',
            optionValue: '',
            maxPages: 1,
            displayOrder: rules.length,
            isActive: true,
        });
        setIsIndependentRule(false);
        setSelectedSpecSlug('');
        setEditingRule(null);
    };

    const openRuleModal = (rule?: CategoryPageControllerRule) => {
        if (rule) {
            setEditingRule(rule);
            const isIndep = !rule.specificationSlug && !rule.optionValue;
            setIsIndependentRule(isIndep);
            setSelectedSpecSlug(rule.specificationSlug || '');
            setRuleForm({
                specificationSlug: rule.specificationSlug || '',
                optionValue: rule.optionValue || '',
                maxPages: rule.maxPages,
                displayOrder: rule.displayOrder,
                isActive: rule.isActive,
            });
        } else {
            resetRuleForm();
        }
        setRuleModalOpen(true);
    };

    const handleSaveRule = async (e: FormEvent) => {
        e.preventDefault();
        try {
            setSavingRule(true);
            setError(null);

            const ruleData = {
                specificationSlug: isIndependentRule ? null : ruleForm.specificationSlug || null,
                optionValue: isIndependentRule ? null : ruleForm.optionValue || null,
                maxPages: ruleForm.maxPages,
                displayOrder: ruleForm.displayOrder,
                isActive: ruleForm.isActive,
            };

            if (editingRule) {
                const updated = await updateCategoryPageControllerRule(
                    categoryId,
                    editingRule.id,
                    ruleData
                );
                setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
                toastSuccess('Page controller rule updated successfully');
            } else {
                const created = await createCategoryPageControllerRule(categoryId, ruleData);
                setRules((prev) => [...prev, created]);
                toastSuccess('Page controller rule created successfully');
            }

            setRuleModalOpen(false);
            resetRuleForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save rule');
        } finally {
            setSavingRule(false);
        }
    };

    const handleDeleteRule = async (ruleId: string) => {
        const confirmed = await confirm({
            title: 'Delete Page Controller Rule',
            description: 'Are you sure you want to delete this rule? This action cannot be undone.',
            onConfirm: async () => {
                await deleteCategoryPageControllerRule(categoryId, ruleId);
                setRules((prev) => prev.filter((r) => r.id !== ruleId));
                toastSuccess('Page controller rule deleted successfully');
            },
        });

        if (!confirmed) return;

        try {
            setError(null);
            await deleteCategoryPageControllerRule(categoryId, ruleId);
            setRules((prev) => prev.filter((r) => r.id !== ruleId));
            toastSuccess('Page controller rule deleted successfully');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete rule');
        }
    };

    const handleIndependentRuleToggle = (checked: boolean) => {
        setIsIndependentRule(checked);
        if (checked) {
            setSelectedSpecSlug('');
            setRuleForm((prev) => ({
                ...prev,
                specificationSlug: '',
                optionValue: '',
            }));
        }
    };

    const handleSpecificationChange = (slug: string) => {
        setSelectedSpecSlug(slug);
        setRuleForm((prev) => ({
            ...prev,
            specificationSlug: slug,
            optionValue: '', // Reset option when spec changes
        }));
    };

    // Get specification name by slug
    const getSpecificationName = (slug: string | null): string => {
        if (!slug) return 'Independent Rule';
        const spec = specifications.find((s) => s.slug === slug);
        return spec?.name || slug;
    };

    // Get option label by value
    const getOptionLabel = (specSlug: string | null, optionValue: string | null): string => {
        if (!specSlug || !optionValue) return 'N/A';
        const spec = specifications.find((s) => s.slug === specSlug);
        const option = spec?.options?.find((opt) => opt.value === optionValue);
        return option?.label || optionValue;
    };

    if (loading) {
        return (
            <div className="flex min-h-[200px] items-center justify-center">
                <p className="text-sm text-gray-500">Loading page controller rules...</p>
            </div>
        );
    }

    // Filter SELECT type specifications for dropdown
    const selectSpecifications = specifications.filter((spec) => spec.type === 'SELECT');

    return (
        <div className="space-y-6">
            {ConfirmDialog}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Page Controller Rules</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Configure page upload limits based on specification selections. Rules are optional - categories without rules work normally.
                    </p>
                </div>
                <Button onClick={() => openRuleModal()} className="flex items-center gap-2">
                    <Plus size={18} />
                    Create Rule
                </Button>
            </div>

            {error && (
                <Alert variant="error">
                    {error}
                </Alert>
            )}

            {/* Rules List */}
            {rules.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-gray-500">No page controller rules configured.</p>
                        <p className="mt-2 text-sm text-gray-400">
                            Create a rule to enforce page limits based on specification selections.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Rules ({rules.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {rules.map((rule) => (
                                <div
                                    key={rule.id}
                                    className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900">
                                                {!rule.specificationSlug && !rule.optionValue
                                                    ? 'Independent Rule'
                                                    : `${getSpecificationName(rule.specificationSlug)}: ${getOptionLabel(rule.specificationSlug, rule.optionValue)}`}
                                            </span>
                                            {!rule.isActive && (
                                                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-sm text-gray-600">
                                            Maximum {rule.maxPages} page{rule.maxPages !== 1 ? 's' : ''} allowed
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openRuleModal(rule)}
                                        >
                                            <Edit size={16} />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDeleteRule(rule.id)}
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Rule Form Modal */}
            <Dialog open={ruleModalOpen} onOpenChange={setRuleModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingRule ? 'Edit Page Controller Rule' : 'Create Page Controller Rule'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSaveRule} className="space-y-6">
                        {/* Independent Rule Toggle */}
                        <div className="flex items-center gap-2">
                            <input
                                id="independentRule"
                                type="checkbox"
                                checked={isIndependentRule}
                                onChange={(e) => handleIndependentRuleToggle(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <Label htmlFor="independentRule" className="cursor-pointer">
                                Independent Rule (applies regardless of specifications)
                            </Label>
                        </div>

                        {/* Specification Selection */}
                        {!isIndependentRule && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="specificationSlug">
                                        Specification {!isIndependentRule && <span className="text-red-500">*</span>}
                                    </Label>
                                    <select
                                        id="specificationSlug"
                                        value={selectedSpecSlug}
                                        onChange={(e) => handleSpecificationChange(e.target.value)}
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required={!isIndependentRule}
                                    >
                                        <option value="">Select a specification</option>
                                        {selectSpecifications.map((spec) => (
                                            <option key={spec.id} value={spec.slug}>
                                                {spec.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Option Selection */}
                                {selectedSpecSlug && availableOptions.length > 0 && (
                                    <div className="space-y-2">
                                        <Label htmlFor="optionValue">
                                            Option Value {!isIndependentRule && <span className="text-red-500">*</span>}
                                        </Label>
                                        <select
                                            id="optionValue"
                                            value={ruleForm.optionValue}
                                            onChange={(e) =>
                                                setRuleForm((prev) => ({
                                                    ...prev,
                                                    optionValue: e.target.value,
                                                }))
                                            }
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            required={!isIndependentRule && !!selectedSpecSlug}
                                        >
                                            <option value="">Select an option</option>
                                            {availableOptions.map((option) => (
                                                <option key={option.id} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {selectedSpecSlug && availableOptions.length === 0 && (
                                    <Alert variant="error">
                                        No active options found for this specification. Please add options first.
                                    </Alert>
                                )}
                            </div>
                        )}

                        {/* Max Pages */}
                        <div className="space-y-2">
                            <Label htmlFor="maxPages">
                                Maximum Pages <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="maxPages"
                                type="number"
                                min="1"
                                value={ruleForm.maxPages}
                                onChange={(e) =>
                                    setRuleForm((prev) => ({
                                        ...prev,
                                        maxPages: parseInt(e.target.value, 10) || 1,
                                    }))
                                }
                                required
                            />
                            <p className="text-xs text-gray-500">
                                Maximum number of pages allowed when this rule applies
                            </p>
                        </div>

                        {/* Display Order */}
                        <div className="space-y-2">
                            <Label htmlFor="displayOrder">Display Order</Label>
                            <Input
                                id="displayOrder"
                                type="number"
                                value={ruleForm.displayOrder}
                                onChange={(e) =>
                                    setRuleForm((prev) => ({
                                        ...prev,
                                        displayOrder: parseInt(e.target.value, 10) || 0,
                                    }))
                                }
                            />
                            <p className="text-xs text-gray-500">
                                Lower numbers appear first. Used for rule precedence.
                            </p>
                        </div>

                        {/* Active Toggle */}
                        <div className="flex items-center gap-2">
                            <input
                                id="isActive"
                                type="checkbox"
                                checked={ruleForm.isActive}
                                onChange={(e) =>
                                    setRuleForm((prev) => ({
                                        ...prev,
                                        isActive: e.target.checked,
                                    }))
                                }
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <Label htmlFor="isActive" className="cursor-pointer">
                                Active (rule will be enforced)
                            </Label>
                        </div>

                        {/* Form Actions */}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setRuleModalOpen(false);
                                    resetRuleForm();
                                }}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" isLoading={savingRule}>
                                {editingRule ? 'Update Rule' : 'Create Rule'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
