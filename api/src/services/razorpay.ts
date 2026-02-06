import Razorpay from "razorpay";


// WIP
const razorpayKeyId = process.env.RAZORPAY_KEY_ID || "";
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "";

if (!razorpayKeyId || !razorpayKeySecret) {
    console.warn("⚠️  Razorpay credentials not found. Payment features will not work.");
}

export const razorpay = razorpayKeyId && razorpayKeySecret
    ? new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret,
    })
    : null;

export default razorpay;

