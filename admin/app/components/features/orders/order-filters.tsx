/**
 * Order Filters Component
 * Advanced filtering options for orders list
 */

'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { Label } from '@/app/components/ui/label';
import { Badge } from '@/app/components/ui/badge';
import { X, Filter } from 'lucide-react';
import { type OrderStatus, type PaymentStatus, type PaymentMethod, type OrderQueryParams } from '@/lib/api/orders.service';

interface OrderFiltersProps {
    filters: OrderQueryParams;
    onFiltersChange: (filters: OrderQueryParams) => void;
}

const ORDER_STATUSES: OrderStatus[] = [
    'PENDING_REVIEW',
    'ACCEPTED',
    'REJECTED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED',
];

const PAYMENT_STATUSES: PaymentStatus[] = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];
const PAYMENT_METHODS: PaymentMethod[] = ['ONLINE', 'OFFLINE'];

export function OrderFilters({ filters, onFiltersChange }: OrderFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [localFilters, setLocalFilters] = useState<OrderQueryParams>(filters);

    const handleFilterChange = (key: keyof OrderQueryParams, value: any) => {
        const newFilters = { ...localFilters, [key]: value };
        setLocalFilters(newFilters);
    };

    const handleApply = () => {
        onFiltersChange(localFilters);
        setIsOpen(false);
    };

    const handleClear = () => {
        const clearedFilters: OrderQueryParams = {};
        setLocalFilters(clearedFilters);
        onFiltersChange(clearedFilters);
    };

    const hasActiveFilters = Object.keys(filters).length > 0 && (
        filters.status ||
        filters.paymentStatus ||
        filters.paymentMethod ||
        filters.dateFrom ||
        filters.dateTo ||
        filters.minAmount ||
        filters.maxAmount ||
        filters.sortBy
    );

    return (
        <div className="">
            <div className="flex items-center justify-between">
                <Button
                    variant="outline"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2"
                >
                    <Filter className="h-4 w-4" />
                    Filters
                    {hasActiveFilters && (
                        <span className="ml-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {Object.keys(filters).filter(k => filters[k as keyof OrderQueryParams]).length}
                        </span>
                    )}
                </Button>
                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={handleClear}>
                        Clear All
                    </Button>
                )}
            </div>

            {isOpen && (
                <Card className="mb-4">
                    <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Status Filter */}
                            <div>
                                <Label htmlFor="status">Order Status</Label>
                                <Select
                                    id="status"
                                    value={localFilters.status as string || ''}
                                    onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
                                >
                                    <option value="">All Statuses</option>
                                    {ORDER_STATUSES.map((status) => (
                                        <option key={status} value={status}>
                                            {status.replace(/_/g, ' ')}
                                        </option>
                                    ))}
                                </Select>
                            </div>

                            {/* Payment Status Filter */}
                            <div>
                                <Label htmlFor="paymentStatus">Payment Status</Label>
                                <Select
                                    id="paymentStatus"
                                    value={localFilters.paymentStatus as string || ''}
                                    onChange={(e) => handleFilterChange('paymentStatus', e.target.value || undefined)}
                                >
                                    <option value="">All Payment Statuses</option>
                                    {PAYMENT_STATUSES.map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </Select>
                            </div>

                            {/* Payment Method Filter */}
                            <div>
                                <Label htmlFor="paymentMethod">Payment Method</Label>
                                <Select
                                    id="paymentMethod"
                                    value={localFilters.paymentMethod || ''}
                                    onChange={(e) => handleFilterChange('paymentMethod', e.target.value || undefined)}
                                >
                                    <option value="">All Methods</option>
                                    {PAYMENT_METHODS.map((method) => (
                                        <option key={method} value={method}>
                                            {method}
                                        </option>
                                    ))}
                                </Select>
                            </div>

                            {/* Date From */}
                            <div>
                                <Label htmlFor="dateFrom">Date From</Label>
                                <Input
                                    id="dateFrom"
                                    type="date"
                                    value={localFilters.dateFrom || ''}
                                    onChange={(e) => handleFilterChange('dateFrom', e.target.value || undefined)}
                                />
                            </div>

                            {/* Date To */}
                            <div>
                                <Label htmlFor="dateTo">Date To</Label>
                                <Input
                                    id="dateTo"
                                    type="date"
                                    value={localFilters.dateTo || ''}
                                    onChange={(e) => handleFilterChange('dateTo', e.target.value || undefined)}
                                />
                            </div>

                            {/* Sort By */}
                            <div>
                                <Label htmlFor="sortBy">Sort By</Label>
                                <Select
                                    id="sortBy"
                                    value={localFilters.sortBy || 'createdAt'}
                                    onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                                >
                                    <option value="createdAt">Order Date</option>
                                    <option value="total">Total Amount</option>
                                    <option value="status">Status</option>
                                    <option value="paymentStatus">Payment Status</option>
                                    <option value="updatedAt">Last Updated</option>
                                </Select>
                            </div>

                            {/* Sort Order */}
                            <div>
                                <Label htmlFor="sortOrder">Sort Order</Label>
                                <Select
                                    id="sortOrder"
                                    value={localFilters.sortOrder || 'desc'}
                                    onChange={(e) => handleFilterChange('sortOrder', e.target.value as 'asc' | 'desc')}
                                >
                                    <option value="desc">Descending</option>
                                    <option value="asc">Ascending</option>
                                </Select>
                            </div>

                            {/* Min Amount */}
                            <div>
                                <Label htmlFor="minAmount">Min Amount</Label>
                                <Input
                                    id="minAmount"
                                    type="number"
                                    placeholder="0"
                                    value={localFilters.minAmount || ''}
                                    onChange={(e) => handleFilterChange('minAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                                />
                            </div>

                            {/* Max Amount */}
                            <div>
                                <Label htmlFor="maxAmount">Max Amount</Label>
                                <Input
                                    id="maxAmount"
                                    type="number"
                                    placeholder="999999"
                                    value={localFilters.maxAmount || ''}
                                    onChange={(e) => handleFilterChange('maxAmount', e.target.value ? parseFloat(e.target.value) : undefined)}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button variant="outline" onClick={() => setIsOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleApply}>
                                Apply Filters
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Active Filters Display */}
            {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {filters.status && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            Status: {String(filters.status).replace(/_/g, ' ')}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => onFiltersChange({ ...filters, status: undefined })}
                            />
                        </Badge>
                    )}
                    {filters.paymentStatus && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            Payment: {String(filters.paymentStatus)}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => onFiltersChange({ ...filters, paymentStatus: undefined })}
                            />
                        </Badge>
                    )}
                    {filters.paymentMethod && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            Method: {filters.paymentMethod}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => onFiltersChange({ ...filters, paymentMethod: undefined })}
                            />
                        </Badge>
                    )}
                    {filters.dateFrom && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            From: {filters.dateFrom}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => onFiltersChange({ ...filters, dateFrom: undefined })}
                            />
                        </Badge>
                    )}
                    {filters.dateTo && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            To: {filters.dateTo}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => onFiltersChange({ ...filters, dateTo: undefined })}
                            />
                        </Badge>
                    )}
                </div>
            )}
        </div>
    );
}

