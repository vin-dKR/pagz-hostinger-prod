"use client";

import { useState, useEffect } from "react";
import {
    User, Mail, Phone, Lock, Bell, AlertTriangle,
    Save, Eye, EyeOff, Check, X
} from "lucide-react";
import { useSettings } from "@/hooks/settings/useSettings";
import { BarsSpinner } from "@/app/components/shared/BarsSpinner";
import { useRouter } from "next/navigation";
import { toastError, toastSuccess, toastWarning, toastPromise } from "@/lib/utils/toast";

function SettingsPageContent() {
    const router = useRouter();
    const {
        user,
        loading,
        error,
        notificationPreferences,
        updateProfile,
        updatePassword,
        updateNotifications,
        deleteAccount,
    } = useSettings();

    const [accountForm, setAccountForm] = useState({
        name: "",
        phone: "",
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        showCurrentPassword: false,
        showNewPassword: false,
        showConfirmPassword: false,
    });

    const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
    const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
    const [isSubmittingNotifications, setIsSubmittingNotifications] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState("");

    // Initialize form when user data loads
    useEffect(() => {
        if (user) {
            setAccountForm({
                name: user.name || "",
                phone: user.phone || "",
            });
        }
    }, [user]);

    const handleAccountFormChange = (key: string, value: string) => {
        setAccountForm({ ...accountForm, [key]: value });
    };

    const handlePasswordFormChange = (key: string, value: string | boolean) => {
        setPasswordForm({ ...passwordForm, [key]: value });
    };

    const handleNotificationChange = async (key: string, value: boolean) => {
        const updatedPreferences = { ...notificationPreferences, [key]: value };
        setIsSubmittingNotifications(true);
        const success = await toastPromise(
            updateNotifications(updatedPreferences),
            {
                loading: 'Updating notification preference...',
                success: 'Notification preference updated',
                error: 'Failed to update notification preference. Please try again.',
            }
        );
        setIsSubmittingNotifications(false);
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingProfile(true);

        const success = await updateProfile({
            name: accountForm.name || undefined,
            phone: accountForm.phone || undefined,
        });

        setIsSubmittingProfile(false);

        if (success) {
            toastSuccess("Profile updated successfully!");
        } else {
            toastError("Failed to update profile. Please try again.");
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toastWarning("New passwords do not match");
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            toastWarning("Password must be at least 6 characters long");
            return;
        }

        setIsSubmittingPassword(true);

        const success = await toastPromise(
            updatePassword(
                passwordForm.currentPassword,
                passwordForm.newPassword
            ),
            {
                loading: 'Updating password...',
                success: 'Password updated successfully!',
                error: (err) => err || "Failed to update password. Please try again.",
            }
        );

        setIsSubmittingPassword(false);

        if (success) {
            setPasswordForm({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
                showCurrentPassword: false,
                showNewPassword: false,
                showConfirmPassword: false,
            });
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== "DELETE") {
            toastWarning('Please type "DELETE" to confirm account deletion');
            return;
        }

        const success = await toastPromise(
            deleteAccount(),
            {
                loading: 'Deleting account...',
                success: 'Account deleted successfully',
                error: "Failed to delete account. Please try again.",
            }
        );
        if (!success) {
            setShowDeleteConfirm(false);
            setDeleteConfirmText("");
        }
        // If successful, user will be logged out and redirected
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center py-12">
                <BarsSpinner />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex-1">
                <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 sm:p-12 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertTriangle className="text-red-600 w-8 h-8" />
                    </div>
                    <p className="text-lg font-hkgb text-gray-900 mb-2">Error loading settings</p>
                    <p className="text-gray-600 text-sm mb-6 max-w-md mx-auto">
                        {error || "Unable to load settings. Please try again."}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-block px-6 py-3 bg-[#008ECC] text-white rounded-xl hover:bg-[#0077B3] transition-colors font-hkgb text-sm cursor-pointer"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Main Content */}
            <div className="flex-1 max-w-4xl">
                {/* Header */}
                <div className="mb-4 sm:mb-6">
                    <h1 className="text-xl sm:text-2xl font-hkgb text-gray-900 mb-1 sm:mb-2">
                        Account Settings
                    </h1>
                    <p className="text-gray-600 text-sm sm:text-base">
                        Manage your account settings and preferences
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 sm:mb-6">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}

                {/* Account Information Section */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
                    <div className="flex items-center gap-3 mb-4 sm:mb-6">
                        <User className="w-5 h-5 sm:w-6 sm:h-6 text-[#008ECC]" />
                        <h2 className="text-lg sm:text-xl font-hkgb text-gray-900">
                            Account Information
                        </h2>
                    </div>
                    <form onSubmit={handleProfileSubmit} className="space-y-3 sm:space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={accountForm.name}
                                onChange={(e) => handleAccountFormChange("name", e.target.value)}
                                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008ECC] focus:border-transparent text-sm sm:text-base"
                                placeholder="Enter your name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={user.email}
                                disabled
                                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm sm:text-base cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                value={accountForm.phone}
                                onChange={(e) => handleAccountFormChange("phone", e.target.value)}
                                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008ECC] focus:border-transparent text-sm sm:text-base"
                                placeholder="Enter your phone number"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmittingProfile}
                            className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-[#008ECC] text-white rounded-xl hover:bg-[#0077B3] transition-colors font-medium text-sm sm:text-base disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                            <Save className="w-4 h-4" />
                            {isSubmittingProfile ? "Saving..." : "Save Changes"}
                        </button>
                    </form>
                </div>

                {/* Password Section */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
                    <div className="flex items-center gap-3 mb-4 sm:mb-6">
                        <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-[#008ECC]" />
                        <h2 className="text-lg sm:text-xl font-hkgb text-gray-900">
                            Change Password
                        </h2>
                    </div>
                    <form onSubmit={handlePasswordSubmit} className="space-y-3 sm:space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                Current Password
                            </label>
                            <div className="relative">
                                <input
                                    type={passwordForm.showCurrentPassword ? "text" : "password"}
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => handlePasswordFormChange("currentPassword", e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008ECC] focus:border-transparent text-sm sm:text-base pr-10"
                                    placeholder="Enter current password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => handlePasswordFormChange("showCurrentPassword", !passwordForm.showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
                                >
                                    {passwordForm.showCurrentPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={passwordForm.showNewPassword ? "text" : "password"}
                                    value={passwordForm.newPassword}
                                    onChange={(e) => handlePasswordFormChange("newPassword", e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008ECC] focus:border-transparent text-sm sm:text-base pr-10"
                                    placeholder="Enter new password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => handlePasswordFormChange("showNewPassword", !passwordForm.showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
                                >
                                    {passwordForm.showNewPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                                Confirm New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={passwordForm.showConfirmPassword ? "text" : "password"}
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => handlePasswordFormChange("confirmPassword", e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#008ECC] focus:border-transparent text-sm sm:text-base pr-10"
                                    placeholder="Confirm new password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => handlePasswordFormChange("showConfirmPassword", !passwordForm.showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 cursor-pointer"
                                >
                                    {passwordForm.showConfirmPassword ? (
                                        <EyeOff className="w-4 h-4" />
                                    ) : (
                                        <Eye className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmittingPassword}
                            className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-[#008ECC] text-white rounded-xl hover:bg-[#0077B3] transition-colors font-medium text-sm sm:text-base disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                        >
                            <Lock className="w-4 h-4" />
                            {isSubmittingPassword ? "Updating..." : "Update Password"}
                        </button>
                    </form>
                </div>

                {/* Notification Preferences */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
                    <div className="flex items-center gap-3 mb-4 sm:mb-6">
                        <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-[#008ECC]" />
                        <h2 className="text-lg sm:text-xl font-hkgb text-gray-900">
                            Notification Preferences
                        </h2>
                    </div>
                    <div className="space-y-3">
                        {Object.entries({
                            email: { label: "Email Notifications", desc: "Receive notifications via email", icon: Mail },
                            sms: { label: "SMS Notifications", desc: "Receive notifications via SMS", icon: Phone },
                            push: { label: "Push Notifications", desc: "Receive push notifications on your device", icon: Bell },
                            orderUpdates: { label: "Order Updates", desc: "Get notified about your order status", icon: Check },
                            promotions: { label: "Promotions & Offers", desc: "Receive promotional emails and offers", icon: Check },
                            newsletters: { label: "Newsletters", desc: "Subscribe to our newsletter", icon: Check },
                        }).map(([key, config]) => (
                            <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-gray-50 rounded-lg">
                                        {config.icon && <config.icon className="w-4 h-4 text-gray-600" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">{config.label}</p>
                                        <p className="text-xs text-gray-500 mt-1">{config.desc}</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={notificationPreferences[key as keyof typeof notificationPreferences] || false}
                                        onChange={(e) => handleNotificationChange(key, e.target.checked)}
                                        disabled={isSubmittingNotifications}
                                        className="sr-only peer"
                                    />
                                    <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#008ECC] peer-focus:ring-2 peer-focus:ring-[#008ECC] peer-disabled:opacity-50"></div>
                                </label>
                            </div>
                        ))}
                    </div>
                    {isSubmittingNotifications && (
                        <div className="mt-4 text-sm text-gray-500 flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-[#008ECC] border-t-transparent rounded-full animate-spin"></div>
                            Saving preferences...
                        </div>
                    )}
                </div>

                {/* Danger Zone */}
                <div className="bg-white rounded-2xl border-2 border-red-200 shadow-sm p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
                        <h2 className="text-lg sm:text-xl font-hkgb text-red-600">
                            Danger Zone
                        </h2>
                    </div>
                    <div className="space-y-4">
                        <p className="text-sm text-gray-700">
                            Once you delete your account, there is no going back. Please be certain.
                        </p>
                        {!showDeleteConfirm ? (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-4 sm:px-6 py-2.5 sm:py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium text-sm sm:text-base cursor-pointer"
                            >
                                Delete Account
                            </button>
                        ) : (
                            <div className="space-y-3 p-4 bg-red-50 rounded-lg border border-red-200">
                                <p className="text-sm font-medium text-red-900">
                                    Are you sure you want to delete your account?
                                </p>
                                <p className="text-xs text-red-700">
                                    This action cannot be undone. All your data will be permanently deleted.
                                </p>
                                <div>
                                    <label className="block text-sm font-medium text-red-900 mb-2">
                                        Type <strong>DELETE</strong> to confirm:
                                    </label>
                                    <input
                                        type="text"
                                        value={deleteConfirmText}
                                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm sm:text-base"
                                        placeholder="Type DELETE to confirm"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleDeleteAccount}
                                        disabled={deleteConfirmText !== "DELETE"}
                                        className="px-4 sm:px-6 py-2.5 sm:py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        Confirm Delete
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowDeleteConfirm(false);
                                            setDeleteConfirmText("");
                                        }}
                                        className="px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm sm:text-base cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default function SettingsPage() {
    return <SettingsPageContent />;
}
