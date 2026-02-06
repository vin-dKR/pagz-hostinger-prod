export type PageBasedPrice = { pages: string; price: number };

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

