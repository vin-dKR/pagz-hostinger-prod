"use client";

import { useState, useEffect } from "react";

interface ShippingOption {
    id: string;
    name: string;
    price: number;
    description: string;
    icon?: React.ReactNode;
}

interface ShippingMethodProps {
    options: ShippingOption[];
    selectedId?: string;
    onSelect?: (id: string) => void;
}

export default function ShippingMethod({ options, selectedId, onSelect }: ShippingMethodProps) {
    const [selected, setSelected] = useState(selectedId || options[0]?.id);

    // Sync with external selectedId prop
    useEffect(() => {
        if (selectedId !== undefined) {
            setSelected(selectedId);
        }
    }, [selectedId]);

    const handleSelect = (id: string) => {
        setSelected(id);
        onSelect?.(id);
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6 mb-6">
            <h2 className="text-xl font-hkgb font-bold text-gray-900 mb-6">Shipping Method</h2>

            <div className="space-y-3">
                {options.map((option) => (
                    <label
                        key={option.id}
                        className={`flex items-center gap-4 p-4 border-2 rounded-lg cursor-pointer transition-all ${selected === option.id
                            ? "border-blue-600 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                            }`}
                    >
                        <input
                            type="radio"
                            name="shipping"
                            value={option.id}
                            checked={selected === option.id}
                            onChange={() => handleSelect(option.id)}
                            className="w-5 h-5 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-900">
                                        <span className="font-hkgb font-bold">
                                            ₹{(option.price || 0).toFixed(2)} {" "}
                                        </span>
                                        {option.name}
                                    </p>
                                    <p className="text-sm text-gray-600">{option.description}</p>
                                </div>
                                {option.icon && <div className="ml-4">{option.icon}</div>}
                            </div>
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
}
