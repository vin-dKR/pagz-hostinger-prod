/**
 * Enhanced Users List Component
 * Displays comprehensive user management with filters, search, sorting, and bulk actions
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { PageLoading } from '@/app/components/ui/loading';
import { Alert } from '@/app/components/ui/alert';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
    getUsers,
    getUserStatistics,
    exportUsers,
    type User,
    type UserQueryParams,
    type UserStatisticsResponse,
} from '@/lib/api/users.service';
import { formatDate } from '@/lib/utils/format';
import { Edit, Trash2, Eye, Mail, Phone, Download, Filter, X, LayoutGrid, List, Table2 } from 'lucide-react';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useRouter } from 'next/navigation';
import { UserStats } from './user-stats';
import { UserFilters } from './user-filters';
import { BulkActions } from './bulk-actions';
import { EditUserModal } from './edit-user-modal';
import { UserAnalytics } from './user-analytics';
import { toastError, toastSuccess } from '@/lib/utils/toast';
type ViewMode = 'table' | 'card' | 'list';

export function UsersList() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [statistics, setStatistics] = useState<UserStatisticsResponse | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const debouncedSearch = useDebouncedValue(searchInput, 400);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Filter states
    const [filters, setFilters] = useState<UserQueryParams>({
        role: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        hasOrders: undefined,
        hasReviews: undefined,
        state: undefined,
        city: undefined,
        country: undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
    });

    useEffect(() => {
        loadUsers(page, debouncedSearch, filters);
        loadStatistics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, debouncedSearch]);

    useEffect(() => {
        if (hasLoadedOnce) {
            setPage(1);
            loadUsers(1, debouncedSearch, filters);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);

    const loadUsers = async (pageParam = 1, searchParam = '', filtersParam = filters) => {
        try {
            setIsLoading(true);
            setError(null);
            const params: UserQueryParams = {
                page: pageParam,
                limit: 20,
                search: searchParam || undefined,
                ...filtersParam,
            };
            const data = await getUsers(params);
            setUsers(data.items);
            setTotalPages(data.pagination.totalPages);
            setHasLoadedOnce(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load users');
        } finally {
            setIsLoading(false);
        }
    };

    const loadStatistics = async () => {
        try {
            const stats = await getUserStatistics();
            setStatistics(stats);
        } catch (err) {
            console.error('Failed to load statistics:', err);
        }
    };

    const handleFilterChange = (newFilters: Partial<UserQueryParams>) => {
        setFilters((prev) => ({ ...prev, ...newFilters }));
    };

    const clearFilters = () => {
        setFilters({
            role: undefined,
            dateFrom: undefined,
            dateTo: undefined,
            hasOrders: undefined,
            hasReviews: undefined,
            state: undefined,
            city: undefined,
            country: undefined,
            sortBy: 'createdAt',
            sortOrder: 'desc',
        });
    };

    const handleSelectUser = (userId: string) => {
        setSelectedUsers((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(userId)) {
                newSet.delete(userId);
            } else {
                newSet.add(userId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        if (selectedUsers.size === users.length) {
            setSelectedUsers(new Set());
        } else {
            setSelectedUsers(new Set(users.map((u) => u.id)));
        }
    };

    const handleEdit = (user: User) => {
        setEditingUser(user);
        setIsEditModalOpen(true);
    };

    const handleEditSuccess = () => {
        loadUsers(page, debouncedSearch, filters);
        loadStatistics();
    };

    const handleExport = async () => {
        try {
            setIsLoading(true);
            await exportUsers('csv', {
                role: filters.role,
                dateFrom: filters.dateFrom,
                dateTo: filters.dateTo,
            });
            toastSuccess('Users exported successfully');
        } catch (err) {
            toastError(err instanceof Error ? err.message : 'Failed to export users');
        } finally {
            setIsLoading(false);
        }
    };

    const getInitials = (name?: string, email?: string) => {
        if (name) {
            return name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);
        }
        return email ? email[0]?.toUpperCase() : 'U';
    };

    const getRoleBadge = (user: User) => {
        if (user.isSuperAdmin) {
            return <Badge variant="destructive">Super Admin</Badge>;
        }
        if (user.isAdmin) {
            return <Badge variant="default">Admin</Badge>;
        }
        return <Badge variant="secondary">Customer</Badge>;
    };

    // Full-page loading only on very first load
    if (!hasLoadedOnce && isLoading) {
        return <PageLoading />;
    }

    return (
        <div className="space-y-6">
            {/* Statistics Dashboard */}
            {statistics && (
                <>
                    <UserStats statistics={statistics} />
                    <UserAnalytics statistics={statistics} />
                </>
            )}

            <Card>
                <CardContent className="p-0">
                    {/* Header: search + filters + view toggle */}
                    <div className="flex items-center justify-between px-4 py-3 gap-4 border-b">
                        <div className="flex items-center gap-2 flex-1">
                            <Input
                                className="max-w-sm"
                                placeholder="Search by name, email, phone, or ID..."
                                value={searchInput}
                                onChange={(e) => {
                                    setPage(1);
                                    setSearchInput(e.target.value);
                                }}
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                <Filter className="h-4 w-4 mr-2" />
                                Filters
                                {Object.values(filters).some((v) => v !== undefined && v !== 'createdAt' && v !== 'desc') && (
                                    <Badge variant="secondary" className="ml-2">
                                        {Object.values(filters).filter((v) => v !== undefined && v !== 'createdAt' && v !== 'desc').length}
                                    </Badge>
                                )}
                            </Button>
                            {Object.values(filters).some((v) => v !== undefined && v !== 'createdAt' && v !== 'desc') && (
                                <Button variant="ghost" size="sm" onClick={clearFilters}>
                                    <X className="h-4 w-4 mr-2" />
                                    Clear
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExport}
                                disabled={isLoading}
                            >
                                <Download className="h-4 w-4 mr-2" />
                                Export
                            </Button>
                            <div className="flex items-center gap-1 border rounded-md">
                                <Button
                                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('table')}
                                >
                                    <Table2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={viewMode === 'card' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('card')}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('list')}
                                >
                                    <List className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Filters Panel */}
                    {showFilters && (
                        <div className="px-4 py-3 border-b bg-gray-50">
                            <UserFilters filters={filters} onFilterChange={handleFilterChange} />
                        </div>
                    )}

                    {/* Bulk Actions */}
                    {selectedUsers.size > 0 && (
                        <div className="px-4 py-2 border-b bg-blue-50">
                            <BulkActions
                                selectedCount={selectedUsers.size}
                                selectedUserIds={Array.from(selectedUsers)}
                                onClearSelection={() => setSelectedUsers(new Set())}
                                onUpdate={() => {
                                    loadUsers(page, debouncedSearch, filters);
                                    loadStatistics();
                                }}
                            />
                        </div>
                    )}

                    {/* Inline error */}
                    {error && (
                        <div className="px-4 pb-2 pt-2">
                            <Alert variant="error">
                                {error}
                                <Button
                                    onClick={() => loadUsers(page, debouncedSearch, filters)}
                                    variant="outline"
                                    size="sm"
                                    className="ml-4"
                                >
                                    Retry
                                </Button>
                            </Alert>
                        </div>
                    )}

                    {/* Table / Card / List View */}
                    <div className="relative">
                        {isLoading && hasLoadedOnce && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/5 text-xs text-gray-500">
                                Updating results...
                            </div>
                        )}

                        {users.length === 0 && !isLoading && !error ? (
                            <div className="px-4 pb-6 pt-6">
                                <Card>
                                    <CardContent className="py-8 text-center">
                                        <p className="text-gray-600">
                                            No users found. Try adjusting your search or filters.
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : viewMode === 'table' ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <input
                                                type="checkbox"
                                                checked={selectedUsers.size === users.length && users.length > 0}
                                                onChange={handleSelectAll}
                                                className="rounded border-gray-300"
                                            />
                                        </TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Contact</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Statistics</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUsers.has(user.id)}
                                                    onChange={() => handleSelectUser(user.id)}
                                                    className="rounded border-gray-300"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                                        {getInitials(user.name, user.email)}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{user.name || 'N/A'}</div>
                                                        <div className="text-sm text-gray-500">{user.id.slice(0, 8)}...</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <a
                                                        href={`mailto:${user.email}`}
                                                        className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                                    >
                                                        <Mail className="h-3 w-3" />
                                                        {user.email}
                                                    </a>
                                                    {user.phone && (
                                                        <a
                                                            href={`tel:${user.phone}`}
                                                            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                                        >
                                                            <Phone className="h-3 w-3" />
                                                            {user.phone}
                                                        </a>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getRoleBadge(user)}</TableCell>
                                            <TableCell>
                                                {user.statistics && (
                                                    <div className="flex flex-wrap gap-2 text-xs">
                                                        <Badge variant="outline">
                                                            {user.statistics.totalOrders} orders
                                                        </Badge>
                                                        <Badge variant="outline">
                                                            ₹{user.statistics.totalSpent.toLocaleString()}
                                                        </Badge>
                                                        <Badge variant="outline">
                                                            {user.statistics.totalReviews} reviews
                                                        </Badge>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>{formatDate(user.createdAt)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => router.push(`/users/${user.id}`)}
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEdit(user)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon">
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : viewMode === 'card' ? (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {users.map((user) => (
                                    <Card key={user.id}>
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                                        {getInitials(user.name, user.email)}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{user.name || 'N/A'}</div>
                                                        <div className="text-sm text-gray-500">{user.email}</div>
                                                    </div>
                                                </div>
                                                {getRoleBadge(user)}
                                            </div>
                                            {user.statistics && (
                                                <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                                                    <div>
                                                        <div className="text-gray-500">Orders</div>
                                                        <div className="font-semibold">{user.statistics.totalOrders}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-500">Spent</div>
                                                        <div className="font-semibold">₹{user.statistics.totalSpent.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-500">Reviews</div>
                                                        <div className="font-semibold">{user.statistics.totalReviews}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-500">Addresses</div>
                                                        <div className="font-semibold">{user.statistics.addressesCount}</div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1"
                                                    onClick={() => router.push(`/users/${user.id}`)}
                                                >
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    View
                                                </Button>
                                                <Button variant="outline" size="sm">
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="divide-y">
                                {users.map((user) => (
                                    <div key={user.id} className="px-4 py-3 hover:bg-gray-50 flex items-center justify-between">
                                        <div className="flex items-center gap-4 flex-1">
                                            <input
                                                type="checkbox"
                                                checked={selectedUsers.has(user.id)}
                                                onChange={() => handleSelectUser(user.id)}
                                                className="rounded border-gray-300"
                                            />
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                                                {getInitials(user.name, user.email)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium">{user.name || 'N/A'}</div>
                                                <div className="text-sm text-gray-500">{user.email}</div>
                                            </div>
                                            {getRoleBadge(user)}
                                            {user.statistics && (
                                                <div className="text-sm text-gray-500">
                                                    {user.statistics.totalOrders} orders • ₹{user.statistics.totalSpent.toLocaleString()}
                                                </div>
                                            )}
                                            <div className="text-sm text-gray-500">{formatDate(user.createdAt)}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => router.push(`/users/${user.id}`)}
                                            >
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(user)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between gap-4 flex-nowrap px-4 py-3 border-t">
                        <div className="text-sm text-[var(--color-foreground-secondary)] whitespace-nowrap">
                            Showing {users.length > 0 ? (page - 1) * 20 + 1 : 0} to {Math.min(page * 20, (page - 1) * 20 + users.length)} of{' '}
                            {totalPages * 20} results
                        </div>
                        <div className="flex items-center gap-2 flex-nowrap flex-shrink-0">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1 || isLoading}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="flex-shrink-0"
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-[var(--color-foreground-secondary)] whitespace-nowrap">
                                Page {page} of {Math.max(totalPages, 1)}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages || isLoading}
                                onClick={() => setPage((p) => Math.min(totalPages || 1, p + 1))}
                                className="flex-shrink-0"
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Edit User Modal */}
            <EditUserModal
                open={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingUser(null);
                }}
                user={editingUser}
                onSuccess={handleEditSuccess}
                currentUserIsSuperAdmin={false} // TODO: Get from auth context
            />
        </div>
    );
}
