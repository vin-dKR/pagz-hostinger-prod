-- Category-scoped reviews: make productId optional, add categoryId, relax FKs, add indexes, backfill.

-- Relax productId to nullable
ALTER TABLE `reviews` MODIFY COLUMN `productId` VARCHAR(191) NULL;

-- Add categoryId
ALTER TABLE `reviews` ADD COLUMN `categoryId` VARCHAR(191) NULL;

-- Switch productId FK onDelete Cascade -> SetNull (so deleting a product keeps the review attached to its category)
ALTER TABLE `reviews` DROP FOREIGN KEY `reviews_productId_fkey`;
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add categoryId FK
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_categoryId_fkey`
    FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX `reviews_categoryId_idx` ON `reviews`(`categoryId`);
CREATE INDEX `reviews_categoryId_isApproved_idx` ON `reviews`(`categoryId`, `isApproved`);
CREATE UNIQUE INDEX `reviews_categoryId_userId_key` ON `reviews`(`categoryId`, `userId`);

-- Backfill: every existing product review also gets its product's category
UPDATE `reviews` r
JOIN `products` p ON p.`id` = r.`productId`
SET r.`categoryId` = p.`categoryId`
WHERE r.`categoryId` IS NULL AND r.`productId` IS NOT NULL;
