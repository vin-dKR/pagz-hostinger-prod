// Helper functions for seed scripts
import { getProductImages } from "./seed-images";

/**
 * Creates image data for product creation
 * @param productName - Name of the product for alt text
 * @param imageType - Type of product image to use
 * @param count - Number of images (default: 2)
 * @returns Array of image objects ready for Prisma create
 */
export function createProductImages(
    productName: string,
    imageType: keyof typeof import("./seed-images").PRODUCT_IMAGES = "printout",
    count: number = 2
) {
    return {
        create: getProductImages(imageType, count).map((url, index) => ({
            url,
            alt: `${productName} - Image ${index + 1}`,
            isPrimary: index === 0,
            displayOrder: index,
        })),
    };
}

