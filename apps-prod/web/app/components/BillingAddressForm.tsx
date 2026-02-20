"use client";

import { useState, useEffect, useMemo } from "react";
import { useAddresses } from "@/hooks/addresses/useAddresses";
import { CreateAddressData } from "@/lib/api/addresses";
import { MapPin, Plus } from "lucide-react";
import { toastWarning, toastError, toastSuccess, toastPromise } from "@/lib/utils/toast";

interface BillingAddressFormProps {
    selectedAddressId: string | null;
    onAddressSelect: (addressId: string | null) => void;
    onDataChange?: (data: any) => void;
}

export default function BillingAddressForm({
    selectedAddressId,
    onAddressSelect,
    onDataChange,
}: BillingAddressFormProps) {
    const { addresses, loading, createAddress, refetch } = useAddresses();
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<CreateAddressData>({
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "India",
        isDefault: false,
    });

    // Sort addresses: default first, then selected, then others

    // Find default address
    const defaultAddress = useMemo(() => {
        return addresses.find((addr) => addr.isDefault) || addresses[0] || null;
    }, [addresses]);

    // Auto-select default address if available and none selected
    useEffect(() => {
        if (defaultAddress && !selectedAddressId && !showCreateForm && addresses.length > 0) {
            onAddressSelect(defaultAddress.id);
        }
    }, [defaultAddress, selectedAddressId, showCreateForm, addresses.length, onAddressSelect]);

    // Show create form if no addresses exist
    useEffect(() => {
        if (addresses.length === 0 && !showCreateForm) {
            setShowCreateForm(true);
        }
    }, [addresses.length, showCreateForm]);

    const handleChange = (field: keyof CreateAddressData, value: string | boolean) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    // Track previous address count to detect new address
    const [previousAddressCount, setPreviousAddressCount] = useState(addresses.length);
    const [pendingIsDefault, setPendingIsDefault] = useState(false);

    // Auto-select newly created address
    useEffect(() => {
        if (addresses.length > previousAddressCount) {
            // A new address was added
            const newAddress = pendingIsDefault
                ? addresses.find(addr => addr.isDefault)
                : addresses[addresses.length - 1];

            if (newAddress) {
                onAddressSelect(newAddress.id);
            }
            setPreviousAddressCount(addresses.length);
            setPendingIsDefault(false);
        }
    }, [addresses.length, previousAddressCount, pendingIsDefault, addresses, onAddressSelect]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required fields
        if (!formData.street || !formData.city || !formData.state || !formData.zipCode) {
            toastWarning("Please fill in all required fields");
            return;
        }

        setIsSubmitting(true);
        const wasDefault = formData.isDefault || false;
        setPendingIsDefault(wasDefault);
        setPreviousAddressCount(addresses.length);

        try {
            const success = await toastPromise(
                createAddress(formData),
                {
                    loading: 'Creating address...',
                    success: 'Address created successfully!',
                    error: 'Failed to create address. Please try again.',
                }
            );
            if (success) {
                // Refetch addresses to get the newly created one with its ID
                await refetch();

                // Reset form
                setFormData({
                    street: "",
                    city: "",
                    state: "",
                    zipCode: "",
                    country: "India",
                    isDefault: false,
                });
                setShowCreateForm(false);

                // The useEffect above will handle selecting the new address
            } else {
                setPendingIsDefault(false);
            }
        } catch (err) {
            setPendingIsDefault(false);
        } finally {
            setIsSubmitting(false);
        }
    };


    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 mb-6">
                <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 mb-6">
            <h2 className="text-xl font-hkgb font-bold text-gray-900 mb-6">Billing Address</h2>

            {/* Address Selection - Always show if addresses exist */}
            {addresses.length > 0 && (
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Select Address
                    </label>
                    <div className="space-y-2">
                        {addresses.map((address) => (
                            <label
                                key={address.id}
                                className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${selectedAddressId === address.id
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 hover:border-gray-300"
                                    }`}
                            >
                                <input
                                    type="radio"
                                    name="address"
                                    value={address.id}
                                    checked={selectedAddressId === address.id}
                                    onChange={() => {
                                        onAddressSelect(address.id);
                                        setShowCreateForm(false);
                                    }}
                                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <MapPin size={16} className="text-gray-500" />
                                        <span className="font-medium text-gray-900">
                                            {address.street}
                                        </span>
                                        {address.isDefault && (
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                Default
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600">
                                        {address.city}, {address.state} {address.zipCode}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">{address.country}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Create Address Option - Always show */}
            <div className="mb-6">
                {!showCreateForm ? (
                    <button
                        type="button"
                        onClick={() => setShowCreateForm(true)}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                        <Plus size={16} />
                        {addresses.length > 0 ? "Add New Address" : "Create Address"}
                    </button>
                ) : (
                    <div className="border-t border-gray-200 pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-medium text-gray-900">
                                {addresses.length > 0 ? "Add New Address" : "Create Address"}
                            </h3>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCreateForm(false);
                                    setFormData({
                                        street: "",
                                        city: "",
                                        state: "",
                                        zipCode: "",
                                        country: "India",
                                        isDefault: false,
                                    });
                                }}
                                className="text-sm text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create Address Form - Show when "Add New Address" is clicked */}
            {showCreateForm && (
                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Street Address */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Street Address <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.street}
                            onChange={(e) => handleChange("street", e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Street address"
                        />
                    </div>

                    {/* City, State, Zip */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                City <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.city}
                                onChange={(e) => handleChange("city", e.target.value)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                State/Province <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.state}
                                onChange={(e) => handleChange("state", e.target.value)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Zip/Postal Code <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.zipCode}
                                onChange={(e) => handleChange("zipCode", e.target.value)}
                                required
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Country */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Country <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.country}
                            onChange={(e) => handleChange("country", e.target.value)}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Set as Default Checkbox */}
                    <div className="pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.isDefault}
                                onChange={(e) => handleChange("isDefault", e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">
                                Set as default address
                            </span>
                        </label>
                    </div>

                    {/* Form Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-6 py-2 bg-[#008ECC] text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "Creating..." : "Create Address"}
                        </button>
                    </div>
                </form>
            )}

            {/* Checkboxes - Only show if address is selected */}
            {selectedAddressId && addresses.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-gray-200 mt-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            defaultChecked={true}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                            My billing and shipping address are the same
                        </span>
                    </label>
                </div>
            )}
        </div>
    );
}
