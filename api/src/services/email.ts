import "dotenv/config";
import nodemailer from "nodemailer";

// Email configuration from environment variables
const EMAIL_CONFIG = {
    host: process.env.SMTP_HOST || "smtp.hostinger.com",
    port: parseInt(process.env.SMTP_PORT || "465", 10),
    secure: process.env.SMTP_SECURE !== "false", // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || "admin@pagz.in",
        pass: process.env.SMTP_PASSWORD || "",
    },
    from: process.env.SMTP_FROM || "admin@pagz.in",
    fromName: process.env.SMTP_FROM_NAME || "PAGZ",
};

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
    secure: EMAIL_CONFIG.secure,
    auth: EMAIL_CONFIG.auth,
});

/**
 * Verify email configuration
 */
export async function verifyEmailConfig(): Promise<boolean> {
    try {
        await transporter.verify();
        return true;
    } catch (error) {
        console.error("Email configuration error:", error);
        return false;
    }
}

/**
 * Send email
 */
export async function sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
}): Promise<void> {
    try {
        // Verify transporter configuration first
        await transporter.verify();

        const mailOptions = {
            from: `"${EMAIL_CONFIG.fromName}" <${EMAIL_CONFIG.from}>`,
            to: options.to,
            subject: options.subject,
            text: options.text || options.html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
            html: options.html,
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('[EMAIL_SERVICE] Error sending email:', error);
        console.error('[EMAIL_SERVICE] Error type:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('[EMAIL_SERVICE] Error message:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error && 'code' in error) {
            console.error('[EMAIL_SERVICE] Error code:', (error as any).code);
        }
        if (error instanceof Error && 'command' in error) {
            console.error('[EMAIL_SERVICE] Error command:', (error as any).command);
        }
        throw new Error(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Send password reset OTP email
 */
export async function sendPasswordResetOTP(email: string, otp: string): Promise<void> {
    const subject = "Password Reset OTP - PAGZ";
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset OTP</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f4f4f4; padding: 20px; border-radius: 10px;">
                <h1 style="color: #333; text-align: center; margin-bottom: 30px;">Password Reset Request</h1>
                
                <p>Hello,</p>
                
                <p>You have requested to reset your password for your PAGZ account. Please use the following OTP (One-Time Password) to reset your password:</p>
                
                <div style="background-color: #fff; border: 2px dashed #007bff; border-radius: 5px; padding: 20px; text-align: center; margin: 30px 0;">
                    <h2 style="color: #007bff; font-size: 32px; letter-spacing: 5px; margin: 0;">${otp}</h2>
                </div>
                
                <p><strong>This OTP will expire in 10 minutes.</strong></p>
                
                <p>If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
                
                <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
                    Best regards,<br>
                    The PAGZ Team<br>
                    <a href="mailto:${EMAIL_CONFIG.from}" style="color: #007bff;">${EMAIL_CONFIG.from}</a>
                </p>
            </div>
        </body>
        </html>
    `;

    try {
        await sendEmail({
            to: email,
            subject,
            html,
        });
    } catch (error) {
        console.error('[SEND_OTP_EMAIL] Failed to send OTP email:', error);
        throw error;
    }
}
