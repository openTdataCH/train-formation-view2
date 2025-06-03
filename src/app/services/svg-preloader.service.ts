/**
 * @fileoverview SVG Asset Preloader Service
 * 
 * This service handles preloading of theme-dependent SVG assets to optimize performance
 * during theme transitions. It provides:
 * - Batch preloading of all SVG assets for both light and dark themes
 * - Individual SVG preloading with promise-based tracking
 * - Cache management to prevent duplicate loading
 * - Preload status monitoring and statistics
 * 
 * The service should be initialized early in the application lifecycle to ensure
 * smooth theme switching without visual delays.
 */

import { Injectable } from '@angular/core';

/**
 * Preload status information
 */
interface PreloadStatus {
  total: number;
  loaded: number;
  percentage: number;
}

/**
 * Core service for SVG asset preloading and cache management
 */
@Injectable({
  providedIn: 'root'
})
export class SvgPreloaderService {
  // Static constants for SVG categories and themes
  private static readonly THEMES = ['light', 'dark'] as const;
  
  private static readonly WAGON_TYPES = [
    'locomotive',
    'wagon-regular',
    'wagon-left-slope', 
    'wagon-right-slope',
    'wagon-both-slope',
    'wagon-regular-closed',
    'wagon-left-slope-closed',
    'wagon-right-slope-closed', 
    'wagon-both-slope-closed'
  ] as const;

  private static readonly ICON_TYPES = [
    'no-passage',
    'low-floor-entry',
    'entry-with-steps',
    'low-occupancy',
    'middle-occupancy',
    'high-occupancy'
  ] as const;

  private static readonly SECTORS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'] as const;

  private static readonly PICTOGRAMS = [
    'wheelchair.svg',
    'bike-hooks.svg', 
    'bike-hooks-reservation.svg',
    'business.svg',
    'family-zone.svg',
    'luggage.svg',
    'restaurant.svg',
    'sleep.svg',
    'couchette.svg',
    'stroller.svg'
  ] as const;

  // Asset path templates
  private static readonly ASSET_PATHS = {
    WAGONS: 'assets/wagons',
    ICONS: 'assets/icons',
    PICTOS: 'assets/pictos'
  } as const;

  // State management
  private readonly preloadedImages = new Set<string>();
  private readonly preloadPromises = new Map<string, Promise<void>>();

  constructor() {
    // Service initialized
  }

  /**
   * Preloads all theme-dependent SVG files for both light and dark modes
   * 
   * This method should be called early in the application lifecycle,
   * preferably during app initialization or in the main component constructor.
   * 
   * @returns Promise that resolves when all SVGs are loaded
   */
  preloadAllSvgs(): Promise<void[]> {
    const svgPaths = this.getAllSvgPaths();
    const promises = svgPaths.map(path => this.preloadSvg(path));
    return Promise.all(promises);
  }

  /**
   * Checks if a specific SVG has been preloaded
   * @param path Path to the SVG file to check
   * @returns True if the SVG is already preloaded
   */
  isPreloaded(path: string): boolean {
    return this.preloadedImages.has(path);
  }

  /**
   * Gets comprehensive preload status and statistics
   * @returns Object containing preload progress information
   */
  getPreloadStatus(): PreloadStatus {
    const total = this.getAllSvgPaths().length;
    const loaded = this.preloadedImages.size;
    const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;
    
    return { total, loaded, percentage };
  }

  /**
   * Preloads a single SVG file with promise tracking
   * 
   * This method handles duplicate requests gracefully by returning the existing
   * promise if the same file is already being loaded.
   * 
   * @param path Path to the SVG file
   * @returns Promise that resolves when the image is loaded
   */
  private preloadSvg(path: string): Promise<void> {
    // Return existing promise if already preloading
    if (this.preloadPromises.has(path)) {
      return this.preloadPromises.get(path)!;
    }

    // Return immediately if already preloaded
    if (this.preloadedImages.has(path)) {
      return Promise.resolve();
    }

    const promise = this.createPreloadPromise(path);
    this.preloadPromises.set(path, promise);
    return promise;
  }

  /**
   * Creates a promise for preloading a specific SVG file
   * @param path Path to the SVG file
   * @returns Promise that resolves when loading completes
   */
  private createPreloadPromise(path: string): Promise<void> {
    return new Promise<void>((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        this.handleSuccessfulLoad(path);
        resolve();
      };
      
      img.onerror = () => {
        this.handleLoadError(path);
        resolve(); // Don't reject to avoid breaking the entire preload process
      };
      
      img.src = path;
    });
  }

  /**
   * Handles successful SVG loading
   * @param path Path of the successfully loaded SVG
   */
  private handleSuccessfulLoad(path: string): void {
    this.preloadedImages.add(path);
    this.preloadPromises.delete(path);
  }

  /**
   * Handles SVG loading errors
   * @param path Path of the SVG that failed to load
   */
  private handleLoadError(path: string): void {
    this.preloadPromises.delete(path);
    console.warn(`Failed to preload SVG: ${path}`);
  }

  /**
   * Generates all SVG paths that need to be preloaded for both themes
   * @returns Array of all SVG file paths
   */
  private getAllSvgPaths(): string[] {
    return [
      ...this.getWagonSvgPaths(),
      ...this.getIconSvgPaths(),
      ...this.getSectorSvgPaths(),
      ...this.getPictogramSvgPaths()
    ];
  }

  /**
   * Generates paths for wagon SVG files (theme-dependent)
   * @returns Array of wagon SVG paths
   */
  private getWagonSvgPaths(): string[] {
    const paths: string[] = [];
    
    SvgPreloaderService.THEMES.forEach(theme => {
      SvgPreloaderService.WAGON_TYPES.forEach(type => {
        paths.push(`${SvgPreloaderService.ASSET_PATHS.WAGONS}/${type}-${theme}.svg`);
      });
    });

    return paths;
  }

  /**
   * Generates paths for icon SVG files (theme-dependent)
   * @returns Array of icon SVG paths
   */
  private getIconSvgPaths(): string[] {
    const paths: string[] = [];
    
    SvgPreloaderService.THEMES.forEach(theme => {
      SvgPreloaderService.ICON_TYPES.forEach(type => {
        paths.push(`${SvgPreloaderService.ASSET_PATHS.ICONS}/${type}-${theme}.svg`);
      });
    });

    return paths;
  }

  /**
   * Generates paths for sector SVG files (theme-independent)
   * @returns Array of sector SVG paths
   */
  private getSectorSvgPaths(): string[] {
    return SvgPreloaderService.SECTORS.map(sector => 
      `${SvgPreloaderService.ASSET_PATHS.PICTOS}/sector-${sector}.svg`
    );
  }

  /**
   * Generates paths for pictogram SVG files (theme-independent)
   * @returns Array of pictogram SVG paths
   */
  private getPictogramSvgPaths(): string[] {
    return SvgPreloaderService.PICTOGRAMS.map(pictogram => 
      `${SvgPreloaderService.ASSET_PATHS.PICTOS}/${pictogram}`
    );
  }
} 