import { Request, Response, NextFunction } from "express";
import { Prisma } from "../../generated/prisma/client.js";
import { sendSuccess } from "../utils/response.js";
import { ValidationError, NotFoundError } from "../utils/errors.js";
import { prisma } from "../services/prisma.js";

// Get all categories (public) - Optimized with select to reduce data transfer
export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categories = await prisma.category.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                image: true,
                parentId: true,
                isActive: true,
                // Only get primary image URL, not full image object
                images: {
                    where: { isPrimary: true },
                    take: 1,
                    select: {
                        url: true,
                        alt: true,
                    },
                    orderBy: { displayOrder: "asc" },
                },
            },
            orderBy: { name: "asc" },
        });

        return sendSuccess(res, categories);
    } catch (error) {
        next(error);
    }
};

/**
 * @openapi
 * /api/v1/admin/categories:
 *   get:
 *     summary: Get all categories (admin)
 *     description: Returns a paginated list of product categories for admins, with optional search by name, slug, or description.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Free-text search across category name, slug, and description (case-insensitive).
 *     responses:
 *       200:
 *         description: List of categories retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   required:
 *                     - categories
 *                     - pagination
 *                   properties:
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
                           name:
                             type: string
                           slug:
                             type: string
                           description:
                             type: string
                             nullable: true
                           isActive:
                             type: boolean
                           parent:
                             type: object
                             nullable: true
                             properties:
                               id:
                                 type: string
                               name:
                                 type: string
                               slug:
                                 type: string
                           createdAt:
                             type: string
                             format: date-time
                           updatedAt:
                             type: string
                             format: date-time
                           _count:
                             type: object
                             properties:
                               products:
                                 type: integer
                     pagination:
                       type: object
                       properties:
                         page:
                           type: integer
                         limit:
                           type: integer
                         total:
                           type: integer
                         totalPages:
                           type: integer
       401:
         description: Unauthorized - admin authentication required.
 */
export const getAdminCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const search = (req.query.search as string) || "";
        const skip = (page - 1) * limit;

        const where: Prisma.CategoryWhereInput = {};

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { slug: { contains: search } },
                { description: { contains: search } },
            ];
        }

        // Optimize: Use select to reduce data transfer and improve performance
        const [categories, total] = await Promise.all([
            prisma.category.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    image: true,
                    parentId: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                    parent: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                    images: {
                        where: { isPrimary: true },
                        take: 1,
                        select: {
                            id: true,
                            url: true,
                            alt: true,
                        },
                    },
                    _count: {
                        select: {
                            products: true,
                            specifications: true,
                            pricingRules: true,
                            images: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
            prisma.category.count({ where }),
        ]);

        // Add count of published pricing rules for each category
        const categoriesWithPublishedCount = await Promise.all(
            categories.map(async (category) => {
                const publishedCount = await prisma.categoryPricingRule.count({
                    where: {
                        categoryId: category.id,
                        isPublished: true,
                    },
                });
                return {
                    ...category,
                    _count: {
                        ...category._count,
                        publishedPricingRules: publishedCount,
                    },
                    primaryImage: category.images[0] || null,
                };
            })
        );

        return sendSuccess(res, {
            categories: categoriesWithPublishedCount,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        next(error);
    }
};

export const createCategoties = async (req: Request, res: Response, next: NextFunction) => {
    const { name, slug, description } = req.body

    try {
        const category = await prisma.category.create({
            data: {
                name,
                slug,
                description
            }
        })

        return sendSuccess(res, category, "Category created successfully", 200)
    } catch (error) {
        next(error)
    }
}

// Get all products with pagination and filters (public catalog)
export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const category = req.query.category as string;
        const search = req.query.search as string;
        const isFeatured = req.query.isFeatured as string;
        const isBestSeller = req.query.isBestSeller as string;
        const isNewArrival = req.query.isNewArrival as string;
        const minPrice = req.query.minPrice as string;
        const maxPrice = req.query.maxPrice as string;
        const sortBy = (req.query.sortBy as string) || 'createdAt';
        const sortOrder = (req.query.sortOrder as string) || 'desc';
        const skip = (page - 1) * limit;

        const where: any = {
            isActive: true,
        };

        // Category filter
        if (category) {
            const categoryRecord = await prisma.category.findFirst({
                where: {
                    OR: [
                        { slug: category.toLowerCase() || category },
                        { name: { contains: category } },
                    ],
                },
            });

            if (categoryRecord) {
                where.categoryId = categoryRecord.id;
            }
        }

        // Search filter
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { description: { contains: search } },
                { shortDescription: { contains: search } },
            ];
        }

        // Feature flags filters
        if (isFeatured === 'true') {
            where.isFeatured = true;
        }
        if (isBestSeller === 'true') {
            where.isBestSeller = true;
        }
        if (isNewArrival === 'true') {
            where.isNewArrival = true;
        }

        // Price range filter
        if (minPrice || maxPrice) {
            where.basePrice = {};
            if (minPrice) {
                where.basePrice.gte = parseFloat(minPrice);
            }
            if (maxPrice) {
                where.basePrice.lte = parseFloat(maxPrice);
            }
        }

        // Sort configuration
        const orderBy: any = {};
        if (sortBy === 'price') {
            orderBy.basePrice = sortOrder;
        } else if (sortBy === 'rating') {
            orderBy.rating = sortOrder;
        } else if (sortBy === 'totalSold') {
            orderBy.totalSold = sortOrder;
        } else {
            orderBy.createdAt = sortOrder;
        }

        // Optimize: Use select instead of include to reduce data transfer
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    shortDescription: true,
                    basePrice: true,
                    sellingPrice: true,
                    mrp: true,
                    stock: true,
                    isFeatured: true,
                    isNewArrival: true,
                    isBestSeller: true,
                    rating: true,
                    totalSold: true,
                    createdAt: true,
                    category: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                    brand: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                    variants: {
                        where: { available: true },
                        select: {
                            id: true,
                            name: true,
                            priceModifier: true,
                        },
                    },
                    images: {
                        select: {
                            id: true,
                            url: true,
                            alt: true,
                            isPrimary: true,
                        },
                        orderBy: { displayOrder: "asc" },
                        take: 5, // Limit images to reduce payload
                    },
                    specifications: {
                        select: {
                            key: true,
                            value: true,
                        },
                        orderBy: { displayOrder: "asc" },
                        take: 10, // Limit specs to reduce payload
                    },
                },
                skip,
                take: limit,
                orderBy,
            }),
            prisma.product.count({ where }),
        ]);

        return sendSuccess(res, {
            products,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get all products for admin with pagination and filters
// This endpoint is similar to getProducts but:
// - does not force isActive = true
// - allows filtering by isActive and merchandising flags
export const getAdminProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const category = req.query.category as string;
        const search = req.query.search as string;
        const isFeatured = req.query.isFeatured as string;
        const isBestSeller = req.query.isBestSeller as string;
        const isNewArrival = req.query.isNewArrival as string;
        const isActive = req.query.isActive as string;
        const minPrice = req.query.minPrice as string;
        const maxPrice = req.query.maxPrice as string;
        const sortBy = (req.query.sortBy as string) || "createdAt";
        const sortOrder = (req.query.sortOrder as string) || "desc";
        const skip = (page - 1) * limit;

        const where: Prisma.ProductWhereInput = {};

        // Active/inactive filter (if not provided, include all)
        if (isActive === "true") {
            where.isActive = true;
        } else if (isActive === "false") {
            where.isActive = false;
        }

        // Category filter (by id, slug, or name)
        if (category) {
            const categoryRecord = await prisma.category.findFirst({
                where: {
                    OR: [
                        { id: category },
                        { slug: category.toLowerCase() || category },
                        { name: { contains: category } },
                    ],
                },
            });

            if (categoryRecord) {
                where.categoryId = categoryRecord.id;
            }
        }

        // Search filter
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { slug: { contains: search } },
                { description: { contains: search } },
                { shortDescription: { contains: search } },
                { sku: { contains: search } },
            ];
        }

        // Feature flags filters
        if (isFeatured === "true") {
            where.isFeatured = true;
        }
        if (isBestSeller === "true") {
            where.isBestSeller = true;
        }
        if (isNewArrival === "true") {
            where.isNewArrival = true;
        }

        // Price range filter (on basePrice)
        if (minPrice || maxPrice) {
            where.basePrice = {};
            if (minPrice) {
                (where.basePrice as any).gte = parseFloat(minPrice);
            }
            if (maxPrice) {
                (where.basePrice as any).lte = parseFloat(maxPrice);
            }
        }

        // Sort configuration
        const orderBy: any = {};
        if (sortBy === "price") {
            orderBy.basePrice = sortOrder;
        } else if (sortBy === "rating") {
            orderBy.rating = sortOrder;
        } else if (sortBy === "totalSold") {
            orderBy.totalSold = sortOrder;
        } else if (sortBy === "name") {
            orderBy.name = sortOrder;
        } else {
            orderBy.createdAt = sortOrder;
        }

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: {
                    category: true,
                    variants: true,
                    images: {
                        orderBy: { displayOrder: "asc" },
                    },
                    specifications: {
                        orderBy: { displayOrder: "asc" },
                    },
                    attributes: true,
                    tags: true,
                },
                skip,
                take: limit,
                orderBy,
            }),
            prisma.product.count({ where }),
        ]);

        return sendSuccess(res, {
            products,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit) || 1,
            },
        });
    } catch (error) {
        next(error);
    }
};

// Get single product (public)
export const getProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
                variants: {
                    where: { available: true },
                },
                images: {
                    orderBy: { displayOrder: "asc" },
                },
                specifications: {
                    orderBy: { displayOrder: "asc" },
                },
                attributes: true,
                tags: true,
                reviews: {
                    where: { isApproved: true },
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    take: 5,
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        if (!product || !product.isActive) {
            throw new NotFoundError("Product not found");
        }

        // Track recently viewed (if user is authenticated)
        if (req.user) {
            await prisma.recentlyViewedProduct.upsert({
                where: {
                    userId_productId: {
                        userId: req.user.id,
                        productId: product.id,
                    },
                },
                update: {
                    viewedAt: new Date(),
                },
                create: {
                    userId: req.user.id,
                    productId: product.id,
                },
            });
        }

        return sendSuccess(res, product);
    } catch (error) {
        next(error);
    }
};

// Get single product for admin (includes inactive products and all relations)
export const getAdminProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const product = await prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
                variants: true,
                images: {
                    orderBy: { displayOrder: "asc" },
                },
                specifications: {
                    orderBy: { displayOrder: "asc" },
                },
                attributes: true,
                tags: true,
            },
        });

        if (!product) {
            throw new NotFoundError("Product not found");
        }

        return sendSuccess(res, product);
    } catch (error) {
        next(error);
    }
};

// Helper function to generate slug from name
function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 100);
}

// Admin: Create product
export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            name,
            slug,
            description,
            shortDescription,
            basePrice,
            sellingPrice,
            mrp,
            categoryId,
            sku,
            stock,
            minOrderQuantity,
            maxOrderQuantity,
            weight,
            dimensions,
            returnPolicy,
            warranty,
            isFeatured,
            isNewArrival,
            isBestSeller,
            images,
            specifications,
            attributes,
            tags,
            variants,
        } = req.body;

        if (!name || !basePrice || !categoryId) {
            throw new ValidationError("Name, basePrice, and categoryId are required");
        }

        const category = await prisma.category.findUnique({
            where: { id: categoryId },
        });

        if (!category) {
            throw new NotFoundError("Category not found");
        }

        // Generate slug if not provided
        let productSlug = slug || generateSlug(name);
        let uniqueSlug = productSlug;
        let counter = 1;

        // Ensure slug is unique
        while (await prisma.product.findUnique({ where: { slug: uniqueSlug } })) {
            uniqueSlug = `${productSlug}-${counter}`;
            counter++;
        }

        // Create product with images, specifications, attributes, and tags
        const product = await prisma.product.create({
            data: {
                name,
                slug: uniqueSlug,
                description,
                shortDescription,
                basePrice: parseFloat(basePrice),
                sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
                mrp: mrp ? parseFloat(mrp) : null,
                categoryId,
                sku: sku || null,
                stock: stock || 0,
                minOrderQuantity: minOrderQuantity || 1,
                maxOrderQuantity: maxOrderQuantity || null,
                weight: weight ? parseFloat(weight) : null,
                dimensions: dimensions || null,
                returnPolicy: returnPolicy || null,
                warranty: warranty || null,
                isFeatured: isFeatured || false,
                isNewArrival: isNewArrival || false,
                isBestSeller: isBestSeller || false,
                images: images
                    ? {
                        create: images.map((img: any, index: number) => ({
                            url: typeof img === 'string' ? img : img.url,
                            alt: typeof img === 'string' ? null : img.alt,
                            isPrimary: index === 0,
                            displayOrder: index,
                        })),
                    }
                    : undefined,
                specifications: specifications
                    ? {
                        create: specifications.map((spec: any, index: number) => ({
                            key: spec.key,
                            value: spec.value,
                            displayOrder: index,
                        })),
                    }
                    : undefined,
                attributes: attributes
                    ? {
                        create: attributes.map((attr: any) => ({
                            attributeType: attr.type,
                            attributeValue: attr.value,
                        })),
                    }
                    : undefined,
                tags: tags
                    ? {
                        create: tags.map((tag: string) => ({
                            tag,
                        })),
                    }
                    : undefined,
                variants: variants
                    ? {
                        create: variants.map((variant: any) => ({
                            name: variant.name,
                            sku: variant.sku || null,
                            stock: variant.stock ?? 0,
                            priceModifier:
                                typeof variant.priceModifier === "string"
                                    ? parseFloat(variant.priceModifier)
                                    : variant.priceModifier || 0,
                            available:
                                typeof variant.available === "boolean"
                                    ? variant.available
                                    : true,
                        })),
                    }
                    : undefined,
            },
            include: {
                category: true,
                variants: true,
                images: true,
                specifications: true,
                attributes: true,
                tags: true,
            },
        });

        return sendSuccess(res, product, "Product created successfully", 201);
    } catch (error) {
        next(error);
    }
};

// Admin: Update product
export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const {
            name,
            slug,
            description,
            shortDescription,
            basePrice,
            sellingPrice,
            mrp,
            categoryId,
            sku,
            stock,
            minOrderQuantity,
            maxOrderQuantity,
            weight,
            dimensions,
            returnPolicy,
            warranty,
            isActive,
            isFeatured,
            isNewArrival,
            isBestSeller,
            images,
            specifications,
            attributes,
            tags,
        } = req.body;

        if (!id) {
            throw new ValidationError("Pprovide the id to update")
        }
        const product = await prisma.product.findUnique({
            where: { id },
        });

        if (!product) {
            throw new NotFoundError("Product not found");
        }

        const updateData: any = {};
        if (name) updateData.name = name;
        if (slug) {
            // Ensure slug is unique
            let uniqueSlug = slug;
            let counter = 1;
            while (
                await prisma.product.findFirst({
                    where: { slug: uniqueSlug, id: { not: id } },
                })
            ) {
                uniqueSlug = `${slug}-${counter}`;
                counter++;
            }
            updateData.slug = uniqueSlug;
        }
        if (description !== undefined) updateData.description = description;
        if (shortDescription !== undefined) updateData.shortDescription = shortDescription;
        if (basePrice) updateData.basePrice = parseFloat(basePrice);
        if (sellingPrice !== undefined) updateData.sellingPrice = sellingPrice ? parseFloat(sellingPrice) : null;
        if (mrp !== undefined) updateData.mrp = mrp ? parseFloat(mrp) : null;
        if (categoryId) updateData.categoryId = categoryId;
        if (sku !== undefined) updateData.sku = sku || null;
        if (stock !== undefined) updateData.stock = parseInt(stock);
        if (minOrderQuantity !== undefined) updateData.minOrderQuantity = parseInt(minOrderQuantity);
        if (maxOrderQuantity !== undefined) updateData.maxOrderQuantity = maxOrderQuantity ? parseInt(maxOrderQuantity) : null;
        if (weight !== undefined) updateData.weight = weight ? parseFloat(weight) : null;
        if (dimensions !== undefined) updateData.dimensions = dimensions || null;
        if (returnPolicy !== undefined) updateData.returnPolicy = returnPolicy || null;
        if (warranty !== undefined) updateData.warranty = warranty || null;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
        if (isNewArrival !== undefined) updateData.isNewArrival = isNewArrival;
        if (isBestSeller !== undefined) updateData.isBestSeller = isBestSeller;

        const updatedProduct = await prisma.product.update({
            where: { id },
            data: updateData,
            include: {
                category: true,
                variants: true,
                images: true,
                specifications: true,
                attributes: true,
                tags: true,
            },
        });

        // Update images if provided
        if (images && Array.isArray(images)) {
            await prisma.productImage.deleteMany({ where: { productId: id } });
            await prisma.productImage.createMany({
                data: images.map((img: any, index: number) => ({
                    productId: id,
                    url: typeof img === 'string' ? img : img.url,
                    alt: typeof img === 'string' ? null : img.alt,
                    isPrimary: index === 0,
                    displayOrder: index,
                })),
            });
        }

        // Update specifications if provided
        if (specifications && Array.isArray(specifications)) {
            await prisma.productSpecification.deleteMany({ where: { productId: id } });
            await prisma.productSpecification.createMany({
                data: specifications.map((spec: any, index: number) => ({
                    productId: id,
                    key: spec.key,
                    value: spec.value,
                    displayOrder: index,
                })),
            });
        }

        // Update attributes if provided
        if (attributes && Array.isArray(attributes)) {
            await prisma.productAttribute.deleteMany({ where: { productId: id } });
            await prisma.productAttribute.createMany({
                data: attributes.map((attr: any) => ({
                    productId: id,
                    attributeType: attr.type,
                    attributeValue: attr.value,
                })),
            });
        }

        // Update tags if provided
        if (tags && Array.isArray(tags)) {
            await prisma.productTag.deleteMany({ where: { productId: id } });
            await prisma.productTag.createMany({
                data: tags.map((tag: string) => ({
                    productId: id,
                    tag,
                })),
            });
        }

        // Fetch updated product with all relations
        const finalProduct = await prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
                variants: true,
                images: true,
                specifications: true,
                attributes: true,
                tags: true,
            },
        });

        return sendSuccess(res, finalProduct, "Product updated successfully");
    } catch (error) {
        next(error);
    }
};

// Admin: Delete product (soft delete)
export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const product = await prisma.product.findUnique({
            where: { id },
            include: { images: true },
        });

        if (!product) {
            throw new NotFoundError("Product not found");
        }

        // Delete product images from S3 before soft deleting
        if (product.images && product.images.length > 0) {
            const { deleteFromS3, extractKeyFromUrl } = await import("../services/s3.js");
            await Promise.allSettled(
                product.images.map(async (image) => {
                    const key = extractKeyFromUrl(image.url);
                    if (key) {
                        try {
                            await deleteFromS3(key);
                        } catch (error) {
                            console.error(`Failed to delete S3 file for product image ${image.id}:`, error);
                        }
                    }
                })
            );
        }

        await prisma.product.update({
            where: { id },
            data: { isActive: false },
        });

        return sendSuccess(res, null, "Product deleted successfully");
    } catch (error) {
        next(error);
    }
};

// Admin: Add variant to product
export const addVariant = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, priceModifier, available } = req.body;

        if (!id) {
            throw new ValidationError("There is not id passed in the params")
        }

        if (!name) {
            throw new ValidationError("Variant name is required");
        }

        const product = await prisma.product.findUnique({
            where: { id },
        });

        if (!product) {
            throw new NotFoundError("Product not found");
        }

        const variant = await prisma.productVariant.create({
            data: {
                productId: id,
                name,
                priceModifier: priceModifier ? parseFloat(priceModifier) : 0,
                available: available !== undefined ? available : true,
            },
        });

        return sendSuccess(res, variant, "Variant added successfully", 201);
    } catch (error) {
        next(error);
    }
};


export const searchProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            name = "",
            page = "1",
            limit = "10"
        } = req.query as {
            name?: string;
            page?: string;
            limit?: string;
        }

        if (name.trim().length < 3) {
            throw new ValidationError("please name with atleast 3 characters")
        }

        const pageNumber = Number(page)
        const limitNumber = Number(limit)

        if (isNaN(pageNumber) || isNaN(limitNumber)) {
            throw new ValidationError("Page and limit must be number")
        }

        const skip = (pageNumber - 1) * limitNumber

        const where: Prisma.ProductWhereInput = {
            OR: [
                { id: { contains: name } },
                { name: { contains: name } },
                { description: { contains: name } },
                { categoryId: { contains: name } }
            ]
        }

        const [products, totalProducts] = await Promise.all([
            prisma.product.findMany({
                where: where,
                skip,
                take: limitNumber,
                orderBy: { name: "asc" }
            }),
            prisma.product.count({ where })
        ])

        const data = {
            products,
            pagination: {
                page: pageNumber,
                limit: limitNumber,
                totalProducts,
                totalPages: Math.ceil(totalProducts / limitNumber),
            },
        }

        return sendSuccess(
            res,
            data,
            "Data fetched successfully",
            200
        )
    } catch (error) {
        next(error)
    }
}
