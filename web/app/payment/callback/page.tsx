"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { verifyPhonePePayment } from "@/lib/api/payments";
import { useCart } from "@/contexts/CartContext";
import { BarsSpinner } from "@/app/components/shared/BarsSpinner";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

function PaymentCallbackContent() {
    const searchParams = useSearchParams();
    const merchantOrderId = searchParams.get("merchantOrderId");
    const { removeItem } = useCart();

    const [status, setStatus] = useState<"loading" | "success" | "failed" | "pending">("loading");
    const [orderId, setOrderId] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const verifiedRef = useRef(false);

    useEffect(() => {
        if (!merchantOrderId || verifiedRef.current) return;
        verifiedRef.current = true;

        async function verify() {
            try {
                const resp = await verifyPhonePePayment({ merchantOrderId: merchantOrderId! });

                if (resp.success && resp.data?.verified) {
                    setStatus("success");
                    setOrderId(resp.data.orderId || null);

                    // Remove ordered items from cart
                    try {
                        const pendingIds = sessionStorage.getItem("pendingCartItemIds");
                        if (pendingIds) {
                            const ids: string[] = JSON.parse(pendingIds);
                            await Promise.all(ids.map((id) => removeItem(id)));
                            sessionStorage.removeItem("pendingCartItemIds");
                        }
                    } catch {
                        // Don't block redirect if cart cleanup fails
                    }

                    // Clear buyNow data
                    sessionStorage.removeItem("buyNow");

                    // Redirect to order page after a short delay
                    setTimeout(() => {
                        window.location.href = `/orders/${resp.data!.orderId}`;
                    }, 2000);
                } else if (resp.data?.state === "PENDING") {
                    setStatus("pending");
                    setMessage("Your payment is being processed. Please wait...");
                } else {
                    setStatus("failed");
                    setMessage(resp.data?.message || resp.error || "Payment verification failed.");
                }
            } catch (err) {
                console.error("Payment verification error:", err);
                setStatus("failed");
                setMessage("Failed to verify payment. Please contact support if amount was deducted.");
            }
        }

        verify();
    }, [merchantOrderId, removeItem]);

    if (!merchantOrderId) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                    <h2 className="text-xl font-semibold text-red-600 mb-4">Invalid Payment</h2>
                    <p className="text-gray-600 mb-6">No payment information found.</p>
                    <a
                        href="/cart"
                        className="inline-block px-6 py-3 bg-[#008ECC] text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Go to Cart
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center py-8">
            <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                {status === "loading" && (
                    <>
                        <BarsSpinner />
                        <h2 className="text-xl font-semibold text-gray-800 mt-4">Verifying Payment...</h2>
                        <p className="text-gray-500 mt-2">Please wait while we confirm your payment.</p>
                    </>
                )}

                {status === "success" && (
                    <>
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-green-600 mb-2">Payment Successful!</h2>
                        <p className="text-gray-600 mb-4">Your order has been placed successfully.</p>
                        <p className="text-gray-400 text-sm">Redirecting to your order...</p>
                        {orderId && (
                            <a
                                href={`/orders/${orderId}`}
                                className="inline-block mt-4 px-6 py-3 bg-[#008ECC] text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                View Order
                            </a>
                        )}
                    </>
                )}

                {status === "pending" && (
                    <>
                        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-yellow-600 mb-2">Payment Pending</h2>
                        <p className="text-gray-600 mb-6">{message}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="inline-block px-6 py-3 bg-[#008ECC] text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Check Again
                        </button>
                    </>
                )}

                {status === "failed" && (
                    <>
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold text-red-600 mb-2">Payment Failed</h2>
                        <p className="text-gray-600 mb-6">{message}</p>
                        <div className="space-y-3">
                            <a
                                href="/checkout"
                                className="inline-block px-6 py-3 bg-[#008ECC] text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Try Again
                            </a>
                            <p className="text-gray-400 text-sm">
                                If amount was deducted, please contact support.
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function PaymentCallbackPage() {
    return (
        <ProtectedRoute>
            <PaymentCallbackContent />
        </ProtectedRoute>
    );
}
