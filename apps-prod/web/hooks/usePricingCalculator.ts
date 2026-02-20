import { useState, useCallback, useMemo } from 'react';
import { ProductSelection, PricingCalculation } from '@/types';
import {
    getPaperOptions,
    getBindingOptions,
    getLaminationOptions
} from '@/constant/services/pdf-printing'

export const usePricingCalculator = () => {
    const [selection, setSelection] = useState<ProductSelection>({
        paperSize: 'A4',
        paperType: '70 Gsm',
        colorType: 'bwSingle',
        bindingType: undefined,
        bindingPages: undefined,
        laminationSize: undefined,
        laminationType: undefined,
        quantity: 1,
    });

    const paperOptions = useMemo(() =>
        getPaperOptions(selection.paperSize),
        [selection.paperSize]
    );

    const bindingOptions = useMemo(() =>
        getBindingOptions(selection.paperSize),
        [selection.paperSize]
    );

    const laminationOptions = useMemo(() =>
        getLaminationOptions(selection.paperSize),
        [selection.paperSize]
    );

    const calculatePrice = useCallback((): PricingCalculation => {
        // Get selected paper pricing
        const selectedPaper = paperOptions.find(p => p.paperType === selection.paperType);
        if (!selectedPaper) {
            return {
                basePrintPrice: 0,
                bindingPrice: 0,
                laminationPrice: 0,
                totalPrice: 0,
                quantity: selection.quantity,
                pricePerUnit: 0,
            };
        }

        const basePrice = selectedPaper.prices[selection.colorType];
        const basePrintPrice = basePrice * selection.quantity;

        // Calculate binding price
        let bindingPrice = 0;
        if (selection.bindingType) {
            const selectedBinding = bindingOptions.find(b => b.type === selection.bindingType);
            if (selectedBinding && selection.bindingPages) {
                const bindingPriceObj = selectedBinding.prices.find(p =>
                    'pages' in p ? p.pages === selection.bindingPages : p.type === selection.bindingPages
                );
                if (bindingPriceObj) {
                    bindingPrice = 'price' in bindingPriceObj ? bindingPriceObj.price : 0;
                }
            }
        }

        // Calculate lamination price
        let laminationPrice = 0;
        if (selection.laminationType) {
            const selectedLamination = laminationOptions.find(l => l.type === selection.laminationType);
            if (selectedLamination) {
                laminationPrice = selectedLamination.price * selection.quantity;
            }
        }

        const totalPrice = basePrintPrice + bindingPrice + laminationPrice;
        const pricePerUnit = totalPrice / selection.quantity;

        return {
            basePrintPrice,
            bindingPrice,
            laminationPrice,
            totalPrice,
            quantity: selection.quantity,
            pricePerUnit,
        };
    }, [selection, paperOptions, bindingOptions, laminationOptions]);

    const updateSelection = useCallback(<K extends keyof ProductSelection>(
        key: K,
        value: ProductSelection[K]
    ) => {
        setSelection(prev => {
            // If changing paper size, reset dependent options
            if (key === 'paperSize') {
                const newSize = value as 'A4' | 'A3';
                const newPaperOptions = getPaperOptions(newSize);
                const newBindingOptions = getBindingOptions(newSize);
                const newLaminationOptions = getLaminationOptions(newSize);

                return {
                    ...prev,
                    paperSize: newSize,
                    paperType: newPaperOptions[0]?.paperType || '70 Gsm',
                    bindingType: undefined,
                    bindingPages: undefined,
                    laminationType: newLaminationOptions[0]?.type,
                    [key]: value,
                };
            }

            // If changing paper type or color type, keep other selections
            return { ...prev, [key]: value };
        });
    }, []);

    const pricing = useMemo(() => calculatePrice(), [calculatePrice]);

    return {
        selection,
        paperOptions,
        bindingOptions,
        laminationOptions,
        pricing,
        updateSelection,
    };
};
