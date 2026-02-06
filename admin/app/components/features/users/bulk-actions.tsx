/**
 * Bulk Actions Component
 * Handles bulk operations on selected users
 */

'use client';

import { Button } from '@/app/components/ui/button';
import { Select } from '@/app/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { updateUser, deleteUser, exportUsers, type User } from '@/lib/api/users.service';
import { toastError, toastSuccess, toastInfo, toastPromise } from '@/lib/utils/toast';

interface BulkActionsProps {
    selectedCount: number;
    selectedUserIds: string[];
    onClearSelection: () => void;
    onUpdate?: () => void;
}

export function BulkActions({ selectedCount, selectedUserIds, onClearSelection, onUpdate }: BulkActionsProps) {
    const [action, setAction] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [newRole, setNewRole] = useState<'customer' | 'admin' | 'super_admin'>('customer');

    const handleBulkAction = async () => {
        if (!action) return;

        setError(null);

        switch (action) {
            case 'export':
                await handleBulkExport();
                break;
            case 'email':
                // TODO: Implement bulk email
                toastInfo('Bulk email functionality coming soon');
                break;
            case 'role':
                setIsRoleModalOpen(true);
                break;
            case 'delete':
                setIsDeleteModalOpen(true);
                break;
        }
    };

    const handleBulkExport = async () => {
        try {
            setIsProcessing(true);
            // Export only selected users
            await exportUsers('csv', { userIds: selectedUserIds });
            onClearSelection();
            setAction('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to export users');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBulkRoleUpdate = async () => {
        try {
            setIsProcessing(true);
            setError(null);

            const isSuperAdmin = newRole === 'super_admin';
            const isAdmin = newRole === 'admin' || isSuperAdmin;

            // Update all selected users
            const updates = selectedUserIds.map(userId =>
                updateUser(userId, {
                    isAdmin,
                    isSuperAdmin,
                })
            );

            await Promise.all(updates);
            setIsRoleModalOpen(false);
            setAction('');
            onClearSelection();
            onUpdate?.();
            toastSuccess(`Successfully updated ${selectedUserIds.length} user(s) to ${newRole}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update user roles');
            toastError(err instanceof Error ? err.message : 'Failed to update user roles');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBulkDelete = async () => {
        try {
            setIsProcessing(true);
            setError(null);

            // Delete all selected users
            const deletions = selectedUserIds.map(userId => deleteUser(userId));

            await Promise.all(deletions);
            setIsDeleteModalOpen(false);
            setAction('');
            onClearSelection();
            onUpdate?.();
            toastSuccess(`Successfully deleted ${selectedUserIds.length} user(s)`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete users');
            toastError(err instanceof Error ? err.message : 'Failed to delete users');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <>
            <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                    {selectedCount} user{selectedCount !== 1 ? 's' : ''} selected
                </span>
                <Select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="max-w-xs"
                >
                    <option value="">Select action...</option>
                    <option value="export">Export to CSV</option>
                    <option value="email">Send Email</option>
                    <option value="role">Change Role</option>
                    <option value="delete">Delete</option>
                </Select>
                <Button
                    size="sm"
                    onClick={handleBulkAction}
                    disabled={!action || isProcessing}
                >
                    {isProcessing ? 'Processing...' : 'Apply'}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearSelection}
                    disabled={isProcessing}
                >
                    Clear Selection
                </Button>
            </div>

            {/* Role Change Modal */}
            <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
                <DialogContent>
                    <DialogClose onClose={() => setIsRoleModalOpen(false)} />
                    <DialogHeader>
                        <DialogTitle>Change Role for {selectedCount} User(s)</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {error && <Alert variant="error">{error}</Alert>}
                        <Alert variant="error">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            This will change the role for {selectedCount} selected user(s). Only super admins can change roles.
                        </Alert>
                        <div>
                            <Label htmlFor="newRole">New Role</Label>
                            <Select
                                id="newRole"
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value as any)}
                            >
                                <option value="customer">Customer</option>
                                <option value="admin">Admin</option>
                                <option value="super_admin">Super Admin</option>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRoleModalOpen(false)} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button onClick={handleBulkRoleUpdate} disabled={isProcessing}>
                            {isProcessing ? 'Updating...' : 'Update Role'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
                <DialogContent>
                    <DialogClose onClose={() => setIsDeleteModalOpen(false)} />
                    <DialogHeader>
                        <DialogTitle>Delete {selectedCount} User(s)?</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {error && <Alert variant="error">{error}</Alert>}
                        <Alert variant="error">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            This action cannot be undone. This will permanently delete {selectedCount} user(s) and all their associated data.
                        </Alert>
                        <p className="text-sm text-gray-600">
                            Are you sure you want to delete these users? This action is irreversible.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={isProcessing}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleBulkDelete}
                            disabled={isProcessing}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isProcessing ? 'Deleting...' : 'Delete Users'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
