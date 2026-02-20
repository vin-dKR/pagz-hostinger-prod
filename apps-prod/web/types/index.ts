export type Feature = {
    id: string;
    text: string;
    icon: string;
};

export type BreadcrumbItem = {
    label: string;
    href: string;
    isActive?: boolean;
};

export type UploadedFile = {
    name: string;
    size: number;
    type: string;
    lastModified: number;
} | null;

export type PageBasedPrice = {
    pages: string;
    price: number
};

export type TypeBasedPrice = {
    type: string;
    price: number
};

export type BindingPrice = PageBasedPrice | TypeBasedPrice;

export type PrintPricing = {
    bwSingle: number;
    bwBoth: number;
    colorSingle: number;
    colorBoth: number;
};

export type PrintProduct = {
    paperType: string;
    paperSize?: string;
    prices: PrintPricing;
};

export type BindingProduct = {
    type: string;
    prices: BindingPrice[];
};

export type LaminationProduct = {
    size: string;
    options: Array<{
        type: string;
        price: number;
    }>;
};

export type ProductSelection = {
    paperSize: 'A4' | 'A3';
    paperType: string;
    colorType: 'bwSingle' | 'bwBoth' | 'colorSingle' | 'colorBoth';
    bindingType?: string;
    bindingPages?: string;
    laminationSize?: string;
    laminationType?: string;
    quantity: number;
};

export type PricingCalculation = {
    basePrintPrice: number;
    bindingPrice: number;
    laminationPrice: number;
    totalPrice: number;
    quantity: number;
    pricePerUnit: number;
};

export type ProductCategory = 'pdf-printing' | 'book-printing' | 'photo-printing' | 'map-printing';

export type Option = {
    id: string;
    label: string;
    value: string;
    price?: number;
    description?: string;
    disabled?: boolean;
};

export type PriceTier = {
    pages?: string;
    type?: string;
    price: number;
};

export type ProductVariant = {
    id: string;
    label: string;
    price: number;
    pricePerUnit?: number;
    options?: Option[];
};

export type ProductConfiguration = {
    category: ProductCategory;
    size?: string;
    paperType?: string;
    colorType?: string;
    sides?: string;
    binding?: string;
    lamination?: string;
    quantity: number;
    customOptions?: Record<string, any>;
};

export type ProductData = {
    category: ProductCategory;
    title: string;
    description: string;
    basePrice: number;
    features: string[];
    options: {
        sizes: Option[];
        paperTypes: Option[];
        colors: Option[];
        sides: Option[];
        bindings: Option[];
        laminations: Option[];
        customOptions?: Record<string, Option[]>;
    };
    pricing: {
        paperTiers: Record<string, PriceTier[]>;
        bindingTiers: PriceTier[];
        laminationTiers: PriceTier[];
    };
};
