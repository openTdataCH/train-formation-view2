/**
 * @fileoverview Authentication Interceptor for OpenTransportData API
 * 
 * Automatically adds Authorization Bearer token to requests targeting
 * the OpenTransportData API endpoints.
 */

import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly API_BASE_URL = 'https://api.opentransportdata.swiss';

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Only add auth header for OpenTransportData API requests
    if (req.url.startsWith(this.API_BASE_URL)) {
      const authReq = req.clone({
        setHeaders: {
          'Authorization': `Bearer ${environment.apiKey}`
        }
      });
      return next.handle(authReq);
    }

    // Pass through other requests unchanged
    return next.handle(req);
  }
} 