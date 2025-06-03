/**
 * @fileoverview Search Form Component for Train Formation Lookup
 * 
 * This component provides the main interface for searching train formations.
 * Key features include:
 * - Reactive form with validation for operator, date, and train number inputs
 * - Integration with SBB Angular UI components for consistent design
 * - Automatic scrolling to results after successful search
 * - Loading state management and error handling
 * - Date range validation (today to +3 days for forecast data)
 * 
 * The component communicates with FormationService to fetch train formation data
 * from the OpenTransportData.swiss API and uses ScrollService for smooth navigation.
 */

import { Component, OnInit, OnDestroy, ViewChild, ElementRef, Inject, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule, formatDate } from '@angular/common';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

// SBB Angular components
import { SbbButtonModule } from '@sbb-esta/angular/button';
import { SbbFormFieldModule } from '@sbb-esta/angular/form-field';
import { SbbInputModule } from '@sbb-esta/angular/input';
import { SbbSelectModule } from '@sbb-esta/angular/select';
import { SbbDatepickerModule } from '@sbb-esta/angular/datepicker';
import { SbbIconModule } from '@sbb-esta/angular/icon';
import { SbbTooltipModule } from '@sbb-esta/angular/tooltip';

// Application services and models
import { FormationService } from '../../services/formation.service';
import { ScrollService } from '../../services/scroll.service';
import { SearchParams } from '../../models/formation.model';
import { AppComponent } from '../../app.component';

/**
 * Railway operator option for dropdown selection
 */
interface EvuOption {
  value: string;
  label: string;
}

/**
 * Search form component for train formation lookup
 */
@Component({
  selector: 'app-search-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    SbbButtonModule,
    SbbFormFieldModule,
    SbbInputModule,
    SbbSelectModule,
    SbbDatepickerModule,
    SbbIconModule,
    SbbTooltipModule
  ],
  templateUrl: './search-form.component.html',
  styleUrl: './search-form.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class SearchFormComponent implements OnInit, OnDestroy {
  // Static constants
  private static readonly MAX_FORECAST_DAYS = 3;
  private static readonly DEFAULT_TRAIN_NUMBER = '2167';
  private static readonly DEFAULT_OPERATOR = 'SBBP';
  private static readonly DATE_FORMAT = 'yyyy-MM-dd';
  private static readonly LOCALE = 'en-US';
  
  // Available railway operators for selection
  private static readonly EVU_OPTIONS: readonly EvuOption[] = [
    { value: 'BLSP', label: 'BLS' },
    { value: 'SBBP', label: 'SBB' },
    { value: 'MBC', label: 'MBC' },
    { value: 'OeBB', label: 'OeBB' },
    { value: 'RhB', label: 'RhB' },
    { value: 'SOB', label: 'SOB' },
    { value: 'THURBO', label: 'THURBO' },
    { value: 'TPF', label: 'TPF' },
    { value: 'TRN', label: 'TRN' },
    { value: 'VDBB', label: 'VDBB' },
    { value: 'ZB', label: 'ZB' }
  ] as const;

  // Template references
  @ViewChild('searchFormContent', { static: false }) searchFormContent?: ElementRef;
  
  // Public properties for template
  readonly evuOptions = SearchFormComponent.EVU_OPTIONS;
  readonly minDate = new Date();
  readonly maxDate = this.calculateMaxDate();
  
  // Form and state management
  searchForm!: FormGroup;
  loading = false;
  
  // Private state tracking
  private readonly subscriptions: Subscription[] = [];
  private trainFormationReady = false;
  private hasError = false;

  constructor(
    private fb: FormBuilder,
    private formationService: FormationService,
    private scrollService: ScrollService,
    @Inject(AppComponent) private appComponent: AppComponent
  ) {}

  /**
   * Initializes the component, sets up the form, and subscribes to service updates
   */
  ngOnInit(): void {
    this.initializeForm();
    this.subscribeToServiceUpdates();
  }

  /**
   * Cleanup method to prevent memory leaks
   */
  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  /**
   * Handles form submission and initiates train formation search
   */
  onSearch(): void {
    if (!this.searchForm.valid) {
      return;
    }

    const formValue = this.searchForm.value;
    const params = this.createSearchParams(formValue);
    
    this.executeSearch(params);
  }

  /**
   * Calculates the maximum allowed date for the datepicker
   * @returns Date object representing today + MAX_FORECAST_DAYS
   */
  private calculateMaxDate(): Date {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + SearchFormComponent.MAX_FORECAST_DAYS);
    return maxDate;
  }

  /**
   * Initializes the reactive form with default values and validation
   */
  private initializeForm(): void {
    const todayFormatted = formatDate(
      this.minDate, 
      SearchFormComponent.DATE_FORMAT, 
      SearchFormComponent.LOCALE
    );
    
    this.searchForm = this.fb.group({
      evu: [SearchFormComponent.DEFAULT_OPERATOR, Validators.required],
      operationDate: [todayFormatted, Validators.required],
      trainNumber: [
        SearchFormComponent.DEFAULT_TRAIN_NUMBER, 
        [Validators.required, Validators.pattern('[0-9]*')]
      ]
    });
  }

  /**
   * Sets up subscriptions to formation service observables
   */
  private subscribeToServiceUpdates(): void {
    // Monitor loading state for UI updates
    this.subscriptions.push(
      this.formationService.loading$.subscribe(isLoading => {
        this.loading = isLoading;
        this.handleLoadingComplete(isLoading);
      })
    );
    
    // Monitor formation data availability
    this.subscriptions.push(
      this.formationService.currentFormation$.subscribe(formation => {
        this.trainFormationReady = formation !== null;
      })
    );
    
    // Monitor error state
    this.subscriptions.push(
      this.formationService.currentError$.subscribe(error => {
        this.hasError = error !== null;
      })
    );
  }

  /**
   * Handles loading completion and triggers scroll if successful
   * @param isLoading Current loading state
   */
  private handleLoadingComplete(isLoading: boolean): void {
    if (!isLoading && this.trainFormationReady && !this.hasError) {
      this.scrollToTrainFormation();
      this.trainFormationReady = false; // Reset for next search
    }
  }

  /**
   * Creates SearchParams object from form values
   * @param formValue Form values from the reactive form
   * @returns Formatted SearchParams object
   */
  private createSearchParams(formValue: {
    evu: string;
    operationDate: string | Date;
    trainNumber: string;
  }): SearchParams {
    return {
      evu: formValue.evu,
      operationDate: formatDate(
        formValue.operationDate, 
        SearchFormComponent.DATE_FORMAT, 
        SearchFormComponent.LOCALE
      ),
      trainNumber: formValue.trainNumber,
      includeOperationalStops: false
    };
  }

  /**
   * Executes the search request with error handling
   * @param params Search parameters for the API request
   */
  private executeSearch(params: SearchParams): void {
    this.loading = true;
    
    this.formationService.getFormation(params)
      .pipe(
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: () => {
          this.hasError = false;
          this.trainFormationReady = true;
        },
        error: () => {
          this.hasError = true;
          this.trainFormationReady = false;
        }
      });
  }

  /**
   * Scrolls to the train formation component after successful search
   * Waits for spacing calculations to complete before scrolling
   */
  private scrollToTrainFormation(): void {
    this.appComponent.getSpacingReadyState().subscribe(isReady => {
      if (!isReady) {
        return;
      }
      
      const trainFormation = document.querySelector('app-train-formation');
      if (trainFormation) {
        this.scrollService.scrollToAnchor(trainFormation);
      }
    });
  }
}
