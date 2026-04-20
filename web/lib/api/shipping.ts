import { get, type ApiResponse } from '../api-client';

export interface ShippingMethod {
    id: string;
    name: string;
    description?: string | null;
    price: number;
    estimatedDays?: string | null;
    icon?: string | null;
    iconColor?: string | null;
    isDefault: boolean;
    displayOrder: number;
}

export interface ShippingMethodListResponse {
    methods: ShippingMethod[];
}

export async function getShippingMethods(): Promise<ApiResponse<ShippingMethodListResponse>> {
    return get<ShippingMethodListResponse>('/shipping-methods');
}
