import { HttpInterceptorFn } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, Injectable, computed, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router } from '@angular/router';
import { finalize } from 'rxjs';

/** Tracks route navigation and in-flight HTTP requests for the top loading bar. */
@Injectable({ providedIn: 'root' })
export class Loading {
  private readonly navigating = signal(false);
  private readonly requests = signal(0);
  readonly active = computed(() => this.navigating() || this.requests() > 0);

  constructor() {
    inject(Router).events.subscribe((e) => {
      if (e instanceof NavigationStart) this.navigating.set(true);
      else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError || e instanceof NavigationSkipped) {
        this.navigating.set(false);
      }
    });
  }

  requestStarted() { this.requests.update((n) => n + 1); }
  requestFinished() { this.requests.update((n) => Math.max(0, n - 1)); }
}

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(Loading);
  loading.requestStarted();
  return next(req).pipe(finalize(() => loading.requestFinished()));
};

@Component({
  selector: 'app-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading.active()) {
      <div class="top-bar" role="progressbar" aria-label="Loading" aria-busy="true"><span></span></div>
    }
  `,
})
export class TopBar {
  protected readonly loading = inject(Loading);
}
