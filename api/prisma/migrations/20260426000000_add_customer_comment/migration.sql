-- Add customer-supplied free-form note to Order + PendingPayment.
-- Persisted at checkout (PendingPayment) and copied onto the final
-- Order row at verify-payment time.

ALTER TABLE `orders`
    ADD COLUMN `customerComment` TEXT NULL;

ALTER TABLE `pending_payments`
    ADD COLUMN `customerComment` TEXT NULL;
