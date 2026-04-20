import "dotenv/config";
import { prisma } from "../src/services/prisma.js";

interface SeedTestimonial {
    customerName: string;
    rating: number;
    review: string;
}

// Verbatim from web/app/components/Testimonials.tsx (initial useState array).
const TESTIMONIALS: SeedTestimonial[] = [
    {
        customerName: "Rajesh Kumar",
        rating: 5,
        review: "Got my wedding photo album printed here. The photo quality is amazing and the binding is perfect. They even helped me choose the right paper quality. Worth every rupee!"
    },
    {
        customerName: "Anjali Patel",
        rating: 4,
        review: "Printed my college project documents - 200 pages with color covers. The printing is clear and professional. Delivery was on time. Only minor issue was one page had slight misalignment, but overall satisfied."
    },
    {
        customerName: "Vikram Singh",
        rating: 5,
        review: "Best printing service in Bihar! Got my company letterheads and visiting cards printed. The quality is top-notch and pricing is very reasonable. They understand business requirements well."
    },
    {
        customerName: "Meera Reddy",
        rating: 5,
        review: "Ordered bulk printing for my school - 1000 copies of exam papers. They handled the large order efficiently and delivered on schedule. The print quality is consistent throughout. Great service!"
    },
    {
        customerName: "Amit Verma",
        rating: 4,
        review: "Printed large format maps for my office presentation. The colors are vibrant and the details are sharp. Good quality paper used. Would have given 5 stars if the delivery was a bit faster, but quality is excellent."
    },
    {
        customerName: "Sneha Desai",
        rating: 5,
        review: "Got brochures printed for my business. The design came out exactly as I wanted. Professional finish and good customer service. They even suggested improvements to my design. Very helpful team!"
    },
    {
        customerName: "Rohit Gupta",
        rating: 5,
        review: "Printed my book manuscript - 300 pages. The binding is sturdy and the pages are crisp. They offer various binding options and helped me choose the best one. Great value for money!"
    }
];

function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}

async function main() {
    const categories = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { priority: "desc" },
        take: 7
    });

    if (categories.length === 0) {
        console.warn("⚠️  No active categories found. Skipping review seeding.");
        return;
    }

    let seeded = 0;

    for (let i = 0; i < TESTIMONIALS.length; i++) {
        const testimonial = TESTIMONIALS[i]!;
        const category = categories[i % categories.length]!;

        const slug = slugify(testimonial.customerName);
        const email = `seed-testimonial-${slug}@pagz.in`;

        const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: { email, name: testimonial.customerName }
        });

        await prisma.review.upsert({
            where: {
                categoryId_userId: {
                    categoryId: category.id,
                    userId: user.id
                }
            },
            update: {
                rating: testimonial.rating,
                comment: testimonial.review,
                isApproved: true
            },
            create: {
                categoryId: category.id,
                productId: null,
                userId: user.id,
                rating: testimonial.rating,
                title: null,
                comment: testimonial.review,
                images: [],
                isApproved: true,
                isVerifiedPurchase: false
            }
        });

        seeded++;
        console.log(`✓ Seeded review by ${testimonial.customerName} on category ${category.name}`);
    }

    console.log(`Done: ${seeded} reviews seeded.`);
}

main()
    .catch((error) => {
        console.error("❌ Failed to seed reviews:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
