/**
 * User Security Actions Component
 * Handles password reset, account suspension, and activation
 */

'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import { resetUserPassword, suspendUser, activateUser } from '@/lib/api/users.service';
import { Key, Ban, CheckCircle, AlertTriangle } from 'lucide-react';
import { toastPromise } from '@/lib/utils/toast';

interface UserSecurityActionsProps {
    userId: string;
    userName?: string;
    isSuspended?: boolean;
    onSuccess?: () => void;
}

export function UserSecurityActions({ userId, userName, isSuspended, onSuccess }: UserSecurityActionsProps) {
    const [isPasswordResetOpen, setIsPasswordResetOpen] = useState(false);
    const [isSuspendOpen, setIsSuspendOpen] = useState(false);
    const [isActivateOpen, setIsActivateOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suspendReason, setSuspendReason] = useState('');
    const [suspendDuration, setSuspendDuration] = useState<number | undefined>(undefined);
    const [sendEmail, setSendEmail] = useState(true);

    const handlePasswordReset = async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            await toastPromise(
                resetUserPassword(userId, sendEmail),
                {
                    loading: 'Resetting password...',
                    success: sendEmail ? 'Password reset email sent successfully' : 'Password reset token generated',
                    error: 'Failed to reset password',
                }
            );
            setIsPasswordResetOpen(false);
            onSuccess?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reset password');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSuspend = async () => {
        if (!suspendReason.trim()) {
            setError('Please provide a reason for suspension');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await suspendUser(userId, suspendReason, suspendDuration);
            setIsSuspendOpen(false);
            setSuspendReason('');
            setSuspendDuration(undefined);
            onSuccess?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to suspend user');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleActivate = async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            await activateUser(userId);
            setIsActivateOpen(false);
            onSuccess?.();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to activate user');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPasswordResetOpen(true)}
                >
                    <Key className="h-4 w-4 mr-2" />
                    Reset Password
                </Button>
                {isSuspended ? (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsActivateOpen(true)}
                    >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Activate Account
                    </Button>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSuspendOpen(true)}
                    >
                        <Ban className="h-4 w-4 mr-2" />
                        Suspend Account
                    </Button>
                )}
            </div>

            {/* Password Reset Dialog */}
            <Dialog open={isPasswordResetOpen} onOpenChange={setIsPasswordResetOpen}>
                <DialogContent>
                    <DialogClose onClose={() => setIsPasswordResetOpen(false)} />
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {error && <Alert variant="error">{error}</Alert>}
                        <p className="text-sm text-gray-600">
                            This will reset the password for {userName || 'this user'}.
                            {sendEmail ? ' An email will be sent with instructions.' : ' A reset token will be generated.'}
                        </p>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="sendEmail"
                                checked={sendEmail}
                                onChange={(e) => setSendEmail(e.target.checked)}
                            />
                            <Label htmlFor="sendEmail">Send password reset email</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPasswordResetOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handlePasswordReset} disabled={isSubmitting}>
                            {isSubmitting ? 'Processing...' : 'Reset Password'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Suspend Account Dialog */}
            <Dialog open={isSuspendOpen} onOpenChange={setIsSuspendOpen}>
                <DialogContent>
                    <DialogClose onClose={() => setIsSuspendOpen(false)} />
                    <DialogHeader>
                        <DialogTitle>Suspend Account</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {error && <Alert variant="error">{error}</Alert>}
                        <Alert variant="error">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            Suspending this account will prevent the user from logging in and placing orders.
                        </Alert>
                        <div>
                            <Label htmlFor="reason">Reason for Suspension *</Label>
                            <Input
                                id="reason"
                                value={suspendReason}
                                onChange={(e) => setSuspendReason(e.target.value)}
                                placeholder="Enter reason for suspension"
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="duration">Duration (days, optional)</Label>
                            <Input
                                id="duration"
                                type="number"
                                value={suspendDuration || ''}
                                onChange={(e) => setSuspendDuration(e.target.value ? parseInt(e.target.value) : undefined)}
                                placeholder="Leave empty for indefinite"
                                min="1"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Leave empty to suspend indefinitely
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSuspendOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleSuspend} disabled={isSubmitting || !suspendReason.trim()}>
                            {isSubmitting ? 'Suspending...' : 'Suspend Account'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Activate Account Dialog */}
            <Dialog open={isActivateOpen} onOpenChange={setIsActivateOpen}>
                <DialogContent>
                    <DialogClose onClose={() => setIsActivateOpen(false)} />
                    <DialogHeader>
                        <DialogTitle>Activate Account</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {error && <Alert variant="error">{error}</Alert>}
                        <p className="text-sm text-gray-600">
                            This will reactivate the account for {userName || 'this user'}, allowing them to log in and place orders again.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsActivateOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleActivate} disabled={isSubmitting}>
                            {isSubmitting ? 'Activating...' : 'Activate Account'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

