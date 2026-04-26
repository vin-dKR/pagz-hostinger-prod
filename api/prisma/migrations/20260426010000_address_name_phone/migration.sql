-- Per-address recipient name + phone. Optional so existing rows
-- continue to validate; the customer / admin UI falls back to the
-- account-level user.name / user.phone when null.

ALTER TABLE `addresses`
    ADD COLUMN `name` VARCHAR(255) NULL,
    ADD COLUMN `phone` VARCHAR(32) NULL;
