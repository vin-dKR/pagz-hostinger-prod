/**
 * Database query retry utility
 * Retries database queries on connection/timeout errors
 */

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Start with 1 second

/**
 * Retry a database query with exponential backoff
 * @param queryFn - Function that returns a Promise (the database query)
 * @param retries - Number of retries (default: 3)
 * @returns Promise with the query result
 */
export async function retryQuery<T>(
    queryFn: () => Promise<T>,
    retries: number = MAX_RETRIES
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await queryFn();
        } catch (error: any) {
            lastError = error;
            const errorMessage = error?.message || "";

            // Only retry on connection/timeout errors
            const isRetryableError =
                errorMessage.includes("timeout") ||
                errorMessage.includes("Connection") ||
                errorMessage.includes("ECONNREFUSED") ||
                errorMessage.includes("ENOTFOUND") ||
                errorMessage.includes("ETIMEDOUT");

            if (!isRetryableError || attempt === retries - 1) {
                // Don't retry non-connection errors or if this is the last attempt
                throw error;
            }

            // Exponential backoff: 1s, 2s, 4s
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
            console.warn(
                `Database query failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms...`,
                errorMessage
            );

            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error("Database query failed after retries");
}

