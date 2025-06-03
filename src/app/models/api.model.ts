/**
 * @fileoverview Shared API models and interfaces
 */

export interface ApiError {
  statusCode: number;
  message: string;
  technicalDetails?: string;
} 