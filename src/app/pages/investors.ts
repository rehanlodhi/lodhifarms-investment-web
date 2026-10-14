import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../core/api';
import { Collapsible } from '../core/collapsible';
import { Pending } from '../core/pending';
import { Investor } from '../core/models';

@Component({
  selector: 'app-investors',
  imports: [ReactiveFormsModule, Collapsible],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Investors</h1>
    <app-collapsible [title]="editing() ? 'Edit investor' : 'Add investor'" [(open)]="formOpen">
    <form class="row wide" [formGroup]="form" (ngSubmit)="save()">
      <label>Name <input formControlName="name" /></label>
      <label>Email <input type="email" formControlName="email" /></label>
      <label>Phone <input formControlName="phone" /></label>
      <fieldset>
        <legend>Assigned types ({{ selectedTypes().length }})</legend>
        <div class="checks">
          @for (t of types.value() ?? []; track t.id) {
            <label class="check"><input type="checkbox" [checked]="selectedTypes().includes(t.id)" (change)="toggleType(t.id)" /> {{ t.name }}</label>
          }
        </div>
      </fieldset>
      <div>
        <button class="primary" [class.is-loading]="pending.has('save')" [disabled]="form.invalid || pending.has('save')">{{ editing() ? 'Update' : 'Add investor' }}</button>
        @if (editing()) { <button type="button" (click)="reset()">Cancel</button> }
      </div>
    </form>
    </app-collapsible>
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    <app-collapsible title="Filters" [(open)]="filtersOpen">
      <div class="toolbar">
        <span class="muted">{{ filtered().length }} of {{ items.value()?.length ?? 0 }}</span>
        <button type="button" (click)="clearFilters()">Clear filters</button>
      </div>
      <div class="filter-grid">
        <label>Name <input placeholder="Contains…" [value]="fName()" (input)="fName.set($any($event.target).value)" /></label>
        <label>Email <input placeholder="Contains…" [value]="fEmail()" (input)="fEmail.set($any($event.target).value)" /></label>
        <label>Phone <input placeholder="Contains…" [value]="fPhone()" (input)="fPhone.set($any($event.target).value)" /></label>
      </div>
    </app-collapsible>
    <div class="card table-wrap">
      <table>
        <thead>
          <tr><th>Name</th><th>Types</th><th>Email</th><th>Phone</th><th></th></tr>
        </thead>
        <tbody>
          @for (i of filtered(); track i.id) {
            <tr>
              <td>{{ i.name }}</td><td>{{ typeNames(i) }}</td><td>{{ i.email }}</td><td>{{ i.phone }}</td>
              <td class="actions">
                <button (click)="edit(i)">Edit</button>
                <button class="danger" [class.is-loading]="pending.has('del:' + i.id)" [disabled]="pending.has('del:' + i.id)" (click)="remove(i)">Delete</button>
              </td>
            </tr>
          } @empty { <tr><td colspan="5" class="muted">No investors found.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class Investors {
  protected readonly formOpen = signal(false);
  protected readonly pending = new Pending();
  protected readonly filtersOpen = signal(false);
  private readonly api = inject(Api);
  protected readonly items = rxResource({ stream: () => this.api.investors() });
  protected readonly types = rxResource({ stream: () => this.api.types() });
  protected readonly selectedTypes = signal<string[]>([]);
  private readonly typeById = computed(() => new Map((this.types.value() ?? []).map((t) => [t.id, t.name])));
  protected typeNames(i: Investor) {
    return (i.type_ids ?? []).map((id) => this.typeById().get(id)).filter(Boolean).join(', ');
  }
  protected toggleType(id: string) {
    this.selectedTypes.update((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
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
    this.error.set('');
    this.pending
      .track('save', this.api.saveInvestor({ name: v.name, email: v.email || null, phone: v.phone || null, type_ids: this.selectedTypes() }, this.editing() ?? undefined))
      .subscribe({
        next: () => { this.reset(); this.items.reload(); },
        error: (e) => this.error.set(String(e.error?.detail ?? 'Save failed')),
      });
  }
  edit(i: Investor) {
    this.formOpen.set(true);
    this.editing.set(i.id);
    this.selectedTypes.set([...(i.type_ids ?? [])]);
    this.form.setValue({ name: i.name, email: i.email ?? '', phone: i.phone ?? '' });
  }
  reset() { this.editing.set(null); this.selectedTypes.set([]); this.form.reset(); }
  remove(i: Investor) {
    if (!confirm(`Delete ${i.name}?`)) return;
    this.error.set('');
    this.pending.track('del:' + i.id, this.api.deleteInvestor(i.id)).subscribe({
      next: () => this.items.reload(),
      error: (e) => this.error.set(e.error?.detail ?? 'Delete failed'),
    });
  }
}
