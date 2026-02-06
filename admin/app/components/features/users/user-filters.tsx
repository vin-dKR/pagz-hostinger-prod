/**
 * User Filters Component
 * Advanced filtering options for users
 */

'use client';

import { Input } from '@/app/components/ui/input';
import { Select } from '@/app/components/ui/select';
import { Label } from '@/app/components/ui/label';
import { UserQueryParams } from '@/lib/api/users.service';

interface UserFiltersProps {
    filters: UserQueryParams;
    onFilterChange: (filters: Partial<UserQueryParams>) => void;
}

export function UserFilters({ filters, onFilterChange }: UserFiltersProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Role Filter */}
            <div>
                <Label htmlFor="role">Role</Label>
                <Select
                    id="role"
                    value={filters.role || ''}
                    onChange={(e) => onFilterChange({ role: e.target.value as any || undefined })}
                >
                    <option value="">All Roles</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="customer">Customer</option>
                </Select>
            </div>

            {/* Date From */}
            <div>
                <Label htmlFor="dateFrom">Date From</Label>
                <Input
                    id="dateFrom"
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={(e) => onFilterChange({ dateFrom: e.target.value || undefined })}
                />
            </div>

            {/* Date To */}
            <div>
                <Label htmlFor="dateTo">Date To</Label>
                <Input
                    id="dateTo"
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={(e) => onFilterChange({ dateTo: e.target.value || undefined })}
                />
            </div>

            {/* Has Orders */}
            <div>
                <Label htmlFor="hasOrders">Has Orders</Label>
                <Select
                    id="hasOrders"
                    value={filters.hasOrders === undefined ? '' : String(filters.hasOrders)}
                    onChange={(e) => onFilterChange({ hasOrders: e.target.value === '' ? undefined : e.target.value === 'true' })}
                >
                    <option value="">All</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </Select>
            </div>

            {/* Has Reviews */}
            <div>
                <Label htmlFor="hasReviews">Has Reviews</Label>
                <Select
                    id="hasReviews"
                    value={filters.hasReviews === undefined ? '' : String(filters.hasReviews)}
                    onChange={(e) => onFilterChange({ hasReviews: e.target.value === '' ? undefined : e.target.value === 'true' })}
                >
                    <option value="">All</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                </Select>
            </div>

            {/* State */}
            <div>
                <Label htmlFor="state">State</Label>
                <Input
                    id="state"
                    placeholder="Filter by state"
                    value={filters.state || ''}
                    onChange={(e) => onFilterChange({ state: e.target.value || undefined })}
                />
            </div>

            {/* City */}
            <div>
                <Label htmlFor="city">City</Label>
                <Input
                    id="city"
                    placeholder="Filter by city"
                    value={filters.city || ''}
                    onChange={(e) => onFilterChange({ city: e.target.value || undefined })}
                />
            </div>

            {/* Sort By */}
            <div>
                <Label htmlFor="sortBy">Sort By</Label>
                <Select
                    id="sortBy"
                    value={filters.sortBy || 'createdAt'}
                    onChange={(e) => onFilterChange({ sortBy: e.target.value })}
                >
                    <option value="createdAt">Registration Date</option>
                    <option value="name">Name</option>
                    <option value="email">Email</option>
                </Select>
            </div>

            {/* Sort Order */}
            <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Select
                    id="sortOrder"
                    value={filters.sortOrder || 'desc'}
                    onChange={(e) => onFilterChange({ sortOrder: e.target.value as 'asc' | 'desc' })}
                >
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                </Select>
            </div>
        </div>
    );
}

