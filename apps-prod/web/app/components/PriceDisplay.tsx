import { cn } from "@/lib/utils";

interface PriceDisplayProps {
    currentPrice: number;
    originalPrice?: number;
    discount?: number;
    currency?: string;
    className?: string;
    size?: "sm" | "md" | "lg";
}

export default function PriceDisplay({
    currentPrice,
    originalPrice,
    discount,
    currency = "₹",
    className,
    size = "lg",
}: PriceDisplayProps) {
    const sizeClasses = {
        sm: 'text-lg',
        md: 'text-xl',
        lg: 'text-3xl',
    };

    return (
        <div className={cn("flex items-center gap-4", className)}>
            <span className={cn("font-bold text-gray-900", sizeClasses[size])}>
                {currency}
                {currentPrice.toFixed(2)}
            </span>
            {originalPrice && originalPrice > currentPrice && (
                <>
                    <span className="text-lg lg:text-xl text-gray-500 line-through">
                        {currency}
                        {originalPrice.toFixed(2)}
                    </span>
                    {discount && (
                        <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-semibold">
                            -{discount}%
                        </span>
                    )}
                </>
            )}
        </div>
    );
}
