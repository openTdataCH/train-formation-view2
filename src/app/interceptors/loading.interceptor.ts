/**
 * @fileoverview Global Loading State HTTP Interceptor
 * 
 * This interceptor provides centralized loading state management for HTTP requests.
 * It automatically manages a global loading indicator by:
 * - Incrementing loading counter when requests start
 * - Decrementing loading counter when requests complete (success or error)
 * - Exposing a reactive loading state observable for UI components
 * - Ensuring loading state never goes below zero through safe counter management
 * 
 * Components can inject GlobalLoadingService to access the loading state.
 */

import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { finalize } from 'rxjs/operators';

/**
 * HTTP interceptor for managing global loading state
 */
@Injectable({
  providedIn: 'root'
})
export class LoadingInterceptor implements HttpInterceptor {
  // State management
  private loadingCount = 0;
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  
  /** Observable that emits the current global loading state */
  readonly loading$ = this.loadingSubject.asObservable();

  /**
   * Intercepts HTTP requests to manage loading state
   * @param req HTTP request being processed
   * @param next HTTP handler for request processing
   * @returns Observable of HTTP events with loading state management
   */
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    this.incrementLoading();

    return next.handle(req).pipe(
      finalize(() => {
        // Always decrement loading counter when request completes (success or error)
        this.decrementLoading();
      })
    );
  }

  /**
   * Gets the current loading state synchronously
   * @returns Current loading state
   */
  isLoading(): boolean {
    return this.loadingSubject.value;
  }

  /**
   * Increments the loading counter and updates the loading state
   * This method is called when a new HTTP request starts
   */
  private incrementLoading(): void {
    this.loadingCount++;
    this.updateLoadingState();
  }

  /**
   * Decrements the loading counter and updates the loading state
   * Uses Math.max to ensure counter never goes below zero
   */
  private decrementLoading(): void {
    this.loadingCount = Math.max(0, this.loadingCount - 1);
    this.updateLoadingState();
  }

  /**
   * Updates the loading state based on the current loading counter
   * Only emits new values when the state actually changes to prevent unnecessary updates
   */
  private updateLoadingState(): void {
    const isLoading = this.loadingCount > 0;
    
    if (this.loadingSubject.value !== isLoading) {
      this.loadingSubject.next(isLoading);
    }
  }
} 