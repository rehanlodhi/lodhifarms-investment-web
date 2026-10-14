import { computed, signal } from '@angular/core';
import { Observable, defer, finalize } from 'rxjs';

/** Tracks which async actions are running so their buttons can show a spinner and disable themselves. */
export class Pending {
  private readonly keys = signal<ReadonlySet<string>>(new Set());
  readonly any = computed(() => this.keys().size > 0);

  has(key: string) { return this.keys().has(key); }

  track<T>(key: string, source: Observable<T>): Observable<T> {
    return defer(() => {
      this.keys.update((s) => new Set(s).add(key));
      return source.pipe(
        finalize(() => this.keys.update((s) => { const next = new Set(s); next.delete(key); return next; })),
      );
    });
  }
}
