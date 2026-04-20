-- Dynamic shipping methods: new shipping_methods table + orders.shippingMethodId FK

CREATE TABLE `shipping_methods` (
    `id`            VARCHAR(191) NOT NULL,
    `name`          VARCHAR(191) NOT NULL,
    `description`   VARCHAR(191) NULL,
    `price`         DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `estimatedDays` VARCHAR(191) NULL,
    `icon`          VARCHAR(191) NULL,
    `iconColor`     VARCHAR(191) NULL,
    `isActive`      BOOLEAN NOT NULL DEFAULT true,
    `isDefault`     BOOLEAN NOT NULL DEFAULT false,
    `displayOrder`  INT NOT NULL DEFAULT 0,
    `createdAt`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`     DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `shipping_methods_isActive_idx` (`isActive`),
    INDEX `shipping_methods_displayOrder_idx` (`displayOrder`),
    INDEX `shipping_methods_isActive_displayOrder_idx` (`isActive`, `displayOrder`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Link orders to shipping method (nullable; SET NULL on method delete)
ALTER TABLE `orders` ADD COLUMN `shippingMethodId` VARCHAR(191) NULL;
ALTER TABLE `orders` ADD CONSTRAINT `orders_shippingMethodId_fkey`
    FOREIGN KEY (`shippingMethodId`) REFERENCES `shipping_methods`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX `orders_shippingMethodId_idx` ON `orders`(`shippingMethodId`);
