import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, ElementRef } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../core/api';
import { Collapsible } from '../core/collapsible';
import { Pending } from '../core/pending';
import { Investment } from '../core/models';

@Component({
  selector: 'app-investments',
  imports: [ReactiveFormsModule, CurrencyPipe, Collapsible],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Investments</h1>
    <app-collapsible [title]="editing() ? 'Edit investment' : 'Add investment'" [(open)]="formOpen">
    <form class="row wide" [formGroup]="form" (ngSubmit)="save()">
      <label>Investor
        <select formControlName="investor_id">
          <option value="" disabled>Select…</option>
          @for (i of investors.value() ?? []; track i.id) { <option [value]="i.id">{{ i.name }}</option> }
        </select>
      </label>
      <label>Type
        <select formControlName="type_id">
          <option value="" disabled>Select…</option>
          @for (t of types.value() ?? []; track t.id) { <option [value]="t.id">{{ t.name }}</option> }
        </select>
      </label>
      <label>Amount <input type="number" min="1" formControlName="amount" /></label>
      <label>Date <input type="date" formControlName="date" /></label>
      <label>Month <input type="month" formControlName="month" /></label>
      <label>Note <input formControlName="note" /></label>
      <label>Screenshots <input #file type="file" accept="image/*" multiple (change)="files.set(file.files ? [...file.files] : [])" /></label>
      <div>
        <button class="primary" [class.is-loading]="pending.has('save')" [disabled]="form.invalid || pending.has('save')">{{ editing() ? 'Update' : 'Add investment' }}</button>
        @if (editing()) { <button type="button" (click)="reset(file)">Cancel</button> }
      </div>
    </form>
    </app-collapsible>
    @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
    <app-collapsible title="Bulk add (one investment per selected investor)" [(open)]="bulkOpen">
      <form class="row wide" [formGroup]="bulkForm" (ngSubmit)="bulkAdd()">
        <label>Type
          <select formControlName="type_id">
            <option value="" disabled>Select…</option>
            @for (t of types.value() ?? []; track t.id) { <option [value]="t.id">{{ t.name }}</option> }
          </select>
        </label>
        <label>Amount each <input type="number" min="1" formControlName="amount" /></label>
        <label>Date <input type="date" formControlName="date" /></label>
        <label>Month <input type="month" formControlName="month" /></label>
        <label>Note <input formControlName="note" /></label>
        <label class="check"><input type="checkbox" formControlName="skip_existing" /> Skip investors who already have this type, month and amount</label>
        <fieldset>
          <legend>Investors ({{ bulkInvestors().length }})</legend>
          <button type="button" (click)="bulkSelectAll()">All</button>
          <button type="button" (click)="bulkInvestors.set([])">None</button>
          <div class="checks">
            @for (i of investors.value() ?? []; track i.id) {
              <label class="check"><input type="checkbox" [checked]="bulkInvestors().includes(i.id)" (change)="toggleBulkInvestor(i.id)" /> {{ i.name }}</label>
            }
          </div>
        </fieldset>
        @if (bulkMsg()) { <p class="muted" role="status">{{ bulkMsg() }}</p> }
        <div><button class="primary" [class.is-loading]="pending.has('bulkAdd')" [disabled]="bulkForm.invalid || !bulkInvestors().length || pending.has('bulkAdd')">Add for {{ bulkInvestors().length }} investors</button></div>
      </form>
    </app-collapsible>
    <app-collapsible title="Filters" [(open)]="filtersOpen">
      <div class="toolbar">
        <span class="muted">{{ filtered().length }} of {{ items.value()?.length ?? 0 }} · Total {{ total() | currency: 'PKR ' : 'symbol' : '1.0-0' }}</span>
        <button type="button" (click)="clearFilters()">Clear filters</button>
      </div>
      <div class="filter-grid">
        <label>Investor
          <select [value]="fInvestor()" (change)="fInvestor.set($any($event.target).value)">
            <option value="">All</option>
            @for (i of investors.value() ?? []; track i.id) { <option [value]="i.id">{{ i.name }}</option> }
          </select>
        </label>
        <label>Type
          <select [value]="fType()" (change)="fType.set($any($event.target).value)">
            <option value="">All</option>
            @for (t of types.value() ?? []; track t.id) { <option [value]="t.id">{{ t.name }}</option> }
          </select>
        </label>
        <label>Month <input type="month" [value]="fMonth()" (input)="fMonth.set($any($event.target).value)" /></label>
        <label>Date contains <input placeholder="e.g. 2026-06" [value]="fDate()" (input)="fDate.set($any($event.target).value)" /></label>
        <label>Minimum amount <input type="number" min="0" placeholder="0" [value]="fMin()" (input)="fMin.set($any($event.target).value)" /></label>
        <label>Screenshots
          <select [value]="fShots()" (change)="fShots.set($any($event.target).value)">
            <option value="">All</option>
            <option value="yes">With</option>
            <option value="no">Without</option>
          </select>
        </label>
      </div>
    </app-collapsible>
    <div class="card table-wrap">
      @if (selectedVisible().length) {
        <div class="toolbar">
          <span>{{ selectedVisible().length }} selected · {{ selectedTotal() | currency: 'PKR ' : 'symbol' : '1.0-0' }}</span>
          <span>
            <button type="button" (click)="selected.set(emptySet)">Clear selection</button>
            <button type="button" class="danger" [class.is-loading]="pending.has('bulkDel')" [disabled]="pending.has('bulkDel')" (click)="bulkDelete()">Delete selected</button>
          </span>
        </div>
      }
      <table>
        <thead>
          <tr><th class="sel"><input type="checkbox" aria-label="Select all shown investments" [checked]="allSelected()" (change)="toggleAll($any($event.target).checked)" /></th><th>Date</th><th>Month</th><th>Investor</th><th>Type</th><th>Amount</th><th>Screenshots</th><th></th></tr>
        </thead>
        <tbody>
          @for (inv of filtered(); track inv.id) {
            <tr>
              <td class="sel"><input type="checkbox" [attr.aria-label]="'Select investment of ' + inv.investor_name + ', ' + inv.type_name + ', ' + inv.date" [checked]="selected().has(inv.id)" (change)="toggleRow(inv.id)" /></td>
              <td>{{ inv.date }}</td><td>{{ inv.month ?? inv.date.slice(0, 7) }}</td><td>{{ inv.investor_name }}</td><td>{{ inv.type_name }}</td>
              <td>{{ inv.amount | currency: 'PKR ' : 'symbol' : '1.0-0' }}</td>
              <td>
                <button type="button" class="thumbs" (click)="openShots(inv.id)" [attr.aria-label]="'View screenshots (' + inv.screenshots.length + ')'">
                  @for (s of inv.screenshots.slice(0, 3); track s) { <img [src]="'/uploads/' + s" alt="" /> }
                  @if (!inv.screenshots.length) { <span class="muted">Add</span> }
                  @else if (inv.screenshots.length > 3) { <span class="muted">+{{ inv.screenshots.length - 3 }}</span> }
                </button>
              </td>
              <td class="actions">
                <button (click)="edit(inv)">Edit</button>
                <button class="danger" [class.is-loading]="pending.has('del:' + inv.id)" [disabled]="pending.has('del:' + inv.id)" (click)="remove(inv)">Delete</button>
              </td>
            </tr>
          } @empty { <tr><td colspan="8" class="muted">No investments found.</td></tr> }
        </tbody>
      </table>
    </div>

    <dialog #dlg class="shots-dialog" (close)="shotsFor.set(null)" (click)="$event.target === dlg && dlg.close()">
      @if (shotsInvestment(); as inv) {
        <div class="toolbar">
          <h2>Screenshots · {{ inv.investor_name }} · {{ inv.type_name }} · {{ inv.month ?? inv.date.slice(0, 7) }}</h2>
          <button type="button" (click)="dlg.close()">Close</button>
        </div>
        @if (shotError()) { <p class="error" role="alert">{{ shotError() }}</p> }
        <div class="shots-grid">
          @for (s of inv.screenshots; track s) {
            <figure>
              <a [href]="'/uploads/' + s" target="_blank" rel="noopener"><img [src]="'/uploads/' + s" alt="Screenshot" /></a>
              <figcaption>
                <label class="btn" [class.is-loading]="pending.has('shot:rep:' + s)">Replace <input type="file" accept="image/*" hidden [disabled]="pending.has('shot:rep:' + s)" (change)="replaceShot(inv.id, s, $any($event.target))" /></label>
                <button type="button" class="danger" [class.is-loading]="pending.has('shot:del:' + s)" [disabled]="pending.has('shot:del:' + s)" (click)="deleteShot(inv.id, s)">Delete</button>
              </figcaption>
            </figure>
          } @empty { <p class="muted">No screenshots yet.</p> }
        </div>
        <label class="btn primary add" [class.is-loading]="pending.has('shot:add')">+ Add screenshots <input type="file" accept="image/*" multiple hidden [disabled]="pending.has('shot:add')" (change)="addShots(inv.id, $any($event.target))" /></label>
      }
    </dialog>
  `,
})
export class Investments {
  protected readonly formOpen = signal(false);
  protected readonly pending = new Pending();
  protected readonly filtersOpen = signal(false);
  protected readonly bulkOpen = signal(false);
  protected readonly bulkInvestors = signal<string[]>([]);
  protected readonly bulkMsg = signal('');
  protected readonly bulkForm = inject(FormBuilder).nonNullable.group({
    type_id: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    month: [new Date().toISOString().slice(0, 7), Validators.required],
    note: [''],
    skip_existing: [true],
  });
  protected readonly emptySet: ReadonlySet<string> = new Set();
  protected readonly selected = signal<ReadonlySet<string>>(this.emptySet);
  private readonly api = inject(Api);
  protected readonly items = rxResource({ stream: () => this.api.investments() });
  protected readonly investors = rxResource({ stream: () => this.api.investors() });
  protected readonly types = rxResource({ stream: () => this.api.types() });
  protected readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  protected readonly shotsFor = signal<string | null>(null);
  protected readonly shotError = signal('');
  protected readonly shotsInvestment = computed(() => (this.items.value() ?? []).find((i) => i.id === this.shotsFor()) ?? null);
  protected readonly editing = signal<string | null>(null);
  protected readonly files = signal<File[]>([]);
  protected readonly error = signal('');
  protected readonly fDate = signal('');
  protected readonly fMonth = signal('');
  protected readonly fInvestor = signal('');
  protected readonly fType = signal('');
  protected readonly fMin = signal('');
  protected readonly fShots = signal('');
  protected readonly form = inject(FormBuilder).nonNullable.group({
    investor_id: ['', Validators.required],
    type_id: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    month: [new Date().toISOString().slice(0, 7), Validators.required],
    note: [''],
  });

  protected readonly filtered = computed(() => {
    const date = this.fDate().trim();
    const min = Number(this.fMin()) || 0;
    return (this.items.value() ?? []).filter(
      (i) =>
        (!date || i.date.includes(date)) &&
        (!this.fMonth() || (i.month ?? i.date.slice(0, 7)) === this.fMonth()) &&
        (!this.fInvestor() || i.investor_id === this.fInvestor()) &&
        (!this.fType() || i.type_id === this.fType()) &&
        i.amount >= min &&
        (!this.fShots() || (this.fShots() === 'yes') === i.screenshots.length > 0),
    );
  });
  protected readonly total = computed(() => this.filtered().reduce((sum, i) => sum + i.amount, 0));

  // Only rows currently shown count as selected, so a filter can never hide rows that get deleted.
  protected readonly selectedVisible = computed(() => this.filtered().filter((i) => this.selected().has(i.id)));
  protected readonly selectedTotal = computed(() => this.selectedVisible().reduce((sum, i) => sum + i.amount, 0));
  protected readonly allSelected = computed(() => this.filtered().length > 0 && this.selectedVisible().length === this.filtered().length);

  toggleRow(id: string) {
    this.selected.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
  toggleAll(checked: boolean) {
    this.selected.set(checked ? new Set(this.filtered().map((i) => i.id)) : this.emptySet);
  }
  bulkDelete() {
    const ids = this.selectedVisible().map((i) => i.id);
    if (!ids.length || !confirm(`Delete ${ids.length} investment${ids.length === 1 ? '' : 's'}? This also removes their screenshots.`)) return;
    this.error.set('');
    this.pending.track('bulkDel', this.api.bulkDeleteInvestments(ids)).subscribe({
      next: () => { this.selected.set(this.emptySet); this.items.reload(); },
      error: (e) => this.error.set(String(e.error?.detail ?? 'Bulk delete failed')),
    });
  }

  toggleBulkInvestor(id: string) {
    this.bulkInvestors.update((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  bulkSelectAll() { this.bulkInvestors.set((this.investors.value() ?? []).map((i) => i.id)); }
  bulkAdd() {
    const v = this.bulkForm.getRawValue();
    this.bulkMsg.set('');
    this.error.set('');
    this.pending.track('bulkAdd', this.api.bulkAddInvestments({
      investor_ids: this.bulkInvestors(), type_id: v.type_id, amount: v.amount, date: v.date,
      month: v.month, note: v.note || null, skip_existing: v.skip_existing,
    })).subscribe({
      next: (r) => {
        this.bulkMsg.set(`Added ${r.created}${r.skipped ? `, skipped ${r.skipped} that already existed` : ''}.`);
        this.bulkInvestors.set([]);
        this.items.reload();
      },
      error: (e) => this.error.set(String(e.error?.detail ?? 'Bulk add failed')),
    });
  }

  openShots(id: string) {
    this.shotError.set('');
    this.shotsFor.set(id);
    this.dlg().nativeElement.showModal();
  }
  private shotDone = {
    next: () => this.items.reload(),
    error: (e: { error?: { detail?: unknown } }) => this.shotError.set(String(e.error?.detail ?? 'Upload failed')),
  };
  addShots(id: string, input: HTMLInputElement) {
    const files = [...(input.files ?? [])];
    input.value = '';
    if (files.length) this.pending.track('shot:add', this.api.addScreenshots(id, files)).subscribe(this.shotDone);
  }
  replaceShot(id: string, name: string, input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (file) this.pending.track('shot:rep:' + name, this.api.replaceScreenshot(id, name, file)).subscribe(this.shotDone);
  }
  deleteShot(id: string, name: string) {
    if (confirm('Delete this screenshot?')) this.pending.track('shot:del:' + name, this.api.deleteScreenshot(id, name)).subscribe(this.shotDone);
  }

  clearFilters() {
    this.fDate.set(''); this.fMonth.set(''); this.fInvestor.set('');
    this.fType.set(''); this.fMin.set(''); this.fShots.set('');
  }

  save() {
    const v = this.form.getRawValue();
    const fd = new FormData();
    fd.set('investor_id', v.investor_id);
    fd.set('type_id', v.type_id);
    fd.set('amount', String(v.amount));
    fd.set('date', v.date);
    fd.set('month', v.month);
    if (v.note) fd.set('note', v.note);
    this.files().forEach((f) => fd.append('screenshots', f));
    this.error.set('');
    this.pending.track('save', this.api.saveInvestment(fd, this.editing() ?? undefined)).subscribe({
      next: () => { this.reset(); this.items.reload(); },
      error: (e) => this.error.set(e.error?.detail?.toString() ?? 'Save failed'),
    });
  }
  edit(inv: Investment) {
    this.formOpen.set(true);
    this.editing.set(inv.id);
    this.form.setValue({ investor_id: inv.investor_id, type_id: inv.type_id, amount: inv.amount, date: inv.date, month: inv.month ?? inv.date.slice(0, 7), note: inv.note ?? '' });
  }
  reset(file?: HTMLInputElement) {
    this.editing.set(null);
    this.files.set([]);
    if (file) file.value = '';
    this.form.reset({ investor_id: '', type_id: '', amount: 0, date: new Date().toISOString().slice(0, 10), month: new Date().toISOString().slice(0, 7), note: '' });
  }
  remove(inv: Investment) {
    if (!confirm('Delete this investment?')) return;
    this.pending.track('del:' + inv.id, this.api.deleteInvestment(inv.id)).subscribe(() => this.items.reload());
  }
}
