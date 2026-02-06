"use client";

interface SizeSelectorProps {
    sizes: string[];
    selectedSize?: string;
    onSizeChange?: (size: string) => void;
}

export default function SizeSelector({ sizes, selectedSize, onSizeChange }: SizeSelectorProps) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">Choose Size</label>
            <div className="flex gap-3">
                {sizes.map((size) => (
                    <button
                        key={size}
                        onClick={() => onSizeChange?.(size)}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${selectedSize === size
                                ? "bg-[#008ECC] text-white"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                    >
                        {size}
                    </button>
                ))}
            </div>
        </div>
    );
}
