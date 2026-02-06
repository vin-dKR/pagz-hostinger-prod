"use client";

import { useState } from "react";
import { MapPin, Plus, Edit2, Trash2, Check, X } from "lucide-react";
import { useAddresses } from "@/hooks/addresses/useAddresses";
import { BarsSpinner } from "@/app/components/shared/BarsSpinner";
import { CreateAddressData, Address, UpdateAddressData } from "@/lib/api/addresses";
import { toastError, toastSuccess, toastPromise } from "@/lib/utils/toast";
import { useConfirm } from "@/lib/hooks/use-confirm";

function AddressesPageContent() {
    const { addresses, user, loading, error, createAddress, updateAddress, deleteAddress, setDefaultAddress } = useAddresses();
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<CreateAddressData>({
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "India",
        isDefault: false,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { confirm, ConfirmDialog } = useConfirm();

    const handleEdit = (address: Address) => {
        setEditingId(address.id);
        setFormData({
            street: address.street,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode,
            country: address.country,
        });
        setShowAddForm(false);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setFormData({
            street: "",
            city: "",
            state: "",
            zipCode: "",
            country: "IN",
        });
    };

    const handleSetDefault = async (id: string) => {
        const success = await toastPromise(
            setDefaultAddress(id),
            {
                loading: 'Setting default address...',
                success: 'Default address updated',
                error: 'Failed to set default address. Please try again.',
            }
        );
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirm({
            title: 'Delete Address',
            description: 'Are you sure you want to delete this address? This action cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            variant: 'destructive',
            onConfirm: async () => {
                const success = await toastPromise(
                    deleteAddress(id),
                    {
                        loading: 'Deleting address...',
                        success: 'Address deleted successfully',
                        error: 'Failed to delete address. Please try again.',
                    }
                );
            },
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (editingId) {
                // Update existing address
                const updateData: UpdateAddressData = {
                    street: formData.street,
                    city: formData.city,
                    state: formData.state,
                    zipCode: formData.zipCode,
                    country: formData.country,
                };
                const success = await toastPromise(
                    updateAddress(editingId, updateData),
                    {
                        loading: 'Updating address...',
                        success: 'Address updated successfully',
                        error: 'Failed to update address. Please try again.',
                    }
                );
                if (success) {
                    handleCancelEdit();
                }
            } else {
                // Create new address
                const success = await toastPromise(
                    createAddress(formData),
                    {
                        loading: 'Creating address...',
                        success: 'Address created successfully',
                        error: 'Failed to create address. Please try again.',
                    }
                );
                if (success) {
                    setShowAddForm(false);
                    setFormData({
                        street: "",
                        city: "",
                        state: "",
                        zipCode: "",
                        country: "IN",
                    });
                }
            }
        } catch (err) {
            toastError("An error occurred. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <>
                {ConfirmDialog}
                <div className="flex-1 flex items-center justify-center py-12">
                    <BarsSpinner />
                </div>
            </>
        );
    }

    if (error && addresses.length === 0) {
        return (
            <>
                {ConfirmDialog}
                <div className="flex-1">
                    <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 sm:p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                            <MapPin className="text-red-600 w-8 h-8" />
                        </div>
                        <p className="text-lg font-hkgb text-gray-900 mb-2">Error loading addresses</p>
                        <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">
                            {error}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="inline-block px-6 py-3 bg-[#008ECC] text-white rounded-xl hover:bg-[#0077B3] transition-colors font-hkgb text-sm cursor-pointer"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            {ConfirmDialog}
            {/* Main Content */}
            <div className="flex-1">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-hkgb text-gray-900 mb-1 sm:mb-2">
                            Saved Addresses
                        </h1>
                        <p className="text-gray-600 text-sm sm:text-base">
                            Manage your delivery addresses for faster checkout
                        </p>
                    </div>
                    {!editingId && (
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-[#008ECC] text-white rounded-xl hover:bg-[#0077B3] transition-colors font-medium text-sm sm:text-base cursor-pointer whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                            Add New Address
                        </button>
                    )}
                </div>

                {/* Error Message */}
                {error && addresses.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 sm:mb-6">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Add/Edit Address Form */}
                {(showAddForm || editingId) && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                            <h2 className="text-lg sm:text-xl font-hkgb text-gray-900">
                                {editingId ? "Edit Address" : "Add New Address"}
                            </h2>
                            <button
                                onClick={() => {
                                    if (editingId) {
                                        handleCancelEdit();
                                    } else {
                                        setShowAddForm(false);
                                    }
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                            {/* User Info Display */}
                            {user && (
                                <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
                                    <p className="text-sm text-gray-600 mb-1">
                                        <strong>Name:</strong> {user.name || user.email}
                                    </p>
                                    {user.phone && (
                                        <p className="text-sm text-gray-600">
                                            <strong>Phone:</strong> {user.phone}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-2">
                                        This information will be used for all deliveries to this address.
                                    </p>
                                </div>
                            )}

                            {/* Address Details */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                    <MapPin className="w-4 h-4 inline mr-2 text-gray-500" />
                                    Street Address
                                </label>
                                <input
                                    type="text"
                                    value={formData.street}
                                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008ECC] focus:border-transparent text-sm sm:text-base"
                                    placeholder="House/Flat No., Building Name, Street"
                                    required
                                />
                            </div>

                            {/* City/State/ZIP */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                        City
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008ECC] focus:border-transparent text-sm sm:text-base"
                                        placeholder="Enter city"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                        State
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.state}
                                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008ECC] focus:border-transparent text-sm sm:text-base"
                                        placeholder="Enter state"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                        PIN Code
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.zipCode}
                                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008ECC] focus:border-transparent text-sm sm:text-base"
                                        placeholder="Enter PIN code"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                    Country
                                </label>
                                <input
                                    type="text"
                                    value={formData.country}
                                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008ECC] focus:border-transparent text-sm sm:text-base"
                                    placeholder="Enter country code (e.g., IN)"
                                    required
                                />
                            </div>

                            {/* Form Actions */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4 sm:pt-6 border-t border-gray-100">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-[#008ECC] text-white rounded-xl hover:bg-[#0077B3] transition-colors font-medium text-sm sm:text-base disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? "Saving..." : editingId ? "Update Address" : "Save Address"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (editingId) {
                                            handleCancelEdit();
                                        } else {
                                            setShowAddForm(false);
                                        }
                                    }}
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm sm:text-base disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Addresses List */}
                {addresses.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 sm:p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                            <MapPin className="text-gray-400 w-8 h-8" />
                        </div>
                        <p className="text-lg font-hkgb text-gray-900 mb-2">No addresses saved</p>
                        <p className="text-gray-600 text-sm mb-6">
                            Add an address to get started with faster checkout
                        </p>
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="px-6 py-3 bg-[#008ECC] text-white rounded-xl hover:bg-[#0077B3] transition-colors font-hkgb text-sm cursor-pointer"
                        >
                            Add Address
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {addresses.map((address) => (
                            <div
                                key={address.id}
                                className={`bg-white rounded-2xl border shadow-sm p-4 sm:p-6 relative hover:shadow-md transition-all duration-300 ${address.isDefault
                                    ? "border-[#008ECC]"
                                    : "border-gray-100 hover:border-gray-200"
                                    }`}
                            >
                                {/* Default Badge */}
                                {address.isDefault && (
                                    <div className="absolute top-3 sm:top-4 right-3 sm:right-4 px-2 sm:px-3 py-1 bg-[#008ECC] text-white text-xs font-hkgb rounded-full flex items-center gap-1">
                                        <Check className="w-3 h-3" />
                                        DEFAULT
                                    </div>
                                )}

                                {/* Address Details */}
                                <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                                    {user && (
                                        <>
                                            <p className="text-sm sm:text-base font-hkgb text-gray-900">
                                                {user.name || user.email}
                                            </p>
                                            {user.phone && (
                                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                                    <span>{user.phone}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    <div className="space-y-1 text-sm text-gray-700">
                                        <p>{address.street}</p>
                                        <p>{address.city}, {address.state} {address.zipCode}</p>
                                        <p>{address.country}</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-wrap gap-2 sm:gap-3 pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => handleSetDefault(address.id)}
                                        disabled={address.isDefault}
                                        className={`flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all cursor-pointer ${address.isDefault
                                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                            : "border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                                            }`}
                                    >
                                        {address.isDefault ? "Default" : "Set Default"}
                                    </button>
                                    <button
                                        onClick={() => handleEdit(address)}
                                        className="flex items-center justify-center gap-1 px-3 sm:px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer"
                                    >
                                        <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span className="text-xs sm:text-sm">Edit</span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(address.id)}
                                        className="flex items-center justify-center gap-1 px-3 sm:px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-300 transition-all cursor-pointer"
                                    >
                                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span className="text-xs sm:text-sm">Delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Help Text */}
                <div className="mt-6 sm:mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">
                    <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-[#008ECC] mt-0.5 shrink-0" />
                        <div>
                            <h3 className="text-sm sm:text-base font-hkgb text-gray-900 mb-2">
                                Address Management Tips
                            </h3>
                            <ul className="space-y-1 text-sm text-gray-600">
                                <li>• You can have multiple saved addresses</li>
                                <li>• Only one address can be set as default at a time</li>
                                <li>• Default address will be used for all deliveries</li>
                                <li>• Update addresses regularly for accurate delivery</li>
                                <li>• Make sure your phone number is up to date in your profile</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

export default function AddressesPage() {
    return <AddressesPageContent />;
}
