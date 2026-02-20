/**
 * Available Coupons Page
 * Displays all available coupons for customers
 */

'use client';

import { useEffect, useState } from 'react';
import { getAvailableCoupons, type Coupon } from '@/lib/api/coupons';
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
    onCopy: (code: string) => void;
    copied: boolean;
}

function CouponCard({ coupon, onCopy, copied }: CouponCardProps) {
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

            <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded px-4 py-2 font-mono font-bold text-center">
                    {coupon.code}
                </div>
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
            </div>

            {coupon.validUntil && (
                <p className="text-xs text-gray-500 mt-4">
                    Valid until: {new Date(coupon.validUntil).toLocaleDateString()}
                </p>
            )}
        </Card>
    );
}

export default function CouponsPage() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    useEffect(() => {
        loadCoupons();
    }, []);

    const loadCoupons = async () => {
        try {
            setLoading(true);
            const response = await getAvailableCoupons();
            if (response.success && response.data) {
                setCoupons(response.data);
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
            <h1 className="text-3xl font-bold mb-6">Available Coupons</h1>
            {coupons.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-gray-600">No coupons available at the moment.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {coupons.map((coupon) => (
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
    );
}

