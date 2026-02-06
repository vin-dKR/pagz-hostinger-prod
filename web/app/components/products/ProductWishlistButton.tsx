"use client";

import { Heart } from "lucide-react";

interface ProductWishlistButtonProps {
  isWishlisted: boolean;
  isLoading: boolean;
  onToggle: () => void;
  className?: string;
  showLabel?: boolean;
}

export default function ProductWishlistButton({
  isWishlisted,
  isLoading,
  onToggle,
  className = "",
  showLabel = false,
}: ProductWishlistButtonProps) {
  return (
    <button
      onClick={onToggle}
      disabled={isLoading}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
        isWishlisted
          ? "bg-red-50 text-red-600 hover:bg-red-100"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      } ${className}`}
    >
      <Heart size={showLabel ? 18 : 20} fill={isWishlisted ? "currentColor" : "none"} />
      {showLabel && <span className="text-sm font-medium">Wishlist</span>}
    </button>
  );
}

