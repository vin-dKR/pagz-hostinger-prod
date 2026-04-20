import { prisma } from "../src/services/prisma.js";

interface SeedMethod {
    key: string; // lookup key on name
    name: string;
    description: string;
    price: number;
    estimatedDays: string;
    icon: string;
    iconColor: string;
    isActive: boolean;
    isDefault: boolean;
    displayOrder: number;
}

const METHODS: SeedMethod[] = [
    {
        key: "Standard Delivery",
        name: "Standard Delivery",
        description: "5 - 7 business days",
        price: 0,
        estimatedDays: "5-7",
        icon: "truck",
        iconColor: "#2563eb",
        isActive: true,
        isDefault: true,
        displayOrder: 0,
    },
    {
        key: "Express Delivery",
        name: "Express Delivery",
        description: "2 - 3 business days",
        price: 50,
        estimatedDays: "2-3",
        icon: "zap",
        iconColor: "#2563eb",
        isActive: true,
        isDefault: false,
        displayOrder: 1,
    },
];

async function main() {
    let created = 0;
    let updated = 0;

    for (const m of METHODS) {
        const existing = await prisma.shippingMethod.findFirst({ where: { name: m.key } });
        if (existing) {
            await prisma.shippingMethod.update({
                where: { id: existing.id },
                data: {
                    name: m.name,
                    description: m.description,
                    price: m.price,
                    estimatedDays: m.estimatedDays,
                    icon: m.icon,
                    iconColor: m.iconColor,
                    isActive: m.isActive,
                    isDefault: m.isDefault,
                    displayOrder: m.displayOrder,
                },
            });
            updated++;
            console.log(`✓ Updated ${m.name}`);
        } else {
            await prisma.shippingMethod.create({
                data: {
                    name: m.name,
                    description: m.description,
                    price: m.price,
                    estimatedDays: m.estimatedDays,
                    icon: m.icon,
                    iconColor: m.iconColor,
                    isActive: m.isActive,
                    isDefault: m.isDefault,
                    displayOrder: m.displayOrder,
                },
            });
            created++;
            console.log(`✓ Created ${m.name}`);
        }
    }

    console.log(`\nDone: ${created} created, ${updated} updated.`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
