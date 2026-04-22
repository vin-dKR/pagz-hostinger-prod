-- Phone-based OTP auth (Fast2SMS). Email now optional, phone mandatory+unique.
-- WARNING: Destructive for users without a phone. Rows with NULL/empty phone are deleted.

-- 1. Drop existing unique constraint on users.email (email becomes optional+unique nullable).
DROP INDEX `users_email_key` ON `users`;

-- 2. Delete users lacking a usable phone (dev-safe cleanup; prod must backfill before applying).
DELETE FROM `users` WHERE `phone` IS NULL OR `phone` = '';

-- 3. Add passwordHash column (nullable for existing Supabase-backed rows; required for new signups).
ALTER TABLE `users` ADD COLUMN `passwordHash` VARCHAR(191) NULL;

-- 4. Make phone NOT NULL + UNIQUE, allow email NULL but keep unique.
ALTER TABLE `users` MODIFY `phone` VARCHAR(191) NOT NULL;
ALTER TABLE `users` MODIFY `email` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `users_phone_key` ON `users`(`phone`);
CREATE UNIQUE INDEX `users_email_key` ON `users`(`email`);
CREATE INDEX `users_phone_idx` ON `users`(`phone`);

-- 5. Drop legacy email-OTP table.
DROP TABLE IF EXISTS `password_reset_otps`;

-- 6. Create phone-OTP table.
CREATE TABLE `phone_otps` (
    `id`        VARCHAR(191) NOT NULL,
    `phone`     VARCHAR(191) NOT NULL,
    `otp`       VARCHAR(191) NOT NULL,
    `purpose`   ENUM('SIGNUP', 'RESET_PASSWORD') NOT NULL,
    `expiresAt` DATETIME(3)  NOT NULL,
    `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `phone_otps_phone_idx` (`phone`),
    INDEX `phone_otps_phone_purpose_idx` (`phone`, `purpose`),
    INDEX `phone_otps_phone_otp_purpose_idx` (`phone`, `otp`, `purpose`),
    INDEX `phone_otps_expiresAt_idx` (`expiresAt`),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
