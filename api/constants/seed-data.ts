// All product data constants used across seed scripts

// Type definitions
export type PageBasedPrice = { pages: string; price: number };
export type TypeBasedPrice = { type: string; price: number };
export type BindingPrice = PageBasedPrice | TypeBasedPrice;

// A4 Printout Products Data
export const A4_PRINTOUTS = [
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
export const A3_PRINTOUTS = [
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
export const LAMINATION_PRODUCTS = [
    {
        size: "A4",
        options: [
            { type: "Thin 50 Micron", price: 10 },
            { type: "Thick 125 Micron", price: 20 },
        ],
    },
    {
        size: "A3",
        options: [
            { type: "Thin 50 Micron", price: 30 },
            { type: "Thick 125 Micron", price: 40 },
        ],
    },
];

// Binding Products
export const BINDING_PRODUCTS = [
    {
        size: "A4",
        bindings: [
            {
                type: "Spiral Binding",
                prices: [
                    { pages: "Upto 50 Pages", price: 20 },
                    { pages: "Upto 100 Pages", price: 25 },
                    { pages: "Upto 150 Pages", price: 30 },
                    { pages: "Upto 200 Pages", price: 35 },
                    { pages: "Upto 250 Pages", price: 40 },
                    { pages: "Upto 300 Pages", price: 45 },
                ] as PageBasedPrice[],
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
                ] as PageBasedPrice[],
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
                ] as PageBasedPrice[],
            },
            {
                type: "Hard Binding",
                prices: [
                    { type: "Standard", price: 50 },
                    { type: "With Golden Print (Black Cover)", price: 150 },
                    { type: "With Silver Print (Red Cover)", price: 150 },
                ] as TypeBasedPrice[],
            },
        ],
    },
    {
        size: "A3",
        bindings: [
            {
                type: "Spiral Binding",
                prices: [
                    { pages: "Upto 50 Pages", price: 40 },
                    { pages: "Upto 100 Pages", price: 60 },
                    { pages: "Upto 150 Pages", price: 80 },
                    { pages: "Upto 200 Pages", price: 100 },
                    { pages: "Upto 250 Pages", price: 120 },
                    { pages: "Upto 300 Pages", price: 140 },
                ] as PageBasedPrice[],
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
                ] as PageBasedPrice[],
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
                ] as PageBasedPrice[],
            },
            {
                type: "Hard Binding",
                prices: [
                    { type: "Standard", price: 70 },
                    { type: "With Golden Print", price: 200 },
                    { type: "With Silver Print", price: 200 },
                ] as TypeBasedPrice[],
            },
        ],
    },
];

// Book Printout Products Data
export const BOOK_PRINTOUTS = [
    {
        paperSize: "A5",
        paperType: "70 Gsm",
        prices: {
            bwSingle: 0.65,
            bwBoth: 0.80,
            colorSingle: 2.10,
            colorBoth: 3.40,
        },
    },
    {
        paperSize: "B5",
        paperType: "70 Gsm",
        prices: {
            bwSingle: 0.70,
            bwBoth: 0.90,
            colorSingle: 3.10,
            colorBoth: 5.50,
        },
    },
    {
        paperSize: "A4",
        paperType: "70 Gsm",
        prices: {
            bwSingle: 0.90,
            bwBoth: 1.10,
            colorSingle: 3.50,
            colorBoth: 6.00,
        },
    },
    {
        paperSize: "A3",
        paperType: "70 Gsm",
        prices: {
            bwSingle: 2.00,
            bwBoth: 3.50,
            colorSingle: 10.00,
            colorBoth: 15.00,
        },
    },
];

// Book Binding Products
export const BOOK_BINDING_PRODUCTS = [
    {
        type: "Glue Binding",
        prices: [
            { pages: "Upto 50 Pages", price: 15 },
            { pages: "Upto 100 Pages", price: 20 },
            { pages: "Upto 150 Pages", price: 25 },
            { pages: "Upto 200 Pages", price: 30 },
            { pages: "Upto 250 Pages", price: 35 },
            { pages: "Upto 300 Pages", price: 40 },
        ] as PageBasedPrice[],
    },
    {
        type: "Hard Binding",
        prices: [
            { pages: "Upto 50 Pages", price: 40 },
            { pages: "Upto 100 Pages", price: 45 },
            { pages: "Upto 150 Pages", price: 50 },
            { pages: "Upto 200 Pages", price: 55 },
            { pages: "Upto 250 Pages", price: 60 },
            { pages: "Upto 300 Pages", price: 65 },
        ] as PageBasedPrice[],
    },
];

// Glossy Photo Products Data
export const GLOSSY_PHOTO_PRODUCTS = [
    { size: "4X6", price: 10 },
    { size: "5X7", price: 20 },
    { size: "8X10", price: 45 },
    { size: "A4", price: 55 },
    { size: "8X12", price: 60 },
    { size: "10X15", price: 80 },
    { size: "12X18", price: 100 },
    { size: "A3", price: 120 },
    { size: "A2", price: 150 },
    { size: "A1", price: 200 },
    { size: "A0", price: 300 },
];

// Matt Photo Products Data
export const MATT_PHOTO_PRODUCTS = [
    { size: "4X6", price: 15 },
    { size: "5X7", price: 25 },
    { size: "8X10", price: 50 },
    { size: "A4", price: 60 },
    { size: "8X12", price: 65 },
    { size: "10X15", price: 85 },
    { size: "12X18", price: 110 },
    { size: "A3", price: 130 },
];

// Glossy Lamination Products Data
export const GLOSSY_LAMINATION_PRODUCTS = [
    { size: "4X6", price: 5 },
    { size: "5X7", price: 10 },
    { size: "8X10", price: 30 },
    { size: "A4", price: 40 },
    { size: "8X12", price: 50 },
    { size: "10X15", price: 70 },
    { size: "12X18", price: 90 },
    { size: "A3", price: 85 },
    { size: "A2", price: 100 },
    { size: "A1", price: 120 },
    { size: "A0", price: 150 },
];

// Business Card Products Data
export const BUSINESS_CARD_PRODUCTS = [
    {
        paperType: "ART PAPER 250 GSM PAPER",
        pricePerPiece: 2.00,
        priceSingleSide100: 200,
        priceBothSide100: 300,
    },
    {
        paperType: "ROYAL GOLD PAPER",
        pricePerPiece: 2.50,
        priceSingleSide100: 250,
        priceBothSide100: 350,
    },
    {
        paperType: "ICE GOLD PAPER",
        pricePerPiece: 2.50,
        priceSingleSide100: 250,
        priceBothSide100: 350,
    },
    {
        paperType: "ICE SILVER PAPER",
        pricePerPiece: 2.50,
        priceSingleSide100: 250,
        priceBothSide100: 350,
    },
    {
        paperType: "LINEN WHITE PAPER",
        pricePerPiece: 2.50,
        priceSingleSide100: 250,
        priceBothSide100: 350,
    },
    {
        paperType: "LINEN IVORY PAPER",
        pricePerPiece: 2.50,
        priceSingleSide100: 250,
        priceBothSide100: 350,
    },
    {
        paperType: "FINE TOILE WHITE PAPER",
        pricePerPiece: 2.50,
        priceSingleSide100: 250,
        priceBothSide100: 350,
    },
    {
        paperType: "DOT IVORY PAPER",
        pricePerPiece: 2.50,
        priceSingleSide100: 250,
        priceBothSide100: 350,
    },
    {
        paperType: "SPLENDO EXTRA WHITE PAPER",
        pricePerPiece: 2.50,
        priceSingleSide100: 250,
        priceBothSide100: 350,
    },
    {
        paperType: "NTR 115 MIC PAPER",
        pricePerPiece: 4.00,
        priceSingleSide100: 400,
        priceBothSide100: 600,
    },
    {
        paperType: "NTR 200 MIC PAPER",
        pricePerPiece: 5.00,
        priceSingleSide100: 500,
        priceBothSide100: 750,
    },
];

// Design Making Charge
export const DESIGN_MAKING_CHARGE = 50;

// Letter Head Products Data
export const LETTER_HEAD_PRODUCTS = [
    {
        paperType: "100 GSM",
        options: [
            {
                printType: "Single Side",
                pricePerPiece: 1.35,
                minQuantity: 1000,
                totalPrice: 1350,
                glueOption: "BINDING",
            },
            {
                printType: "Both Side",
                pricePerPiece: 1.50,
                minQuantity: 1000,
                totalPrice: 1500,
                glueOption: "ATTACH",
            },
            {
                printType: "Multi Color",
                pricePerPiece: 1.60,
                minQuantity: 5000,
                totalPrice: 8000,
                glueOption: null,
            },
        ],
    },
    {
        paperType: "80 GSM",
        options: [
            {
                printType: "Single Side",
                pricePerPiece: 1.20,
                minQuantity: 1000,
                totalPrice: 1200,
                glueOption: "BINDING",
            },
            {
                printType: "Both Side",
                pricePerPiece: 1.40,
                minQuantity: 1000,
                totalPrice: 1400,
                glueOption: "ATTACH",
            },
            {
                printType: "Multi Color",
                pricePerPiece: 1.50,
                minQuantity: 5000,
                totalPrice: 7500,
                glueOption: null,
            },
        ],
    },
];

// Binding Options
export const HARD_BINDING_PRICE = 50;

// Bill Book Products Data
export const BILL_BOOK_PRODUCTS = [
    {
        type: "Bill Book (Non-GST)",
        pricePerPiece: 0.95,
        minQuantity: 1000,
        totalPrice: 950,
        binding: "GLUE BINDING ATTACH",
    },
    {
        type: "GST Bill Book",
        pricePerPiece: 1.00,
        minQuantity: 1000,
        totalPrice: 1000,
        binding: "GLUE BINDING ATTACH",
    },
];

// Pamphlet (Poster) Products Data
export const PAMPHLET_PRODUCTS = [
    {
        description: "Single Color, 58 Gsm Paper",
        pricePerPiece: 0.33,
        minQuantity: 1000,
        totalPrice: 330,
    },
    {
        description: "Single Color, 70 Gsm Paper",
        pricePerPiece: 0.42,
        minQuantity: 1000,
        totalPrice: 420,
    },
    {
        description: "Single Color, 100 gsm Paper",
        pricePerPiece: 0.63,
        minQuantity: 1000,
        totalPrice: 630,
    },
    {
        description: "Multi color",
        pricePerPiece: 1.20,
        minQuantity: 5000,
        totalPrice: 6000,
    },
];

// Brochure Products Data
export const BROCHURE_PRODUCTS = [
    {
        paperSize: "Memo 5.5\" x 8.5\"",
        sizeDescription: "Half the size of Letter size, smallest brochure size",
        pricePerPiece: 1.50,
        minQuantity: 5000,
        totalPrice: 7500,
    },
    {
        paperSize: "A4",
        sizeDescription: "8.5\" x 11.5\". Most popular brochure size for product and service information, offering a perfectly balanced design area",
        pricePerPiece: 2.25,
        minQuantity: 5000,
        totalPrice: 11250,
    },
    {
        paperSize: "Legal 8.5\" x 14\"",
        sizeDescription: "Slightly larger paneled than Letter size. Recommended if a design seems tight in 8.5\" x 11\" to provide more white space and avoid a crowded look",
        pricePerPiece: 2.50,
        minQuantity: 5000,
        totalPrice: 12500,
    },
    {
        paperSize: "Tabloid 12\" x 18\"",
        sizeDescription: "Works best with large content areas and for creating multi-folded brochures",
        pricePerPiece: 3.50,
        minQuantity: 5000,
        totalPrice: 17500,
    },
];

// Brochure Fold Types
export const BROCHURE_FOLD_TYPES = [
    "The Half-Fold: Simple and Clear",
    "The Tri-Fold: Quick and Effective",
    "The Z-Fold: Storytelling Perfection",
    "The Accordion Fold: Unique and Luxurious",
    "The Gate-Fold: Interactive and Irresistible",
    "The Die-Cut Z-Fold: Quirky and Humorous",
];

// Map Products Data
export const MAP_PRODUCTS = [
    {
        paperSize: "A2",
        paperType: "80 Gsm",
        options: [
            {
                printType: "B/W",
                price: 45,
            },
            {
                printType: "Color",
                price: 90,
            },
        ],
        lamination: {
            type: "50 Micron",
            price: 50,
        },
    },
    {
        paperSize: "A1",
        paperType: "80 Gsm",
        options: [
            {
                printType: "B/W",
                price: 75,
                pricingType: "Standard Sheet",
            },
            {
                printType: "Color",
                price: 150,
                pricingType: "Standard Sheet",
            },
            {
                printType: "B/W",
                price: 100,
                pricingType: "Per Meter",
            },
            {
                printType: "Color",
                price: 200,
                pricingType: "Per Meter",
            },
        ],
        lamination: {
            type: "50 Micron",
            price: 120,
        },
    },
    {
        paperSize: "A0",
        paperType: "80 Gsm",
        options: [
            {
                printType: "B/W",
                price: 150,
                pricingType: "Standard Sheet",
            },
            {
                printType: "Color",
                price: 350,
                pricingType: "Standard Sheet",
            },
            {
                printType: "B/W",
                price: 200,
                pricingType: "Per Meter",
            },
            {
                printType: "Color",
                price: 400,
                pricingType: "Per Meter",
            },
        ],
        lamination: {
            type: "50 Micron",
            price: 180,
        },
    },
    {
        paperSize: "A0+",
        paperType: "80 Gsm",
        options: [
            {
                printType: "B/W",
                price: 200,
            },
            {
                printType: "Color",
                price: 500,
            },
        ],
        lamination: {
            type: "50 Micron",
            price: 200,
        },
    },
];

