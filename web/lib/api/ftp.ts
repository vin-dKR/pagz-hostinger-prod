/**
 * FTP Upload API functions
 */

import { getAuthToken } from '../api-client';
import { ApiResponse } from '../api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

export interface FTPUploadResult {
    remotePath: string;
    remoteFileName: string;
    publicUrl: string;
    size: number;
    mimetype: string;
    originalName: string;
}

export interface FTPUploadResponse {
    remotePath: string;
    remoteFileName: string;
    publicUrl: string;
    size: number;
    mimetype: string;
    originalName: string;
}

export interface FTPMultipleUploadResponse {
    files: FTPUploadResult[];
    count: number;
}

/**
 * Upload a single file to FTP server
 */
export async function uploadFileToFTP(
    file: File,
    subDir?: string,
    fileName?: string
): Promise<ApiResponse<FTPUploadResponse>> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (subDir) {
        formData.append('subDir', subDir);
    }
    
    if (fileName) {
        formData.append('fileName', fileName);
    }

    const token = getAuthToken();
    const headers: Record<string, string> = {};
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/ftp/upload`, {
        method: 'POST',
        headers,
        body: formData,
    });

    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
        data = await response.json();
    } else {
        const text = await response.text();
        data = {
            error: text || 'An error occurred',
            message: `Server returned ${response.status}: ${response.statusText}`,
        };
    }

    if (!response.ok) {
        throw {
            message: data.message || data.error || 'An error occurred',
            statusCode: response.status,
            errors: data.errors,
        };
    }

    return data;
}

/**
 * Upload multiple files to FTP server
 */
export async function uploadMultipleFilesToFTP(
    files: File[],
    subDir?: string
): Promise<ApiResponse<FTPMultipleUploadResponse>> {
    const formData = new FormData();
    
    files.forEach(file => {
        formData.append('files', file);
    });
    
    if (subDir) {
        formData.append('subDir', subDir);
    }

    const token = getAuthToken();
    const headers: Record<string, string> = {};
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/ftp/upload-multiple`, {
        method: 'POST',
        headers,
        body: formData,
    });

    const contentType = response.headers.get('content-type');
    let data;

    if (contentType && contentType.includes('application/json')) {
        data = await response.json();
    } else {
        const text = await response.text();
        data = {
            error: text || 'An error occurred',
            message: `Server returned ${response.status}: ${response.statusText}`,
        };
    }

    if (!response.ok) {
        throw {
            message: data.message || data.error || 'An error occurred',
            statusCode: response.status,
            errors: data.errors,
        };
    }

    return data;
}

/**
 * Test FTP connection
 */
export async function testFTPConnection(): Promise<ApiResponse<{ connected: boolean; message: string }>> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/ftp/test`, {
        method: 'GET',
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw {
            message: data.message || data.error || 'An error occurred',
            statusCode: response.status,
        };
    }

    return data;
}

/**
 * List files in FTP directory
 */
export async function listFTPFiles(subDir?: string): Promise<ApiResponse<{ files: string[]; count: number; directory: string }>> {
    const token = getAuthToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const url = subDir 
        ? `${API_BASE_URL}/ftp/list?subDir=${encodeURIComponent(subDir)}`
        : `${API_BASE_URL}/ftp/list`;

    const response = await fetch(url, {
        method: 'GET',
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw {
            message: data.message || data.error || 'An error occurred',
            statusCode: response.status,
        };
    }

    return data;
}
