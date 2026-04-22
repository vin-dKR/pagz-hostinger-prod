/**
 * Parses a login identifier as either an Indian mobile number or an email address.
 * Returns `{ phone }` or `{ email }` ready to hand to the auth API, or null if neither form matches.
 *
 * Mobile: 10 digits 6-9 prefixed, optional +91 / 91 / leading 0 accepted.
 * Email: RFC-adjacent regex (same as backend `authController.register`).
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;

export type LoginIdentifier = { phone: string } | { email: string };

export function parseLoginIdentifier(raw: string): LoginIdentifier | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    if (trimmed.includes("@")) {
        const email = trimmed.toLowerCase();
        return EMAIL_REGEX.test(email) ? { email } : null;
    }

    const digits = trimmed.replace(/\D/g, "");
    const normalized =
        digits.length === 12 && digits.startsWith("91")
            ? digits.slice(2)
            : digits.length === 11 && digits.startsWith("0")
                ? digits.slice(1)
                : digits;

    return MOBILE_REGEX.test(normalized) ? { phone: normalized } : null;
}
