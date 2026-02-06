'use client';

/**
 * Category Specifications & Options Management
 */

import { useEffect, useState, FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import {
    getCategoryById,
    getCategorySpecificationsApi,
    createCategorySpecificationApi,
    updateCategorySpecificationApi,
    deleteCategorySpecificationApi,
    getSpecificationOptionsApi,
    createSpecificationOptionApi,
    updateSpecificationOptionApi,
    deleteSpecificationOptionApi,
    type Category,
    type CategorySpecification,
    type CategorySpecificationOption,
    type SpecificationType,
} from '@/lib/api/categories.service';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { toastPromise } from '@/lib/utils/toast';

interface CategorySpecificationsProps {
    categoryId: string;
}

const SPEC_TYPES: { value: SpecificationType; label: string }[] = [
    { value: 'SELECT', label: 'Select (single choice)' },
    { value: 'MULTI_SELECT', label: 'Multi Select' },
    { value: 'TEXT', label: 'Text' },
    { value: 'NUMBER', label: 'Number' },
    { value: 'BOOLEAN', label: 'Boolean' },
];

export function CategorySpecifications({ categoryId }: CategorySpecificationsProps) {
    const [category, setCategory] = useState<Category | null>(null);
    const [specs, setSpecs] = useState<CategorySpecification[]>([]);
    const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
    const [options, setOptions] = useState<CategorySpecificationOption[]>([]);
    const [parentSpecOptions, setParentSpecOptions] = useState<CategorySpecificationOption[]>([]);

    const [loading, setLoading] = useState(true);
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [savingSpec, setSavingSpec] = useState(false);
    const { confirm, ConfirmDialog } = useConfirm();
    const [savingOption, setSavingOption] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [specForm, setSpecForm] = useState<{
        id?: string;
        name: string;
        slug: string;
        type: SpecificationType;
        isRequired: boolean;
        displayOrder: number;
    }>({
        name: '',
        slug: '',
        type: 'SELECT',
        isRequired: true,
        displayOrder: 0,
    });

    const [optionForm, setOptionForm] = useState<{
        id?: string;
        label: string;
        value: string;
        displayOrder: number;
        allowedParentValues: string[]; // For dependencies: which parent spec values this option applies to
    }>({
        label: '',
        value: '',
        displayOrder: 0,
        allowedParentValues: [],
    });

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);
                setError(null);
                const [cat, specifications] = await Promise.all([
                    getCategoryById(categoryId), 
                    getCategorySpecificationsApi(categoryId),
                ]);
                setCategory(cat);
                setSpecs(specifications);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load specifications');
            } finally {
                setLoading(false);
            }
        }

        void load();
    }, [categoryId]);

    const resetSpecForm = () => {
        setSpecForm({
            name: '',
            slug: '',
            type: 'SELECT',
            isRequired: true,
            displayOrder: specs.length,
        });
    };

    const resetOptionForm = () => {
        setOptionForm({
            label: '',
            value: '',
            displayOrder: options.length,
            allowedParentValues: [],
        });
    };

    const handleSubmitSpec = async (e: FormEvent) => {
        e.preventDefault();
        try {
            setSavingSpec(true);
            setError(null);

            if (specForm.id) {
                const updated = await updateCategorySpecificationApi(categoryId, specForm.id, {
                    name: specForm.name.trim(),
                    slug: specForm.slug.trim(),
                    type: specForm.type,
                    isRequired: specForm.isRequired,
                    displayOrder: specForm.displayOrder,
                });
                setSpecs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            } else {
                const created = await createCategorySpecificationApi(categoryId, {
                    name: specForm.name.trim(),
                    slug: specForm.slug.trim(),
                    type: specForm.type,
                    isRequired: specForm.isRequired,
                    displayOrder: specForm.displayOrder,
                });
                setSpecs((prev) => [...prev, created].sort((a, b) => a.displayOrder - b.displayOrder));
            }

            resetSpecForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save specification');
        } finally {
            setSavingSpec(false);
        }
    };

    const handleEditSpec = (spec: CategorySpecification) => {
        setSpecForm({
            id: spec.id,
            name: spec.name,
            slug: spec.slug,
            type: spec.type,
            isRequired: spec.isRequired,
            displayOrder: spec.displayOrder,
        });
    };

    const handleDeleteSpec = async (specId: string) => {
        const confirmed = await confirm({
            title: 'Delete Specification',
            description: 'Are you sure you want to delete this specification? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    await toastPromise(
                        deleteCategorySpecificationApi(categoryId, specId),
                        {
                            loading: 'Deleting specification...',
                            success: 'Specification deleted successfully',
                            error: 'Failed to delete specification',
                        }
                    );
                    setSpecs((prev) => prev.filter((s) => s.id !== specId));
                    if (selectedSpecId === specId) {
                        setSelectedSpecId(null);
                        setOptions([]);
                    }
                } catch (err) {
                    // Error handled by toastPromise
                }
            },
        });
    };

    const loadOptions = async (specId: string) => {
        try {
            setLoadingOptions(true);
            setError(null);
            const data = await getSpecificationOptionsApi(categoryId, specId);
            setOptions(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load options');
        } finally {
            setLoadingOptions(false);
        }
    };

    const handleSelectSpec = (specId: string) => {
        setSelectedSpecId(specId);
        resetOptionForm();
        void loadOptions(specId);
    };

    const handleSubmitOption = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedSpecId) return;
        try {
            setSavingOption(true);
            setError(null);

            const metadata = optionForm.allowedParentValues.length > 0
                ? { allowedParentValues: optionForm.allowedParentValues }
                : null;

            if (optionForm.id) {
                const updated = await updateSpecificationOptionApi(
                    categoryId,
                    selectedSpecId,
                    optionForm.id,
                    {
                        label: optionForm.label.trim(),
                        value: optionForm.value.trim(),
                        displayOrder: optionForm.displayOrder,
                        metadata,
                    }
                );
                setOptions((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
            } else {
                const created = await createSpecificationOptionApi(categoryId, selectedSpecId, {
                    label: optionForm.label.trim(),
                    value: optionForm.value.trim(),
                    displayOrder: optionForm.displayOrder,
                    metadata,
                });
                setOptions((prev) => [...prev, created].sort((a, b) => a.displayOrder - b.displayOrder));
            }

            resetOptionForm();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save option');
        } finally {
            setSavingOption(false);
        }
    };

    const handleEditOption = (opt: CategorySpecificationOption) => {
        const metadata = opt.metadata as { allowedParentValues?: string[] } | null;
        setOptionForm({
            id: opt.id,
            label: opt.label,
            value: opt.value,
            displayOrder: opt.displayOrder,
            allowedParentValues: metadata?.allowedParentValues || [],
        });
    };

    const handleDeleteOption = async (optionId: string) => {
        if (!selectedSpecId) return;
        const confirmed = await confirm({
            title: 'Delete Option',
            description: 'Are you sure you want to delete this option? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    await toastPromise(
                        deleteSpecificationOptionApi(categoryId, selectedSpecId, optionId),
                        {
                            loading: 'Deleting option...',
                            success: 'Option deleted successfully',
                            error: 'Failed to delete option',
                        }
                    );
                    setOptions((prev) => prev.filter((o) => o.id !== optionId));
                } catch (err) {
                    // Error handled by toastPromise
                }
            },
        });
    };

    if (loading) {
        return (
            <>
                {ConfirmDialog}
                <div className="flex min-h-[200px] items-center justify-center">
                    <p className="text-sm text-gray-500">Loading specifications...</p>
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
                        Specifications - {category.name}
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Define the configurable fields and options for this category. These power the
                        dynamic service page.
                    </p>
                </div>

                {error && <Alert variant="error">{error}</Alert>}

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Specifications list & form */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Specifications</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <form onSubmit={handleSubmitSpec} className="space-y-3">
                                <div className="space-y-2">
                                    <Label htmlFor="spec-name">Name</Label>
                                    <Input
                                        id="spec-name"
                                        value={specForm.name}
                                        onChange={(e) =>
                                            setSpecForm((prev) => ({
                                                ...prev,
                                                name: e.target.value,
                                            }))
                                        }
                                        placeholder="e.g. Paper Size"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="spec-slug">Slug</Label>
                                    <Input
                                        id="spec-slug"
                                        value={specForm.slug}
                                        onChange={(e) =>
                                            setSpecForm((prev) => ({
                                                ...prev,
                                                slug: e.target.value
                                                    .toLowerCase()
                                                    .trim()
                                                    .replace(/[^\w\s-]/g, '')
                                                    .replace(/\s+/g, '-')
                                                    .replace(/-+/g, '-'),
                                            }))
                                        }
                                        placeholder="e.g. paper-size"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="spec-type">Type</Label>
                                    <select
                                        id="spec-type"
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                        value={specForm.type}
                                        onChange={(e) =>
                                            setSpecForm((prev) => ({
                                                ...prev,
                                                type: e.target.value as SpecificationType,
                                            }))
                                        }
                                    >
                                        {SPEC_TYPES.map((t) => (
                                            <option key={t.value} value={t.value}>
                                                {t.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        id="spec-required"
                                        type="checkbox"
                                        checked={specForm.isRequired}
                                        onChange={(e) =>
                                            setSpecForm((prev) => ({
                                                ...prev,
                                                isRequired: e.target.checked,
                                            }))
                                        }
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <Label htmlFor="spec-required">Required</Label>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="spec-order">Display Order</Label>
                                    <Input
                                        id="spec-order"
                                        type="number"
                                        value={specForm.displayOrder}
                                        onChange={(e) =>
                                            setSpecForm((prev) => ({
                                                ...prev,
                                                displayOrder: Number(e.target.value) || 0,
                                            }))
                                        }
                                    />
                                </div>

                                <div className="flex justify-end gap-2">
                                    {specForm.id && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={resetSpecForm}
                                            disabled={savingSpec}
                                        >
                                            Cancel edit
                                        </Button>
                                    )}
                                    <Button type="submit" isLoading={savingSpec}>
                                        {specForm.id ? 'Update Specification' : 'Add Specification'}
                                    </Button>
                                </div>
                            </form>

                            <div className="mt-6 space-y-2">
                                <h3 className="text-sm font-semibold text-gray-700">Existing Specifications</h3>
                                {specs.length === 0 ? (
                                    <p className="text-xs text-gray-500">
                                        No specifications yet. Create the first one using the form above.
                                    </p>
                                ) : (
                                    <div className="space-y-2 max-h-80 overflow-auto">
                                        {specs
                                            .slice()
                                            .sort((a, b) => a.displayOrder - b.displayOrder)
                                            .map((spec) => (
                                                <div
                                                    key={spec.id}
                                                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                                                >
                                                    <div>
                                                        <div className="font-medium text-gray-900">
                                                            {spec.name}{' '}
                                                            <span className="text-xs text-gray-500">({spec.slug})</span>
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {spec.type} • {spec.isRequired ? 'Required' : 'Optional'} • Order{' '}
                                                            {spec.displayOrder}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant={selectedSpecId === spec.id ? 'default' : 'outline'}
                                                            onClick={() => handleSelectSpec(spec.id)}
                                                        >
                                                            Options
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleEditSpec(spec)}
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleDeleteSpec(spec.id)}
                                                        >
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Options for selected specification */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Options</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!selectedSpecId ? (
                                <p className="text-sm text-gray-500">
                                    Select a specification to manage its options.
                                </p>
                            ) : (
                                <>
                                    <form onSubmit={handleSubmitOption} className="space-y-3">
                                        <div className="space-y-2">
                                            <Label htmlFor="opt-label">Label</Label>
                                            <Input
                                                id="opt-label"
                                                value={optionForm.label}
                                                onChange={(e) =>
                                                    setOptionForm((prev) => ({
                                                        ...prev,
                                                        label: e.target.value,
                                                    }))
                                                }
                                                placeholder="e.g. A4"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="opt-value">Value</Label>
                                            <Input
                                                id="opt-value"
                                                value={optionForm.value}
                                                onChange={(e) =>
                                                    setOptionForm((prev) => ({
                                                        ...prev,
                                                        value: e.target.value,
                                                    }))
                                                }
                                                placeholder="e.g. a4"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="opt-order">Display Order</Label>
                                            <Input
                                                id="opt-order"
                                                type="number"
                                                value={optionForm.displayOrder}
                                                onChange={(e) =>
                                                    setOptionForm((prev) => ({
                                                        ...prev,
                                                        displayOrder: Number(e.target.value) || 0,
                                                    }))
                                                }
                                            />
                                        </div>

                                        {/* Dependency: Applies to parent spec values */}
                                        {(() => {
                                            // Find if there's a "size" spec (or any parent spec we want to depend on)
                                            const parentSpec = specs.find(s => s.slug === 'size' || s.slug === 'paper-size');
                                            if (!parentSpec || selectedSpecId === parentSpec.id) return null;

                                            // Load parent spec options if not already loaded
                                            if (parentSpecOptions.length === 0 && parentSpec.id) {
                                                getSpecificationOptionsApi(categoryId, parentSpec.id)
                                                    .then(setParentSpecOptions)
                                                    .catch(() => { });
                                            }

                                            return (
                                                <div className="space-y-2">
                                                    <Label htmlFor="opt-dependencies">
                                                        Applies to {parentSpec.name} (leave empty for all)
                                                    </Label>
                                                    <div className="space-y-2 max-h-32 overflow-auto">
                                                        {parentSpecOptions.length === 0 ? (
                                                            <p className="text-xs text-gray-400">Loading...</p>
                                                        ) : (
                                                            parentSpecOptions.map((parentOpt) => (
                                                                <label key={parentOpt.id} className="flex items-center gap-2">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={optionForm.allowedParentValues.includes(parentOpt.value)}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setOptionForm((prev) => ({
                                                                                    ...prev,
                                                                                    allowedParentValues: [...prev.allowedParentValues, parentOpt.value],
                                                                                }));
                                                                            } else {
                                                                                setOptionForm((prev) => ({
                                                                                    ...prev,
                                                                                    allowedParentValues: prev.allowedParentValues.filter(
                                                                                        (v) => v !== parentOpt.value
                                                                                    ),
                                                                                }));
                                                                            }
                                                                        }}
                                                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                    />
                                                                    <span className="text-sm">{parentOpt.label}</span>
                                                                </label>
                                                            ))
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500">
                                                        Select which {parentSpec.name} values this option applies to. If none selected, it applies to all.
                                                    </p>
                                                </div>
                                            );
                                        })()}

                                        <div className="flex justify-end gap-2">
                                            {optionForm.id && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={resetOptionForm}
                                                    disabled={savingOption}
                                                >
                                                    Cancel edit
                                                </Button>
                                            )}
                                            <Button type="submit" isLoading={savingOption}>
                                                {optionForm.id ? 'Update Option' : 'Add Option'}
                                            </Button>
                                        </div>
                                    </form>

                                    <div className="mt-6 space-y-2">
                                        <h3 className="text-sm font-semibold text-gray-700">Existing Options</h3>
                                        {loadingOptions ? (
                                            <p className="text-xs text-gray-500">Loading options...</p>
                                        ) : options.length === 0 ? (
                                            <p className="text-xs text-gray-500">
                                                No options yet. Add options using the form above.
                                            </p>
                                        ) : (
                                            <div className="space-y-2 max-h-80 overflow-auto">
                                                {options
                                                    .slice()
                                                    .sort((a, b) => a.displayOrder - b.displayOrder)
                                                    .map((opt) => (
                                                        <div
                                                            key={opt.id}
                                                            className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                                                        >
                                                            <div>
                                                                <div className="font-medium text-gray-900">
                                                                    {opt.label}{' '}
                                                                    <span className="text-xs text-gray-500">({opt.value})</span>
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    Order {opt.displayOrder}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleEditOption(opt)}
                                                                >
                                                                    Edit
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleDeleteOption(opt.id)}
                                                                >
                                                                    Delete
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}


