import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../core/api';
import { InvestmentType } from '../core/models';

@Component({
  selector: 'app-types',
  imports: [ReactiveFormsModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Investment types</h1>
    <form class="card row" [formGroup]="form" (ngSubmit)="save()">
      <label>Name <input formControlName="name" /></label>
      <label>Goal <input type="number" min="0" formControlName="goal" /></label>
      <label>Description <input formControlName="description" /></label>
      <button class="primary" [disabled]="form.invalid">{{ editing() ? 'Update' : 'Add type' }}</button>
      @if (editing()) { <button type="button" (click)="reset()">Cancel</button> }
    </form>
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Goal</th><th>Description</th><th></th></tr></thead>
        <tbody>
          @for (t of items.value() ?? []; track t.id) {
            <tr>
              <td>{{ t.name }}</td><td>{{ t.goal | currency: 'PKR ' : 'symbol' : '1.0-0' }}</td><td>{{ t.description }}</td>
              <td class="actions">
                <button (click)="edit(t)">Edit</button>
                <button class="danger" (click)="remove(t)">Delete</button>
              </td>
            </tr>
          } @empty { <tr><td colspan="4" class="muted">No investment types yet.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class Types {
  private readonly api = inject(Api);
  protected readonly items = rxResource({ stream: () => this.api.types() });
  protected readonly editing = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required], goal: [0, [Validators.required, Validators.min(0)]], description: [''],
  });

  save() {
    const v = this.form.getRawValue();
    this.api.saveType({ name: v.name, goal: v.goal, description: v.description || null }, this.editing() ?? undefined)
      .subscribe(() => { this.reset(); this.items.reload(); });
  }
  edit(t: InvestmentType) {
    this.editing.set(t.id);
    this.form.setValue({ name: t.name, goal: t.goal, description: t.description ?? '' });
  }
  reset() { this.editing.set(null); this.form.reset({ name: '', goal: 0, description: '' }); }
  remove(t: InvestmentType) {
    if (!confirm(`Delete ${t.name}?`)) return;
    this.error.set('');
    this.api.deleteType(t.id).subscribe({
      next: () => this.items.reload(),
      error: (e) => this.error.set(e.error?.detail ?? 'Delete failed'),
    });
  }
}
