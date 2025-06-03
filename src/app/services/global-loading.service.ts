/**
 * @fileoverview Global Loading Service
 * 
 * Provides access to the global loading state managed by the LoadingInterceptor.
 * Components can inject this service to observe loading states across all HTTP requests.
 */

import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { LoadingInterceptor } from '../interceptors/loading.interceptor';

@Injectable({
  providedIn: 'root'
})
export class GlobalLoadingService {
  private loadingInterceptor: LoadingInterceptor;

  constructor(private injector: Injector) {
    // Get the LoadingInterceptor instance
    this.loadingInterceptor = this.injector.get(LoadingInterceptor);
  }

  /**
   * Observable that emits the current global loading state
   */
  get loading$(): Observable<boolean> {
    return this.loadingInterceptor.loading$;
  }

  /**
   * Gets the current loading state synchronously
   */
  isLoading(): boolean {
    return this.loadingInterceptor.isLoading();
  }
} 