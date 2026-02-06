/**
 * Edit User Modal Component
 * Modal for editing user information with role-based restrictions
 */

'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select } from '@/app/components/ui/select';
import { Alert } from '@/app/components/ui/alert';
import { updateUser, type User, type UpdateUserData } from '@/lib/api/users.service';
import { Shield, Mail, Phone, User as UserIcon } from 'lucide-react';

interface EditUserModalProps {
    open: boolean;
    onClose: () => void;
    user: User | null;
    onSuccess?: () => void;
    currentUserIsSuperAdmin?: boolean;
}

export function EditUserModal({ open, onClose, user, onSuccess, currentUserIsSuperAdmin = false }: EditUserModalProps) {
    const [formData, setFormData] = useState<UpdateUserData>({
        name: '',
        email: '',
        phone: '',
        isAdmin: false,
        isSuperAdmin: false,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                isAdmin: user.isAdmin,
                isSuperAdmin: user.isSuperAdmin,
            });
            setError(null);
            setValidationErrors({});
        }
    }, [user]);

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        if (!formData.email || !formData.email.trim()) {
            errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'Invalid email format';
        }

        if (formData.phone && formData.phone.trim()) {
            // Basic phone validation (adjust as needed)
            const phoneRegex = /^[\d\s\-\+\(\)]+$/;
            if (!phoneRegex.test(formData.phone)) {
                errors.phone = 'Invalid phone number format';
            }
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!validateForm() || !user) {
            return;
        }

        // Check if user is trying to change their own role
        // This should be checked on the backend, but we can prevent it here too
        if (!currentUserIsSuperAdmin && (formData.isAdmin !== user.isAdmin || formData.isSuperAdmin !== user.isSuperAdmin)) {
            setError('Only super admins can change user roles');
            return;
        }

        setIsSubmitting(true);

        try {
            // Prepare update data
            const updateData: UpdateUserData = {
                name: formData.name || undefined,
                email: formData.email,
                phone: formData.phone || undefined,
            };

            // Only include role changes if current user is super admin
            if (currentUserIsSuperAdmin) {
                updateData.isAdmin = formData.isAdmin;
                updateData.isSuperAdmin = formData.isSuperAdmin;
            }

            await updateUser(user.id, updateData);
            onSuccess?.();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update user');
        } finally {
            setIsSubmitting(false);
        }
    };

    const canChangeRole = currentUserIsSuperAdmin && user && !user.isSuperAdmin;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogClose onClose={onClose} />
                <DialogHeader>
                    <DialogTitle>Edit User</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <Alert variant="error">{error}</Alert>
                    )}

                    {/* Name */}
                    <div>
                        <Label htmlFor="name">
                            <UserIcon className="h-4 w-4 inline mr-2" />
                            Full Name
                        </Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Enter full name"
                        />
                        {validationErrors.name && (
                            <p className="text-sm text-red-600 mt-1">{validationErrors.name}</p>
                        )}
                    </div>

                    {/* Email */}
                    <div>
                        <Label htmlFor="email">
                            <Mail className="h-4 w-4 inline mr-2" />
                            Email <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="user@example.com"
                            required
                        />
                        {validationErrors.email && (
                            <p className="text-sm text-red-600 mt-1">{validationErrors.email}</p>
                        )}
                    </div>

                    {/* Phone */}
                    <div>
                        <Label htmlFor="phone">
                            <Phone className="h-4 w-4 inline mr-2" />
                            Phone Number
                        </Label>
                        <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+1234567890"
                        />
                        {validationErrors.phone && (
                            <p className="text-sm text-red-600 mt-1">{validationErrors.phone}</p>
                        )}
                    </div>

                    {/* Role Management (Super Admin Only) */}
                    {canChangeRole && (
                        <div className="border-t pt-4">
                            <Label className="flex items-center gap-2 mb-3">
                                <Shield className="h-4 w-4" />
                                Role Management (Super Admin Only)
                            </Label>
                            <div className="space-y-3">
                                <div>
                                    <Select
                                        value={formData.isSuperAdmin ? 'super_admin' : formData.isAdmin ? 'admin' : 'customer'}
                                        onChange={(e) => {
                                            const role = e.target.value;
                                            setFormData({
                                                ...formData,
                                                isSuperAdmin: role === 'super_admin',
                                                isAdmin: role === 'admin' || role === 'super_admin',
                                            });
                                        }}
                                    >
                                        <option value="customer">Customer</option>
                                        <option value="admin">Admin</option>
                                        <option value="super_admin">Super Admin</option>
                                    </Select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Only super admins can change user roles. Cannot change super admin roles.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!canChangeRole && user?.isSuperAdmin && (
                        <div className="border-t pt-4">
                            <Alert variant="error">
                                Super admin roles cannot be changed.
                            </Alert>
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

