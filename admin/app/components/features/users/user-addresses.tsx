/**
 * User Addresses Tab Component
 * Displays and manages user addresses
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { PageLoading } from '@/app/components/ui/loading';
import { getUserAddresses, addUserAddress, updateUserAddress, deleteUserAddress, setDefaultAddress, type Address } from '@/lib/api/users.service';
import { MapPin, Edit, Trash2, Star, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { toastError, toastSuccess, toastPromise } from '@/lib/utils/toast';
import { useConfirm } from '@/lib/hooks/use-confirm';

interface UserAddressesProps {
    userId: string;
}

export function UserAddresses({ userId }: UserAddressesProps) {
    const [addresses, setAddresses] = useState<Address[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const { confirm, ConfirmDialog } = useConfirm();
    const [formData, setFormData] = useState({
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'India',
        isDefault: false,
    });

    useEffect(() => {
        loadAddresses();
    }, [userId]);

    const loadAddresses = async () => {
        try {
            setIsLoading(true);
            const data = await getUserAddresses(userId);
            setAddresses(data);
        } catch (error) {
            console.error('Failed to load addresses:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingAddress(null);
        setFormData({
            street: '',
            city: '',
            state: '',
            zipCode: '',
            country: 'India',
            isDefault: false,
        });
        setIsDialogOpen(true);
    };

    const handleEdit = (address: Address) => {
        setEditingAddress(address);
        setFormData({
            street: address.street,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode,
            country: address.country,
            isDefault: address.isDefault,
        });
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        try {
            if (editingAddress) {
                await updateUserAddress(userId, editingAddress.id, formData);
            } else {
                await addUserAddress(userId, formData);
            }
            setIsDialogOpen(false);
            loadAddresses();
            toastSuccess('Address saved successfully');
        } catch (error) {
            console.error('Failed to save address:', error);
            toastError('Failed to save address');
        }
    };

    const handleDelete = async (addressId: string) => {
        const confirmed = await confirm({
            title: 'Delete Address',
            description: 'Are you sure you want to delete this address? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                try {
                    await toastPromise(
                        deleteUserAddress(userId, addressId),
                        {
                            loading: 'Deleting address...',
                            success: 'Address deleted successfully',
                            error: 'Failed to delete address',
                        }
                    );
                    loadAddresses();
                } catch (error) {
                    console.error('Failed to delete address:', error);
                }
            },
        });
    };

    const handleSetDefault = async (addressId: string) => {
        try {
            await toastPromise(
                setDefaultAddress(userId, addressId),
                {
                    loading: 'Setting default address...',
                    success: 'Default address updated',
                    error: 'Failed to set default address',
                }
            );
            loadAddresses();
        } catch (error) {
            console.error('Failed to set default address:', error);
        }
    };

    if (isLoading) {
        return (
            <>
                {ConfirmDialog}
                <PageLoading />
            </>
        );
    }

    return (
        <>
            {ConfirmDialog}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Addresses ({addresses.length})</h3>
                    <Button onClick={handleAdd}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Address
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addresses.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center text-gray-500">
                                No addresses found
                            </CardContent>
                        </Card>
                    ) : (
                        addresses.map((address) => (
                            <Card key={address.id}>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-5 w-5 text-gray-400" />
                                            {address.isDefault && (
                                                <Badge variant="default">
                                                    <Star className="h-3 w-3 mr-1" />
                                                    Default
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(address)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(address.id)}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                        <p className="font-medium">{address.street}</p>
                                        <p>
                                            {address.city}, {address.state} {address.zipCode}
                                        </p>
                                        <p>{address.country}</p>
                                        {address._count && (
                                            <p className="text-gray-500 text-xs mt-2">
                                                Used in {address._count.orders} order(s)
                                            </p>
                                        )}
                                        {!address.isDefault && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="mt-2"
                                                onClick={() => handleSetDefault(address.id)}
                                            >
                                                Set as Default
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* Add/Edit Dialog */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingAddress ? 'Edit Address' : 'Add Address'}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="street">Street</Label>
                                <Input
                                    id="street"
                                    value={formData.street}
                                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="city">City</Label>
                                    <Input
                                        id="city"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="state">State</Label>
                                    <Input
                                        id="state"
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="zipCode">Zip Code</Label>
                                    <Input
                                        id="zipCode"
                                        value={formData.zipCode}
                                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="country">Country</Label>
                                    <Input
                                        id="country"
                                        value={formData.country}
                                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isDefault"
                                    checked={formData.isDefault}
                                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                />
                                <Label htmlFor="isDefault">Set as default address</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSave}>Save</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}

