-- Add copyMultiplier flag to CategoryPricingRule.
-- When true on an ADDON rule, the addon is charged once per physical copy
-- (e.g. spiral binding — one binding per printed book). The rule's
-- page-range gate is checked against the per-copy page count
-- (post half-page reduction) and the price is multiplied by the copies
-- count. Defaults to false so every existing rule keeps its current
-- behavior; the data migration is a non-destructive ADD COLUMN.

ALTER TABLE `category_pricing_rules` ADD COLUMN `copyMultiplier` BOOLEAN NOT NULL DEFAULT false;
