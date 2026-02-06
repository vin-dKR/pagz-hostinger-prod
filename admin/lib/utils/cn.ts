/**
 * Utility function to merge Tailwind CSS classes
 * Uses clsx and tailwind-merge for optimal class merging
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

