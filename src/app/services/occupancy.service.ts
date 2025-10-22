/**
 * @fileoverview Train Occupancy Service SKI+ Train Occupancy Visualization
 * 
 * This service is responsible for:
 * - Loading pre-processed occupancy data from GitHub Pages
 * - Providing occupancy information for train formation visualization
 * - Managing cache and data updates with automatic expiration
 * - Handling operator code mapping and train number normalization
 * 
 * The service handles missing data gracefully and provides occupancy information
 * only when it's available, without generating errors for missing data.
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { formatDate } from '@angular/common';
import { 
  OperatorOccupancy, 
  TrainOccupancy, 
  FareClass,
  OCCUPANCY_VISUALIZATION
} from '../models/occupancy.model';

/**
 * Cache entry for occupancy data with timestamp
 */
interface OccupancyCache {
  data: OperatorOccupancy;
  timestamp: number;
}

/**
 * Core service for handling train occupancy data and visualization
 */
@Injectable({
  providedIn: 'root'
})
export class OccupancyService {
  // Static constants
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private static readonly MAX_FORECAST_DAYS = 3;
  
  // Operator code mapping to numeric IDs
  private static readonly OPERATOR_MAPPING: Readonly<Record<string, string>> = {
    '11': '11',   // SBB/SBBP
    '33': '33',   // BLS
    '65': '65',   // Südostbahn
    '82': '82',   // Zentralbahn
    'SBBP': '11',
    'BLS': '33',
    'SOB': '65',
    'ZB': '82'
  };

  // State management
  private readonly cache = new Map<string, OccupancyCache>();
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  readonly loading$ = this.loadingSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Gets occupancy data for a specific train and operator
   * @param operatorId Operator ID (e.g. "11" for SBB or "SBBP")
   * @param trainNumber Train number as string
   * @param date Operation date (string or Date object)
   * @returns Observable with occupancy data or null if not available
   */
  getTrainOccupancy(
    operatorId: string,
    trainNumber: string,
    date: string | Date
  ): Observable<TrainOccupancy | null> {
    // Map operator code to numeric ID
    const numericOperatorId = OccupancyService.OPERATOR_MAPPING[operatorId];
    if (!numericOperatorId) {
      console.debug('Occupancy data not available for operator:', operatorId);
      return of(null);
    }

    const formattedDate = this.formatDate(date);
    
    // Validate date range
    if (!this.isDateValid(formattedDate)) {
      console.debug('Occupancy data not available for date:', formattedDate);
      return of(null);
    }

    // Check cache first
    const cacheKey = this.getCacheKey(numericOperatorId, formattedDate);
    const cachedData = this.cache.get(cacheKey);
    
    if (cachedData && this.isCacheValid(cachedData.timestamp)) {
      return of(this.findTrainOccupancy(cachedData.data, trainNumber));
    }

    // Load data if not in cache or cache is expired
    return this.loadOccupancyData(numericOperatorId, formattedDate, trainNumber, cacheKey);
  }

  /**
   * Gets occupancy visualization data for a specific class and section
   * @param trainOccupancy Train occupancy data
   * @param fareClass Fare class to check
   * @param fromStation Departure station name
   * @param toStation Destination station name
   * @returns Occupancy visualization data or null if not available
   */
  getOccupancyVisualization(
    trainOccupancy: TrainOccupancy | null,
    fareClass: FareClass,
    fromStation: string,
    toStation: string
  ) {
    if (!trainOccupancy) {
      return null;
    }

    try {
      // Find matching section
      const section = trainOccupancy.sections.find(s => 
        s.departureStationName === fromStation && 
        s.destinationStationName === toStation
      );

      if (!section) {
        return null;
      }

      // Find occupancy for the specified class
      const occupancy = section.expectedDepartureOccupancies.find(o => 
        o.fareClass === fareClass
      );

      if (!occupancy) {
        return null;
      }

      return OCCUPANCY_VISUALIZATION[occupancy.occupancyLevel];
    } catch (error) {
      console.debug('Error processing occupancy data:', error);
      return null;
    }
  }

  /**
   * Gets current loading state
   * @returns Current loading state
   */
  isLoading(): boolean {
    return this.loadingSubject.value;
  }

  /**
   * Formats date to required string format
   * @param date Date as string or Date object
   * @returns Formatted date string (yyyy-MM-dd)
   */
  private formatDate(date: string | Date): string {
    return typeof date === 'string' ? date : formatDate(date, 'yyyy-MM-dd', 'en-US');
  }

  /**
   * Loads occupancy data from API and handles caching
   * @param operatorId Numeric operator ID
   * @param formattedDate Formatted date string
   * @param trainNumber Train number to find
   * @param cacheKey Cache key for storing data
   * @returns Observable with occupancy data
   */
  private loadOccupancyData(
    operatorId: string,
    formattedDate: string,
    trainNumber: string,
    cacheKey: string
  ): Observable<TrainOccupancy | null> {
    this.loadingSubject.next(true);
    
    const dataUrl = `https://opentdatach.github.io/data/occupancy-forecast-json-dataset/${formattedDate}/operator-${operatorId}.json`;
    
    return this.http.get<OperatorOccupancy>(dataUrl).pipe(
      map(data => {
        this.cacheOccupancyData(cacheKey, data);
        return this.findTrainOccupancy(data, trainNumber);
      }),
      catchError(error => this.handleLoadError(error, operatorId, formattedDate)),
      tap(() => this.loadingSubject.next(false))
    );
  }

  /**
   * Caches occupancy data with current timestamp
   * @param cacheKey Key for cache storage
   * @param data Occupancy data to cache
   */
  private cacheOccupancyData(cacheKey: string, data: OperatorOccupancy): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Handles errors during data loading
   * @param error HTTP error object
   * @param operatorId Operator ID for logging
   * @param formattedDate Date for logging
   * @returns Observable that emits null
   */
  private handleLoadError(error: unknown, operatorId: string, formattedDate: string): Observable<null> {
    const hasStatus404 = (error as { statusCode?: number; status?: number }).statusCode === 404 || 
                         (error as { statusCode?: number; status?: number }).status === 404;
                         
    if (hasStatus404) {
      console.debug('No occupancy data available for:', { operatorId, date: formattedDate });
    } else {
      console.warn('Error fetching occupancy data:', error);
    }
    return of(null);
  }

  /**
   * Validates if a date is within the allowed range for occupancy data
   * @param date Date string to check
   * @returns True if date is valid for occupancy data
   */
  private isDateValid(date: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const checkDate = new Date(date);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + OccupancyService.MAX_FORECAST_DAYS);
    
    return checkDate >= today && checkDate <= maxDate;
  }

  /**
   * Generates a cache key for occupancy data
   * @param operatorId Operator ID
   * @param date Operation date
   * @returns Cache key string
   */
  private getCacheKey(operatorId: string, date: string): string {
    return `${operatorId}_${date}`;
  }

  /**
   * Checks if cached data is still valid based on timestamp
   * @param timestamp Cache timestamp to check
   * @returns True if cache is still valid
   */
  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < OccupancyService.CACHE_DURATION;
  }

  /**
   * Finds occupancy data for a specific train within operator data
   * @param data Operator occupancy data
   * @param trainNumber Train number to find
   * @returns Train occupancy data or null if not found
   */
  private findTrainOccupancy(
    data: OperatorOccupancy,
    trainNumber: string
  ): TrainOccupancy | null {
    try {
      const normalizedSearchNumber = this.normalizeTrainNumber(trainNumber);
      return data.trains.find(train => 
        this.normalizeTrainNumber(train.trainNumber) === normalizedSearchNumber
      ) || null;
    } catch (error) {
      console.debug('Error finding train occupancy:', error);
      return null;
    }
  }

  /**
   * Normalizes train number by removing prefixes and leading zeros
   * 
   * This ensures consistent comparison by converting train numbers like:
   * - "IC 123" → "123"
   * - "IR 0456" → "456"
   * - "S 01" → "1"
   * 
   * @param trainNumber Train number to normalize
   * @returns Normalized train number string
   */
  private normalizeTrainNumber(trainNumber: string): string {
    try {
      // Remove any non-numeric prefix (e.g., "IC", "IR", "S")
      const numericPart = trainNumber.replace(/^[A-Za-z\s]+/, '');
      
      // Remove leading zeros and convert to string
      return parseInt(numericPart, 10).toString();
    } catch (error) {
      console.debug('Error normalizing train number:', error);
      return trainNumber; // Return original if normalization fails
    }
  }
} 