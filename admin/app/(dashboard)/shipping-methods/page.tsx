'use client';

/**
 * Shipping Methods Page
 * List + inline create/edit modal for admin-managed shipping methods.
 */

import { useEffect, useState, type FormEvent } from 'react';
import {
    ArrowDown,
    ArrowUp,
    Edit,
    Loader2,
    Package,
    Plane,
    Plus,
    Rocket,
    Ship,
    Trash2,
    Truck,
    Zap,
    type LucideIcon,
} from 'lucide-react';

const SHIPPING_ICONS: { value: string; label: string; Icon: LucideIcon }[] = [
    { value: 'truck',   label: 'Truck',   Icon: Truck },
    { value: 'zap',     label: 'Zap',     Icon: Zap },
    { value: 'package', label: 'Package', Icon: Package },
    { value: 'plane',   label: 'Plane',   Icon: Plane },
    { value: 'ship',    label: 'Ship',    Icon: Ship },
    { value: 'rocket',  label: 'Rocket',  Icon: Rocket },
];

function renderShippingIcon(
    name?: string | null,
    color?: string | null,
    size = 20,
) {
    const key = (name || '').toLowerCase();
    const match = SHIPPING_ICONS.find((opt) => opt.value === key);
    if (!match) return null;
    const IconCmp = match.Icon;
    const style = color ? { color } : undefined;
    const className = color ? '' : 'text-[var(--color-primary)]';
    return <IconCmp size={size} className={className} style={style} />;
}

import { Alert } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { PageLoading } from '@/app/components/ui/loading';
import { useConfirm } from '@/lib/hooks/use-confirm';
import { toastError, toastSuccess } from '@/lib/utils/toast';
import { formatCurrency } from '@/lib/utils/format';
import {
    createShippingMethod,
    deleteShippingMethod,
    getShippingMethods,
    reorderShippingMethods,
    updateShippingMethod,
    type CreateShippingMethodData,
    type ShippingMethod,
    type UpdateShippingMethodData,
} from '@/lib/api/shipping-methods.service';

interface FormState {
    name: string;
    description: string;
    price: string;
    estimatedDays: string;
    icon: string;
    iconColor: string;
    isActive: boolean;
    isDefault: boolean;
}

const emptyForm: FormState = {
    name: '',
    description: '',
    price: '0',
    estimatedDays: '',
    icon: '',
    iconColor: '',
    isActive: true,
    isDefault: false,
};

function toFormState(method: ShippingMethod): FormState {
    return {
        name: method.name,
        description: method.description ?? '',
        price: String(method.price ?? 0),
        estimatedDays: method.estimatedDays ?? '',
        icon: method.icon ?? '',
        iconColor: method.iconColor ?? '',
        isActive: method.isActive,
        isDefault: method.isDefault,
    };
}

export default function ShippingMethodsPage() {
    const [methods, setMethods] = useState<ShippingMethod[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const [mutatingId, setMutatingId] = useState<string | null>(null);
    const [isReordering, setIsReordering] = useState(false);

    const { confirm, ConfirmDialog } = useConfirm();

    useEffect(() => {
        void loadMethods();
    }, []);

    async function loadMethods() {
        try {
            setIsLoading(true);
            setLoadError(null);
            const data = await getShippingMethods();
            // Keep a stable client-side order by displayOrder (backend should already).
            const sorted = [...data].sort((a, b) => a.displayOrder - b.displayOrder);
            setMethods(sorted);
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : 'Failed to load shipping methods');
        } finally {
            setIsLoading(false);
        }
    }

    function openCreateDialog() {
        setEditingId(null);
        setForm(emptyForm);
        setSubmitError(null);
        setIsDialogOpen(true);
    }

    function openEditDialog(method: ShippingMethod) {
        setEditingId(method.id);
        setForm(toFormState(method));
        setSubmitError(null);
        setIsDialogOpen(true);
    }

    function closeDialog() {
        if (isSubmitting) return;
        setIsDialogOpen(false);
        setEditingId(null);
        setSubmitError(null);
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitError(null);

        const trimmedName = form.name.trim();
        if (!trimmedName) {
            setSubmitError('Name is required');
            return;
        }

        const priceNum = Number(form.price);
        if (Number.isNaN(priceNum) || priceNum < 0) {
            setSubmitError('Price must be a non-negative number');
            return;
        }

        const basePayload = {
            name: trimmedName,
            description: form.description.trim() || null,
            price: priceNum,
            estimatedDays: form.estimatedDays.trim() || null,
            icon: form.icon.trim() || null,
            iconColor: form.iconColor.trim() || null,
            isActive: form.isActive,
            isDefault: form.isDefault,
        };

        try {
            setIsSubmitting(true);
            if (editingId) {
                const payload: UpdateShippingMethodData = basePayload;
                await updateShippingMethod(editingId, payload);
                toastSuccess('Shipping method updated');
            } else {
                const payload: CreateShippingMethodData = basePayload;
                await createShippingMethod(payload);
                toastSuccess('Shipping method created');
            }
            setIsDialogOpen(false);
            setEditingId(null);
            await loadMethods();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to save shipping method';
            setSubmitError(msg);
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(method: ShippingMethod) {
        await confirm({
            title: 'Delete Shipping Method',
            description: `Delete "${method.name}"? Orders already using this method will keep their snapshot shipping charge but lose the method link. This cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    setMutatingId(method.id);
                    await deleteShippingMethod(method.id);
                    toastSuccess('Shipping method deleted');
                    await loadMethods();
                } catch (err) {
                    toastError(err instanceof Error ? err.message : 'Failed to delete shipping method');
                } finally {
                    setMutatingId(null);
                }
            },
        });
    }

    async function handleToggleActive(method: ShippingMethod) {
        try {
            setMutatingId(method.id);
            await updateShippingMethod(method.id, { isActive: !method.isActive });
            toastSuccess(method.isActive ? 'Shipping method deactivated' : 'Shipping method activated');
            await loadMethods();
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to update shipping method');
        } finally {
            setMutatingId(null);
        }
    }

    async function handleMove(method: ShippingMethod, direction: 'up' | 'down') {
        const currentIndex = methods.findIndex((m) => m.id === method.id);
        if (currentIndex === -1) return;
        const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (swapIndex < 0 || swapIndex >= methods.length) return;

        const newOrder = [...methods];
        const a = newOrder[currentIndex];
        const b = newOrder[swapIndex];
        if (!a || !b) return;
        newOrder[currentIndex] = b;
        newOrder[swapIndex] = a;

        const prevOrder = methods;
        setMethods(newOrder);

        try {
            setIsReordering(true);
            await reorderShippingMethods(newOrder.map((m) => m.id));
            toastSuccess('Order updated');
            await loadMethods();
        } catch (err) {
            // Revert on failure.
            setMethods(prevOrder);
            toastError(err instanceof Error ? err.message : 'Failed to reorder shipping methods');
        } finally {
            setIsReordering(false);
        }
    }

    return (
        <div className="space-y-8 max-w-[1600px]">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-[var(--color-foreground)] tracking-tight">
                        Shipping Methods
                    </h1>
                    <p className="mt-2 text-sm text-[var(--color-foreground-secondary)]">
                        Manage the delivery options shown to customers at checkout.
                    </p>
                </div>
                <Button onClick={openCreateDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Shipping Method
                </Button>
            </div>

            {isLoading ? (
                <PageLoading />
            ) : loadError ? (
                <Alert variant="error">
                    <div className="flex items-center justify-between gap-4">
                        <span>{loadError}</span>
                        <Button variant="outline" size="sm" onClick={loadMethods}>
                            Retry
                        </Button>
                    </div>
                </Alert>
            ) : (
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-xl font-semibold text-[var(--color-foreground)]">
                                    Shipping Methods ({methods.length})
                                </h2>
                                <p className="text-sm text-[var(--color-foreground-secondary)] mt-1">
                                    Use the arrows to change display order. Only one method can be marked default.
                                </p>
                            </div>
                            {isReordering && (
                                <span className="text-sm text-[var(--color-foreground-secondary)] inline-flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving order...
                                </span>
                            )}
                        </div>

                        {methods.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-[var(--color-foreground-secondary)] mb-4">
                                    No shipping methods yet. Add one to get started.
                                </p>
                                <Button onClick={openCreateDialog}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Shipping Method
                                </Button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-foreground-secondary)]">
                                            <th className="py-3 pr-4 font-medium">Order</th>
                                            <th className="py-3 pr-4 font-medium w-10">Icon</th>
                                            <th className="py-3 pr-4 font-medium">Name</th>
                                            <th className="py-3 pr-4 font-medium">Price</th>
                                            <th className="py-3 pr-4 font-medium">Estimated</th>
                                            <th className="py-3 pr-4 font-medium">Default</th>
                                            <th className="py-3 pr-4 font-medium">Active</th>
                                            <th className="py-3 pr-4 font-medium text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {methods.map((method, index) => {
                                            const isFirst = index === 0;
                                            const isLast = index === methods.length - 1;
                                            const isBusy = mutatingId === method.id || isReordering;
                                            return (
                                                <tr
                                                    key={method.id}
                                                    className="border-b border-[var(--color-border)] last:border-0"
                                                >
                                                    <td className="py-3 pr-4">
                                                        <div className="inline-flex items-center gap-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleMove(method, 'up')}
                                                                disabled={isFirst || isBusy}
                                                                title="Move up"
                                                                className="h-8 w-8"
                                                            >
                                                                <ArrowUp className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleMove(method, 'down')}
                                                                disabled={isLast || isBusy}
                                                                title="Move down"
                                                                className="h-8 w-8"
                                                            >
                                                                <ArrowDown className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 pr-4">
                                                        {method.icon ? (
                                                            <span
                                                                aria-hidden
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-border)]"
                                                            >
                                                                {renderShippingIcon(method.icon, method.iconColor, 18)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-[var(--color-foreground-tertiary)]">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 pr-4">
                                                        <div className="font-medium text-[var(--color-foreground)]">
                                                            {method.name}
                                                        </div>
                                                        {method.description && (
                                                            <div className="text-xs text-[var(--color-foreground-secondary)] mt-0.5">
                                                                {method.description}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 pr-4 text-[var(--color-foreground)]">
                                                        {formatCurrency(Number(method.price) || 0)}
                                                    </td>
                                                    <td className="py-3 pr-4 text-[var(--color-foreground-secondary)]">
                                                        {method.estimatedDays || '—'}
                                                    </td>
                                                    <td className="py-3 pr-4">
                                                        {method.isDefault ? (
                                                            <Badge variant="success">Default</Badge>
                                                        ) : (
                                                            <span className="text-xs text-[var(--color-foreground-tertiary)]">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 pr-4">
                                                        <label className="inline-flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={method.isActive}
                                                                disabled={isBusy}
                                                                onChange={() => handleToggleActive(method)}
                                                                className="h-4 w-4 rounded border-[var(--color-input)] text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)]"
                                                            />
                                                            <span className="text-xs text-[var(--color-foreground-secondary)]">
                                                                {method.isActive ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </label>
                                                    </td>
                                                    <td className="py-3 pr-4">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => openEditDialog(method)}
                                                                disabled={isBusy}
                                                                title="Edit"
                                                            >
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDelete(method)}
                                                                disabled={isBusy}
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
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
            )}

            <Dialog open={isDialogOpen} onOpenChange={(next) => (next ? setIsDialogOpen(true) : closeDialog())}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingId ? 'Edit Shipping Method' : 'Add Shipping Method'}
                        </DialogTitle>
                        <DialogDescription>
                            These options appear at checkout. The default method is pre-selected for customers.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {submitError && <Alert variant="error">{submitError}</Alert>}

                        <div className="space-y-2">
                            <Label htmlFor="shipping-name">Name *</Label>
                            <Input
                                id="shipping-name"
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="Standard Delivery"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="shipping-description">Description</Label>
                            <textarea
                                id="shipping-description"
                                value={form.description}
                                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                                placeholder="5 - 7 business days"
                                rows={2}
                                className="flex w-full rounded-[var(--radius)] border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] transition-all duration-200 placeholder:text-[var(--color-foreground-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--color-muted)]"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="shipping-price">Price *</Label>
                                <Input
                                    id="shipping-price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={form.price}
                                    onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="shipping-estimated">Estimated Days</Label>
                                <Input
                                    id="shipping-estimated"
                                    value={form.estimatedDays}
                                    onChange={(e) => setForm((prev) => ({ ...prev, estimatedDays: e.target.value }))}
                                    placeholder="5-7 business days"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="shipping-icon">Icon</Label>
                                <div className="flex items-center gap-2">
                                    <span
                                        aria-hidden
                                        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius)] border border-[var(--color-input)] bg-[var(--color-background-subtle,transparent)]"
                                    >
                                        {renderShippingIcon(form.icon, form.iconColor, 22)}
                                    </span>
                                    <select
                                        id="shipping-icon"
                                        value={form.icon}
                                        onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
                                        className="flex-1 h-10 rounded-[var(--radius)] border border-[var(--color-input)] bg-[var(--color-background)] px-3 text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                                    >
                                        <option value="">None</option>
                                        {SHIPPING_ICONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-xs text-[var(--color-foreground-tertiary)]">
                                    Pick an icon or choose None to show no icon at checkout.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="shipping-icon-color">Icon Color</Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="shipping-icon-color-picker"
                                        type="color"
                                        value={form.iconColor || '#000000'}
                                        onChange={(e) => setForm((prev) => ({ ...prev, iconColor: e.target.value }))}
                                        className="h-10 w-12 cursor-pointer rounded-[var(--radius)] border border-[var(--color-input)] bg-[var(--color-background)]"
                                    />
                                    <Input
                                        id="shipping-icon-color"
                                        value={form.iconColor}
                                        onChange={(e) => setForm((prev) => ({ ...prev, iconColor: e.target.value }))}
                                        placeholder="#2563eb"
                                    />
                                </div>
                                <p className="text-xs text-[var(--color-foreground-tertiary)]">
                                    Blank uses the admin theme primary.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                                    className="h-4 w-4 rounded border-[var(--color-input)] text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)]"
                                />
                                <span className="text-sm text-[var(--color-foreground)]">
                                    Active (visible at checkout)
                                </span>
                            </label>

                            <label
                                className="inline-flex items-center gap-2 cursor-pointer"
                                title="Only one method can be default. Marking this will unset any existing default."
                            >
                                <input
                                    type="checkbox"
                                    checked={form.isDefault}
                                    onChange={(e) => setForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                                    className="h-4 w-4 rounded border-[var(--color-input)] text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)]"
                                />
                                <span className="text-sm text-[var(--color-foreground)]">
                                    Default (pre-selected at checkout)
                                </span>
                            </label>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeDialog}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : editingId ? (
                                    'Save Changes'
                                ) : (
                                    'Create Shipping Method'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {ConfirmDialog}
        </div>
    );
}
