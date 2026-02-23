/**
 * Payment Filters Component
 * Advanced filtering options for payments list
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
import { type PaymentStatus, type PaymentMethod, type PaymentQueryParams } from '@/lib/api/payments.service';

interface PaymentFiltersProps {
    filters: PaymentQueryParams;
    onFiltersChange: (filters: PaymentQueryParams) => void;
}

const PAYMENT_STATUSES: PaymentStatus[] = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];
const PAYMENT_METHODS: PaymentMethod[] = ['ONLINE', 'OFFLINE'];

export function PaymentFilters({ filters, onFiltersChange }: PaymentFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [localFilters, setLocalFilters] = useState<PaymentQueryParams>(filters);

    const handleFilterChange = (key: keyof PaymentQueryParams, value: any) => {
        const newFilters = { ...localFilters, [key]: value };
        setLocalFilters(newFilters);
    };

    const handleApply = () => {
        onFiltersChange(localFilters);
        setIsOpen(false);
    };

    const handleClear = () => {
        const clearedFilters: PaymentQueryParams = {};
        setLocalFilters(clearedFilters);
        onFiltersChange(clearedFilters);
    };

    const hasActiveFilters = Object.keys(filters).length > 0 && (
        filters.status ||
        filters.method ||
        filters.dateFrom ||
        filters.dateTo ||
        filters.minAmount ||
        filters.maxAmount ||
        filters.userId ||
        filters.orderId ||
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
                            {Object.keys(filters).filter(k => filters[k as keyof PaymentQueryParams]).length}
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
                <Card className="mb-4 mt-2">
                    <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Status Filter */}
                            <div>
                                <Label htmlFor="status">Payment Status</Label>
                                <Select
                                    id="status"
                                    value={localFilters.status as string || ''}
                                    onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
                                >
                                    <option value="">All Statuses</option>
                                    {PAYMENT_STATUSES.map((status) => (
                                        <option key={status} value={status}>
                                            {status}
                                        </option>
                                    ))}
                                </Select>
                            </div>

                            {/* Payment Method Filter */}
                            <div>
                                <Label htmlFor="method">Payment Method</Label>
                                <Select
                                    id="method"
                                    value={localFilters.method || ''}
                                    onChange={(e) => handleFilterChange('method', e.target.value || undefined)}
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

                            {/* User ID */}
                            <div>
                                <Label htmlFor="userId">User ID</Label>
                                <Input
                                    id="userId"
                                    type="text"
                                    placeholder="Filter by user ID"
                                    value={localFilters.userId || ''}
                                    onChange={(e) => handleFilterChange('userId', e.target.value || undefined)}
                                />
                            </div>

                            {/* Order ID */}
                            <div>
                                <Label htmlFor="orderId">Order ID</Label>
                                <Input
                                    id="orderId"
                                    type="text"
                                    placeholder="Filter by order ID"
                                    value={localFilters.orderId || ''}
                                    onChange={(e) => handleFilterChange('orderId', e.target.value || undefined)}
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
                                    <option value="createdAt">Payment Date</option>
                                    <option value="amount">Amount</option>
                                    <option value="status">Status</option>
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
                <div className="flex flex-wrap gap-2 mb-4 mt-2">
                    {filters.status && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            Status: {String(filters.status)}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => onFiltersChange({ ...filters, status: undefined })}
                            />
                        </Badge>
                    )}
                    {filters.method && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            Method: {filters.method}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => onFiltersChange({ ...filters, method: undefined })}
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
                    {filters.minAmount && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            Min: {filters.minAmount}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => onFiltersChange({ ...filters, minAmount: undefined })}
                            />
                        </Badge>
                    )}
                    {filters.maxAmount && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            Max: {filters.maxAmount}
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => onFiltersChange({ ...filters, maxAmount: undefined })}
                            />
                        </Badge>
                    )}
                    {filters.userId && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            User: {filters.userId.slice(0, 8)}...
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => onFiltersChange({ ...filters, userId: undefined })}
                            />
                        </Badge>
                    )}
                    {filters.orderId && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            Order: {filters.orderId.slice(0, 8)}...
                            <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={() => onFiltersChange({ ...filters, orderId: undefined })}
                            />
                        </Badge>
                    )}
                </div>
            )}
        </div>
    );
}
