/**
 * @fileoverview Global HTTP Error Handling Interceptor
 * 
 * This interceptor provides centralized error handling for HTTP requests with:
 * - Automatic retry logic for transient server errors (500, 502, 503, 504)
 * - Exponential backoff retry strategy to reduce server load
 * - Standardized error formatting for consistent user experience
 * - Comprehensive error logging for debugging
 * - Rate limit handling (429) without retries to respect API limits
 * 
 * The interceptor transforms HTTP errors into user-friendly ApiError objects
 * with appropriate messages and technical details for debugging.
 */

import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { retryWhen, concatMap } from 'rxjs/operators';

/**
 * Standardized API error interface for consistent error handling
 */
interface ApiError {
  statusCode: number;
  message: string;
  technicalDetails?: string;
}

/**
 * HTTP interceptor for centralized error handling and retry logic
 */
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  // Static constants for retry configuration
  private static readonly MAX_RETRIES = 3;
  private static readonly BASE_RETRY_DELAY = 1000; // 1 second base delay
  
  // HTTP status codes that should trigger automatic retry
  // NOTE: 429 (Rate Limit) is intentionally EXCLUDED to respect API limits
  private static readonly RETRYABLE_STATUS_CODES = [500, 502, 503, 504] as const;

  /**
   * Intercepts HTTP requests to provide error handling and retry logic
   * @param req HTTP request being processed
   * @param next HTTP handler for request processing
   * @returns Observable of HTTP events with error handling
   */
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      retryWhen(errors => 
        errors.pipe(
          concatMap((error: HttpErrorResponse, index: number) => {
            if (index < ErrorInterceptor.MAX_RETRIES && this.shouldRetry(error)) {
              const delay = this.calculateRetryDelay(index);
              console.warn(`Retrying request (attempt ${index + 1}/${ErrorInterceptor.MAX_RETRIES}) after ${delay}ms:`, error);
              return timer(delay);
            }
            
            // Max retries exceeded or non-retryable error
            return throwError(() => this.formatError(error));
          })
        )
      )
    );
  }

  /**
   * Determines if an HTTP error should trigger a retry
   * @param error HTTP error response to evaluate
   * @returns True if the error should be retried
   */
  private shouldRetry(error: HttpErrorResponse): boolean {
    return ErrorInterceptor.RETRYABLE_STATUS_CODES.includes(error.status as 500 | 502 | 503 | 504);
  }

  /**
   * Calculates retry delay using exponential backoff strategy
   * @param retryIndex Current retry attempt index (0-based)
   * @returns Delay in milliseconds before next retry
   */
  private calculateRetryDelay(retryIndex: number): number {
    // Exponential backoff: base_delay * 2^retry_index
    return ErrorInterceptor.BASE_RETRY_DELAY * Math.pow(2, retryIndex);
  }

  /**
   * Formats HTTP errors into standardized ApiError objects with user-friendly messages
   * @param error HTTP error response to format
   * @returns Formatted ApiError object
   */
  private formatError(error: HttpErrorResponse): ApiError {
    console.error('HTTP Error:', error);
    
    switch (error.status) {
      case 400:
        return this.createApiError(
          error.status,
          'No train formation data available. Please check your search parameters.',
          error
        );
        
      case 401:
        return this.createApiError(
          error.status,
          'Authentication failed. Please check your API key.',
          error
        );
        
      case 403:
        return this.createApiError(
          error.status,
          'Access to this API has been disallowed.',
          error
        );
        
      case 404:
        return this.createApiError(
          error.status,
          'Train formation data not found. The train might not exist for the specified date.',
          error
        );
        
      case 429:
        return this.createApiError(
          error.status,
          'Rate limit exceeded. Please wait 1 minute before trying again (maximum 5 requests per minute allowed).',
          error,
          'Rate Limit Exceeded'
        );
        
      case 500:
      case 502:
      case 503:
      case 504:
        return this.createApiError(
          error.status,
          'Server error occurred. The request has been automatically retried.',
          error
        );
        
      default:
        return this.createApiError(
          error.status || 500,
          'An unexpected error occurred. Please try again later.',
          error,
          error.message || 'Unknown error'
        );
    }
  }

  /**
   * Creates a standardized ApiError object
   * @param statusCode HTTP status code
   * @param message User-friendly error message
   * @param error Original HTTP error response
   * @param customTechnicalDetails Optional custom technical details
   * @returns Formatted ApiError object
   */
  private createApiError(
    statusCode: number,
    message: string,
    error: HttpErrorResponse,
    customTechnicalDetails?: string
  ): ApiError {
    return {
      statusCode,
      message,
      technicalDetails: customTechnicalDetails || `HTTP ${statusCode}: ${error.message}`
    };
  }
} 