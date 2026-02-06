/**
 * My Coupons Page
 * Shows customer's coupon usage history and available coupons
 */

'use client';

import { useEffect, useState } from 'react';
import { getMyCoupons, getAvailableCoupons, type Coupon } from '@/lib/api/coupons';
import { Card } from '@/app/components/ui/Card';
import { Button } from '@/app/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { toastSuccess } from '@/lib/utils/toast';

function formatDiscount(type: 'PERCENTAGE' | 'FIXED', value: number): string {
    if (type === 'PERCENTAGE') {
        return `${value}% OFF`;
    }
    return `₹${value} OFF`;
}

interface CouponCardProps {
    coupon: Coupon;
    onCopy?: (code: string) => void;
    copied?: boolean;
    showCopy?: boolean;
}

function CouponCard({ coupon, onCopy, copied, showCopy = true }: CouponCardProps) {
    return (
        <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">{coupon.name}</h3>
                    <p className="text-2xl font-bold text-blue-600 mt-2">
                        {formatDiscount(coupon.discountType, coupon.discountValue)}
                    </p>
                </div>
                <div className="bg-blue-100 rounded-full px-4 py-2">
                    <span className="text-blue-600 font-bold text-sm">SAVE</span>
                </div>
            </div>

            {coupon.description && (
                <p className="text-gray-600 mb-4">{coupon.description}</p>
            )}

            {coupon.minPurchaseAmount && (
                <p className="text-sm text-gray-500 mb-4">
                    Min. purchase: ₹{Number(coupon.minPurchaseAmount).toLocaleString()}
                </p>
            )}

            {showCopy && (
                <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded px-4 py-2 font-mono font-bold text-center">
                        {coupon.code}
                    </div>
                    {onCopy && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onCopy(coupon.code)}
                        >
                            {copied ? (
                                <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="mr-2 h-4 w-4" />
                                    Copy
                                </>
                            )}
                        </Button>
                    )}
                </div>
            )}

            {coupon.validUntil && (
                <p className="text-xs text-gray-500 mt-4">
                    Valid until: {new Date(coupon.validUntil).toLocaleDateString()}
                </p>
            )}
        </Card>
    );
}

interface UsedCoupon {
    id: string;
    couponId: string;
    userId: string;
    orderId: string | null;
    usedAt: string;
    coupon: {
        id: string;
        code: string;
        name: string;
        discountType: 'PERCENTAGE' | 'FIXED';
        discountValue: number;
    };
}

function UsedCouponCard({ usage }: { usage: UsedCoupon }) {
    return (
        <Card className="p-6">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">{usage.coupon.name}</h3>
                        <span className="text-sm text-gray-500 font-mono">({usage.coupon.code})</span>
                    </div>
                    <p className="text-blue-600 font-semibold mb-2">
                        {formatDiscount(usage.coupon.discountType, usage.coupon.discountValue)}
                    </p>
                    <p className="text-sm text-gray-600">
                        Used on: {new Date(usage.usedAt).toLocaleDateString()}
                    </p>
                    {usage.orderId && (
                        <p className="text-xs text-gray-500 mt-1">
                            Order ID: {usage.orderId}
                        </p>
                    )}
                </div>
            </div>
        </Card>
    );
}

export default function MyCouponsPage() {
    const [usedCoupons, setUsedCoupons] = useState<UsedCoupon[]>([]);
    const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'available' | 'used'>('available');
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    useEffect(() => {
        loadCoupons();
    }, []);

    const loadCoupons = async () => {
        try {
            setLoading(true);
            const [usedResponse, availableResponse] = await Promise.all([
                getMyCoupons(),
                getAvailableCoupons(),
            ]);

            if (usedResponse.success && usedResponse.data) {
                setUsedCoupons(usedResponse.data);
            }
            if (availableResponse.success && availableResponse.data) {
                setAvailableCoupons(availableResponse.data);
            }
        } catch (err) {
            console.error('Failed to load coupons:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        toastSuccess('Coupon code copied!');
        setTimeout(() => setCopiedCode(null), 2000);
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="text-center">Loading coupons...</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">My Coupons</h1>

            {/* Tabs */}
            <div className="mb-6 border-b border-gray-200">
                <div className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('available')}
                        className={`pb-4 px-2 font-medium transition-colors ${activeTab === 'available'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Available ({availableCoupons.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('used')}
                        className={`pb-4 px-2 font-medium transition-colors ${activeTab === 'used'
                                ? 'text-blue-600 border-b-2 border-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Used ({usedCoupons.length})
                    </button>
                </div>
            </div>

            {/* Content */}
            {activeTab === 'available' ? (
                <div>
                    {availableCoupons.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-600">No available coupons at the moment.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {availableCoupons.map((coupon) => (
                                <CouponCard
                                    key={coupon.id}
                                    coupon={coupon}
                                    onCopy={handleCopyCode}
                                    copied={copiedCode === coupon.code}
                                />
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    {usedCoupons.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-600">You haven't used any coupons yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {usedCoupons.map((usage) => (
                                <UsedCouponCard key={usage.id} usage={usage} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

