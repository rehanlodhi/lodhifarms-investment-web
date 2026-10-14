import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../core/api';
import { Collapsible } from '../core/collapsible';
import { RequestItem } from '../core/models';

const thisMonth = () => new Date().toISOString().slice(0, 7);

@Component({
  selector: 'app-requests',
  imports: [ReactiveFormsModule, CurrencyPipe, Collapsible],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Requests</h1>
    <p class="muted">What each selected investor owes for a type — once, or every month. The dashboard compares this with what they've paid.</p>
    <app-collapsible [title]="editing() ? 'Edit request' : 'Add request'" [(open)]="formOpen">
    <form class="row wide" [formGroup]="form" (ngSubmit)="save()">
      <label>Type
        <select formControlName="type_id">
          <option value="" disabled>Select…</option>
          @for (t of types.value() ?? []; track t.id) { <option [value]="t.id">{{ t.name }}</option> }
        </select>
      </label>
      <label>Amount per investor <input type="number" min="1" formControlName="amount" /></label>
      <label>{{ form.controls.recurring.value ? 'Starting month' : 'Month' }} <input type="month" formControlName="start_month" /></label>
      <label class="check"><input type="checkbox" formControlName="recurring" /> Repeats every month</label>
      @if (form.controls.recurring.value) {
        <label>Ending month (optional) <input type="month" formControlName="end_month" /></label>
      }
      <fieldset>
        <legend>Investors ({{ selected().length }})</legend>
        <button type="button" (click)="selectAll()">All</button>
        <button type="button" (click)="selected.set([])">None</button>
        <div class="checks">
          @for (i of investors.value() ?? []; track i.id) {
            <label class="check"><input type="checkbox" [checked]="selected().includes(i.id)" (change)="toggle(i.id)" /> {{ i.name }}</label>
          }
        </div>
      </fieldset>
      <label>Note <input formControlName="note" /></label>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      <div>
        <button class="primary" [disabled]="form.invalid || !selected().length">{{ editing() ? 'Update' : 'Add request' }}</button>
        @if (editing()) { <button type="button" (click)="reset()">Cancel</button> }
      </div>
    </form>
    </app-collapsible>
    <section class="card table-wrap">
      <table>
        <thead><tr><th>Type</th><th>Each</th><th>When</th><th>Investors</th><th></th></tr></thead>
        <tbody>
          @for (r of items.value() ?? []; track r.id) {
            <tr>
              <td>{{ typeName(r.type_id) }}</td>
              <td>{{ r.amount | currency: 'PKR ' : 'symbol' : '1.0-0' }}</td>
              <td>{{ when(r) }}</td>
              <td [title]="names(r)">{{ r.investor_ids.length }} · {{ names(r) }}</td>
              <td class="actions">
                <button (click)="edit(r)">Edit</button>
                <button class="danger" (click)="remove(r)">Delete</button>
              </td>
            </tr>
          } @empty { <tr><td colspan="5" class="muted">No requests yet.</td></tr> }
        </tbody>
      </table>
    </section>
  `,
})
export class Requests {
  protected readonly formOpen = signal(false);
  private readonly api = inject(Api);
  protected readonly items = rxResource({ stream: () => this.api.requests() });
  protected readonly investors = rxResource({ stream: () => this.api.investors() });
  protected readonly types = rxResource({ stream: () => this.api.types() });
  protected readonly editing = signal<string | null>(null);
  protected readonly selected = signal<string[]>([]);
  protected readonly error = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    type_id: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    start_month: [thisMonth(), Validators.required],
    recurring: [false],
    end_month: [''],
    note: [''],
  });

  private readonly typeById = computed(() => new Map((this.types.value() ?? []).map((t) => [t.id, t.name])));
  private readonly investorById = computed(() => new Map((this.investors.value() ?? []).map((i) => [i.id, i.name])));
  protected typeName(id: string) { return this.typeById().get(id) ?? '?'; }
  protected names(r: RequestItem) { return r.investor_ids.map((id) => this.investorById().get(id) ?? '?').join(', '); }
  protected when(r: RequestItem) {
    if (!r.recurring) return r.start_month;
    return `Every month from ${r.start_month}${r.end_month ? ' to ' + r.end_month : ''}`;
  }

  toggle(id: string) {
    this.selected.update((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  selectAll() { this.selected.set((this.investors.value() ?? []).map((i) => i.id)); }

  save() {
    const v = this.form.getRawValue();
    this.error.set('');
    this.api.saveRequest({
      type_id: v.type_id, amount: v.amount, start_month: v.start_month, recurring: v.recurring,
      end_month: v.recurring && v.end_month ? v.end_month : null,
      investor_ids: this.selected(), note: v.note || null,
    }, this.editing() ?? undefined).subscribe({
      next: () => { this.reset(); this.items.reload(); },
      error: (e) => this.error.set(JSON.stringify(e.error?.detail ?? 'Save failed')),
    });
  }
  edit(r: RequestItem) {
    this.formOpen.set(true);
    this.editing.set(r.id);
    this.selected.set([...r.investor_ids]);
    this.form.setValue({
      type_id: r.type_id, amount: r.amount, start_month: r.start_month,
      recurring: r.recurring, end_month: r.end_month ?? '', note: r.note ?? '',
    });
  }
  reset() {
    this.editing.set(null);
    this.selected.set([]);
    this.form.reset({ type_id: '', amount: 0, start_month: thisMonth(), recurring: false, end_month: '', note: '' });
  }
  remove(r: RequestItem) {
    if (confirm('Delete this request?')) this.api.deleteRequest(r.id).subscribe(() => this.items.reload());
  }
}
