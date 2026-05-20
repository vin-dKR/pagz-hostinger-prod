'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { ProductPageTemplate } from '@/app/components/services/ProductPageTemplate';
import { TemplateSelector } from '@/app/components/services/TemplateSelector';
import { Select } from '@/app/components/ui/select';
import { useCategoryTemplates } from '@/lib/hooks/use-category-templates';
import { usePageController } from '@/lib/hooks/use-page-controller';
import { QuantityWithCopiesSelector } from '@/app/components/services/QuantityWithCopiesSelector';
import { FileDetail } from '@/app/components/products/ProductDocumentUpload';
import {
    getCategoryBySlug,
    getProductsBySpecifications,
    getCategoryAddons,
    type Category,
    type CategorySpecification,
    type CategoryAddon,
} from '@/lib/api/categories';
import { useCalculatePricing } from '@/lib/hooks/use-calculate-pricing';
import { SubcategoryGrid } from '@/app/components/services/SubcategoryGrid';
import CategoryReviewsSection from '@/app/components/reviews/CategoryReviewsSection';
import {
    getAvailableOptions as getAvailableOptionsUtil,
    isSpecificationVisible as isSpecificationVisibleUtil,
    clearDependentSpecifications,
} from '@/lib/utils/specification-dependencies';
import { addToCart, type FileMeta } from '@/lib/api/cart';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { ProductData, BreadcrumbItem } from '@/types';
import { Option } from '@/types';
import { uploadOrderFilesToS3 } from '@/lib/api/uploads';
import { toastWarning, toastError, toastSuccess, toastPromise } from '@/lib/utils/toast';
import { redirectToLoginWithReturn } from '@/lib/utils/auth-redirect';
import { redirectGuestToCart } from '@/lib/utils/guest-cart';
import {
    savePendingPurchaseData,
    clearPendingPurchaseData,
    prepareFilesForStorage,
    type PendingPurchaseData
} from "@/lib/utils/pending-purchase";
import { formatInr } from "@/lib/utils/category-min-cart-value";
import {
    saveDraftServiceConfig,
    getDraftServiceConfig,
    clearDraftServiceConfig,
    type ServiceDraftFile,
} from '@/lib/utils/service-draft';
import { extractPathFromUrl } from '@/lib/utils/fileUrl';

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
    const [specWarnings, setSpecWarnings] = useState<Record<string, string>>({});
    const [pageCount, setPageCount] = useState(0); // Fixed, calculated from files
    const [copies, setCopies] = useState(1); // Editable, default 1
    const [quantity, setQuantity] = useState<number>(1); // Keep for backward compatibility with NUMBER spec type
    const [isCopiesMode, setIsCopiesMode] = useState(false); // Track if user is in copies mode

    const [priceBreakdown, setPriceBreakdown] = useState<Array<{ label: string; value: number }>>([]);
    const [totalPrice, setTotalPrice] = useState<number>(0);
    const [basePricePerUnit, setBasePricePerUnit] = useState<number>(0);
    const [effectivePageCount, setEffectivePageCount] = useState<number | undefined>(undefined);
    const [originalPageCount, setOriginalPageCount] = useState<number | undefined>(undefined);
    const [hasHalfPageAdjustment, setHasHalfPageAdjustment] = useState<boolean>(false);
    const [calculatingPrice, setCalculatingPrice] = useState(false);
    const [matchingProduct, setMatchingProduct] = useState<any | null>(null);
    const [addingToCart, setAddingToCart] = useState(false);
    const [buyNowLoading, setBuyNowLoading] = useState(false);
    const [availableAddons, setAvailableAddons] = useState<CategoryAddon[]>([]);
    const [uploadedFilesS3, setUploadedFilesS3] = useState<FileDetail[]>([]);
    const [fileHasPassword, setFileHasPassword] = useState(false);
    const [filePassword, setFilePassword] = useState('');
    const [isPasswordSubmitted, setIsPasswordSubmitted] = useState(false);

    // Check if templates exist for this category
    const { data: categoryTemplates = [] } = useCategoryTemplates(categorySlug, !!category);
    const hasTemplates = categoryTemplates.length > 0;
    const pageController = usePageController({
        categorySlug,
        selectedSpecifications,
        pageCount,
        enabled: !!category,
    });

    // Template selection state
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [selectedTemplateName, setSelectedTemplateName] = useState<string | null>(null);
    const [selectedTemplatePreviewImage, setSelectedTemplatePreviewImage] = useState<string | null>(null);
    const [templateFormData, setTemplateFormData] = useState<Record<string, any>>({});
    const [templateFormImages, setTemplateFormImages] = useState<string[]>([]);

    // Draft persistence flags — used by the sessionStorage hydration / save
    // effects to avoid clobbering an in-flight template-flow restoration
    // and to skip the very first save (which would just echo the initial
    // empty / defaults state).
    const hasHydratedRef = useRef(false);
    const draftRestoredFromTemplateFlowRef = useRef(false);

    // Check for uploaded file data from template page
    useEffect(() => {
        const uploadedFileData = sessionStorage.getItem('uploadedFileData');
        if (uploadedFileData) {
            try {
                const data = JSON.parse(uploadedFileData);
                if (data.uploadedFiles && data.uploadedFiles.length > 0) {
                    // Mark so the service-draft hydration effect below
                    // doesn't clobber the files we're about to restore
                    // from the template flow.
                    draftRestoredFromTemplateFlowRef.current = true;
                    // Convert stored data back to FileDetail format
                    // Note: We need to reconstruct File objects, but since we only have metadata,
                    // we'll create a minimal FileDetail structure that matches what's expected
                    const fileDetails: FileDetail[] = data.uploadedFiles.map((f: any) => {
                        // Create a File object with stored metadata
                        // We can't restore the actual file content, but we can preserve the size
                        // Create a minimal Blob and then create a File with size override
                        const blob = new Blob([], {
                            type: f.type === 'pdf' ? 'application/pdf' : 'image/jpeg'
                        });
                        const file = new File([blob], f.name, {
                            type: f.type === 'pdf' ? 'application/pdf' : 'image/jpeg',
                            lastModified: Date.now()
                        });
                        // Override the size property to show correct file size
                        if (f.size && f.size > 0) {
                            Object.defineProperty(file, 'size', {
                                value: f.size,
                                writable: false,
                                enumerable: true,
                                configurable: true
                            });
                        }
                        return {
                            file,
                            s3Key: f.s3Key || undefined, // Ensure s3Key is set, even if undefined
                            type: f.type,
                            pageCount: f.pageCount,
                            id: f.id || `uploaded-${Date.now()}-${Math.random()}`,
                            uploadStatus: f.s3Key ? ('uploaded' as const) : ('pending' as const), // Set status based on s3Key presence
                        };
                    });
                    setUploadedFileDetails(fileDetails);
                    setUploadedFilesS3(fileDetails);
                    // Also set uploadedFiles array for button logic
                    setUploadedFiles(fileDetails.map(fd => fd.file));
                    if (data.pageCount > 0) {
                        setPageCount(data.pageCount);
                        setMinQuantityFromFiles(data.pageCount);
                    }
                    // Restore password state if present
                    if (data.fileHasPassword !== undefined) {
                        setFileHasPassword(!!data.fileHasPassword);
                    }
                    if (data.filePassword !== undefined && data.filePassword) {
                        setFilePassword(String(data.filePassword));
                        // If password exists from template page, always show it as submitted
                        // (user clicked Continue, which means they're done with password entry)
                        setIsPasswordSubmitted(true);
                    }
                }
                // Clear the stored data after using it
                sessionStorage.removeItem('uploadedFileData');
            } catch (error) {
                console.error('Error parsing uploaded file data:', error);
            }
        }
    }, []);

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

    /**
     * Phase 0 — per-file `{ url, pageCount }` array built from a snapshot
     * of `FileDetail[]` whose `s3Key` is populated (i.e. the file has
     * landed on FTP). Used by add-to-cart and buy-now to populate
     * `metadata.files` on the cart/pending-purchase payload.
     *
     * Caller passes the current snapshot — we don't read closure state
     * directly because the auth path can inline-upload mid-handler and
     * needs to capture the freshly assigned `s3Key`s without waiting
     * for a re-render.
     *
     * Spec reference: `prompts/per-file-addon-pricing-architecture.md` §3.1.
     */
    const buildFilesMeta = useCallback((details: FileDetail[]): FileMeta[] => {
        return details
            .filter((fd) => typeof fd.s3Key === 'string' && fd.s3Key.length > 0)
            .map((fd) => ({
                url: fd.s3Key as string,
                pageCount: fd.type === 'image'
                    ? 1
                    : (typeof fd.pageCount === 'number' && fd.pageCount > 0 ? fd.pageCount : 0),
            }));
    }, []);

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
                if (data.specifications && Array.isArray(data.specifications)) {
                    data.specifications
                        .filter(spec => spec.isRequired && spec.type === 'SELECT' && spec.options.length > 0)
                        .forEach(spec => {
                            defaults[spec.slug] = spec.options[0]?.value || '';
                        });
                }
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

    // ------------------------------------------------------------------
    // Service-draft persistence (sessionStorage)
    // ------------------------------------------------------------------
    // Hydrate from the saved draft AFTER the category is loaded (so the
    // default-spec seeding in `fetchCategory` doesn't overwrite us) and
    // only once. We skip hydration when the template flow already
    // restored uploaded files for this slug — otherwise we'd clobber
    // those files with whatever URLs were in the draft.
    useEffect(() => {
        if (!category) return;
        if (hasHydratedRef.current) return;

        // Defer until next microtask so the `setSelectedSpecifications(defaults)`
        // from fetchCategory has committed first; React batches both, and we
        // want our hydrate to win for any slug present in the draft.
        hasHydratedRef.current = true;

        if (draftRestoredFromTemplateFlowRef.current) {
            // Template flow already set uploadedFiles + pageCount; skip
            // hydration to avoid double-application.
            return;
        }

        const draft = getDraftServiceConfig(categorySlug);
        if (!draft) return;

        if (draft.selectedSpecifications && Object.keys(draft.selectedSpecifications).length > 0) {
            setSelectedSpecifications((prev) => ({ ...prev, ...draft.selectedSpecifications }));
        }
        if (typeof draft.copies === 'number' && draft.copies > 0) {
            setCopies(draft.copies);
        }
        if (typeof draft.pageCount === 'number' && draft.pageCount > 0) {
            setPageCount(draft.pageCount);
            setMinQuantityFromFiles(draft.pageCount);
        }

        // Reconstruct the "already uploaded" file state from durable URLs.
        // File blobs are intentionally NOT restored — the uploaded copy on
        // FTP is the source of truth; the local blob is only used for new
        // uploads. We keep `s3Key` (the relative FTP path) on each entry
        // so the add-to-cart path sees `uploadStatus: 'uploaded'` and skips
        // re-upload.
        if (Array.isArray(draft.uploadedFiles) && draft.uploadedFiles.length > 0) {
            const restoredDetails: FileDetail[] = draft.uploadedFiles.map((f, idx) => {
                const inferredType: 'pdf' | 'image' =
                    /\.pdf(\?|$)/i.test(f.url) || /\.pdf$/i.test(f.name)
                        ? 'pdf'
                        : 'image';
                const blob = new Blob([], {
                    type: inferredType === 'pdf' ? 'application/pdf' : 'image/jpeg',
                });
                const reconstructed = new File([blob], f.name, {
                    type: inferredType === 'pdf' ? 'application/pdf' : 'image/jpeg',
                    lastModified: Date.now(),
                });
                // Preserve the original byte size so the UI shows the right
                // figure even though the blob is empty.
                if (f.size > 0) {
                    Object.defineProperty(reconstructed, 'size', {
                        value: f.size,
                        writable: false,
                        enumerable: true,
                        configurable: true,
                    });
                }
                return {
                    file: reconstructed,
                    type: inferredType,
                    pageCount: f.pageCount ?? (inferredType === 'image' ? 1 : 0),
                    id: `draft-${idx}-${Date.now()}`,
                    s3Key: extractPathFromUrl(f.url),
                    uploadStatus: 'uploaded' as const,
                };
            });
            setUploadedFileDetails(restoredDetails);
            setUploadedFilesS3(restoredDetails);
            setUploadedFiles(restoredDetails.map((fd) => fd.file));
        }

        if (draft.pdfPasswords) {
            const passwords = Object.values(draft.pdfPasswords).filter(Boolean);
            if (passwords.length > 0) {
                setFileHasPassword(true);
                setFilePassword(passwords.join(','));
                setIsPasswordSubmitted(true);
            }
        }
        // `draft.selectedAddons` and `draft.halfPageAdjustments` are
        // intentionally not re-applied here — both flow out of the
        // restored specifications + page count via the `selectedAddonIds`
        // memo defined below.
    }, [category, categorySlug]);

    const checkForProduct = useCallback(async () => {
        if (!category) return;

        try {
            // Identify which specifications are used in published product pricing rules
            // vs addon-only specifications
            const productSpecSlugs = new Set<string>();
            const addonOnlySpecSlugs = new Set<string>();

            // Extract specs from published product rules (SPECIFICATION_COMBINATION with isPublished=true)
            category.pricingRules
                .filter(rule =>
                    rule.ruleType === 'SPECIFICATION_COMBINATION' &&
                    rule.isPublished === true &&
                    rule.isActive === true
                )
                .forEach(rule => {
                    const ruleSpecs = (rule.specificationValues || {}) as Record<string, any>;
                    Object.keys(ruleSpecs).forEach(slug => productSpecSlugs.add(slug));
                });

            // Extract specs from addon rules (ADDON type)
            category.pricingRules
                .filter(rule => rule.ruleType === 'ADDON' && rule.isActive === true)
                .forEach(rule => {
                    const ruleSpecs = (rule.specificationValues || {}) as Record<string, any>;
                    Object.keys(ruleSpecs).forEach(slug => {
                        // Only mark as addon-only if it's NOT in product specs
                        if (!productSpecSlugs.has(slug)) {
                            addonOnlySpecSlugs.add(slug);
                        }
                    });
                });

            // Build specs for product matching: exclude specs that are ONLY in addon rules
            // Include specs that are in product rules (even if they're also in addons)
            const specsForProduct: Record<string, any> = {};
            Object.entries(selectedSpecifications).forEach(([slug, value]) => {
                // Exclude only if it's addon-only (not in product specs at all)
                if (!addonOnlySpecSlugs.has(slug)) {
                    specsForProduct[slug] = value;
                }
            });

            const products = await getProductsBySpecifications(categorySlug, specsForProduct);
            // Find the first matching product (should be only one if published correctly)
            setMatchingProduct(products.length > 0 ? products[0] : null);
        } catch (err: any) {
            // Only log network errors, don't show toasts or redirect
            if (err?.message?.includes('NetworkError') || err?.name === 'TypeError') {
            } else {
                console.error('Product check error:', err);
            }
            // Don't clear product on network errors - keep previous value
            if (!err?.message?.includes('NetworkError') && err?.name !== 'TypeError') {
                setMatchingProduct(null);
            }
        }
    }, [category, categorySlug, selectedSpecifications]);


    // Product-match lookup (separate from pricing — runs when the user has
    // picked enough specs to identify a published product). Pricing is now
    // driven by the `useCalculatePricing` hook below, not this effect.
    useEffect(() => {
        if (category && Object.keys(selectedSpecifications).length > 0) {
            checkForProduct();
        } else {
            setMatchingProduct(null);
        }
    }, [selectedSpecifications, category, categorySlug, checkForProduct]);

    // Get available options for a specification based on dependencies
    const getAvailableOptions = (spec: CategorySpecification): Option[] => {
        // Use the optimized utility function
        const availableOptions = getAvailableOptionsUtil(spec, selectedSpecifications);

        // Map to Option format
        return availableOptions.map((option) => ({
            id: option.id,
            label: option.label,
            value: option.value,
            description: option.metadata?.description,
            disabled: !option.isActive,
        }));
    };

    // Spec-matched addon rule ids for the current selections.
    //
    // Previously this also did range-gating and spec-group dominance to
    // match the server math. Phase 1 moves all that logic into
    // `/cart/calculate-pricing` (engine: `api/src/utils/addon-pricing.ts`),
    // so the client only needs to identify which rules match the current
    // spec map — the server filters out out-of-range and dominated rules.
    // String compare because dropdowns produce strings while admin can
    // persist booleans / numbers in `rule.specificationValues`.
    const selectedAddonIds = useMemo(() => {
        if (!availableAddons || availableAddons.length === 0) return [];
        const normalize = (v: unknown) => (v === null || v === undefined ? "" : String(v));
        return availableAddons
            .filter((rule) => {
                const ruleSpecs = (rule.specificationValues || {}) as Record<string, any>;
                for (const [slug, val] of Object.entries(ruleSpecs)) {
                    if (normalize(selectedSpecifications[slug]) !== normalize(val)) {
                        return false;
                    }
                }
                return true;
            })
            .map((rule) => rule.id);
    }, [availableAddons, selectedSpecifications]);

    // ── Live pricing via the public /cart/calculate-pricing endpoint ────────
    // Phase 1 of the per-file addon pricing rollout
    // (`prompts/per-file-addon-pricing-architecture.md` §2 Phase 1).
    // The api is the single source of truth for the number we display here.
    // 200ms debounce hides the round-trip during spec / copy / addon edits.
    const pricingFiles = useMemo(() => {
        return uploadedFileDetails
            .filter((fd) => typeof fd.s3Key === 'string' && fd.s3Key.length > 0)
            .map((fd) => ({
                url: fd.s3Key as string,
                pageCount: fd.type === 'image'
                    ? 1
                    : (typeof fd.pageCount === 'number' && fd.pageCount > 0 ? fd.pageCount : 1),
            }));
    }, [uploadedFileDetails]);

    const pricingHook = useCalculatePricing(
        {
            categoryId: category?.id ?? '',
            selectedSpecifications: selectedSpecifications as Record<string, string>,
            selectedAddons: selectedAddonIds,
            files: pricingFiles.length > 0 ? pricingFiles : undefined,
            copies: pageCount > 0 ? copies : 1,
        },
        {
            enabled: Boolean(category?.id) && Object.keys(selectedSpecifications).length > 0,
        },
    );

    // Hold the last successful response so a transient network error keeps
    // the visible price stable instead of bouncing back to ₹0.
    const lastPricingRef = useRef<{
        baseSubtotal: number;
        addonsSubtotal: number;
        total: number;
        addons: Array<{ ruleId: string; name: string; total: number }>;
        effectivePageCount?: number;
        hasHalfPageAdjustment: boolean;
        pageCount: number;
    } | null>(null);

    // Sync the hook's response into the page-local state shapes the existing
    // price card + add-to-cart payload consumers already expect. Keeps the
    // refactor surgical — no downstream component contract changes.
    useEffect(() => {
        if (pricingHook.isLoading) {
            setCalculatingPrice(true);
        } else {
            setCalculatingPrice(false);
        }

        const data = pricingHook.data;
        if (!data) {
            if (pricingHook.isError) {
                // Keep the last good response on screen — log only.
                console.warn('[services] pricing request failed; using last known total', pricingHook.error);
            }
            return;
        }

        lastPricingRef.current = data;

        // Build the labeled breakdown the price card consumes. Base row +
        // one row per active addon. Mirrors the legacy `calculateCategoryPrice`
        // shape minus the half-page "informational" line (now surfaced via
        // `hasHalfPageAdjustment` + `effectivePageCount` instead).
        const breakdown: Array<{ label: string; value: number }> = [];
        if (data.baseSubtotal > 0) {
            const baseSuffix = data.pageCount > 0
                ? ` (${data.effectivePageCount ?? data.pageCount} pages × ${pageCount > 0 ? copies : 1} copies)`
                : '';
            breakdown.push({ label: `Base Price${baseSuffix}`, value: data.baseSubtotal });
        }
        for (const addon of data.addons) {
            breakdown.push({ label: `Addon: ${addon.name}`, value: addon.total });
        }
        setPriceBreakdown(breakdown);
        setTotalPrice(data.total);
        setEffectivePageCount(data.effectivePageCount);
        setOriginalPageCount(data.pageCount > 0 ? data.pageCount : undefined);
        setHasHalfPageAdjustment(data.hasHalfPageAdjustment);

        // Derive a per-unit base price for the price card's "₹X × N pages"
        // line. Only meaningful when the base scales with pages (legacy
        // `baseQuantityMultiplierApplied` flag).
        const effPages = (data.effectivePageCount ?? data.pageCount) * (pageCount > 0 ? copies : 1);
        if (effPages > 1 && data.baseSubtotal > 0) {
            setBasePricePerUnit(data.baseSubtotal / effPages);
        } else {
            setBasePricePerUnit(0);
        }
    }, [
        pricingHook.data,
        pricingHook.isLoading,
        pricingHook.isError,
        pricingHook.error,
        copies,
        pageCount,
    ]);

    // Debounced save of the in-progress draft (300ms after last change).
    // We skip until `hasHydratedRef` is true so the restore pass doesn't
    // immediately overwrite the saved draft with a half-applied state.
    useEffect(() => {
        if (!hasHydratedRef.current) return;
        if (!category) return;

        const handle = window.setTimeout(() => {
            const uploadedDraftFiles: ServiceDraftFile[] = uploadedFileDetails
                .filter((fd) => fd.s3Key)
                .map((fd) => ({
                    url: fd.s3Key as string,
                    name: fd.file?.name || 'file',
                    size: fd.file?.size ?? 0,
                    pageCount: fd.pageCount,
                }));

            const pdfPasswords: Record<string, string> = {};
            if (fileHasPassword && filePassword) {
                const passwordList = filePassword
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                uploadedDraftFiles.forEach((file, idx) => {
                    const pw = passwordList[idx] ?? passwordList[0];
                    if (pw) pdfPasswords[file.name] = pw;
                });
            }

            saveDraftServiceConfig(categorySlug, {
                selectedSpecifications: selectedSpecifications as Record<string, string>,
                copies,
                selectedAddons: selectedAddonIds,
                uploadedFiles: uploadedDraftFiles,
                pageCount,
                pdfPasswords: Object.keys(pdfPasswords).length > 0 ? pdfPasswords : undefined,
            });
        }, 300);

        return () => window.clearTimeout(handle);
    }, [
        category,
        categorySlug,
        selectedSpecifications,
        copies,
        selectedAddonIds,
        uploadedFileDetails,
        pageCount,
        fileHasPassword,
        filePassword,
    ]);

    // Check if a specification should be visible based on dependencies
    const isSpecificationVisible = (spec: CategorySpecification): boolean => {
        return isSpecificationVisibleUtil(spec, selectedSpecifications);
    };

    // Handle specification selection change
    const handleSpecificationChange = (specSlug: string, value: string) => {
        setSelectedSpecifications(prev => {
            let updated = { ...prev };

            // If value is empty string, remove the specification (for "None" option)
            if (value === '' || value === 'none') {
                delete updated[specSlug];
            } else {
                updated[specSlug] = value;
            }

            // Clear dependent specifications when parent changes
            if (category && category.specifications) {
                updated = clearDependentSpecifications(
                    category.specifications,
                    updated,
                    specSlug
                );
            }

            return updated;
        });
    };

    const clearSpecWarning = (specSlug: string) => {
        setSpecWarnings((prev) => {
            if (!prev[specSlug]) return prev;
            const next = { ...prev };
            delete next[specSlug];
            return next;
        });
    };

    const setSpecWarning = (specSlug: string, message: string) => {
        setSpecWarnings((prev) => ({ ...prev, [specSlug]: message }));
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

    // Handle file removal
    const handleFileRemove = (fileId: string) => {
        // Find the file detail to get its page count
        const fileDetailToRemove = uploadedFilesS3.find(fd => fd.id === fileId);

        // Remove file from all file state arrays
        setUploadedFilesS3(prev => {
            const updated = prev.filter(fd => fd.id !== fileId);
            // Recalculate page count after removal
            const newPageCount = updated.reduce((total, fd) => {
                return total + (fd.pageCount || (fd.type === 'image' ? 1 : 0));
            }, 0);
            setPageCount(newPageCount);
            setMinQuantityFromFiles(newPageCount > 0 ? newPageCount : 1);
            return updated;
        });

        setUploadedFileDetails(prev => prev.filter(fd => fd.id !== fileId));

        // Remove from uploadedFiles array
        if (fileDetailToRemove) {
            setUploadedFiles(prev => prev.filter(f => f !== fileDetailToRemove.file));
        }
    };

    // Handle edit template form - navigate to template page with current template selected
    const handleEditTemplateForm = () => {
        if (selectedTemplateId) {
            // Store current template data so it can be pre-filled when editing
            const templateData = {
                templateId: selectedTemplateId,
                templateName: selectedTemplateName,
                templatePreviewImage: selectedTemplatePreviewImage,
                formData: templateFormData,
                formImages: templateFormImages,
            };
            sessionStorage.setItem(`templateDraftData:${categorySlug}`, JSON.stringify(templateData));
            sessionStorage.setItem('templateEditAction', 'true'); // Flag to indicate edit action
            router.push(`/services/${categorySlug}/templates`);
        }
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
        if (!category || !category.specifications) return [];

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
        if (!category || !category.specifications) return false;

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

        // Check if file upload is required (or template selected)
        if (category.configuration?.fileUploadRequired && uploadedFiles.length === 0 && !selectedTemplateId) {
            return false;
        }

        // At this point, all mandatory fields are filled
        return true;
    }, [category, selectedSpecifications, uploadedFiles, isSpecificationVisible]);


    const handleAddToCart = async () => {
        if (!pageController.isValid) {
            toastError(pageController.errorMessage || 'Page limit exceeded');
            return;
        }

        // Per-category minimum cart value gate. Server enforces this at
        // addToCart / createOrder, but a guest only hits the server after
        // login — they'd previously discover the rule mid-checkout. Mirror
        // the check client-side so the error surfaces at the moment they
        // click Add to Cart, before any redirect.
        const minCartValue = Number(category?.minCartValue ?? 0);
        if (Number.isFinite(minCartValue) && minCartValue > 0 && totalPrice + 1e-6 < minCartValue) {
            const diff = Math.max(0, minCartValue - totalPrice);
            toastError(
                `Add ${formatInr(diff)} more to "${category?.name ?? 'this category'}" to reach the minimum order of ${formatInr(minCartValue)}.`
            );
            return;
        }

        // Check authentication - if not authenticated, save data and redirect
        if (!isAuthenticated) {
            try {
                // Prepare files for storage
                const preparedFiles = uploadedFileDetails.length > 0
                    ? await prepareFilesForStorage(
                        uploadedFiles,
                        uploadedFileDetails.map(fd => ({
                            id: fd.id,
                            type: fd.type,
                            pageCount: fd.pageCount,
                        }))
                    )
                    : [];

                // Phase 0 — guest entry carries per-file `{url, pageCount}`
                // so the post-login merge can POST it to `/cart` and the
                // server can persist `CartItem.metadata.files`.
                const guestFilesMeta = buildFilesMeta(uploadedFileDetails);

                const purchaseData: PendingPurchaseData = {
                    type: 'service',
                    categorySlug,
                    // Snapshot the product id the service page has already
                    // resolved so the post-login merge doesn't have to re-match
                    // by specs (addon-only spec keys would otherwise cause the
                    // spec match to fail and we'd land on a different product).
                    productId: matchingProduct?.id,
                    files: preparedFiles,
                    specifications: selectedSpecifications,
                    selectedAddons: selectedAddonIds.length > 0 ? selectedAddonIds : undefined,
                    quantity: totalQuantity,
                    copies,
                    pageCount,
                    templateId: selectedTemplateId || undefined,
                    templateFormData: selectedTemplateId ? templateFormData : undefined,
                    templateFormImages: selectedTemplateId ? templateFormImages : undefined,
                    metadata: {
                        pageCount: pageCount > 0 ? pageCount : undefined,
                        copies: pageCount > 0 ? copies : undefined,
                        selectedAddons: selectedAddonIds.length > 0 ? selectedAddonIds : undefined,
                        priceBreakdown,
                        templateId: selectedTemplateId || undefined,
                        templateFormData: selectedTemplateId ? templateFormData : undefined,
                        templateFormImages: selectedTemplateId ? templateFormImages : undefined,
                        // Snapshot half-page reduction so GuestCart can render
                        // the same numbers a logged-in cart would show without
                        // having to re-derive from the spec metadata.
                        effectivePageCount: hasHalfPageAdjustment ? effectivePageCount : undefined,
                        originalPageCount: hasHalfPageAdjustment ? originalPageCount : undefined,
                        hasHalfPageAdjustment: hasHalfPageAdjustment || undefined,
                        files: guestFilesMeta.length > 0 ? guestFilesMeta : undefined,
                    },
                    currentPrice: totalPrice,
                    totalPrice,
                    timestamp: Date.now(),
                    returnUrl: window.location.pathname + window.location.search,
                };

                await savePendingPurchaseData(purchaseData);
                // The pending-purchase payload supersedes the draft for this
                // flow; clear so a return to the service page after login
                // starts clean rather than re-hydrating stale picks.
                clearDraftServiceConfig(categorySlug);
                // Guest add-to-cart: send to /cart so the user can see their
                // item; auth is deferred until the Checkout button.
                redirectGuestToCart(router);
            } catch (error) {
                console.error('Failed to save pending purchase data:', error);
                toastError('Failed to save your selections. Please try again.');
            }
            return;
        }

        // Check if file is required and uploaded (or template is selected)
        if (category?.configuration?.fileUploadRequired && uploadedFiles.length === 0 && !selectedTemplateId) {
            toastWarning('Please upload a file or select a template to continue.');
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
            toastWarning('Product does not exist. Please contact us');
            return;
        }

        setAddingToCart(true);
        try {
            // Extract S3 keys from already uploaded files (files are uploaded immediately when selected)
            let s3Keys: string[] = uploadedFilesS3
                .filter(f => f.uploadStatus === 'uploaded' && f.s3Key)
                .map(f => f.s3Key!)
                .filter(Boolean);

            // Phase 0 — local lookup of `s3Key/url → pageCount` so we can
            // build `metadata.files` after any inline uploads complete.
            // Closure state from `uploadedFileDetails` won't reflect
            // setState mutations made later in this handler, so we mirror
            // the per-file pageCount here and update it alongside each
            // newly assigned key.
            const filePageCountByKey = new Map<string, number>();
            const pageCountForDetail = (fd: FileDetail): number =>
                fd.type === 'image'
                    ? 1
                    : (typeof fd.pageCount === 'number' && fd.pageCount > 0 ? fd.pageCount : 0);
            for (const fd of uploadedFileDetails) {
                if (typeof fd.s3Key === 'string' && fd.s3Key.length > 0) {
                    filePageCountByKey.set(fd.s3Key, pageCountForDetail(fd));
                }
            }

            // If we have files but no S3 keys, upload them now
            // Only check this if files are actually required (not if template is selected)
            if (uploadedFiles.length > 0 && s3Keys.length === 0 && !selectedTemplateId) {
                const pendingFiles = uploadedFilesS3.filter(f => f.uploadStatus === 'pending');
                if (pendingFiles.length > 0) {
                    // Upload pending files
                    for (const fileDetail of pendingFiles) {
                        try {
                            const response = await uploadOrderFilesToS3([fileDetail.file]);
                            if (response.success && response.data?.files?.[0]?.key) {
                                const key = response.data.files[0].key;
                                s3Keys.push(key);
                                filePageCountByKey.set(key, pageCountForDetail(fileDetail));
                                setUploadedFilesS3(prev =>
                                    prev.map(fd =>
                                        fd.id === fileDetail.id
                                            ? { ...fd, uploadStatus: 'uploaded' as const, s3Key: key }
                                            : fd
                                    )
                                );
                                setUploadedFileDetails(prev =>
                                    prev.map(fd =>
                                        fd.id === fileDetail.id
                                            ? { ...fd, uploadStatus: 'uploaded' as const, s3Key: key }
                                            : fd
                                    )
                                );
                            }
                        } catch (error) {
                            console.error(`Failed to upload file ${fileDetail.file.name}:`, error);
                            toastError(`Failed to upload ${fileDetail.file.name}. Please try again.`);
                            setAddingToCart(false);
                            return;
                        }
                    }
                } else {
                    // Files exist but no pending files and no S3 keys - might be already uploaded but s3Key not set
                    // Try to extract from uploadedFilesS3 that might have s3Key but status is not 'uploaded'
                    const filesWithKeys = uploadedFilesS3.filter(f => f.s3Key);
                    if (filesWithKeys.length > 0) {
                        s3Keys = filesWithKeys.map(f => f.s3Key!).filter(Boolean);
                        for (const fd of filesWithKeys) {
                            if (fd.s3Key) filePageCountByKey.set(fd.s3Key, pageCountForDetail(fd));
                        }
                    } else {
                        // Files don't have s3Key - they need to be uploaded
                        // Try to upload files that don't have s3Key
                        const filesToUpload = uploadedFilesS3.filter(f => !f.s3Key && f.uploadStatus !== 'uploading');
                        if (filesToUpload.length > 0) {
                            // Upload files that don't have s3Key
                            for (const fileDetail of filesToUpload) {
                                try {
                                    const response = await uploadOrderFilesToS3([fileDetail.file]);
                                    if (response.success && response.data?.files?.[0]?.key) {
                                        const key = response.data.files[0].key;
                                        s3Keys.push(key);
                                        filePageCountByKey.set(key, pageCountForDetail(fileDetail));
                                        setUploadedFilesS3(prev =>
                                            prev.map(fd =>
                                                fd.id === fileDetail.id
                                                    ? { ...fd, uploadStatus: 'uploaded' as const, s3Key: key }
                                                    : fd
                                            )
                                        );
                                        setUploadedFileDetails(prev =>
                                            prev.map(fd =>
                                                fd.id === fileDetail.id
                                                    ? { ...fd, uploadStatus: 'uploaded' as const, s3Key: key }
                                                    : fd
                                            )
                                        );
                                    }
                                } catch (error) {
                                    console.error(`Failed to upload file ${fileDetail.file.name}:`, error);
                                    toastError(`Failed to upload ${fileDetail.file.name}. Please try again.`);
                                    setAddingToCart(false);
                                    return;
                                }
                            }
                        } else {
                            toastError('Files are not ready yet. Please wait for uploads to complete.');
                            setAddingToCart(false);
                            return;
                        }
                    }
                }
            }

            // When using templates, don't add template preview image to customDesignUrl
            // The template preview image should only be in metadata.templatePreviewImage
            // customDesignUrl should only contain user-uploaded files

            // Phase 0 — per-file `{ url, pageCount }` for the authoritative
            // cart-write. Built from `s3Keys` (live order, including any
            // inline uploads we just completed) zipped against
            // `filePageCountByKey` so the array stays in sync with what
            // we just persisted to FTP.
            const filesMeta: FileMeta[] = s3Keys.map((url) => ({
                url,
                pageCount: filePageCountByKey.get(url) ?? 0,
            }));

            // Prepare metadata with template information
            const hasTemplateFormData = Object.keys(templateFormData).length > 0;
            const metadata: any = {
                pageCount: pageCount > 0 ? pageCount : undefined,
                copies: pageCount > 0 ? copies : undefined,
                priceBreakdown,
                selectedAddons: selectedAddonIds,
                files: filesMeta.length > 0 ? filesMeta : undefined,
                fileHasPassword: fileHasPassword ? true : undefined,
                filePassword: fileHasPassword ? (filePassword || undefined) : undefined,
                filePasswords: fileHasPassword
                    ? (filePassword || '')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : undefined,
                // Persist the user-selected specs so the server can resolve
                // half-page (and other option-driven rules) authoritatively
                // by looking up the live category option metadata. The
                // server NEVER trusts client effectivePageCount /
                // hasHalfPageAdjustment for pricing — those fields are
                // display-only and the half-page check is always
                // re-derived server-side from this `specifications` map.
                specifications: Object.keys(selectedSpecifications).length > 0
                    ? selectedSpecifications
                    : undefined,
                // Display-only snapshot of the reduction (cart UI / order
                // detail page render this as `483 → 242 (Both Sides)` text).
                // Server ignores these for math.
                effectivePageCount: hasHalfPageAdjustment ? effectivePageCount : undefined,
                originalPageCount: hasHalfPageAdjustment ? originalPageCount : undefined,
                hasHalfPageAdjustment: hasHalfPageAdjustment || undefined,
            };

            // Include template data if template is selected
            if (selectedTemplateId) {
                metadata.templateId = selectedTemplateId;
                if (selectedTemplateName) {
                    metadata.templateName = selectedTemplateName;
                }
                if (selectedTemplatePreviewImage) {
                    // Keep the original template preview image URL (DB string) in metadata
                    metadata.templatePreviewImage = selectedTemplatePreviewImage;
                }
                // Always include templateFormData if template is selected, even if empty
                if (hasTemplateFormData) {
                    metadata.templateFormData = templateFormData;
                }
                if (templateFormImages.length > 0) {
                    metadata.templateFormImages = templateFormImages;
                }
            }

            // Add to cart with S3 URLs
            // Always use totalQuantity which already includes copies multiplication

            const response = await toastPromise(
                addToCart({
                    productId: matchingProduct.id,
                    quantity: totalQuantity,
                    // Only include customDesignUrl if user uploaded files (not template preview image)
                    customDesignUrl: s3Keys.length > 0 ? s3Keys : undefined,
                    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
                    hasAddon: selectedAddonIds.length > 0,
                    addons: selectedAddonIds,
                }),
                {
                    loading: 'Adding to cart...',
                    success: 'Product added to cart successfully!',
                    error: (err: any) => err?.message || 'Failed to add product to cart. Please try again.',
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
                setFileHasPassword(false);
                setFilePassword('');
                setIsPasswordSubmitted(false);
                // Clear pending purchase data after successful add to cart
                clearPendingPurchaseData();
                // Item is now in the server cart — drop the local draft so
                // navigating back here doesn't re-hydrate stale selections.
                clearDraftServiceConfig(categorySlug);
                // Refresh cart to update count
                await refetchCart();
                // Redirect to cart page
                router.push('/cart');
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
        if (!pageController.isValid) {
            toastError(pageController.errorMessage || 'Page limit exceeded');
            return;
        }

        // Same minimum-cart-value gate as `handleAddToCart` — surface the
        // shortfall before any pending-purchase save / redirect, so a
        // guest sees the error immediately instead of after login.
        const minCartValue = Number(category?.minCartValue ?? 0);
        if (Number.isFinite(minCartValue) && minCartValue > 0 && totalPrice + 1e-6 < minCartValue) {
            const diff = Math.max(0, minCartValue - totalPrice);
            toastError(
                `Add ${formatInr(diff)} more to "${category?.name ?? 'this category'}" to reach the minimum order of ${formatInr(minCartValue)}.`
            );
            return;
        }

        // Check authentication - if not authenticated, save data and redirect
        if (!isAuthenticated) {
            try {
                // Prepare files for storage
                const preparedFiles = uploadedFileDetails.length > 0
                    ? await prepareFilesForStorage(
                        uploadedFiles,
                        uploadedFileDetails.map(fd => ({
                            id: fd.id,
                            type: fd.type,
                            pageCount: fd.pageCount,
                        }))
                    )
                    : [];

                // Phase 0 — buy-now guest entry also carries per-file
                // metadata so the post-login `/cart` POST persists
                // `CartItem.metadata.files` consistently with the
                // add-to-cart path.
                const guestBuyNowFilesMeta = buildFilesMeta(uploadedFileDetails);

                const purchaseData: PendingPurchaseData = {
                    type: 'service',
                    categorySlug,
                    productId: matchingProduct?.id,
                    files: preparedFiles,
                    specifications: selectedSpecifications,
                    selectedAddons: selectedAddonIds.length > 0 ? selectedAddonIds : undefined,
                    quantity: totalQuantity,
                    copies,
                    pageCount,
                    fileHasPassword,
                    filePassword: fileHasPassword ? filePassword : undefined,
                    templateId: selectedTemplateId || undefined,
                    templateFormData: selectedTemplateId ? templateFormData : undefined,
                    templateFormImages: selectedTemplateId ? templateFormImages : undefined,
                    metadata: {
                        pageCount: pageCount > 0 ? pageCount : undefined,
                        copies: pageCount > 0 ? copies : undefined,
                        selectedAddons: selectedAddonIds.length > 0 ? selectedAddonIds : undefined,
                        priceBreakdown,
                        templateId: selectedTemplateId || undefined,
                        templateFormData: selectedTemplateId ? templateFormData : undefined,
                        templateFormImages: selectedTemplateId ? templateFormImages : undefined,
                        fileHasPassword: fileHasPassword ? true : undefined,
                        filePassword: fileHasPassword ? (filePassword || undefined) : undefined,
                        // Snapshot half-page reduction so post-login merge keeps the
                        // same totals seen in the guest cart (see GuestCart.tsx).
                        effectivePageCount: hasHalfPageAdjustment ? effectivePageCount : undefined,
                        originalPageCount: hasHalfPageAdjustment ? originalPageCount : undefined,
                        hasHalfPageAdjustment: hasHalfPageAdjustment || undefined,
                        files: guestBuyNowFilesMeta.length > 0 ? guestBuyNowFilesMeta : undefined,
                    },
                    currentPrice: totalPrice,
                    totalPrice,
                    timestamp: Date.now(),
                    returnUrl: window.location.pathname + window.location.search,
                };

                await savePendingPurchaseData(purchaseData);
                // The pending-purchase payload is the source of truth from
                // here; drop the local service draft so a post-login bounce
                // back to this page (if any) doesn't double-up.
                clearDraftServiceConfig(categorySlug);
                // Buy Now → after login, land on /checkout (not back on the
                // service config page). Add-to-cart flow continues to use the
                // cart page as the return target.
                redirectToLoginWithReturn('/checkout', { intent: 'add_to_cart' });
            } catch (error) {
                console.error('Failed to save pending purchase data:', error);
                toastError('Failed to save your selections. Please try again.');
            }
            return;
        }

        // Check for missing required specifications
        const missingSpecs = getMissingRequiredSpecs();
        if (missingSpecs.length > 0) {
            const missingNames = missingSpecs.map(spec => spec.name).join(', ');
            toastWarning(`Please select the following required specifications: ${missingNames}`);
            return;
        }

        // Check if file is required and uploaded (or template is selected)
        if (category?.configuration?.fileUploadRequired && uploadedFiles.length === 0 && !selectedTemplateId) {
            toastWarning('Please upload a file or select a template to continue.');
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
            let s3Keys: string[] = uploadedFilesS3
                .filter(f => f.uploadStatus === 'uploaded' && f.s3Key)
                .map(f => f.s3Key!)
                .filter(Boolean);

            // Phase 0 — local `url → pageCount` map mirrored alongside any
            // inline uploads completed below, so the per-file metadata sent
            // into the buy-now payload stays in sync with what we just
            // persisted to FTP. See the matching block in `handleAddToCart`
            // for the rationale.
            const filePageCountByKey = new Map<string, number>();
            const pageCountForDetail = (fd: FileDetail): number =>
                fd.type === 'image'
                    ? 1
                    : (typeof fd.pageCount === 'number' && fd.pageCount > 0 ? fd.pageCount : 0);
            for (const fd of uploadedFileDetails) {
                if (typeof fd.s3Key === 'string' && fd.s3Key.length > 0) {
                    filePageCountByKey.set(fd.s3Key, pageCountForDetail(fd));
                }
            }

            // If we have files but no S3 keys, upload them now
            // Only check this if files are actually required (not if template is selected)
            if (uploadedFiles.length > 0 && s3Keys.length === 0 && !selectedTemplateId) {
                const pendingFiles = uploadedFilesS3.filter(f => f.uploadStatus === 'pending');
                if (pendingFiles.length > 0) {
                    // Upload pending files
                    for (const fileDetail of pendingFiles) {
                        try {
                            const response = await uploadOrderFilesToS3([fileDetail.file]);
                            if (response.success && response.data?.files?.[0]?.key) {
                                const key = response.data.files[0].key;
                                s3Keys.push(key);
                                filePageCountByKey.set(key, pageCountForDetail(fileDetail));
                                setUploadedFilesS3(prev =>
                                    prev.map(fd =>
                                        fd.id === fileDetail.id
                                            ? { ...fd, uploadStatus: 'uploaded' as const, s3Key: key }
                                            : fd
                                    )
                                );
                                setUploadedFileDetails(prev =>
                                    prev.map(fd =>
                                        fd.id === fileDetail.id
                                            ? { ...fd, uploadStatus: 'uploaded' as const, s3Key: key }
                                            : fd
                                    )
                                );
                            }
                        } catch (error) {
                            console.error(`Failed to upload file ${fileDetail.file.name}:`, error);
                            toastError(`Failed to upload ${fileDetail.file.name}. Please try again.`);
                            setBuyNowLoading(false);
                            return;
                        }
                    }
                } else {
                    // Files exist but no pending files and no S3 keys - might be already uploaded but s3Key not set
                    // Try to extract from uploadedFilesS3 that might have s3Key but status is not 'uploaded'
                    const filesWithKeys = uploadedFilesS3.filter(f => f.s3Key);
                    if (filesWithKeys.length > 0) {
                        s3Keys = filesWithKeys.map(f => f.s3Key!).filter(Boolean);
                        for (const fd of filesWithKeys) {
                            if (fd.s3Key) filePageCountByKey.set(fd.s3Key, pageCountForDetail(fd));
                        }
                    } else {
                        // Files don't have s3Key - they need to be uploaded
                        // Try to upload files that don't have s3Key
                        const filesToUpload = uploadedFilesS3.filter(f => !f.s3Key && f.uploadStatus !== 'uploading');
                        if (filesToUpload.length > 0) {
                            // Upload files that don't have s3Key
                            for (const fileDetail of filesToUpload) {
                                try {
                                    const response = await uploadOrderFilesToS3([fileDetail.file]);
                                    if (response.success && response.data?.files?.[0]?.key) {
                                        const key = response.data.files[0].key;
                                        s3Keys.push(key);
                                        filePageCountByKey.set(key, pageCountForDetail(fileDetail));
                                        setUploadedFilesS3(prev =>
                                            prev.map(fd =>
                                                fd.id === fileDetail.id
                                                    ? { ...fd, uploadStatus: 'uploaded' as const, s3Key: key }
                                                    : fd
                                            )
                                        );
                                        setUploadedFileDetails(prev =>
                                            prev.map(fd =>
                                                fd.id === fileDetail.id
                                                    ? { ...fd, uploadStatus: 'uploaded' as const, s3Key: key }
                                                    : fd
                                            )
                                        );
                                    }
                                } catch (error) {
                                    console.error(`Failed to upload file ${fileDetail.file.name}:`, error);
                                    toastError(`Failed to upload ${fileDetail.file.name}. Please try again.`);
                                    setBuyNowLoading(false);
                                    return;
                                }
                            }
                        } else {
                            toastError('Files are not ready yet. Please wait for uploads to complete.');
                            setBuyNowLoading(false);
                            return;
                        }
                    }
                }
            }

            // When using templates, don't add template preview image to customDesignUrl
            // The template preview image should only be in metadata.templatePreviewImage
            // customDesignUrl should only contain user-uploaded files

            // Phase 0 — per-file metadata for the buy-now path. The
            // sessionStorage `buyNow` blob is consumed by the checkout
            // page which passes `metadata` straight through to
            // `/payment/razorpay/create-order-from-cart`, so the same
            // shape lands on `PendingPayment.items` → `OrderItem.metadata`.
            const filesMeta: FileMeta[] = s3Keys.map((url) => ({
                url,
                pageCount: filePageCountByKey.get(url) ?? 0,
            }));

            // Prepare metadata with template information
            const hasTemplateFormData = Object.keys(templateFormData).length > 0;
            const buyNowMetadata: any = {
                pageCount: pageCount > 0 ? pageCount : undefined,
                copies: pageCount > 0 ? copies : undefined,
                priceBreakdown,
                selectedAddons: selectedAddonIds,
                files: filesMeta.length > 0 ? filesMeta : undefined,
                fileHasPassword: fileHasPassword ? true : undefined,
                filePassword: fileHasPassword ? (filePassword || undefined) : undefined,
                filePasswords: fileHasPassword
                    ? (filePassword || '')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    : undefined,
            };

            // Include template data if template is selected
            if (selectedTemplateId) {
                buyNowMetadata.templateId = selectedTemplateId;
                if (selectedTemplateName) {
                    buyNowMetadata.templateName = selectedTemplateName;
                }
                if (selectedTemplatePreviewImage) {
                    // Keep the original template preview image URL (DB string) in metadata
                    buyNowMetadata.templatePreviewImage = selectedTemplatePreviewImage;
                }
                // Always include templateFormData if template is selected, even if empty
                if (hasTemplateFormData) {
                    buyNowMetadata.templateFormData = templateFormData;
                }
                if (templateFormImages.length > 0) {
                    buyNowMetadata.templateFormImages = templateFormImages;
                }
            }

            // Clear any existing buyNow data before creating new one (prevents showing old product)
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem('buyNow');
            }

            // Store product data in sessionStorage for direct checkout (bypass cart)
            const buyNowData = {
                productId: matchingProduct.id,
                quantity: totalQuantity,
                // Only include customDesignUrl if user uploaded files (not template preview image)
                customDesignUrl: s3Keys.length > 0 ? s3Keys : undefined,
                product: matchingProduct,
                price: totalPrice,
                priceBreakdown,
                pageCount: pageCount > 0 ? pageCount : undefined,
                copies: pageCount > 0 ? copies : undefined,
                metadata: Object.keys(buyNowMetadata).length > 0 ? buyNowMetadata : undefined,
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
            setFileHasPassword(false);
            setFilePassword('');

            // Clear pending purchase data after successful buy now
            clearPendingPurchaseData();
            // Buy-now committed → user is leaving the configurator with a
            // captured snapshot, so the local draft is no longer useful.
            clearDraftServiceConfig(categorySlug);

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

    const isComingSoon = Boolean(category?.configuration?.layoutConfig?.comingSoon);

    // Keep hook order stable: build this UI first, return it after all hooks below are declared.
    const comingSoonContent = !loading && category && isComingSoon ? (
        (() => {
            const serviceName = category.name || 'Service';
            return (
            <div className="min-h-screen bg-white">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
                    <div className="text-center">
                        {/* Coming Soon Badge */}
                        <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-6">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Coming Soon
                        </div>

                        {/* Main Heading */}
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-hkgb text-gray-900 mb-4">
                            {serviceName}
                        </h1>

                        {/* Subheading */}
                        <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-2xl mx-auto">
                            We're working hard to bring you this amazing service. Stay tuned!
                        </p>

                        {/* Decorative Icon/Image */}
                        <div className="mb-12 flex justify-center">
                            <div className="relative w-64 h-64 md:w-80 md:h-80 bg-linear-to-br from-blue-50 to-indigo-100 rounded-3xl flex items-center justify-center shadow-lg">
                                <svg className="w-32 h-32 md:w-40 md:h-40 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                        </div>

                        {/* Features Preview */}
                        <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-3xl mx-auto">
                            <div className="p-6 bg-gray-50 rounded-xl">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a4 4 0 004-4v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-gray-900 mb-2">Premium Quality</h3>
                                <p className="text-sm text-gray-600">High-quality printing with professional finishes</p>
                            </div>

                            <div className="p-6 bg-gray-50 rounded-xl">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-gray-900 mb-2">Fast Delivery</h3>
                                <p className="text-sm text-gray-600">Quick turnaround times for all orders</p>
                            </div>

                            <div className="p-6 bg-gray-50 rounded-xl">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h3 className="font-semibold text-gray-900 mb-2">Competitive Pricing</h3>
                                <p className="text-sm text-gray-600">Affordable rates with no hidden costs</p>
                            </div>
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <button
                                onClick={() => router.push('/services')}
                                className="px-8 py-3 bg-[#008ECC] text-white rounded-lg font-semibold hover:bg-[#0077B5] transition-colors shadow-lg"
                            >
                                Browse Other Services
                            </button>
                            <button
                                onClick={() => router.push('/')}
                                className="px-8 py-3 bg-white text-[#008ECC] border-2 border-[#008ECC] rounded-lg font-semibold hover:bg-blue-50 transition-colors"
                            >
                                Back to Home
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            );
        })()
    ) : null;

    // Check if category is a parent category (has children)
    const isParentCategory = useMemo(() => {
        if (!category) return false;
        return (category.hasChildren === true) || 
               (category.childrenCount && category.childrenCount > 0) ||
               (category.children && category.children.length > 0);
    }, [category]);

    // Filter specifications by display order and visibility
    const visibleSpecifications = useMemo(() => {
        if (!category || !category.specifications) return [];
        return category.specifications
            .filter(isSpecificationVisible)
            .sort((a, b) => a.displayOrder - b.displayOrder);
    }, [category, selectedSpecifications]);

    if (comingSoonContent) {
        return comingSoonContent;
    }

    // If category is loaded and is a parent, render subcategory grid
    if (!loading && category && isParentCategory) {
        const children = category.children || [];
        return <SubcategoryGrid parentCategory={category} children={children} />;
    }

    // Inline skeleton while category & pricing data load on client (default product template skeleton)
    if (loading || !category) {
        return (
            <div className="min-h-screen bg-white py-8 pb-24">
                <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Breadcrumbs skeleton - Hidden on mobile, shown on tablet and above */}
                    <div className="hidden sm:block mb-6">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                            <div className="h-3 w-3 rounded-full bg-gray-200 animate-pulse" />
                            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                            <div className="h-3 w-3 rounded-full bg-gray-200 animate-pulse" />
                            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                        </div>
                    </div>

                    {/* Mobile Breadcrumb skeleton */}
                    <div className="sm:hidden mb-4">
                        <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
                    </div>

                    {/* Main Product Section - Matching ProductPageTemplate layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mb-12">
                        {/* Left Column - Product Images */}
                        <div className="lg:col-span-6 space-y-4 sm:space-y-5">
                            <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-100">
                                <div className="relative aspect-square rounded-xl bg-gray-200 animate-pulse" />
                            </div>
                        </div>

                        {/* Right Column - Info, upload, config, price, actions */}
                        <div className="lg:col-span-6">
                            <div className="sticky top-24 space-y-4 sm:space-y-6">
                                {/* Title & Description */}
                                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100">
                                    <div className="h-8 sm:h-9 w-3/4 bg-gray-200 rounded animate-pulse mb-3" />
                                    <div className="space-y-2">
                                        <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                                        <div className="h-4 w-5/6 bg-gray-200 rounded animate-pulse" />
                                    </div>
                                </div>

                                {/* Features */}
                                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-100">
                                    <div className="h-5 w-24 bg-gray-200 rounded animate-pulse mb-4" />
                                    <div className="space-y-2">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                                        ))}
                                    </div>
                                </div>

                                {/* File Upload */}
                                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100">
                                    <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
                                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center">
                                        <div className="h-12 w-12 bg-gray-200 rounded-full animate-pulse mb-3" />
                                        <div className="h-4 w-40 bg-gray-200 rounded animate-pulse mb-2" />
                                        <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
                                    </div>
                                </div>

                                {/* Configuration options */}
                                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100">
                                    <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4" />
                                    <div className="space-y-4">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="space-y-2">
                                                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                                                <div className="h-10 w-full bg-gray-200 rounded-lg animate-pulse" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Price Section */}
                                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100">
                                    <div className="space-y-3">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                                                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                                            </div>
                                        ))}
                                        <div className="pt-3 border-t border-gray-100">
                                            <div className="flex items-center justify-between">
                                                <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
                                                <div className="h-6 w-28 bg-gray-200 rounded animate-pulse" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3">
                                    <div className="h-12 flex-1 bg-gray-200 rounded-lg animate-pulse" />
                                    <div className="h-12 flex-1 bg-gray-200 rounded-lg animate-pulse" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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
                    setFileHasPassword(false);
                    setFilePassword('');
                }}
                priceItems={priceBreakdown}
                totalPrice={totalPrice}
                basePricePerUnit={basePricePerUnit}
                pageCount={effectivePageCount !== undefined ? effectivePageCount : (pageCount > 0 ? pageCount : undefined)}
                originalPageCount={originalPageCount !== undefined ? originalPageCount : (pageCount > 0 ? pageCount : undefined)}
                hasHalfPageAdjustment={hasHalfPageAdjustment}
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
                hasUploadedFiles={uploadedFiles.length > 0 || !!selectedTemplateId}
                hasTemplates={hasTemplates}
                calculatingPrice={calculatingPrice}
                isUploadingFiles={isUploadingFiles}
                uploadedFilesS3={uploadedFilesS3}
                setUploadedFilesS3={setUploadedFilesS3}
                hideFileUpload={hasTemplates}
                pageControllerMaxPages={pageController.maxPages}
                pageControllerCurrentPageCount={pageCount}
                pageControllerError={pageController.errorMessage}
                hasPageControllerRules={pageController.hasRules}
                templateSelector={
                    hasTemplates ? (
                        <TemplateSelector
                            categorySlug={categorySlug}
                            onTemplateSelect={(templateId, formData, formImages, templateName, templatePreviewImage) => {
                                setSelectedTemplateId(templateId);
                                setSelectedTemplateName(templateName || null);
                                setSelectedTemplatePreviewImage(templatePreviewImage || null);
                                setTemplateFormData(formData);
                                setTemplateFormImages(formImages);
                            }}
                            selectedTemplateId={selectedTemplateId}
                            selectedFormData={templateFormData}
                            selectedFormImages={templateFormImages}
                            uploadedFiles={uploadedFilesS3}
                            onFileSelect={(files) => {
                                // When files are selected from template selector (no templates case)
                                // This shouldn't happen since we hide the selector when no templates
                                // But keeping it for safety
                                handleFileSelect(files, 0, undefined);
                            }}
                            onFileRemove={handleFileRemove}
                            onEditTemplateForm={handleEditTemplateForm}
                        />
                    ) : undefined
                }
                fileHasPassword={fileHasPassword}
                filePassword={filePassword}
                isPasswordSubmitted={isPasswordSubmitted}
                onFileHasPasswordChange={setFileHasPassword}
                onFilePasswordChange={setFilePassword}
                onPasswordSubmittedChange={setIsPasswordSubmitted}
            >

                {/* Dynamic Configuration Options */}
                <div className="space-y-8">
                    {visibleSpecifications.map((spec: CategorySpecification) => {
                        const availableOptions = getAvailableOptions(spec);
                        if (availableOptions.length === 0) return null;

                        // Handle different specification types
                        if (spec.type === 'SELECT' || spec.type === 'MULTI_SELECT') {
                            const selectedValue = selectedSpecifications[spec.slug];
                            const warningMessage = specWarnings[spec.slug];

                            // Get the selected option label for display
                            const selectedOption = selectedValue
                                ? availableOptions.find(opt => opt.value === selectedValue)
                                : null;
                            const selectedOptionLabel = selectedOption?.label || selectedValue || '';

                            return (
                                <div key={spec.id} className="space-y-2">
                                    <label htmlFor={`spec-${spec.slug}`} className="block text-sm font-medium text-gray-700 font-hkgb">
                                        {spec.name}
                                        {spec.isRequired && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    <Select
                                        value={selectedValue || ''}
                                        onChange={(value) => {
                                            // Clear any previous warning as the user is changing selection
                                            clearSpecWarning(spec.slug);

                                            // If this is an OPTIONAL dropdown and selection has no matching ADDON pricing rule,
                                            // show a message and reset to default.
                                            const isOptional = !spec.isRequired;
                                            const isClearing = value === '' || value === 'none';

                                            if (isOptional && !isClearing && availableAddons.length > 0) {
                                                const nextSpecs: Record<string, any> = {
                                                    ...selectedSpecifications,
                                                    [spec.slug]: value,
                                                };

                                                // Determine if any addon rule matches this selection with current specs.
                                                // String-normalise comparison to match the memo above.
                                                const normalize = (v: unknown) => (v === null || v === undefined ? "" : String(v));
                                                // Mirror the addon-id memo: total pages = raw upload
                                                // volume (pageCount × copies, or quantity × copies in
                                                // bulk mode). Half-page reduction NOT applied — addon
                                                // ranges gate on the customer-uploaded volume.
                                                const safeCopies = copies > 0 ? copies : 1;
                                                const totalPages = pageCount > 0
                                                    ? pageCount * safeCopies
                                                    : (isCopiesMode ? quantity * safeCopies : quantity);
                                                const rangeBasis = totalPages > 0 ? totalPages : null;
                                                const matchingAddonRules = availableAddons.filter((rule) => {
                                                    const ruleSpecs = (rule.specificationValues || {}) as Record<string, any>;
                                                    for (const [slug, val] of Object.entries(ruleSpecs)) {
                                                        if (normalize(nextSpecs[slug]) !== normalize(val)) return false;
                                                    }

                                                    const hasPageRange = rule.minQuantity != null || rule.maxQuantity != null;
                                                    if (hasPageRange) {
                                                        if (rangeBasis == null) return false;
                                                        if (rule.minQuantity != null && rangeBasis < rule.minQuantity) return false;
                                                        if (rule.maxQuantity != null && rangeBasis > rule.maxQuantity) return false;
                                                    }
                                                    return true;
                                                });

                                                if (matchingAddonRules.length === 0) {
                                                    const optionLabel =
                                                        availableOptions.find((opt) => opt.value === value)?.label || value;
                                                    const pagesNote = rangeBasis != null
                                                        ? ` (current pages: ${rangeBasis} = ${pageCount > 0 ? pageCount : quantity} × ${safeCopies})`
                                                        : "";
                                                    setSpecWarning(
                                                        spec.slug,
                                                        `Pricing for “${optionLabel}” is not configured yet${pagesNote}. Please choose another option or contact support.`
                                                    );
                                                    // Reset dropdown back to default
                                                    handleSpecificationChange(spec.slug, '');
                                                    return;
                                                }
                                            }

                                            handleSpecificationChange(spec.slug, value);
                                        }}
                                        options={[
                                            ...(!spec.isRequired
                                                ? [{ value: '', label: 'None (Clear selection)', disabled: false }]
                                                : []),
                                            ...availableOptions.map((option) => ({
                                                value: option.value,
                                                label: option.label,
                                                description: option.description,
                                                disabled: option.disabled,
                                            })),
                                        ]}
                                        placeholder={spec.isRequired ? `Select ${spec.name}` : `Select ${spec.name} (Optional)`}
                                        required={spec.isRequired}
                                    />

                                    {warningMessage && (
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                            {warningMessage}
                                        </p>
                                    )}


                                </div>
                            );
                        } else if (spec.type === 'NUMBER') {
                            if (spec.slug === 'quantity') {
                                return (
                                    <QuantityWithCopiesSelector
                                        key={spec.id}
                                        quantity={quantity}
                                        copies={copies}
                                        onQuantityChange={(value) => {
                                            setQuantity(value);
                                            handleSpecificationChange(spec.slug, value.toString());
                                        }}
                                        onCopiesChange={setCopies}
                                        label={spec.name}
                                        min={1}
                                        max={1000}
                                        showBulkToggle={pageController.uiSettings.showBulkToggle}
                                        bulkToggleLabel={pageController.uiSettings.bulkToggleLabel}
                                        copiesLabel={pageController.uiSettings.copiesLabel}
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
                                    <Select
                                        value={selectedSpecifications[spec.slug] || ''}
                                        onChange={(value) => handleSpecificationChange(spec.slug, value)}
                                        options={availableOptions.map((option) => ({
                                            value: option.value,
                                            label: option.label,
                                            description: option.description,
                                            disabled: option.disabled,
                                        }))}
                                        placeholder={`Select ${spec.name}`}
                                        error={isMissing}
                                        required={spec.isRequired}
                                    />
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
                            {/* <PageCountDisplay
                                pageCount={pageCount}
                                fileType={getFileType(uploadedFileDetails)}
                                pdfPageCount={pdfPageCount}
                                imageCount={imageCount}
                            /> */}

                            <QuantityWithCopiesSelector
                                quantity={pageCount}
                                copies={copies}
                                onQuantityChange={() => {
                                    // quantity is derived from uploaded pages; keep read-only here
                                }}
                                onCopiesChange={setCopies}
                                min={1}
                                max={999}
                                label="Quantity"
                                quantityReadOnly
                                showBulkToggle={pageController.uiSettings.showBulkToggle}
                                bulkToggleLabel={pageController.uiSettings.bulkToggleLabel}
                                copiesLabel={pageController.uiSettings.copiesLabel}
                            />

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
                                showBulkToggle={pageController.uiSettings.showBulkToggle}
                                bulkToggleLabel={pageController.uiSettings.bulkToggleLabel}
                                copiesLabel={pageController.uiSettings.copiesLabel}
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

            {category?.id && <CategoryReviewsSection categoryId={category.id} />}
        </div>
    );
}

