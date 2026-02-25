"use client";

import Link from "next/link";
import Image from "next/image";
import { imageLoader } from "@/lib/utils/image-loader";
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
                                className="shrink-0 w-64 bg-gray-50/50 rounded-xl border border-gray-100 transition-all duration-200 overflow-hidden"
                            >
                                {/* Product Image */}
                                <div className="relative aspect-square bg-gray-100 overflow-hidden">
                                    {product.image ? (
                                        <Image
                                            src={product.image}
                                            alt={product.name || 'Product image'}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 768px) 50vw, 25vw"
                                            loader={imageLoader}
                                        />
                                    ) : (
                                        <Image
                                            src={'/images/pagz-logo.png'}
                                            alt={product.name || 'Product image'}
                                            fill
                                            className="object-cover"
                                            sizes="(max-width: 768px) 50vw, 25vw"
                                            loader={imageLoader}
                                        />
                                    )}
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
