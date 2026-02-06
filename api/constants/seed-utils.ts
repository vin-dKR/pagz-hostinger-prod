import { PrismaClient } from "../generated/prisma/client";

// Helper function to generate slug from name
export function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 100);
}

// Helper function to ensure unique slug
export async function getUniqueSlug(
    prisma: PrismaClient,
    baseSlug: string
): Promise<string> {
    let uniqueSlug = baseSlug;
    let counter = 1;
    while (await prisma.product.findUnique({ where: { slug: uniqueSlug } })) {
        uniqueSlug = `${baseSlug}-${counter}`;
        counter++;
    }
    return uniqueSlug;
}

