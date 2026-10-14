import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { Api } from '../core/api';
import { Stats, TypeDues } from '../core/models';

Chart.register(...registerables);

const PALETTE = ['#2f6b3a', '#d9a441', '#3b7dd8', '#b5533c', '#7a5cc2', '#2a9d8f', '#c0568f', '#8a8f3a'];
const PAID = '#2f6b3a';
const REMAINING = '#d9a441';

interface DueRow { id: string; name: string; paid: number; owed: number; remaining: number; ahead: number; types: TypeDues[] }

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Dashboard</h1>
    @if (stats.value(); as s) {
      <div class="tabs" role="group" aria-label="Show data for">
        <button type="button" [attr.aria-pressed]="tab() === ''" (click)="tab.set('')">All</button>
        @for (t of typeTabs(); track t.id) {
          <button type="button" [attr.aria-pressed]="tab() === t.id" (click)="tab.set(t.id)">{{ t.name }}</button>
        }
      </div>

      <div class="grid">
        <div class="card"><div class="muted">{{ summary().scope }} raised</div><div class="stat">{{ summary().raised | currency: 'PKR ' : 'symbol' : '1.0-0' }}</div></div>
        <div class="card"><div class="muted">{{ summary().scope }} goal</div>
          <div class="stat">@if (summary().goal) { {{ summary().goal | currency: 'PKR ' : 'symbol' : '1.0-0' }} } @else { <span class="muted">No goal set</span> }</div></div>
        <div class="card"><div class="muted">Progress</div>
          <div class="stat">@if (summary().progress !== null) { {{ summary().progress }}% } @else { <span class="muted">—</span> }</div></div>
      </div>

      <section class="card">
        <h2>Paid vs remaining by investor <span class="muted">· as of {{ dues.value()?.as_of }}</span></h2>
        @if (rows().length) {
          <div class="canvas-box" style="height:360px"><canvas #dueCanvas role="img" aria-label="Paid and remaining amount for each investor"></canvas></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Investor</th><th>Type</th><th class="num">Paid</th><th class="num">Owed</th><th class="num">Remaining</th><th>Status</th></tr></thead>
              <tbody>
                @for (r of tableRows(); track r.key) {
                  <tr>
                    <td>{{ r.name }}</td>
                    <td>{{ r.type }}</td>
                    <td class="num">{{ r.paid | currency: 'PKR ' : 'symbol' : '1.0-0' }}</td>
                    <td class="num">{{ r.owed | currency: 'PKR ' : 'symbol' : '1.0-0' }}</td>
                    <td class="num">{{ r.remaining | currency: 'PKR ' : 'symbol' : '1.0-0' }}</td>
                    <td><ng-container [ngTemplateOutlet]="statusTpl" [ngTemplateOutletContext]="{ $implicit: r }" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (dues.isLoading()) {
          <div class="loading" role="status"><span class="spinner" aria-hidden="true"></span> Loading…</div>
        } @else {
          <p class="muted">Nothing to show yet. Add requests to see what each investor still owes.</p>
        }

        <ng-template #statusTpl let-r>
          @if (r.remaining > 0) { <span class="status-behind">Behind</span> }
          @else if (r.ahead > 0) { <span class="status-ahead">Ahead {{ r.ahead | currency: 'PKR ' : 'symbol' : '1.0-0' }}</span> }
          @else if (r.owed > 0) { <span class="status-ok">Settled</span> }
          @else { <span class="muted">No request</span> }
        </ng-template>
      </section>

      <section class="card">
        <h2>Raised vs goal{{ tab() ? '' : ' by type' }}</h2>
        <div class="canvas-box" [style.height.px]="height()"><canvas #goalCanvas role="img" aria-label="Raised versus goal for each investment type"></canvas></div>
      </section>
      <section class="card">
        <h2>Monthly contributions{{ tab() ? '' : ' by type' }}</h2>
        <div class="canvas-box" [style.height.px]="height()"><canvas #monthCanvas role="img" aria-label="Monthly contributions stacked per investment type"></canvas></div>
      </section>
    } @else if (stats.error()) {
      <p class="error" role="alert">Failed to load stats.</p>
    } @else {
      <div class="loading" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span> Loading dashboard…</div>
    }
  `,
})
export class Dashboard {
  private readonly api = inject(Api);
  protected readonly stats = rxResource<Stats, undefined>({ stream: () => this.api.stats() });
  protected readonly dues = rxResource({ stream: () => this.api.investorDues() });
  protected readonly tab = signal('');
  private readonly goalCanvas = viewChild<ElementRef<HTMLCanvasElement>>('goalCanvas');
  private readonly monthCanvas = viewChild<ElementRef<HTMLCanvasElement>>('monthCanvas');
  private readonly dueCanvas = viewChild<ElementRef<HTMLCanvasElement>>('dueCanvas');

  protected readonly typeTabs = computed(() =>
    (this.stats.value()?.types ?? []).map((t) => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name)),
  );

  /** The selected type (or all types): what every chart and tile on the page shows. */
  protected readonly typesView = computed(() => (this.stats.value()?.types ?? []).filter((t) => !this.tab() || t.id === this.tab()));
  private readonly typeMonthsView = computed(() => (this.stats.value()?.type_months ?? []).filter((t) => !this.tab() || t.id === this.tab()));
  protected readonly summary = computed(() => {
    const types = this.typesView();
    const raised = types.reduce((a, t) => a + t.raised, 0);
    const goal = types.reduce((a, t) => a + t.goal, 0);
    // Progress only compares types that have a goal, so goal-less types don't push it past 100%.
    const raisedWithGoal = types.filter((t) => t.goal > 0).reduce((a, t) => a + t.raised, 0);
    return {
      scope: this.tab() ? (types[0]?.name ?? '') : 'Total',
      raised, goal,
      progress: goal > 0 ? Math.round((raisedWithGoal / goal) * 1000) / 10 : null,
    };
  });

  /** One row per investor for the selected type tab (or summed across types for All). */
  protected readonly rows = computed<DueRow[]>(() => {
    const tab = this.tab();
    const out: DueRow[] = [];
    const idle: DueRow[] = [];
    for (const i of this.dues.value()?.investors ?? []) {
      const ts = i.types.filter((t) => !tab || t.id === tab);
      if (!ts.length) {
        if (!tab) idle.push({ id: i.id, name: i.name, paid: 0, owed: 0, remaining: 0, ahead: 0, types: [] });
        continue;
      }
      const sum = (k: 'paid' | 'owed' | 'remaining' | 'ahead') => ts.reduce((a, t) => a + t[k], 0);
      out.push({ id: i.id, name: i.name, paid: sum('paid'), owed: sum('owed'), remaining: sum('remaining'), ahead: sum('ahead'), types: ts });
    }
    // Investors in several types first, then those who are behind, then by name.
    // On the All tab, investors with nothing yet come last.
    const byPriority = (a: DueRow, b: DueRow) =>
      b.types.length - a.types.length || b.remaining - a.remaining || a.name.localeCompare(b.name);
    return [...out.sort(byPriority), ...idle];
  });

  /** One row per investor; the Type column lists their types (all on the All tab, just the tab's type otherwise). */
  protected readonly tableRows = computed(() =>
    this.rows().map((r) => ({
      key: r.id, name: r.name, paid: r.paid, owed: r.owed, remaining: r.remaining, ahead: r.ahead,
      type: r.types.map((t) => t.name).sort((a, b) => a.localeCompare(b)).join(', ') || '—',
    })),
  );

  protected height() { return Math.max(160, this.typesView().length * 70 + 70); }

  private readonly chartText = () => getComputedStyle(document.body).color;
  private readonly gridColor = 'rgba(128,128,128,.25)';
  private scales(stacked: boolean, text: string, vertical = false) {
    if (vertical) {
      return {
        x: { stacked, ticks: { color: text }, grid: { display: false } },
        y: { stacked, beginAtZero: true, ticks: { color: text }, grid: { color: this.gridColor } },
      };
    }
    return {
      x: { stacked, beginAtZero: true, ticks: { color: text }, grid: { color: this.gridColor } },
      y: { stacked, ticks: { color: text }, grid: { display: false } },
    };
  }

  constructor() {
    effect((onCleanup) => {
      const rows = this.rows();
      const el = this.dueCanvas();
      if (!el || !rows.length) return;
      const text = this.chartText();
      const chart = new Chart(el.nativeElement, {
        type: 'bar',
        data: {
          labels: rows.map((r) => r.name),
          datasets: [
            { label: 'Paid', data: rows.map((r) => r.paid), backgroundColor: PAID },
            { label: 'Remaining', data: rows.map((r) => r.remaining), backgroundColor: REMAINING },
          ],
        },
        options: {
          indexAxis: 'x', responsive: true, maintainAspectRatio: false,
          scales: this.scales(true, text, true), plugins: { legend: { labels: { color: text } } },
        },
      });
      onCleanup(() => chart.destroy());
    });

    effect((onCleanup) => {
      const types = this.typesView(), typeMonths = this.typeMonthsView();
      const g = this.goalCanvas(), m = this.monthCanvas();
      if (!g || !m) return;
      const text = this.chartText();
      const base = { indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false };
      const months = [...new Set(typeMonths.flatMap((t) => Object.keys(t.months)))].sort();

      const charts = [
        // Gantt-style progress: a wide goal track with a narrower raised bar on top.
        new Chart(g.nativeElement, {
          type: 'bar',
          data: {
            labels: types.map((t) => t.name),
            datasets: [
              { label: 'Goal', data: types.map((t) => t.goal), backgroundColor: 'rgba(128,128,128,.3)', grouped: false, barPercentage: 0.8, order: 2 },
              { label: 'Raised', data: types.map((t) => t.raised), backgroundColor: PALETTE[0], grouped: false, barPercentage: 0.45, order: 1 },
            ],
          },
          options: { ...base, scales: this.scales(false, text), plugins: { legend: { labels: { color: text } } } },
        }),
        // One bar per type, split into month segments.
        new Chart(m.nativeElement, {
          type: 'bar',
          data: {
            labels: typeMonths.map((t) => t.name),
            datasets: months.map((month, i) => ({
              label: month,
              data: typeMonths.map((t) => t.months[month] ?? 0),
              backgroundColor: PALETTE[i % PALETTE.length],
            })),
          },
          options: { ...base, scales: this.scales(true, text), plugins: { legend: { labels: { color: text } } } },
        }),
      ];
      onCleanup(() => charts.forEach((c) => c.destroy()));
    });
  }
}
