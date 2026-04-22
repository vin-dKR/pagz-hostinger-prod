-- Add ON DELETE CASCADE to Order.userId, Payment.userId, Payment.orderId
-- so deleting a user (or order) cascades properly without FK violations.

ALTER TABLE `orders` DROP FOREIGN KEY `orders_userId_fkey`;
ALTER TABLE `orders`
    ADD CONSTRAINT `orders_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `payments` DROP FOREIGN KEY `payments_userId_fkey`;
ALTER TABLE `payments`
    ADD CONSTRAINT `payments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `payments` DROP FOREIGN KEY `payments_orderId_fkey`;
ALTER TABLE `payments`
    ADD CONSTRAINT `payments_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
