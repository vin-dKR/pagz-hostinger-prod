/**
 * User Wishlist & Cart Tab Component
 * Displays user's wishlist and cart items
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { PageLoading } from '@/app/components/ui/loading';
import { getUserWishlistAndCart } from '@/lib/api/users.service';
import { formatDate, formatCurrency } from '@/lib/utils/format';
import { Heart, ShoppingCart, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';

interface UserWishlistCartProps {
    userId: string;
}

export function UserWishlistCart({ userId }: UserWishlistCartProps) {
    const router = useRouter();
    const [wishlistItems, setWishlistItems] = useState<any[]>([]);
    const [cart, setCart] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('wishlist');

    useEffect(() => {
        loadData();
    }, [userId]);

    const loadData = async () => {
        try {
            setIsLoading(true);
            const data = await getUserWishlistAndCart(userId);
            setWishlistItems(data.wishlistItems || []);
            setCart(data.cart);
        } catch (error) {
            console.error('Failed to load wishlist and cart:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <PageLoading />;
    }

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
                <TabsTrigger value="wishlist">
                    <Heart className="h-4 w-4 mr-2" />
                    Wishlist ({wishlistItems.length})
                </TabsTrigger>
                <TabsTrigger value="cart">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Cart ({cart?.items?.length || 0})
                </TabsTrigger>
            </TabsList>

            <TabsContent value="wishlist">
                <div className="space-y-4">
                    {wishlistItems.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center text-gray-500">
                                No wishlist items found
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {wishlistItems.map((item) => (
                                <Card key={item.id}>
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-4">
                                            {item.product?.images?.[0] && (
                                                <img
                                                    src={item.product.images[0].url}
                                                    alt={item.product.name}
                                                    className="w-20 h-20 object-cover rounded"
                                                />
                                            )}
                                            <div className="flex-1">
                                                <h4 className="font-medium mb-1">{item.product?.name || 'N/A'}</h4>
                                                {item.product?.basePrice && (
                                                    <p className="text-sm text-gray-600 mb-2">
                                                        {formatCurrency(Number(item.product.basePrice))}
                                                    </p>
                                                )}
                                                <p className="text-xs text-gray-500">
                                                    Added {formatDate(item.createdAt)}
                                                </p>
                                                {item.product && (
                                                    <button
                                                        onClick={() => router.push(`/products/${item.product.id}`)}
                                                        className="mt-2 text-blue-600 hover:underline text-sm flex items-center gap-1"
                                                    >
                                                        <Eye className="h-3 w-3" />
                                                        View Product
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </TabsContent>

            <TabsContent value="cart">
                <div className="space-y-4">
                    {!cart || cart.items?.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center text-gray-500">
                                Cart is empty
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="p-0">
                                <div className="divide-y">
                                    {cart.items.map((item: any) => (
                                        <div key={item.id} className="p-4 flex items-center gap-4">
                                            {item.product?.images?.[0] && (
                                                <img
                                                    src={item.product.images[0].url}
                                                    alt={item.product.name}
                                                    className="w-16 h-16 object-cover rounded"
                                                />
                                            )}
                                            <div className="flex-1">
                                                <h4 className="font-medium">{item.product?.name || 'N/A'}</h4>
                                                <p className="text-sm text-gray-600">
                                                    Quantity: {item.quantity}
                                                </p>
                                                {item.product?.basePrice && (
                                                    <p className="text-sm font-medium mt-1">
                                                        {formatCurrency(Number(item.product.basePrice) * item.quantity)}
                                                    </p>
                                                )}
                                            </div>
                                            {item.product && (
                                                <button
                                                    onClick={() => router.push(`/products/${item.product.id}`)}
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </TabsContent>
        </Tabs>
    );
}

