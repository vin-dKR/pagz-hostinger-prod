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
import { Edit, Trash2, Eye, Mail, Phone, Download, Filter, X, LayoutGrid, List, Table2, Search, UsersRound } from 'lucide-react';
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
        <div className="space-y-5">
            {/* Statistics Dashboard */}
            {statistics && (
                <>
                    <UserStats statistics={statistics} />
                    <UserAnalytics statistics={statistics} />
                </>
            )}

            <Card className="overflow-hidden">
                <CardContent className="p-0">
                    {/* Header: search + filters + view toggle */}
                    <div className="admin-toolbar flex flex-col gap-3 border-b border-[var(--color-border)] p-4 sm:px-5 sm:py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-semibold text-[var(--color-foreground)]">Directory</h2>
                                <p className="mt-0.5 text-xs text-[var(--color-foreground-secondary)]">{statistics ? `${statistics.totalUsers.toLocaleString()} total accounts` : 'Browse accounts'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExport}
                                disabled={isLoading}
                                className="gap-2"
                            >
                                <Download className="h-4 w-4" />
                                Export
                            </Button>
                            <div className="flex items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background-secondary)] p-0.5" role="group" aria-label="User view">
                                <Button
                                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('table')}
                                    aria-label="Table view"
                                    title="Table view"
                                    className="h-8 w-8 px-0"
                                >
                                    <Table2 className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={viewMode === 'card' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('card')}
                                    aria-label="Card view"
                                    title="Card view"
                                    className="h-8 w-8 px-0"
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                                    size="sm"
                                    onClick={() => setViewMode('list')}
                                    aria-label="List view"
                                    title="List view"
                                    className="h-8 w-8 px-0"
                                >
                                    <List className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative min-w-[220px] flex-1 sm:max-w-md">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-foreground-tertiary)]" aria-hidden="true" />
                                <Input
                                    type="search"
                                    aria-label="Search users"
                                    className="h-9 rounded-lg bg-[var(--color-background)] pl-9"
                                    placeholder="Search name, email, phone, or ID"
                                    value={searchInput}
                                    onChange={(e) => { setPage(1); setSearchInput(e.target.value); }}
                                />
                            </div>
                            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
                                <Filter className="h-4 w-4" />
                                Filters
                                {Object.values(filters).some((v) => v !== undefined && v !== 'createdAt' && v !== 'desc') && <Badge variant="secondary">{Object.values(filters).filter((v) => v !== undefined && v !== 'createdAt' && v !== 'desc').length}</Badge>}
                            </Button>
                            {Object.values(filters).some((v) => v !== undefined && v !== 'createdAt' && v !== 'desc') && <Button variant="ghost" size="sm" className="gap-1.5" onClick={clearFilters}><X className="h-4 w-4" />Clear</Button>}
                        </div>
                    </div>

                    {/* Filters Panel */}
                    {showFilters && (
                        <div className="border-b border-[var(--color-border)] bg-[var(--color-background-secondary)] px-4 py-4 sm:px-5">
                            <UserFilters filters={filters} onFilterChange={handleFilterChange} />
                        </div>
                    )}

                    {/* Bulk Actions */}
                    {selectedUsers.size > 0 && (
                        <div className="border-b border-[var(--color-border)] bg-[var(--color-accent)] px-4 py-3 sm:px-5">
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
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-card)]/75 text-sm font-medium text-[var(--color-foreground-secondary)] backdrop-blur-[1px]">
                                Updating results…
                            </div>
                        )}

                        {users.length === 0 && !isLoading && !error ? (
                            <div className="flex flex-col items-center px-6 py-16 text-center">
                                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-background-secondary)] text-[var(--color-foreground-secondary)]"><UsersRound className="h-6 w-6" /></span>
                                <h3 className="text-base font-semibold text-[var(--color-foreground)]">No users found</h3>
                                <p className="mt-1 text-sm text-[var(--color-foreground-secondary)]">Try another search or adjust the filters.</p>
                            </div>
                        ) : viewMode === 'table' ? (
                            <>
                            <div className="hidden xl:block [&>div]:!rounded-none [&>div]:!border-0">
                            <Table className="min-w-[1040px]">
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
                                        <TableRow key={user.id} className="hover:bg-[var(--color-background-secondary)]">
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
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] text-xs font-semibold text-[var(--color-primary)]">
                                                        {getInitials(user.name, user.email)}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-[var(--color-foreground)]">{user.name || 'N/A'}</div>
                                                        <div className="mt-0.5 font-mono text-[11px] text-[var(--color-foreground-tertiary)]">{user.id.slice(0, 8)}...</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <a
                                                        href={`mailto:${user.email}`}
                                                        className="flex items-center gap-1 text-xs text-[var(--color-foreground)] hover:text-[var(--color-primary)] hover:underline"
                                                    >
                                                        <Mail className="h-3 w-3" />
                                                        {user.email}
                                                    </a>
                                                    {user.phone && (
                                                        <a
                                                            href={`tel:${user.phone}`}
                                                            className="flex items-center gap-1 text-xs text-[var(--color-foreground-secondary)] hover:text-[var(--color-primary)] hover:underline"
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
                                            <TableCell className="whitespace-nowrap text-xs text-[var(--color-foreground-secondary)]">{formatDate(user.createdAt)}</TableCell>
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
                            </div>
                            <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:hidden">
                                {users.map((user) => (
                                    <article key={user.id} className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                                        <div className="flex items-start gap-3">
                                            <input type="checkbox" aria-label={`Select ${user.name || user.email}`} checked={selectedUsers.has(user.id)} onChange={() => handleSelectUser(user.id)} className="mt-3 rounded border-[var(--color-border)]" />
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] text-xs font-semibold text-[var(--color-primary)]">{getInitials(user.name, user.email)}</div>
                                            <div className="min-w-0 flex-1"><button type="button" onClick={() => router.push(`/users/${user.id}`)} className="block max-w-full truncate text-left text-sm font-semibold text-[var(--color-foreground)] hover:text-[var(--color-primary)]">{user.name || 'N/A'}</button><p className="mt-0.5 truncate text-xs text-[var(--color-foreground-secondary)]">{user.email}</p></div>
                                            {getRoleBadge(user)}
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-3 text-xs sm:grid-cols-4">
                                            <div><p className="text-[var(--color-foreground-tertiary)]">Orders</p><p className="mt-1 font-semibold tabular-nums text-[var(--color-foreground)]">{user.statistics?.totalOrders ?? '—'}</p></div>
                                            <div><p className="text-[var(--color-foreground-tertiary)]">Spent</p><p className="mt-1 font-semibold tabular-nums text-[var(--color-foreground)]">{user.statistics ? `₹${user.statistics.totalSpent.toLocaleString()}` : '—'}</p></div>
                                            <div><p className="text-[var(--color-foreground-tertiary)]">Reviews</p><p className="mt-1 font-semibold tabular-nums text-[var(--color-foreground)]">{user.statistics?.totalReviews ?? '—'}</p></div>
                                            <div><p className="text-[var(--color-foreground-tertiary)]">Created</p><p className="mt-1 font-semibold text-[var(--color-foreground)]">{formatDate(user.createdAt)}</p></div>
                                        </div>
                                        <div className="mt-3 flex justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`View ${user.name || user.email}`} onClick={() => router.push(`/users/${user.id}`)}><Eye className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${user.name || user.email}`} onClick={() => handleEdit(user)}><Edit className="h-4 w-4" /></Button></div>
                                    </article>
                                ))}
                            </div>
                            </>
                        ) : viewMode === 'card' ? (
                            <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 2xl:grid-cols-3">
                                {users.map((user) => (
                                    <Card key={user.id} className="min-w-0 shadow-none hover:border-[var(--color-primary)]">
                                        <CardContent className="p-4">
                                            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] text-xs font-semibold text-[var(--color-primary)]">
                                                        {getInitials(user.name, user.email)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-semibold text-[var(--color-foreground)]">{user.name || 'N/A'}</div>
                                                        <div className="truncate text-xs text-[var(--color-foreground-secondary)]">{user.email}</div>
                                                    </div>
                                                </div>
                                                {getRoleBadge(user)}
                                            </div>
                                            {user.statistics && (
                                                <div className="mb-4 grid grid-cols-2 gap-3 border-y border-[var(--color-border)] py-3 text-xs">
                                                    <div>
                                                        <div className="text-[var(--color-foreground-tertiary)]">Orders</div>
                                                        <div className="mt-1 font-semibold tabular-nums text-[var(--color-foreground)]">{user.statistics.totalOrders}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[var(--color-foreground-tertiary)]">Spent</div>
                                                        <div className="mt-1 font-semibold tabular-nums text-[var(--color-foreground)]">₹{user.statistics.totalSpent.toLocaleString()}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[var(--color-foreground-tertiary)]">Reviews</div>
                                                        <div className="mt-1 font-semibold tabular-nums text-[var(--color-foreground)]">{user.statistics.totalReviews}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[var(--color-foreground-tertiary)]">Addresses</div>
                                                        <div className="mt-1 font-semibold tabular-nums text-[var(--color-foreground)]">{user.statistics.addressesCount}</div>
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
                                                <Button variant="outline" size="sm" aria-label={`Edit ${user.name || user.email}`}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <div className="divide-y divide-[var(--color-border)]">
                                {users.map((user) => (
                                    <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-background-secondary)] sm:px-5">
                                        <div className="flex min-w-0 flex-1 items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedUsers.has(user.id)}
                                                onChange={() => handleSelectUser(user.id)}
                                                className="rounded border-gray-300"
                                            />
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-accent)] text-xs font-semibold text-[var(--color-primary)]">
                                                {getInitials(user.name, user.email)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-sm font-semibold text-[var(--color-foreground)]">{user.name || 'N/A'}</div>
                                                <div className="truncate text-xs text-[var(--color-foreground-secondary)]">{user.email}</div>
                                            </div>
                                            {getRoleBadge(user)}
                                            {user.statistics && (
                                                <div className="hidden text-xs tabular-nums text-[var(--color-foreground-secondary)] lg:block">
                                                    {user.statistics.totalOrders} orders • ₹{user.statistics.totalSpent.toLocaleString()}
                                                </div>
                                            )}
                                            <div className="hidden text-xs text-[var(--color-foreground-secondary)] lg:block">{formatDate(user.createdAt)}</div>
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
                    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-foreground-secondary)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <div className="tabular-nums">
                            Showing {users.length > 0 ? (page - 1) * 20 + 1 : 0}–{Math.min(page * 20, (page - 1) * 20 + users.length)} · Page {page} of {Math.max(totalPages, 1)}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1 || isLoading}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="flex-shrink-0"
                            >
                                Previous
                            </Button>
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
