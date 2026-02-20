import { PrintProduct, BindingProduct, LaminationProduct } from '@/types';

// A4 Printout Products Data
export const A4_PRINTOUTS: PrintProduct[] = [
    {
        paperType: "65 Gsm",
        prices: {
            bwSingle: 0.84,
            bwBoth: 0.98,
            colorSingle: 3.00,
            colorBoth: 5.00,
        },
    },
    {
        paperType: "70 Gsm",
        prices: {
            bwSingle: 0.90,
            bwBoth: 1.10,
            colorSingle: 3.50,
            colorBoth: 6.00,
        },
    },
    {
        paperType: "75 Gsm",
        prices: {
            bwSingle: 1.00,
            bwBoth: 1.20,
            colorSingle: 4.00,
            colorBoth: 7.00,
        },
    },
    {
        paperType: "100 Gsm",
        prices: {
            bwSingle: 1.85,
            bwBoth: 3.10,
            colorSingle: 5.00,
            colorBoth: 9.00,
        },
    },
    {
        paperType: "100 Gsm BOND",
        prices: {
            bwSingle: 2.00,
            bwBoth: 3.50,
            colorSingle: 7.00,
            colorBoth: 10.00,
        },
    },
];

// A3 Printout Products Data
export const A3_PRINTOUTS: PrintProduct[] = [
    {
        paperType: "70 Gsm",
        prices: {
            bwSingle: 3.00,
            bwBoth: 4.50,
            colorSingle: 10.00,
            colorBoth: 15.00,
        },
    },
    {
        paperType: "75 Gsm",
        prices: {
            bwSingle: 3.50,
            bwBoth: 5.00,
            colorSingle: 12.00,
            colorBoth: 20.00,
        },
    },
    {
        paperType: "100 Gsm",
        prices: {
            bwSingle: 4.00,
            bwBoth: 6.00,
            colorSingle: 15.00,
            colorBoth: 22.00,
        },
    },
    {
        paperType: "130 Gsm",
        prices: {
            bwSingle: 5.00,
            bwBoth: 8.00,
            colorSingle: 20.00,
            colorBoth: 25.00,
        },
    },
];

// Lamination Products
export const LAMINATION_PRODUCTS: LaminationProduct[] = [
    {
        size: "A4",
        options: [
            { type: "Not Required", price: 0 },
            { type: "Thin 50 Micron", price: 10 },
            { type: "Thick 125 Micron", price: 20 },
        ],
    },
    {
        size: "A3",
        options: [
            { type: "Not Required", price: 0 },
            { type: "Thin 50 Micron", price: 30 },
            { type: "Thick 125 Micron", price: 40 },
        ],
    },
];

// Binding Products
export const BINDING_PRODUCTS: BindingProduct[] = [
    {
        type: "Not Required",
        prices: [
            { pages: "O", price: 0 }
        ]
    },
    {
        type: "Spiral Binding",
        prices: [
            { pages: "Upto 50 Pages", price: 20 },
            { pages: "Upto 100 Pages", price: 25 },
            { pages: "Upto 150 Pages", price: 30 },
            { pages: "Upto 200 Pages", price: 35 },
            { pages: "Upto 250 Pages", price: 40 },
            { pages: "Upto 300 Pages", price: 45 },
        ],
    },
    {
        type: "Wiro Binding",
        prices: [
            { pages: "Upto 50 Pages", price: 25 },
            { pages: "Upto 100 Pages", price: 30 },
            { pages: "Upto 150 Pages", price: 35 },
            { pages: "Upto 200 Pages", price: 40 },
            { pages: "Upto 250 Pages", price: 45 },
            { pages: "Upto 300 Pages", price: 50 },
        ],
    },
    {
        type: "Glue Binding",
        prices: [
            { pages: "Upto 50 Pages", price: 15 },
            { pages: "Upto 100 Pages", price: 20 },
            { pages: "Upto 150 Pages", price: 25 },
            { pages: "Upto 200 Pages", price: 30 },
            { pages: "Upto 250 Pages", price: 35 },
            { pages: "Upto 300 Pages", price: 40 },
        ],
    },
    {
        type: "Hard Binding",
        prices: [
            { type: "Standard", price: 50 },
            { type: "With Golden Print (Black Cover)", price: 150 },
            { type: "With Silver Print (Red Cover)", price: 150 },
        ],
    },
];

// A3 Binding Products
export const A3_BINDING_PRODUCTS: BindingProduct[] = [
    {
        type: "Spiral Binding",
        prices: [
            { pages: "Upto 50 Pages", price: 40 },
            { pages: "Upto 100 Pages", price: 60 },
            { pages: "Upto 150 Pages", price: 80 },
            { pages: "Upto 200 Pages", price: 100 },
            { pages: "Upto 250 Pages", price: 120 },
            { pages: "Upto 300 Pages", price: 140 },
        ],
    },
    {
        type: "Wiro Binding",
        prices: [
            { pages: "Upto 50 Pages", price: 45 },
            { pages: "Upto 100 Pages", price: 65 },
            { pages: "Upto 150 Pages", price: 85 },
            { pages: "Upto 200 Pages", price: 105 },
            { pages: "Upto 250 Pages", price: 125 },
            { pages: "Upto 300 Pages", price: 145 },
        ],
    },
    {
        type: "Glue Binding",
        prices: [
            { pages: "Upto 50 Pages", price: 30 },
            { pages: "Upto 100 Pages", price: 35 },
            { pages: "Upto 150 Pages", price: 40 },
            { pages: "Upto 200 Pages", price: 50 },
            { pages: "Upto 250 Pages", price: 60 },
            { pages: "Upto 300 Pages", price: 70 },
        ],
    },
    {
        type: "Hard Binding",
        prices: [
            { type: "Standard", price: 70 },
            { type: "With Golden Print", price: 200 },
            { type: "With Silver Print", price: 200 },
        ],
    },
];

// Helper function to get available paper types based on size
export const getPaperOptions = (size: 'A4' | 'A3') => {
    return size === 'A4' ? A4_PRINTOUTS : A3_PRINTOUTS;
};

// Helper function to get binding options based on size
export const getBindingOptions = (size: 'A4' | 'A3') => {
    return size === 'A4' ? BINDING_PRODUCTS : A3_BINDING_PRODUCTS;
};

// Helper function to get lamination options based on size
export const getLaminationOptions = (size: string) => {
    return LAMINATION_PRODUCTS.find(l => l.size === size)?.options || [];
};
