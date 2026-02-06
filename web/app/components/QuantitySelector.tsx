"use client";

interface QuantitySelectorProps {
    quantity: number;
    onQuantityChange: (quantity: number) => void;
    min?: number;
    max?: number;
    className?: string;
}

export default function QuantitySelector({
    quantity,
    onQuantityChange,
    min = 1,
    max = 99,
    className = "",
}: QuantitySelectorProps) {
    const handleDecrease = () => {
        if (quantity > min) {
            onQuantityChange(quantity - 1);
        }
    };

    const handleIncrease = () => {
        if (quantity < max) {
            onQuantityChange(quantity + 1);
        }
    };

    return (
        <div className={`flex items-center ${className}`}>
            <div className="flex items-center rounded-full bg-[#F0F0F0]">
                {/* Button: Decrease */}
                <button
                    onClick={handleDecrease}
                    disabled={quantity <= min}
                    className="px-2.5 py-1.5 sm:px-4 sm:py-2 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-l-full"
                    aria-label="Decrease quantity"
                >
                    <svg
                        width="12"
                        height="12"
                        className="sm:w-4 sm:h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>

                {/* Quantity Display */}
                <span className="px-2.5 py-1.5 sm:px-4 sm:py-2 text-gray-900 font-medium min-w-[2rem] sm:min-w-[3rem] text-center text-sm sm:text-base">
                    {quantity}
                </span>

                {/* Button: Increase */}
                <button
                    onClick={handleIncrease}
                    disabled={quantity >= max}
                    className="px-2.5 py-1.5 sm:px-4 sm:py-2 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-r-full"
                    aria-label="Increase quantity"
                >
                    <svg
                        width="12"
                        height="12"
                        className="sm:w-4 sm:h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </div>
        </div>
    );
}
