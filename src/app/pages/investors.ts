import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../core/api';
import { Investor } from '../core/models';

@Component({
  selector: 'app-investors',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Investors</h1>
    <div class="two-col">
      <form class="card stack" [formGroup]="form" (ngSubmit)="save()">
        <h2>{{ editing() ? 'Edit investor' : 'Add investor' }}</h2>
        <label>Name <input formControlName="name" /></label>
        <label>Email <input type="email" formControlName="email" /></label>
        <label>Phone <input formControlName="phone" /></label>
        <div>
          <button class="primary" [disabled]="form.invalid">{{ editing() ? 'Update' : 'Add investor' }}</button>
          @if (editing()) { <button type="button" (click)="reset()">Cancel</button> }
        </div>
      </form>
      <section>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <div class="card">
          <div class="toolbar">
            <h2>Filters</h2>
            <span class="muted">{{ filtered().length }} of {{ items.value()?.length ?? 0 }}</span>
            <button type="button" (click)="clearFilters()">Clear filters</button>
          </div>
          <div class="filter-grid" style="--cols:2">
            <label>Name <input placeholder="Contains…" [value]="fName()" (input)="fName.set($any($event.target).value)" /></label>
            <label>Email <input placeholder="Contains…" [value]="fEmail()" (input)="fEmail.set($any($event.target).value)" /></label>
            <label>Phone <input placeholder="Contains…" [value]="fPhone()" (input)="fPhone.set($any($event.target).value)" /></label>
          </div>
        </div>
        <div class="card table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Phone</th><th></th></tr>
            </thead>
            <tbody>
              @for (i of filtered(); track i.id) {
                <tr>
                  <td>{{ i.name }}</td><td>{{ i.email }}</td><td>{{ i.phone }}</td>
                  <td class="actions">
                    <button (click)="edit(i)">Edit</button>
                    <button class="danger" (click)="remove(i)">Delete</button>
                  </td>
                </tr>
              } @empty { <tr><td colspan="4" class="muted">No investors found.</td></tr> }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class Investors {
  private readonly api = inject(Api);
  protected readonly items = rxResource({ stream: () => this.api.investors() });
  protected readonly editing = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly fName = signal('');
  protected readonly fEmail = signal('');
  protected readonly fPhone = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required], email: [''], phone: [''],
  });

  protected readonly filtered = computed(() => {
    const has = (v: string | null | undefined, q: string) => (v ?? '').toLowerCase().includes(q.trim().toLowerCase());
    return (this.items.value() ?? []).filter(
      (i) => has(i.name, this.fName()) && has(i.email, this.fEmail()) && has(i.phone, this.fPhone()),
    );
  });

  clearFilters() { this.fName.set(''); this.fEmail.set(''); this.fPhone.set(''); }

  save() {
    const v = this.form.getRawValue();
    this.api.saveInvestor({ name: v.name, email: v.email || null, phone: v.phone || null }, this.editing() ?? undefined)
      .subscribe(() => { this.reset(); this.items.reload(); });
  }
  edit(i: Investor) {
    this.editing.set(i.id);
    this.form.setValue({ name: i.name, email: i.email ?? '', phone: i.phone ?? '' });
  }
  reset() { this.editing.set(null); this.form.reset(); }
  remove(i: Investor) {
    if (!confirm(`Delete ${i.name}?`)) return;
    this.error.set('');
    this.api.deleteInvestor(i.id).subscribe({
      next: () => this.items.reload(),
      error: (e) => this.error.set(e.error?.detail ?? 'Delete failed'),
    });
  }
}
