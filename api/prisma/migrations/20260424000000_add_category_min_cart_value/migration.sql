-- Add minCartValue to Category.
-- Optional per-category minimum cart subtotal enforced at order creation.
-- NULL or 0 disables the check for that category.

ALTER TABLE `categories` ADD COLUMN `minCartValue` DECIMAL(10, 2) NULL;
