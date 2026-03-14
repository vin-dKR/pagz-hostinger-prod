import "dotenv/config";
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaMariaDb({
    host: process.env.DATABASE_HOST!,
    user: process.env.DATABASE_USER!,
    password: process.env.DATABASE_PASSWORD!,
    database: process.env.DATABASE_NAME!,
    connectionLimit: 5
});
const prisma: PrismaClient = new PrismaClient({ adapter });

const TARGET_ID = '29c6ad9b-5e25-4653-8c40-78645766526c';

async function deleteSpecificationCombinationPricingRules() {
    try {
        console.log(`Starting deletion for ID: ${TARGET_ID}\n`);

        let categoryId: string | null = null;

        // Check if the ID is a category ID
        const category = await prisma.category.findUnique({
            where: { id: TARGET_ID },
            select: { id: true, name: true }
        });

        if (category) {
            categoryId = category.id;
            console.log(`✓ Found category: ${category.name} (${category.id})\n`);
        } else {
            // Check if the ID is a product ID
            const product = await prisma.product.findUnique({
                where: { id: TARGET_ID },
                select: { id: true, name: true, categoryId: true }
            });

            if (product) {
                categoryId = product.categoryId;
                console.log(`✓ Found product: ${product.name} (${product.id})`);
                console.log(`✓ Category ID: ${categoryId}\n`);
            } else {
                // Check if the ID is a pricing rule ID
                const pricingRule = await prisma.categoryPricingRule.findUnique({
                    where: { id: TARGET_ID },
                    select: { id: true, ruleType: true, categoryId: true }
                });

                if (pricingRule) {
                    categoryId = pricingRule.categoryId;
                    console.log(`✓ Found pricing rule: ${pricingRule.ruleType} (${pricingRule.id})`);
                    console.log(`✓ Category ID: ${categoryId}\n`);
                }
            }
        }

        if (!categoryId) {
            console.error(`❌ No category, product, or pricing rule found with ID: ${TARGET_ID}`);
            process.exit(1);
        }

        // Delete all SPECIFICATION_COMBINATION pricing rules for this category
        const deletedRules = await prisma.categoryPricingRule.deleteMany({
            where: {
                categoryId: categoryId,
                ruleType: 'SPECIFICATION_COMBINATION'
            }
        });

        console.log(`✓ Deleted ${deletedRules.count} SPECIFICATION_COMBINATION pricing rule(s) for category ${categoryId}`);
        console.log(`\n✅ Successfully deleted ${deletedRules.count} record(s) in total`);
    } catch (error: any) {
        console.error('❌ Error deleting specification combination pricing rules:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

deleteSpecificationCombinationPricingRules();
