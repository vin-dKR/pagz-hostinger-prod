import { prisma } from "../services/prisma.js";

export const checkDatabaseConnection = async (retries = 3): Promise<boolean> => {
    for (let i = 0; i < retries; i++) {
        try {
            await prisma.$queryRaw`SELECT 1`;
            return true;
        } catch (error: any) {
            if (i === retries - 1) {
                console.error(`DB connection check failed after ${retries} attempts:`, error.message);
                return false;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    return false;
};

/**
 * Normalize Express route parameter to string
 * Express params can be string | string[] | undefined, but we need string
 */
export function getParamAsString(
    param: string | string[] | undefined,
    paramName: string = "parameter"
): string {
    if (!param) {
        throw new Error(`${paramName} is required`);
    }
    if (Array.isArray(param)) {
        if (param.length === 0 || !param[0]) {
            throw new Error(`${paramName} is required`);
        }
        return param[0];
    }
    return param;
}
