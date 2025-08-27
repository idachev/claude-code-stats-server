/**
 * Application-wide constants
 */

/**
 * Pagination constants used across the admin dashboard
 */
export const PAGINATION = {
  /** Available page size options */
  PAGE_SIZES: [10, 20, 50, 100] as const,
  /** Default page size */
  DEFAULT_PAGE_SIZE: 20,
} as const;

// Type for page sizes
export type PageSize = (typeof PAGINATION.PAGE_SIZES)[number];
