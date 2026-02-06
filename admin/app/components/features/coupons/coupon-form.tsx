/**
 * Coupon Form Component
 * Handles both create and edit modes
 */

'use client';

import { useState, type FormEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select } from '@/app/components/ui/select';
import { Alert } from '@/app/components/ui/alert';
import {
    type CreateCouponData,
    type Coupon,
} from '@/lib/api/coupons.service';
import { useCreateCoupon, useUpdateCoupon } from '@/lib/hooks/use-coupons';
import { generateCouponCode } from '@/lib/utils/coupon-utils';
import { Sparkles } from 'lucide-react';
import { toastError } from '@/lib/utils/toast';
import { CouponProductsManager } from './coupon-products-manager';
import { CouponSelectionManager } from './coupon-selection-manager';

interface CouponFormProps {
    initialData?: Coupon;
    onSuccess?: () => void;
}

export function CouponForm({ initialData, onSuccess }: CouponFormProps) {
    const isEditMode = !!initialData;
    const createCouponMutation = useCreateCoupon();
    const updateCouponMutation = useUpdateCoupon();
    const [error, setError] = useState<string | null>(null);
    const [createdCouponId, setCreatedCouponId] = useState<string | null>(null);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

    const isLoading = createCouponMutation.isPending || updateCouponMutation.isPending;

    const [formData, setFormData] = useState<CreateCouponData>({
        code: initialData?.code || '',
        name: initialData?.name || '',
        description: initialData?.description || '',
        discountType: initialData?.discountType || 'PERCENTAGE',
        discountValue: initialData ? Number(initialData.discountValue) : 0,
        minPurchaseAmount: initialData?.minPurchaseAmount ? Number(initialData.minPurchaseAmount) : undefined,
        maxDiscountAmount: initialData?.maxDiscountAmount ? Number(initialData.maxDiscountAmount) : undefined,
        usageLimit: initialData?.usageLimit || undefined,
        usageLimitPerUser: initialData?.usageLimitPerUser || 1,
        validFrom: initialData?.validFrom
            ? new Date(initialData.validFrom).toISOString().slice(0, 16)
            : new Date().toISOString().slice(0, 16),
        validUntil: initialData?.validUntil
            ? new Date(initialData.validUntil).toISOString().slice(0, 16)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        isActive: initialData?.isActive ?? true,
        applicableTo: initialData?.applicableTo || 'ALL',
    });

    const handleGenerateCode = () => {
        const code = generateCouponCode();
        setFormData({ ...formData, code });
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!formData.code || formData.code.trim().length < 3) {
            setError('Coupon code must be at least 3 characters');
            return;
        }

        if (!/^[A-Z0-9-]+$/.test(formData.code.toUpperCase())) {
            setError('Coupon code can only contain uppercase letters, numbers, and hyphens');
            return;
        }

        if (!formData.name || formData.name.trim().length === 0) {
            setError('Coupon name is required');
            return;
        }

        if (!formData.discountValue || formData.discountValue <= 0) {
            setError('Discount value must be greater than 0');
            return;
        }

        if (formData.discountType === 'PERCENTAGE' && formData.discountValue > 100) {
            setError('Percentage discount cannot exceed 100%');
            return;
        }

        const validFrom = new Date(formData.validFrom);
        const validUntil = new Date(formData.validUntil);

        if (validUntil <= validFrom) {
            setError('Valid until date must be after valid from date');
            return;
        }

        if (formData.minPurchaseAmount && formData.minPurchaseAmount <= 0) {
            setError('Minimum purchase amount must be greater than 0');
            return;
        }

        if (formData.maxDiscountAmount && formData.maxDiscountAmount <= 0) {
            setError('Maximum discount amount must be greater than 0');
            return;
        }

        if (formData.usageLimit && formData.usageLimit <= 0) {
            setError('Usage limit must be greater than 0');
            return;
        }

        if (formData.usageLimitPerUser && formData.usageLimitPerUser <= 0) {
            setError('Usage limit per user must be greater than 0');
            return;
        }

        try {
            const submitData = {
                ...formData,
                code: formData.code.toUpperCase(),
                validFrom: validFrom.toISOString(),
                validUntil: validUntil.toISOString(),
                // Include selected product/category IDs if applicable
                ...(formData.applicableTo === 'PRODUCT' && selectedProductIds.length > 0
                    ? { productIds: selectedProductIds }
                    : {}),
                ...(formData.applicableTo === 'CATEGORY' && selectedCategoryIds.length > 0
                    ? { categoryIds: selectedCategoryIds }
                    : {}),
            };

            if (isEditMode && initialData) {
                await updateCouponMutation.mutateAsync({ id: initialData.id, ...submitData });
                if (onSuccess) {
                    onSuccess();
                }
            } else {
                const newCoupon = await createCouponMutation.mutateAsync(submitData);
                setCreatedCouponId(newCoupon.id);
                // Clear selection state after creation (items are now linked via backend)
                setSelectedProductIds([]);
                setSelectedCategoryIds([]);
                // Only call onSuccess if applicableTo is ALL (no configuration needed)
                if (formData.applicableTo === 'ALL' && onSuccess) {
                    onSuccess();
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to save coupon';
            setError(errorMessage);
            toastError(errorMessage);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <Alert variant="error">{error}</Alert>
            )}

            {/* Basic Information */}
            <Card>
                <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="code">Coupon Code *</Label>
                        <div className="flex gap-2">
                            <Input
                                id="code"
                                value={formData.code}
                                onChange={(e) =>
                                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                                }
                                placeholder="SAVE20"
                                maxLength={20}
                                disabled={isEditMode}
                                required
                            />
                            {!isEditMode && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleGenerateCode}
                                >
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Generate
                                </Button>
                            )}
                        </div>
                        <p className="text-xs text-gray-500">
                            Uppercase letters, numbers, and hyphens only. Cannot be changed after creation.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name">Coupon Name *</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Save 20% Off"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <textarea
                            id="description"
                            value={formData.description || ''}
                            onChange={(e) =>
                                setFormData({ ...formData, description: e.target.value })
                            }
                            placeholder="Get 20% off on all products"
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Discount Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle>Discount Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="discountType">Discount Type *</Label>
                        <Select
                            id="discountType"
                            value={formData.discountType}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    discountType: e.target.value as 'PERCENTAGE' | 'FIXED',
                                })
                            }
                            required
                        >
                            <option value="PERCENTAGE">Percentage</option>
                            <option value="FIXED">Fixed Amount</option>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="discountValue">
                            Discount Value * ({formData.discountType === 'PERCENTAGE' ? '%' : '₹'})
                        </Label>
                        <Input
                            id="discountValue"
                            type="number"
                            step="0.01"
                            min="0"
                            max={formData.discountType === 'PERCENTAGE' ? '100' : undefined}
                            value={formData.discountValue}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    discountValue: parseFloat(e.target.value) || 0,
                                })
                            }
                            placeholder={formData.discountType === 'PERCENTAGE' ? '20' : '100'}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="minPurchaseAmount">Minimum Purchase Amount (₹)</Label>
                        <Input
                            id="minPurchaseAmount"
                            type="number"
                            step="0.01"
                            min="0"
                            value={formData.minPurchaseAmount || ''}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    minPurchaseAmount: e.target.value
                                        ? parseFloat(e.target.value)
                                        : undefined,
                                })
                            }
                            placeholder="500"
                        />
                    </div>

                    {formData.discountType === 'PERCENTAGE' && (
                        <div className="space-y-2">
                            <Label htmlFor="maxDiscountAmount">Maximum Discount Amount (₹)</Label>
                            <Input
                                id="maxDiscountAmount"
                                type="number"
                                step="0.01"
                                min="0"
                                value={formData.maxDiscountAmount || ''}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        maxDiscountAmount: e.target.value
                                            ? parseFloat(e.target.value)
                                            : undefined,
                                    })
                                }
                                placeholder="1000"
                            />
                            <p className="text-xs text-gray-500">
                                Caps the discount amount for percentage discounts
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Usage Limits */}
            <Card>
                <CardHeader>
                    <CardTitle>Usage Limits</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="usageLimit">Total Usage Limit</Label>
                        <Input
                            id="usageLimit"
                            type="number"
                            min="1"
                            value={formData.usageLimit || ''}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    usageLimit: e.target.value ? parseInt(e.target.value) : undefined,
                                })
                            }
                            placeholder="100 (leave empty for unlimited)"
                        />
                        <p className="text-xs text-gray-500">
                            Leave empty for unlimited usage
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="usageLimitPerUser">Usage Limit Per User *</Label>
                        <Input
                            id="usageLimitPerUser"
                            type="number"
                            min="1"
                            value={formData.usageLimitPerUser}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    usageLimitPerUser: parseInt(e.target.value) || 1,
                                })
                            }
                            required
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Validity Period */}
            <Card>
                <CardHeader>
                    <CardTitle>Validity Period</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="validFrom">Valid From *</Label>
                        <Input
                            id="validFrom"
                            type="datetime-local"
                            value={formData.validFrom}
                            onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="validUntil">Valid Until *</Label>
                        <Input
                            id="validUntil"
                            type="datetime-local"
                            value={formData.validUntil}
                            onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                            required
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Applicability */}
            <Card>
                <CardHeader>
                    <CardTitle>Applicability</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="applicableTo">Applicable To *</Label>
                        <Select
                            id="applicableTo"
                            value={formData.applicableTo}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    applicableTo: e.target.value as 'ALL' | 'CATEGORY' | 'PRODUCT',
                                })
                            }
                            required
                        >
                            <option value="ALL">All Products</option>
                            <option value="CATEGORY">Specific Categories</option>
                            <option value="PRODUCT">Specific Products</option>
                        </Select>
                        <p className="text-xs text-gray-500">
                            Configure products or categories below based on your selection
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Products/Categories Selection - Show during creation (before coupon ID exists) */}
            {!isEditMode && !createdCouponId && formData.applicableTo !== 'ALL' && (
                <CouponSelectionManager
                    applicableTo={formData.applicableTo || 'ALL'}
                    selectedProductIds={selectedProductIds}
                    selectedCategoryIds={selectedCategoryIds}
                    onProductIdsChange={setSelectedProductIds}
                    onCategoryIdsChange={setSelectedCategoryIds}
                />
            )}

            {/* Products/Categories Manager - Show when editing or after creation */}
            {((isEditMode && initialData) || createdCouponId) && (
                <CouponProductsManager
                    couponId={initialData?.id || createdCouponId!}
                    applicableTo={formData.applicableTo || 'ALL'}
                />
            )}

            {/* Status */}
            <Card>
                <CardHeader>
                    <CardTitle>Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            className="rounded border-gray-300"
                        />
                        <Label htmlFor="isActive">Active</Label>
                    </div>
                </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
                {createdCouponId && formData.applicableTo !== 'ALL' && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            if (onSuccess) {
                                onSuccess();
                            }
                        }}
                        className="cursor-pointer"
                    >
                        Done
                    </Button>
                )}
                <Button
                    type="submit"
                    disabled={isLoading}
                    className="cursor-pointer"
                >
                    {isLoading ? 'Saving...' : isEditMode ? 'Update Coupon' : 'Create Coupon'}
                </Button>
            </div>
        </form>
    );
}

