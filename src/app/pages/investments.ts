import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, ElementRef } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api } from '../core/api';
import { Investment } from '../core/models';

@Component({
  selector: 'app-investments',
  imports: [ReactiveFormsModule, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Investments</h1>
    <div class="two-col">
      <form class="card stack" [formGroup]="form" (ngSubmit)="save()">
        <h2>{{ editing() ? 'Edit investment' : 'Add investment' }}</h2>
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
          <button class="primary" [disabled]="form.invalid || busy()">{{ editing() ? 'Update' : 'Add investment' }}</button>
          @if (editing()) { <button type="button" (click)="reset(file)">Cancel</button> }
        </div>
      </form>
      <section>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <div class="card">
          <div class="toolbar">
            <h2>Filters</h2>
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
        </div>
        <div class="card table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Month</th><th>Investor</th><th>Type</th><th>Amount</th><th>Screenshots</th><th></th></tr>
            </thead>
            <tbody>
              @for (inv of filtered(); track inv.id) {
                <tr>
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
                    <button class="danger" (click)="remove(inv)">Delete</button>
                  </td>
                </tr>
              } @empty { <tr><td colspan="7" class="muted">No investments found.</td></tr> }
            </tbody>
          </table>
        </div>
      </section>
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
                <label class="btn">Replace <input type="file" accept="image/*" hidden (change)="replaceShot(inv.id, s, $any($event.target))" /></label>
                <button type="button" class="danger" (click)="deleteShot(inv.id, s)">Delete</button>
              </figcaption>
            </figure>
          } @empty { <p class="muted">No screenshots yet.</p> }
        </div>
        <label class="btn primary add">+ Add screenshots <input type="file" accept="image/*" multiple hidden (change)="addShots(inv.id, $any($event.target))" /></label>
      }
    </dialog>
  `,
})
export class Investments {
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
  protected readonly busy = signal(false);
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
    if (files.length) this.api.addScreenshots(id, files).subscribe(this.shotDone);
  }
  replaceShot(id: string, name: string, input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (file) this.api.replaceScreenshot(id, name, file).subscribe(this.shotDone);
  }
  deleteShot(id: string, name: string) {
    if (confirm('Delete this screenshot?')) this.api.deleteScreenshot(id, name).subscribe(this.shotDone);
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
    this.busy.set(true);
    this.error.set('');
    this.api.saveInvestment(fd, this.editing() ?? undefined).subscribe({
      next: () => { this.busy.set(false); this.reset(); this.items.reload(); },
      error: (e) => { this.busy.set(false); this.error.set(e.error?.detail?.toString() ?? 'Save failed'); },
    });
  }
  edit(inv: Investment) {
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
    this.api.deleteInvestment(inv.id).subscribe(() => this.items.reload());
  }
}
