-- Add fileMultiplier flag to CategoryPricingRule.
-- When true, the rule's priceModifier is multiplied by the number of
-- uploaded files (customDesignUrl length) on the cart/order item instead
-- of the effective page count.

ALTER TABLE `category_pricing_rules` ADD COLUMN `fileMultiplier` BOOLEAN NOT NULL DEFAULT false;
