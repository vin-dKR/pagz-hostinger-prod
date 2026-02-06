"use client";

import Link from "next/link";
import ProductRating from "./ProductRating";
import PriceDisplay from "./PriceDisplay";

interface RelatedProduct {
    id: string;
    name: string;
    image: string;
    rating: number;
    currentPrice: number;
    originalPrice?: number;
    discount?: number;
}

interface RelatedProductsProps {
    products: RelatedProduct[];
}

export default function RelatedProducts({ products }: RelatedProductsProps) {
    return (
        <section className="mt-16 mb-20 py-40 bg-white">
            <div className="w-full px-4 lg:px-6 xl:px-10">
                <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
                    YOU MIGHT ALSO LIKE
                </h2>

                <div className="overflow-x-auto scrollbar-hide">
                    <div className="flex gap-6 pb-4" style={{ minWidth: "max-content" }}>
                        {products.map((product) => (
                            <Link
                                key={product.id}
                                href={`/products/${product.id}`}
                                className="shrink-0 w-64 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
                            >
                                {/* Product Image */}
                                <div className="relative aspect-square bg-gray-100">
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                                        <span className="text-gray-400 text-sm">Product Image</span>
                                    </div>
                                </div>

                                {/* Product Info */}
                                <div className="p-4">
                                    <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
                                        {product.name}
                                    </h3>
                                    <div className="mb-3">
                                        <ProductRating rating={product.rating} showText={true} />
                                    </div>
                                    <PriceDisplay
                                        currentPrice={product.currentPrice}
                                        originalPrice={product.originalPrice}
                                        discount={product.discount}
                                    />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
