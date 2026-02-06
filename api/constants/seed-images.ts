// Product image URLs for seed data
// Using Unsplash and Pexels for high-quality free images

export const PRODUCT_IMAGES = {
    // Printout images
    printout: [
        "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=600&fit=crop",
    ],
    // Book images
    book: [
        "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=600&fit=crop",
    ],
    // Photo images
    photo: [
        "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=600&fit=crop",
    ],
    // Business card images
    businessCard: [
        "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800&h=600&fit=crop",
    ],
    // Letter head images
    letterHead: [
        "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&h=600&fit=crop",
    ],
    // Bill book images
    billBook: [
        "https://images.unsplash.com/photo-1506880018603-83d5b7b92a2a?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=600&fit=crop",
    ],
    // Pamphlet/Brochure images
    pamphlet: [
        "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1467232004584-a241de8b9b83?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1558655146-364adaf1fcc9?w=800&h=600&fit=crop",
    ],
    // Map images
    map: [
        "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800&h=600&fit=crop",
    ],
    // Lamination images
    lamination: [
        "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=800&h=600&fit=crop",
    ],
    // Binding images
    binding: [
        "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop",
    ],
};

// Helper function to get random images for a product type
export function getProductImages(type: keyof typeof PRODUCT_IMAGES, count: number = 2): string[] {
    const images = PRODUCT_IMAGES[type] || PRODUCT_IMAGES.printout;
    // Return random selection of images
    const shuffled = [...images].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, images.length));
}

