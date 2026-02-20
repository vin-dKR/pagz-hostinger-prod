'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ProductPageTemplate } from '@/app/components/services/ProductPageTemplate';
import { ChevronDown } from 'lucide-react';
import { QuantitySelector } from '@/app/components/services/QuantitySelector';
import { PageCountDisplay } from '@/app/components/services/PageCountDisplay';
import { CopiesSelector } from '@/app/components/services/CopiesSelector';
import { QuantityWithCopiesSelector } from '@/app/components/services/QuantityWithCopiesSelector';
import { FileDetail } from '@/app/components/products/ProductDocumentUpload';
import {
    getCategoryBySlug,
    calculateCategoryPrice,
    getProductsBySpecifications,
    getCategoryAddons,
    type Category,
    type CategorySpecification,
    type CategoryAddon,
} from '@/lib/api/categories';
import { addToCart } from '@/lib/api/cart';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { ProductData, BreadcrumbItem } from '@/types';
import { Option } from '@/types';
// Files are uploaded immediately in ProductDocumentUpload component, no need to import uploadOrderFilesToS3 here
import { toastWarning, toastError, toastSuccess, toastPromise } from '@/lib/utils/toast';
import { redirectToLoginWithReturn } from '@/lib/utils/auth-redirect';

interface DynamicServicePageProps {
    params: Promise<{ categorySlug: string }>;
}

export default function DynamicServicePage({ params }: DynamicServicePageProps) {
    const { categorySlug } = use(params);
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const { refetch: refetchCart, isProductInCart } = useCart();
    const [category, setCategory] = useState<Category | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
    const [uploadedFileDetails, setUploadedFileDetails] = useState<FileDetail[]>([]);
    const [minQuantityFromFiles, setMinQuantityFromFiles] = useState<number>(1);

    const [selectedSpecifications, setSelectedSpecifications] = useState<Record<string, any>>({});
    const [pageCount, setPageCount] = useState(0); // Fixed, calculated from files
    const [copies, setCopies] = useState(1); // Editable, default 1
    const [quantity, setQuantity] = useState<number>(1); // Keep for backward compatibility with NUMBER spec type
    const [isCopiesMode, setIsCopiesMode] = useState(false); // Track if user is in copies mode

    const [priceBreakdown, setPriceBreakdown] = useState<Array<{ label: string; value: number }>>([]);
    const [totalPrice, setTotalPrice] = useState<number>(0);
    const [basePricePerUnit, setBasePricePerUnit] = useState<number>(0);
    const [calculatingPrice, setCalculatingPrice] = useState(false);
    const [matchingProduct, setMatchingProduct] = useState<any | null>(null);
    const [addingToCart, setAddingToCart] = useState(false);
    const [buyNowLoading, setBuyNowLoading] = useState(false);
    const [availableAddons, setAvailableAddons] = useState<CategoryAddon[]>([]);
    const [uploadedFilesS3, setUploadedFilesS3] = useState<FileDetail[]>([]);

    // Check if files are currently uploading
    const isUploadingFiles = useMemo(() => {
        return uploadedFileDetails.some(fd => fd.uploadStatus === 'uploading');
    }, [uploadedFileDetails]);

    // Calculate total quantity
    const totalQuantity = useMemo(() => {
        if (pageCount > 0) {
            // When files are uploaded, use pageCount × copies
            return pageCount * copies;
        } else {
            // When no files, use quantity × copies if in copies mode, otherwise use quantity
            return isCopiesMode ? quantity * copies : quantity;
        }
    }, [pageCount, copies, quantity, isCopiesMode]);

    // Calculate PDF and image counts for breakdown
    const { pdfPageCount, imageCount } = useMemo(() => {
        let pdfPages = 0;
        let images = 0;

        uploadedFileDetails.forEach(detail => {
            if (detail.type === 'pdf') {
                pdfPages += detail.pageCount;
            } else if (detail.type === 'image') {
                images += 1; // Each image = 1 page
            }
        });

        return { pdfPageCount: pdfPages, imageCount: images };
    }, [uploadedFileDetails]);

    // Fetch category data on mount
    useEffect(() => {
        async function fetchCategory() {
            try {
                setLoading(true);
                setError(null);
                const data = await getCategoryBySlug(categorySlug);
                setCategory(data);

                // Initialize default selections for required specifications
                const defaults: Record<string, any> = {};
                data.specifications
                    .filter(spec => spec.isRequired && spec.type === 'SELECT' && spec.options.length > 0)
                    .forEach(spec => {
                        defaults[spec.slug] = spec.options[0]?.value || '';
                    });
                setSelectedSpecifications(defaults);

                // Fetch ADDON rules for this category (used to display page range variations)
                try {
                    const addons = await getCategoryAddons(categorySlug);
                    setAvailableAddons(addons || []);
                } catch (addonsError) {
                    console.warn('Failed to load category addons', addonsError);
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load category');
            } finally {
                setLoading(false);
            }
        }

        fetchCategory();
    }, [categorySlug]);

    const calculatePrice = useCallback(async () => {
        if (!category) return;

        try {
            setCalculatingPrice(true);

            // Log the combination being used for price calculation
            const combinationLog: Record<string, string> = {};
            Object.entries(selectedSpecifications).forEach(([slug, value]) => {
                const spec = category.specifications.find(s => s.slug === slug);
                if (spec) {
                    const option = spec.options.find(o => o.value === value);
                    combinationLog[spec.name] = option?.label || value || 'Not selected';
                } else {
                    combinationLog[slug] = String(value);
                }
            });

            console.log('🔍 Price Calculation - Using combination:', {
                specifications: combinationLog,
                quantity: totalQuantity,
                selectedSpecifications: selectedSpecifications,
            });

            // Always use totalQuantity which already includes copies multiplication
            const result = await calculateCategoryPrice(categorySlug, {
                specifications: selectedSpecifications,
                quantity: totalQuantity,
                pageCount: pageCount > 0 ? pageCount : undefined,
                copies: pageCount > 0 ? copies : undefined,
            });

            console.log('💰 Price Calculation Result:', {
                totalPrice: result.totalPrice,
                breakdown: result.breakdown,
            });

            setPriceBreakdown(result.breakdown);
            setTotalPrice(result.totalPrice);

            // Derive base price per unit only from the base price line, not including addons
            const baseLine = result.breakdown.find((item) =>
                item.label.toLowerCase().startsWith('base')
            );
            if (baseLine && totalQuantity > 0) {
                setBasePricePerUnit(baseLine.value / totalQuantity);
            } else {
                setBasePricePerUnit(0);
            }
        } catch (err: any) {
            // Only log network errors, don't show toasts or redirect
            if (err?.message?.includes('NetworkError') || err?.name === 'TypeError') {
                console.warn('Price calculation network error (will retry):', err);
            } else {
                console.error('Price calculation error:', err);
            }
            // Don't clear price on network errors - keep previous values
            if (!err?.message?.includes('NetworkError') && err?.name !== 'TypeError') {
                setPriceBreakdown([]);
                setTotalPrice(0);
            }
        } finally {
            setCalculatingPrice(false);
        }
    }, [category, categorySlug, selectedSpecifications, totalQuantity, pageCount, copies]);

    const checkForProduct = useCallback(async () => {
        if (!category) return;

        try {
            // When matching a published product, ignore addon-only specification keys
            const addonSpecSlugs = new Set<string>();
            availableAddons.forEach((addon) => {
                const specValues = (addon.specificationValues || {}) as Record<string, any>;
                Object.keys(specValues).forEach((slug) => addonSpecSlugs.add(slug));
            });

            const specsForProduct: Record<string, any> = {};
            Object.entries(selectedSpecifications).forEach(([slug, value]) => {
                if (!addonSpecSlugs.has(slug)) {
                    specsForProduct[slug] = value;
                }
            });

            console.log('🔍 Product match - using specifications:', specsForProduct);

            const products = await getProductsBySpecifications(categorySlug, specsForProduct);
            // Find the first matching product (should be only one if published correctly)
            setMatchingProduct(products.length > 0 ? products[0] : null);
        } catch (err: any) {
            // Only log network errors, don't show toasts or redirect
            if (err?.message?.includes('NetworkError') || err?.name === 'TypeError') {
                console.warn('Product check network error (will retry):', err);
            } else {
                console.error('Product check error:', err);
            }
            // Don't clear product on network errors - keep previous value
            if (!err?.message?.includes('NetworkError') && err?.name !== 'TypeError') {
                setMatchingProduct(null);
            }
        }
    }, [category, categorySlug, selectedSpecifications, availableAddons]);


    // Calculate price and check for products whenever selections or quantity change
    useEffect(() => {
        if (category && Object.keys(selectedSpecifications).length > 0) {
            calculatePrice();
            checkForProduct();
        } else {
            setMatchingProduct(null);
        }
    }, [selectedSpecifications, totalQuantity, category, categorySlug, calculatePrice, checkForProduct]);

    // Get available options for a specification based on dependencies
    const getAvailableOptions = (spec: CategorySpecification): Option[] => {
        // Check if this specification has dependencies
        if (spec.dependsOn) {
            const dependsOn = spec.dependsOn as Record<string, any>;
            // Check if all dependency conditions are met
            for (const [key, value] of Object.entries(dependsOn)) {
                if (selectedSpecifications[key] !== value) {
                    return []; // Hide this specification if dependencies not met
                }
            }
        }

        // Filter options based on metadata dependencies (e.g., paper type depends on selected size)
        return spec.options
            .filter((option) => {
                const metadata = option.metadata as { allowedParentValues?: string[] } | null;
                if (!metadata?.allowedParentValues || metadata.allowedParentValues.length === 0) {
                    return true; // No restriction, applies to all
                }

                // Check if any parent value matches current selections
                // For now, check against 'size' or 'paper-size' spec
                const sizeValue = selectedSpecifications['size'] || selectedSpecifications['paper-size'];
                if (!sizeValue) return true; // If no size selected yet, show all

                return metadata.allowedParentValues.includes(sizeValue);
            })
            .map((option) => ({
                id: option.id,
                label: option.label,
                value: option.value,
                description: option.metadata?.description,
                disabled: !option.isActive,
            }));
    };

    // Compute which addon pricing rules are active for current selection and total pages
    const selectedAddonIds = useMemo(() => {
        if (!availableAddons || availableAddons.length === 0) return [];

        // Effective pages = pages × copies when files uploaded
        const effectivePages =
            pageCount > 0 ? pageCount * (copies > 0 ? copies : 1) : null;

        return availableAddons
            .filter((rule) => {
                const ruleSpecs = (rule.specificationValues || {}) as Record<string, any>;

                // All rule spec values must match the current selections
                for (const [slug, val] of Object.entries(ruleSpecs)) {
                    if (selectedSpecifications[slug] !== val) {
                        return false;
                    }
                }

                // Page range check (if configured on the rule)
                const hasPageRange = rule.minQuantity != null || rule.maxQuantity != null;
                if (hasPageRange) {
                    if (effectivePages == null) return false;
                    if (rule.minQuantity != null && effectivePages < rule.minQuantity) return false;
                    if (rule.maxQuantity != null && effectivePages > rule.maxQuantity) return false;
                }

                return true;
            })
            .map((rule) => rule.id);
    }, [availableAddons, selectedSpecifications, pageCount, copies]);

    // Check if a specification should be visible based on dependencies
    const isSpecificationVisible = (spec: CategorySpecification): boolean => {
        if (!spec.dependsOn) return true;

        const dependsOn = spec.dependsOn as Record<string, any>;
        for (const [key, value] of Object.entries(dependsOn)) {
            if (selectedSpecifications[key] !== value) {
                return false;
            }
        }
        return true;
    };

    // Handle specification selection change
    const handleSpecificationChange = (specSlug: string, value: string) => {
        console.log('🔧 Spec change', { specSlug, value });
        setSelectedSpecifications(prev => {
            const updated = { ...prev };

            // If value is empty string, remove the specification (for "None" option)
            if (value === '' || value === 'none') {
                delete updated[specSlug];
            } else {
                updated[specSlug] = value;
            }

            // Clear dependent specifications when parent changes
            if (category) {
                category.specifications.forEach(spec => {
                    if (spec.dependsOn) {
                        const dependsOn = spec.dependsOn as Record<string, any>;
                        if (dependsOn[specSlug] && dependsOn[specSlug] !== value) {
                            delete updated[spec.slug];
                        }
                    }
                });
            }

            return updated;
        });
    };


    // Prepare product data for ProductPageTemplate
    const productData: Partial<ProductData> = useMemo(() => {
        if (!category) return {};

        const config = category.configuration;
        return {
            category: categorySlug as any,
            title: config?.pageTitle || category.name,
            description: config?.pageDescription || category.description || '',
            basePrice: totalPrice || 0,
            features: config?.features || [],
        };
    }, [category, categorySlug, totalPrice]);

    // Prepare category images for ProductGallery
    const categoryImages = useMemo(() => {
        if (!category?.images || category.images.length === 0) {
            // Fallback to legacy image field if no images array
            if (category?.image) {
                return [{
                    id: 'legacy-image',
                    src: category.image,
                    alt: category.name || 'Category image',
                }];
            }
            return [];
        }

        return category.images.map((img) => ({
            id: img.id,
            src: img.url,
            alt: img.alt || category.name || 'Category image',
            thumbnailSrc: img.url, // Use same URL for thumbnail
        }));
    }, [category]);

    // Prepare breadcrumb items
    const breadcrumbItems: BreadcrumbItem[] = useMemo(() => {
        if (!category?.configuration?.breadcrumbConfig) {
            return [
                { label: 'Home', href: '/' },
                { label: 'Services', href: '/services' },
                { label: category?.name || 'Service', href: `/services/${categorySlug}`, isActive: true },
            ];
        }

        const config = category.configuration.breadcrumbConfig as any;
        if (Array.isArray(config)) {
            return config.map((item: any, index: number) => ({
                label: item.label,
                href: item.href,
                isActive: index === config.length - 1,
            }));
        }

        return [
            { label: 'Home', href: '/' },
            { label: category.name, href: `/services/${categorySlug}`, isActive: true },
        ];
    }, [category, categorySlug]);

    // Handle file upload with page count calculation
    // Files are uploaded to S3 immediately when selected via ProductDocumentUpload component
    const handleFileSelect = async (files: File[], calculatedPageCount: number, fileDetails?: FileDetail[]) => {
        setUploadedFiles(files);
        if (fileDetails) {
            setUploadedFileDetails(fileDetails);
            // Update uploadedFilesS3 state to match fileDetails (which includes S3 keys after upload)
            setUploadedFilesS3(fileDetails);
        }

        // Set page count (fixed, based on files)
        if (calculatedPageCount > 0) {
            setPageCount(calculatedPageCount);
            setMinQuantityFromFiles(calculatedPageCount);
        } else {
            setPageCount(0);
            setMinQuantityFromFiles(1);
        }

        // Reset copies to 1 when files change
        setCopies(1);
    };

    // Helper function to get file type for display
    const getFileType = (fileDetails: FileDetail[]): 'pdf' | 'image' | 'mixed' => {
        if (fileDetails.length === 0) return 'pdf';
        const hasPDF = fileDetails.some(fd => fd.type === 'pdf');
        const hasImage = fileDetails.some(fd => fd.type === 'image');

        if (hasPDF && hasImage) return 'mixed';
        if (hasPDF) return 'pdf';
        if (hasImage) return 'image';
        return 'pdf'; // default
    };

    // Note: uploadFile function removed - files are now stored in memory only
    // and uploaded after order confirmation via fileStorage utility

    // Check which required specifications are missing
    const getMissingRequiredSpecs = (): CategorySpecification[] => {
        if (!category) return [];

        return category.specifications.filter(spec => {
            // Only check visible and required specifications
            if (!spec.isRequired || !isSpecificationVisible(spec)) {
                return false;
            }

            // Check if specification has a value
            const value = selectedSpecifications[spec.slug];

            // For different types, check differently
            if (spec.type === 'SELECT' || spec.type === 'MULTI_SELECT' || spec.type === 'BOOLEAN') {
                return !value || value === '';
            } else if (spec.type === 'NUMBER') {
                return value === undefined || value === null || value === '';
            } else if (spec.type === 'TEXT') {
                return !value || value.trim() === '';
            }

            return !value;
        });
    };

    // Check if all required fields are filled (for button disabling)
    const areAllRequiredFieldsFilled = useMemo(() => {
        if (!category) return false;

        // Check required specifications
        const requiredSpecs = category.specifications.filter(spec => {
            if (!spec.isRequired || !isSpecificationVisible(spec)) {
                return false;
            }
            const value = selectedSpecifications[spec.slug];
            if (spec.type === 'SELECT' || spec.type === 'MULTI_SELECT' || spec.type === 'BOOLEAN') {
                return !value || value === '';
            } else if (spec.type === 'NUMBER') {
                return value === undefined || value === null || value === '';
            } else if (spec.type === 'TEXT') {
                return !value || value.trim() === '';
            }
            return !value;
        });

        if (requiredSpecs.length > 0) return false;

        // Check if file upload is required
        if (category.configuration?.fileUploadRequired && uploadedFiles.length === 0) {
            return false;
        }

        // At this point, all mandatory fields are filled
        return true;
    }, [category, selectedSpecifications, uploadedFiles, isSpecificationVisible]);


    const handleAddToCart = async () => {
        // Check authentication
        if (!isAuthenticated) {
            redirectToLoginWithReturn();
            return;
        }

        // Check if file is required and uploaded
        if (category?.configuration?.fileUploadRequired && uploadedFiles.length === 0) {
            toastWarning('Please upload a file to continue.');
            return;
        }

        // Check if files are still uploading
        const filesStillUploading = uploadedFilesS3.some(f => f.uploadStatus === 'uploading');
        if (filesStillUploading) {
            toastWarning('Please wait for all files to finish uploading before adding to cart.');
            return;
        }

        // Check if any files failed to upload
        const filesWithErrors = uploadedFilesS3.filter(f => f.uploadStatus === 'error');
        if (filesWithErrors.length > 0) {
            toastError(`Some files failed to upload. Please remove them and try again.`);
            return;
        }

        // Check if product is out of stock
        if (matchingProduct && matchingProduct.stock <= 0) {
            toastWarning('This product is out of stock. Please select a different combination or contact us.');
            return;
        }

        // Check if product exists
        if (!matchingProduct?.id) {
            console.log(matchingProduct)
            toastWarning('Product does not exist. Please contact us');
            return;
        }

        setAddingToCart(true);
        try {
            // Extract S3 keys from already uploaded files (files are uploaded immediately when selected)
            const s3Keys: string[] = uploadedFilesS3
                .filter(f => f.uploadStatus === 'uploaded' && f.s3Key)
                .map(f => f.s3Key!)
                .filter(Boolean);

            // If we have files but no S3 keys, something went wrong
            if (uploadedFiles.length > 0 && s3Keys.length === 0) {
                toastError('Files are not ready yet. Please wait for uploads to complete.');
                setAddingToCart(false);
                return;
            }

            // Add to cart with S3 URLs
            // Always use totalQuantity which already includes copies multiplication
            const response = await toastPromise(
                addToCart({
                    productId: matchingProduct.id,
                    quantity: totalQuantity,
                    customDesignUrl: s3Keys.length > 0 ? s3Keys : undefined,
                    metadata: {
                        pageCount: pageCount > 0 ? pageCount : undefined,
                        copies: pageCount > 0 ? copies : undefined,
                        priceBreakdown,
                        selectedAddons: selectedAddonIds,
                    },
                    hasAddon: selectedAddonIds.length > 0,
                    addons: selectedAddonIds,
                }),
                {
                    loading: 'Adding to cart...',
                    success: 'Product added to cart successfully!',
                    error: 'Failed to add product to cart. Please try again.',
                }
            );

            if (response.success) {
                // Reset uploaded files after adding to cart
                setUploadedFiles([]);
                setUploadedFileDetails([]);
                setUploadedFilesS3([]);
                setPageCount(0);
                setMinQuantityFromFiles(1);
                setCopies(1);
                // Refresh cart to update count
                await refetchCart();
                // Optionally reload to update UI
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                toastError(response.error || 'Failed to add product to cart. Please try again.');
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            toastError('Failed to add product to cart. Please try again.');
        } finally {
            setAddingToCart(false);
        }
    };

    const handleBuyNow = async () => {
        // Check authentication
        if (!isAuthenticated) {
            redirectToLoginWithReturn();
            return;
        }

        // Check for missing required specifications
        const missingSpecs = getMissingRequiredSpecs();
        if (missingSpecs.length > 0) {
            const missingNames = missingSpecs.map(spec => spec.name).join(', ');
            toastWarning(`Please select the following required specifications: ${missingNames}`);
            return;
        }

        // Check if file is required and uploaded
        if (category?.configuration?.fileUploadRequired && uploadedFiles.length === 0) {
            toastWarning('Please upload a file to continue.');
            return;
        }

        // Check if product is out of stock
        if (matchingProduct && matchingProduct.stock <= 0) {
            toastWarning('This product is out of stock. Please select a different combination or contact us.');
            return;
        }

        // Check if product exists
        if (!matchingProduct?.id) {
            const missingSpecs = getMissingRequiredSpecs();
            if (missingSpecs.length > 0) {
                const missingNames = missingSpecs.map(spec => spec.name).join(', ');
                toastWarning(`Please select the following required specifications: ${missingNames}`);
            } else {
                toastWarning('Please select all required specifications to proceed.');
            }
            return;
        }

        setBuyNowLoading(true);
        try {
            // Check if files are still uploading
            const filesStillUploading = uploadedFilesS3.some(f => f.uploadStatus === 'uploading');
            if (filesStillUploading) {
                toastWarning('Please wait for all files to finish uploading before proceeding.');
                setBuyNowLoading(false);
                return;
            }

            // Check if any files failed to upload
            const filesWithErrors = uploadedFilesS3.filter(f => f.uploadStatus === 'error');
            if (filesWithErrors.length > 0) {
                toastError(`Some files failed to upload. Please remove them and try again.`);
                setBuyNowLoading(false);
                return;
            }

            // Extract S3 keys from already uploaded files (files are uploaded immediately when selected)
            const s3Keys: string[] = uploadedFilesS3
                .filter(f => f.uploadStatus === 'uploaded' && f.s3Key)
                .map(f => f.s3Key!)
                .filter(Boolean);

            // If we have files but no S3 keys, something went wrong
            if (uploadedFiles.length > 0 && s3Keys.length === 0) {
                toastError('Files are not ready yet. Please wait for uploads to complete.');
                setBuyNowLoading(false);
                return;
            }
            // Store product data in sessionStorage for direct checkout (bypass cart)
            const buyNowData = {
                productId: matchingProduct.id,
                quantity: totalQuantity,
                customDesignUrl: s3Keys.length > 0 ? s3Keys : undefined,
                product: matchingProduct,
                price: totalPrice,
                priceBreakdown,
                pageCount: pageCount > 0 ? pageCount : undefined,
                copies: pageCount > 0 ? copies : undefined,
                metadata: {
                    pageCount: pageCount > 0 ? pageCount : undefined,
                    copies: pageCount > 0 ? copies : undefined,
                    priceBreakdown,
                    selectedAddons: selectedAddonIds,
                },
                hasAddon: selectedAddonIds.length > 0,
                addons: selectedAddonIds,
            };

            sessionStorage.setItem('buyNow', JSON.stringify(buyNowData));

            // Reset uploaded files
            setUploadedFiles([]);
            setUploadedFileDetails([]);
            setUploadedFilesS3([]);
            setPageCount(0);
            setMinQuantityFromFiles(1);
            setCopies(1);

            // Redirect to checkout immediately
            toastSuccess('Redirecting to checkout...');
            router.push('/checkout');
        } catch (error) {
            console.error('Error in buy now:', error);
            toastError('Failed to proceed. Please try again.');
        } finally {
            setBuyNowLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#008ECC] mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading service...</p>
                </div>
            </div>
        );
    }

    if (error || !category) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Service Not Found</h1>
                    <p className="text-gray-600">{error || 'The requested service could not be found.'}</p>
                </div>
            </div>
        );
    }

    // Filter specifications by display order and visibility
    const visibleSpecifications = category.specifications
        .filter(isSpecificationVisible)
        .sort((a, b) => a.displayOrder - b.displayOrder);
    return (
        <div className="min-h-screen bg-white">
            <ProductPageTemplate
                productData={productData}
                breadcrumbItems={breadcrumbItems}
                uploadedFile={uploadedFiles[0] || null}
                onFileSelect={(file) => {
                    // Legacy callback for single file - convert to new format
                    if (file) {
                        handleFileSelect([file], 1, undefined);
                    } else {
                        handleFileSelect([], 0, undefined);
                    }
                }}
                onFileSelectWithQuantity={handleFileSelect}
                onFileRemove={() => {
                    setUploadedFiles([]);
                    setUploadedFileDetails([]);
                    setUploadedFilesS3([]);
                    setPageCount(0);
                    setMinQuantityFromFiles(1);
                    setCopies(1);
                }}
                priceItems={priceBreakdown}
                totalPrice={totalPrice}
                basePricePerUnit={basePricePerUnit}
                pageCount={pageCount > 0 ? pageCount : undefined}
                copies={pageCount > 0 ? copies : (isCopiesMode ? copies : undefined)}
                quantity={pageCount > 0 ? totalQuantity : quantity}
                onAddToCart={handleAddToCart}
                onBuyNow={handleBuyNow}
                addToCartLoading={addingToCart}
                buyNowLoading={buyNowLoading}
                isInCart={matchingProduct ? isProductInCart(matchingProduct.name) : false}
                stock={matchingProduct?.stock ?? null}
                isOutOfStock={matchingProduct ? matchingProduct.stock <= 0 : false}
                productId={matchingProduct?.id ?? null}
                images={categoryImages}
                minQuantity={minQuantityFromFiles}
                areRequiredFieldsFilled={areAllRequiredFieldsFilled}
                hasUploadedFiles={uploadedFiles.length > 0}
                calculatingPrice={calculatingPrice}
                isUploadingFiles={isUploadingFiles}
                uploadedFilesS3={uploadedFilesS3}
                setUploadedFilesS3={setUploadedFilesS3}
            >
                {/* Dynamic Configuration Options */}
                <div className="space-y-8">
                    {visibleSpecifications.map((spec) => {
                        const availableOptions = getAvailableOptions(spec);
                        if (availableOptions.length === 0) return null;

                        // Handle different specification types
                        if (spec.type === 'SELECT' || spec.type === 'MULTI_SELECT') {
                            const selectedValue = selectedSpecifications[spec.slug];
                            const matchingAddons =
                                availableAddons.length > 0 && selectedValue
                                    ? availableAddons.filter((addon) => {
                                        const specValues = addon.specificationValues || {};
                                        return specValues[spec.slug] === selectedValue;
                                    })
                                    : [];

                            return (
                                <div key={spec.id} className="space-y-2">
                                    <label htmlFor={`spec-${spec.slug}`} className="block text-sm font-medium text-gray-700 font-hkgb">
                                        {spec.name}
                                        {spec.isRequired && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    <div className="relative">
                                        <select
                                            id={`spec-${spec.slug}`}
                                            value={selectedValue || ''}
                                            onChange={(e) => handleSpecificationChange(spec.slug, e.target.value)}
                                            className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008ECC] focus:border-transparent bg-white text-gray-900 text-sm sm:text-base appearance-none cursor-pointer"
                                            required={spec.isRequired}
                                        >
                                            <option value="" disabled={spec.isRequired}>
                                                {spec.isRequired ? `Select ${spec.name}` : `Select ${spec.name} (Optional)`}
                                            </option>
                                            {!spec.isRequired && (
                                                <option value="">
                                                    None (Clear selection)
                                                </option>
                                            )}
                                            {availableOptions.map((option) => (
                                                <option
                                                    key={option.id}
                                                    value={option.value}
                                                    disabled={option.disabled}
                                                >
                                                    {option.label}
                                                    {option.description && ` - ${option.description}`}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                                    </div>

                                    {matchingAddons.length > 0 && (
                                        <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                            <p className="text-xs font-semibold text-blue-900 mb-2">Page Range Pricing:</p>
                                            {matchingAddons.map((addon) => {
                                                const min = addon.minQuantity ?? 0;
                                                const max = addon.maxQuantity ?? '∞';
                                                const price = addon.priceModifier != null ? Number(addon.priceModifier) : 0;
                                                return (
                                                    <p key={addon.id} className="text-xs text-blue-700">
                                                        {min}-{max} pages → ₹{price}
                                                    </p>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        } else if (spec.type === 'NUMBER') {
                            // For NUMBER type, we can use QuantitySelector or a custom input
                            if (spec.slug === 'quantity') {
                                return (
                                    <QuantitySelector
                                        key={spec.id}
                                        value={quantity}
                                        onChange={(value) => {
                                            setQuantity(value);
                                            handleSpecificationChange(spec.slug, value.toString());
                                        }}
                                        label={spec.name}
                                        unit=""
                                        min={1}
                                        max={1000}
                                    />
                                );
                            }
                        } else if (spec.type === 'BOOLEAN') {
                            const isMissing = spec.isRequired && (!selectedSpecifications[spec.slug] || selectedSpecifications[spec.slug] === '');
                            return (
                                <div key={spec.id} className="space-y-2">
                                    <label htmlFor={`spec-${spec.slug}`} className={`block text-sm font-medium font-hkgb ${isMissing ? 'text-red-600' : 'text-gray-700'}`}>
                                        {spec.name}
                                        {spec.isRequired && <span className="text-red-500 ml-1">*</span>}
                                        {isMissing && <span className="text-red-500 text-xs ml-2 font-normal">(Required - Please select)</span>}
                                    </label>
                                    <div className="relative">
                                        <select
                                            id={`spec-${spec.slug}`}
                                            value={selectedSpecifications[spec.slug] || ''}
                                            onChange={(e) => handleSpecificationChange(spec.slug, e.target.value)}
                                            className={`w-full px-4 py-2.5 pr-10 border rounded-lg focus:ring-2 focus:ring-[#008ECC] focus:border-transparent bg-white text-gray-900 text-sm sm:text-base appearance-none cursor-pointer ${isMissing ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                                }`}
                                            required={spec.isRequired}
                                        >
                                            <option value="">Select {spec.name}</option>
                                            <option value="true">Yes</option>
                                            <option value="false">No</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                                    </div>
                                </div>
                            );
                        } else if (spec.type === 'TEXT') {
                            const isMissing = spec.isRequired && (!selectedSpecifications[spec.slug] || selectedSpecifications[spec.slug].trim() === '');
                            return (
                                <div key={spec.id} className="space-y-4">
                                    <label className={`block text-sm font-medium mb-3 font-hkgb ${isMissing ? 'text-red-600' : 'text-gray-700'}`}>
                                        {spec.name}
                                        {spec.isRequired && <span className="text-red-500 ml-1">*</span>}
                                        {isMissing && <span className="text-red-500 text-xs ml-2 font-normal">(Required - Please enter)</span>}
                                    </label>
                                    <input
                                        type="text"
                                        value={selectedSpecifications[spec.slug] || ''}
                                        onChange={(e) => handleSpecificationChange(spec.slug, e.target.value)}
                                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#008ECC] focus:border-transparent ${isMissing ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                            }`}
                                        placeholder={`Enter ${spec.name.toLowerCase()}`}
                                        required={spec.isRequired}
                                    />
                                </div>
                            );
                        }

                        return null;
                    })}

                    {/* Page Count & Copies (if files are uploaded) */}
                    {pageCount > 0 && (
                        <>
                            <PageCountDisplay
                                pageCount={pageCount}
                                fileType={getFileType(uploadedFileDetails)}
                                pdfPageCount={pdfPageCount}
                                imageCount={imageCount}
                            />

                            <CopiesSelector
                                value={copies}
                                onChange={setCopies}
                                min={1}
                                max={999}
                            />

                            {/* Total Quantity Display */}
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-900">
                                    <span className="font-semibold">Total Quantity:</span> {totalQuantity} pages
                                    <br />
                                    <span className="text-xs text-blue-700">
                                        ({pageCount} pages × {copies} {copies === 1 ? 'copy' : 'copies'})
                                    </span>
                                </p>
                            </div>
                        </>
                    )}

                    {/* Quantity/Copies Selector (if not already included as a specification and no files uploaded) - Only show if files were never uploaded */}
                    {!visibleSpecifications.some(spec => spec.slug === 'quantity' && spec.type === 'NUMBER') && pageCount === 0 && uploadedFiles.length === 0 && (
                        <div className="space-y-2">
                            <QuantityWithCopiesSelector
                                quantity={quantity}
                                copies={copies}
                                onQuantityChange={setQuantity}
                                onCopiesChange={setCopies}
                                onModeChange={setIsCopiesMode}
                                min={1}
                                max={1000}
                                label="Quantity"
                            />
                        </div>
                    )}
                </div>

                {calculatingPrice && (
                    <div className="mt-4 text-sm text-gray-500 text-center">
                        Calculating price...
                    </div>
                )}
            </ProductPageTemplate>
        </div>
    );
}

