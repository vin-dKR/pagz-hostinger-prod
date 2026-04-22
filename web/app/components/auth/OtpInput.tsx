"use client";

import { useRef, KeyboardEvent, ClipboardEvent, ChangeEvent, useEffect } from "react";

interface OtpInputProps {
    value: string;
    onChange: (value: string) => void;
    length?: number;
    autoFocus?: boolean;
    disabled?: boolean;
    error?: boolean;
}

export default function OtpInput({
    value,
    onChange,
    length = 6,
    autoFocus = true,
    disabled = false,
    error = false,
}: OtpInputProps) {
    const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

    useEffect(() => {
        if (autoFocus) inputsRef.current[0]?.focus();
    }, [autoFocus]);

    const digits = value.padEnd(length, " ").split("").slice(0, length);

    const setDigitAt = (index: number, digit: string) => {
        const chars = value.split("");
        while (chars.length < length) chars.push("");
        chars[index] = digit;
        onChange(chars.join("").replace(/\s/g, "").slice(0, length));
    };

    const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, "");
        if (!raw) {
            setDigitAt(index, "");
            return;
        }
        if (raw.length === 1) {
            setDigitAt(index, raw);
            if (index < length - 1) inputsRef.current[index + 1]?.focus();
            return;
        }
        const pasted = raw.slice(0, length - index);
        const chars = value.split("");
        while (chars.length < length) chars.push("");
        for (let i = 0; i < pasted.length; i++) {
            chars[index + i] = pasted[i] ?? "";
        }
        const next = chars.join("").replace(/\s/g, "").slice(0, length);
        onChange(next);
        const focusIndex = Math.min(index + pasted.length, length - 1);
        inputsRef.current[focusIndex]?.focus();
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
            if (digits[index]?.trim()) {
                setDigitAt(index, "");
            } else if (index > 0) {
                inputsRef.current[index - 1]?.focus();
                setDigitAt(index - 1, "");
            }
            e.preventDefault();
        } else if (e.key === "ArrowLeft" && index > 0) {
            inputsRef.current[index - 1]?.focus();
        } else if (e.key === "ArrowRight" && index < length - 1) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
        if (!pasted) return;
        e.preventDefault();
        onChange(pasted);
        const focusIndex = Math.min(pasted.length, length - 1);
        inputsRef.current[focusIndex]?.focus();
    };

    return (
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            {Array.from({ length }).map((_, i) => (
                <input
                    key={i}
                    ref={(el) => {
                        inputsRef.current[i] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    value={digits[i]?.trim() ?? ""}
                    onChange={(e) => handleChange(i, e)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    disabled={disabled}
                    className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-mono font-semibold bg-gray-50 border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 ${
                        error ? "border-red-400" : "border-gray-200"
                    }`}
                />
            ))}
        </div>
    );
}
