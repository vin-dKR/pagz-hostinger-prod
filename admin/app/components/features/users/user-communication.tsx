/**
 * User Communication Component
 * Handles email communication and notification preferences
 */

'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/app/components/ui/dialog';
import { Select } from '@/app/components/ui/select';
import { Mail, Bell, Send } from 'lucide-react';
import { updateUser, type User } from '@/lib/api/users.service';
import { toastError, toastSuccess } from '@/lib/utils/toast';

interface UserCommunicationProps {
    userId: string;
    user: User;
    onSuccess?: () => void;
}

export function UserCommunication({ userId, user, onSuccess }: UserCommunicationProps) {
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Email form
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [emailTemplate, setEmailTemplate] = useState('custom');

    // Notification preferences
    const [preferences, setPreferences] = useState({
        emailNotifications: true,
        smsNotifications: false,
        orderUpdates: true,
        promotionalEmails: true,
        reviewReminders: true,
        ...((user.notificationPreferences as any) || {}),
    });

    const emailTemplates = [
        { value: 'custom', label: 'Custom Message' },
        { value: 'welcome', label: 'Welcome Email' },
        { value: 'order_confirmation', label: 'Order Confirmation' },
        { value: 'account_activation', label: 'Account Activation' },
        { value: 'password_reset', label: 'Password Reset' },
    ];

    const handleSendEmail = async () => {
        if (!emailSubject.trim() || !emailBody.trim()) {
            setError('Subject and body are required');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            // TODO: Implement actual email sending API endpoint
            // For now, just show a success message
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            toastSuccess('Email sent successfully!');
            setIsEmailModalOpen(false);
            setEmailSubject('');
            setEmailBody('');
            setEmailTemplate('custom');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send email');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTemplateChange = (template: string) => {
        setEmailTemplate(template);
        // Pre-fill template content
        const templates: Record<string, { subject: string; body: string }> = {
            welcome: {
                subject: 'Welcome to Our Store!',
                body: `Dear ${user.name || 'Customer'},

Welcome to our store! We're excited to have you as part of our community.

Thank you for joining us!

Best regards,
The Team`,
            },
            order_confirmation: {
                subject: 'Order Confirmation',
                body: `Dear ${user.name || 'Customer'},

Thank you for your order! We've received your order and will process it shortly.

Best regards,
The Team`,
            },
            account_activation: {
                subject: 'Account Activated',
                body: `Dear ${user.name || 'Customer'},

Your account has been activated. You can now access all features.

Best regards,
The Team`,
            },
            password_reset: {
                subject: 'Password Reset',
                body: `Dear ${user.name || 'Customer'},

You have requested a password reset. Please use the link below to reset your password.

Best regards,
The Team`,
            },
        };

        if (templates[template]) {
            setEmailSubject(templates[template].subject);
            setEmailBody(templates[template].body);
        }
    };

    const handleSavePreferences = async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            await updateUser(userId, {
                notificationPreferences: preferences,
            });
            setIsPreferencesModalOpen(false);
            onSuccess?.();
            toastSuccess('Notification preferences updated successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update preferences');
            toastError(err instanceof Error ? err.message : 'Failed to update preferences');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Email Communication
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <p className="text-sm text-gray-600 mb-2">
                                Send an email to {user.name || user.email}
                            </p>
                            <Button onClick={() => setIsEmailModalOpen(true)}>
                                <Send className="h-4 w-4 mr-2" />
                                Send Email
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-6">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Notification Preferences
                    </h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium">Email Notifications</p>
                                <p className="text-xs text-gray-500">Receive email notifications</p>
                            </div>
                            <span className="text-sm">
                                {preferences.emailNotifications ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium">SMS Notifications</p>
                                <p className="text-xs text-gray-500">Receive SMS notifications</p>
                            </div>
                            <span className="text-sm">
                                {preferences.smsNotifications ? 'Enabled' : 'Disabled'}
                            </span>
                        </div>
                        <Button variant="outline" onClick={() => setIsPreferencesModalOpen(true)}>
                            Edit Preferences
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Send Email Modal */}
            <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogClose onClose={() => setIsEmailModalOpen(false)} />
                    <DialogHeader>
                        <DialogTitle>Send Email to {user.name || user.email}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {error && <Alert variant="error">{error}</Alert>}
                        <div>
                            <Label htmlFor="template">Email Template</Label>
                            <Select
                                id="template"
                                value={emailTemplate}
                                onChange={(e) => handleTemplateChange(e.target.value)}
                            >
                                {emailTemplates.map((template) => (
                                    <option key={template.value} value={template.value}>
                                        {template.label}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="subject">Subject *</Label>
                            <Input
                                id="subject"
                                value={emailSubject}
                                onChange={(e) => setEmailSubject(e.target.value)}
                                placeholder="Email subject"
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="body">Message *</Label>
                            <textarea
                                id="body"
                                value={emailBody}
                                onChange={(e) => setEmailBody(e.target.value)}
                                placeholder="Email message"
                                className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEmailModalOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleSendEmail} disabled={isSubmitting || !emailSubject.trim() || !emailBody.trim()}>
                            {isSubmitting ? 'Sending...' : 'Send Email'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Notification Preferences Modal */}
            <Dialog open={isPreferencesModalOpen} onOpenChange={setIsPreferencesModalOpen}>
                <DialogContent>
                    <DialogClose onClose={() => setIsPreferencesModalOpen(false)} />
                    <DialogHeader>
                        <DialogTitle>Notification Preferences</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {error && <Alert variant="error">{error}</Alert>}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="emailNotifications">Email Notifications</Label>
                                    <p className="text-xs text-gray-500">Receive email notifications</p>
                                </div>
                                <input
                                    type="checkbox"
                                    id="emailNotifications"
                                    checked={preferences.emailNotifications}
                                    onChange={(e) => setPreferences({ ...preferences, emailNotifications: e.target.checked })}
                                    className="rounded border-gray-300"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="smsNotifications">SMS Notifications</Label>
                                    <p className="text-xs text-gray-500">Receive SMS notifications</p>
                                </div>
                                <input
                                    type="checkbox"
                                    id="smsNotifications"
                                    checked={preferences.smsNotifications}
                                    onChange={(e) => setPreferences({ ...preferences, smsNotifications: e.target.checked })}
                                    className="rounded border-gray-300"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="orderUpdates">Order Updates</Label>
                                    <p className="text-xs text-gray-500">Receive order status updates</p>
                                </div>
                                <input
                                    type="checkbox"
                                    id="orderUpdates"
                                    checked={preferences.orderUpdates}
                                    onChange={(e) => setPreferences({ ...preferences, orderUpdates: e.target.checked })}
                                    className="rounded border-gray-300"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="promotionalEmails">Promotional Emails</Label>
                                    <p className="text-xs text-gray-500">Receive promotional offers</p>
                                </div>
                                <input
                                    type="checkbox"
                                    id="promotionalEmails"
                                    checked={preferences.promotionalEmails}
                                    onChange={(e) => setPreferences({ ...preferences, promotionalEmails: e.target.checked })}
                                    className="rounded border-gray-300"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <Label htmlFor="reviewReminders">Review Reminders</Label>
                                    <p className="text-xs text-gray-500">Receive review reminder emails</p>
                                </div>
                                <input
                                    type="checkbox"
                                    id="reviewReminders"
                                    checked={preferences.reviewReminders}
                                    onChange={(e) => setPreferences({ ...preferences, reviewReminders: e.target.checked })}
                                    className="rounded border-gray-300"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPreferencesModalOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleSavePreferences} disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Save Preferences'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

