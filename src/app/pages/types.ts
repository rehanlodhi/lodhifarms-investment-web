import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../core/api';
import { Collapsible } from '../core/collapsible';
import { InvestmentType } from '../core/models';
import { Pending } from '../core/pending';

@Component({
  selector: 'app-types',
  imports: [ReactiveFormsModule, CurrencyPipe, Collapsible],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Investment types</h1>
    <app-collapsible [title]="editing() ? 'Edit type' : 'Add type'" [(open)]="formOpen">
    <form class="row" [formGroup]="form" (ngSubmit)="save()">
      <label>Name <input formControlName="name" /></label>
      <label>Goal <input type="number" min="0" formControlName="goal" placeholder="Sum of requests" /></label>
      <label>Description <input formControlName="description" /></label>
      <button class="primary" [class.is-loading]="pending.has('save')" [disabled]="form.invalid || pending.has('save')">{{ editing() ? 'Update' : 'Add type' }}</button>
      @if (editing()) { <button type="button" (click)="reset()">Cancel</button> }
    </form>
    <p class="muted small">Leave the goal empty (or 0) and it will be the sum of this type's requests, growing as new months come due.</p>
    </app-collapsible>
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Goal</th><th>Description</th><th></th></tr></thead>
        <tbody>
          @for (t of items.value() ?? []; track t.id) {
            <tr>
              <td>{{ t.name }}</td>
              <td>
                @if (t.goal) { {{ t.goal | currency: 'PKR ' : 'symbol' : '1.0-0' }} }
                @else { <span class="muted" title="No fixed goal: sum of this type's requests">Sum of requests ·</span> {{ goalNow(t.id) | currency: 'PKR ' : 'symbol' : '1.0-0' }} }
              </td>
              <td>{{ t.description }}</td>
              <td class="actions">
                <button (click)="edit(t)">Edit</button>
                <button class="danger" [class.is-loading]="pending.has('del:' + t.id)" [disabled]="pending.has('del:' + t.id)" (click)="remove(t)">Delete</button>
              </td>
            </tr>
          } @empty { <tr><td colspan="4" class="muted">No investment types yet.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class Types {
  protected readonly formOpen = signal(false);
  protected readonly pending = new Pending();
  private readonly api = inject(Api);
  protected readonly items = rxResource({ stream: () => this.api.types() });
  private readonly stats = rxResource({ stream: () => this.api.stats() });
  private readonly effectiveGoal = computed(() => new Map((this.stats.value()?.types ?? []).map((t) => [t.id, t.goal])));
  protected goalNow(id: string) { return this.effectiveGoal().get(id) ?? 0; }
  protected readonly editing = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    goal: [null as number | null, Validators.min(0)],
    description: [''],
  });

  save() {
    const v = this.form.getRawValue();
    this.error.set('');
    this.pending
      .track('save', this.api.saveType({ name: v.name, goal: v.goal || null, description: v.description || null }, this.editing() ?? undefined))
      .subscribe({
        next: () => { this.reset(); this.items.reload(); this.stats.reload(); },
        error: (e) => this.error.set(String(e.error?.detail ?? 'Save failed')),
      });
  }
  edit(t: InvestmentType) {
    this.formOpen.set(true);
    this.editing.set(t.id);
    this.form.setValue({ name: t.name, goal: t.goal || null, description: t.description ?? '' });
  }
  reset() { this.editing.set(null); this.form.reset({ name: '', goal: null, description: '' }); }
  remove(t: InvestmentType) {
    if (!confirm(`Delete ${t.name}?`)) return;
    this.error.set('');
    this.pending.track('del:' + t.id, this.api.deleteType(t.id)).subscribe({
      next: () => { this.items.reload(); this.stats.reload(); },
      error: (e) => this.error.set(e.error?.detail ?? 'Delete failed'),
    });
  }
}
