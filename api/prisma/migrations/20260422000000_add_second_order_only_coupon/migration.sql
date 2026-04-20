-- Add secondOrderOnly flag to coupons (mirror of firstOrderOnly)
ALTER TABLE `coupons` ADD COLUMN `secondOrderOnly` BOOLEAN NOT NULL DEFAULT false;
