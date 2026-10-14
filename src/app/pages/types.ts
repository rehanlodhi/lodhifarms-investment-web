import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../core/api';
import { Collapsible } from '../core/collapsible';
import { InvestmentType } from '../core/models';

@Component({
  selector: 'app-types',
  imports: [ReactiveFormsModule, CurrencyPipe, Collapsible],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Investment types</h1>
    <app-collapsible [title]="editing() ? 'Edit type' : 'Add type'" [(open)]="formOpen">
    <form class="row" [formGroup]="form" (ngSubmit)="save()">
      <label>Name <input formControlName="name" /></label>
      <label class="check"><input type="checkbox" formControlName="auto_goal" /> Auto goal (grows every month from this type's requests)</label>
      @if (!form.controls.auto_goal.value) {
        <label>Goal <input type="number" min="0" formControlName="goal" /></label>
      }
      <label>Description <input formControlName="description" /></label>
      <button class="primary" [disabled]="form.invalid">{{ editing() ? 'Update' : 'Add type' }}</button>
      @if (editing()) { <button type="button" (click)="reset()">Cancel</button> }
    </form>
    </app-collapsible>
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    <div class="card table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Goal</th><th>Description</th><th></th></tr></thead>
        <tbody>
          @for (t of items.value() ?? []; track t.id) {
            <tr>
              <td>{{ t.name }}</td><td>
                @if (t.auto_goal) { <span title="Grows every month from this type's requests">Auto · {{ goalNow(t.id) | currency: 'PKR ' : 'symbol' : '1.0-0' }}</span> }
                @else { {{ t.goal | currency: 'PKR ' : 'symbol' : '1.0-0' }} }
              </td><td>{{ t.description }}</td>
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
  protected readonly formOpen = signal(false);
  private readonly api = inject(Api);
  protected readonly items = rxResource({ stream: () => this.api.types() });
  private readonly stats = rxResource({ stream: () => this.api.stats() });
  private readonly effectiveGoal = computed(() => new Map((this.stats.value()?.types ?? []).map((t) => [t.id, t.goal])));
  protected goalNow(id: string) { return this.effectiveGoal().get(id) ?? 0; }
  protected readonly editing = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required], goal: [0, [Validators.required, Validators.min(0)]], auto_goal: [false], description: [''],
  });

  save() {
    const v = this.form.getRawValue();
    this.api.saveType({ name: v.name, goal: v.goal, auto_goal: v.auto_goal, description: v.description || null }, this.editing() ?? undefined)
      .subscribe(() => { this.reset(); this.items.reload(); this.stats.reload(); });
  }
  edit(t: InvestmentType) {
    this.formOpen.set(true);
    this.editing.set(t.id);
    this.form.setValue({ name: t.name, goal: t.goal, auto_goal: !!t.auto_goal, description: t.description ?? '' });
  }
  reset() { this.editing.set(null); this.form.reset({ name: '', goal: 0, auto_goal: false, description: '' }); }
  remove(t: InvestmentType) {
    if (!confirm(`Delete ${t.name}?`)) return;
    this.error.set('');
    this.api.deleteType(t.id).subscribe({
      next: () => this.items.reload(),
      error: (e) => this.error.set(e.error?.detail ?? 'Delete failed'),
    });
  }
}
