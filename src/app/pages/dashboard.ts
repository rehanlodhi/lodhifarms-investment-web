import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { Api } from '../core/api';
import { Stats, TypeDues } from '../core/models';

Chart.register(...registerables);

const PALETTE = ['#2f6b3a', '#d9a441', '#3b7dd8', '#b5533c', '#7a5cc2', '#2a9d8f', '#c0568f', '#8a8f3a'];
const PAID = '#2f6b3a';
const REMAINING = '#d9a441';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type RGB = [number, number, number];
type PdfCell = string | { content: string; styles: { textColor?: RGB; fontStyle?: 'bold' | 'normal' } };

interface MonthCell { due: number; got: number }
interface InvestorMatrix { name: string; types: { name: string; cells: MonthCell[] }[] }
interface MonthMatrix { months: number[]; investors: InvestorMatrix[] }

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
        <div class="toolbar">
          <h2>Paid vs remaining by investor <span class="muted">· as of {{ dues.value()?.as_of }}</span></h2>
          <button type="button" [class.is-loading]="reportBusy()" [disabled]="reportBusy() || !rows().length" (click)="openReport()">{{ reportBusy() ? 'Preparing PDF…' : 'PDF report' }}</button>
        </div>
        @if (reportError()) { <p class="error" role="alert">{{ reportError() }}</p> }
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

  protected readonly reportBusy = signal(false);
  protected readonly reportError = signal('');

  /** Builds the PDF in the browser (nothing is saved or uploaded) and opens it in a new tab. */
  async openReport() {
    // Open the tab synchronously inside the click so pop-up blockers allow it, then point it at the PDF.
    const tab = window.open('', '_blank');
    if (!tab) { this.reportError.set('Your browser blocked the new tab. Allow pop-ups for this site and try again.'); return; }
    tab.opener = null;
    tab.document.write('<title>Generating report…</title><p style="font:16px system-ui;padding:2rem">Generating report…</p>');
    this.reportError.set('');
    this.reportBusy.set(true);
    try {
      tab.location.href = await this.buildReport();
    } catch {
      tab.close();
      this.reportError.set('Could not create the PDF report.');
    } finally {
      this.reportBusy.set(false);
    }
  }

  private async buildReport(): Promise<string> {
    // Loaded on demand so the PDF libraries stay out of the main bundle.
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const rows = this.tableRows();
    const matrix = await this.monthMatrix();
    const scope = this.tab() ? this.summary().scope : 'All types';
    const asOf = this.dues.value()?.as_of ?? '';
    const money = (n: number) => 'PKR ' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
    const status = (r: { remaining: number; ahead: number; owed: number }) =>
      r.remaining > 0 ? 'Behind' : r.ahead > 0 ? `Ahead ${money(r.ahead)}` : r.owed > 0 ? 'Settled' : 'No request';

    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const width = pageWidth - margin * 2;

    doc.setFont('helvetica', 'bold').setFontSize(16).text('Lodhi Farms Investment', margin, 18);
    doc.setFont('helvetica', 'normal').setFontSize(12).text('Paid vs remaining by investor', margin, 25);
    doc.setFontSize(9).setTextColor(100).text(`Type: ${scope}   |   As of: ${asOf}   |   Generated: ${new Date().toLocaleDateString('en-GB')}`, margin, 31);
    doc.setTextColor(0);

    const chartHeight = (width * 440) / 1000;
    doc.addImage(this.chartImage(this.rows()), 'JPEG', margin, 35, width, chartHeight);

    const sum = (k: 'paid' | 'owed' | 'remaining') => rows.reduce((a, r) => a + r[k], 0);
    autoTable(doc, {
      startY: 35 + chartHeight + 6,
      margin: { left: margin, right: margin, bottom: 14 },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [47, 107, 58] },
      footStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: 'bold' },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      head: [['Investor', 'Type', 'Paid', 'Owed', 'Remaining', 'Status']],
      body: rows.map((r) => [r.name, r.type === '—' ? '-' : r.type, money(r.paid), money(r.owed), money(r.remaining), status(r)]),
      foot: [['Total', '', money(sum('paid')), money(sum('owed')), money(sum('remaining')), '']],
      didParseCell: (d) => {
        if (d.section !== 'body' || d.column.index !== 5) return;
        const text = String(d.cell.raw);
        if (text === 'Behind') d.cell.styles.textColor = [179, 38, 30];
        else if (text === 'Settled' || text.startsWith('Ahead')) d.cell.styles.textColor = [47, 107, 58];
      },
    });

    // Second section: one table per investor, types as rows and months as columns.
    const label = (i: number) => `${MONTH_NAMES[i % 12]} ${Math.floor(i / 12)}`;
    const num = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
    const GREEN: RGB = [47, 107, 58], RED: RGB = [179, 38, 30], GREY: RGB = [110, 110, 110];
    // Paid in full = green, short = red with the amount still missing (-), paid in a month with no request = grey.
    const cell = (c: MonthCell): PdfCell => {
      if (!c.due && !c.got) return { content: '-', styles: { textColor: GREY } };
      if (!c.due) return { content: num(c.got), styles: { textColor: GREY } };
      if (c.got >= c.due) return { content: num(c.got), styles: { textColor: GREEN } };
      return { content: `-${num(c.due - c.got)}`, styles: { textColor: RED, fontStyle: 'bold' } };
    };

    doc.addPage();
    let y = 20;
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(0).text('Investors with missing amounts, by month', margin, y);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(100)
      .text('Green = amount paid that month. Red with a minus (-) = amount still missing that month. Grey = paid with no request that month.', margin, y + 5);
    y += 13;
    if (!matrix.investors.length) {
      doc.setFontSize(10).setTextColor(47, 107, 58).text('No missing amounts. Everyone is up to date.', margin, y);
    }
    for (const investor of matrix.investors) {
      const bodyRows = investor.types.length * 7 + (investor.types.length > 1 ? 7 : 0);
      if (y + 6 + 8 + bodyRows > pageHeight - 14) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(0).text(investor.name, margin, y);

      const totalCells = matrix.months.map((_, i) => ({
        due: investor.types.reduce((a, t) => a + t.cells[i].due, 0),
        got: investor.types.reduce((a, t) => a + t.cells[i].got, 0),
      }));
      const typeTotal = (cells: MonthCell[]): PdfCell => {
        const due = cells.reduce((a, c) => a + c.due, 0), got = cells.reduce((a, c) => a + c.got, 0);
        return { content: `${num(got)} / ${num(due)}`, styles: { fontStyle: 'bold', textColor: got < due ? RED : GREEN } };
      };
      const body: PdfCell[][] = investor.types.map((t) => [t.name, ...t.cells.map(cell), typeTotal(t.cells)]);
      if (investor.types.length > 1) {
        body.push([
          { content: 'Total', styles: { fontStyle: 'bold' } },
          ...totalCells.map(cell),
          typeTotal(totalCells),
        ]);
      }
      const monthWidth = (width - 30 - 32) / matrix.months.length;
      const monthColumns = monthWidth >= 18 ? Object.fromEntries(matrix.months.map((_, i) => [i + 1, { cellWidth: monthWidth }])) : {};
      autoTable(doc, {
        startY: y + 2,
        margin: { left: margin, right: margin, bottom: 14 },
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1.8, halign: 'right' },
        headStyles: { fillColor: [47, 107, 58], halign: 'right' },
        columnStyles: { 0: { halign: 'left', cellWidth: 30 }, ...monthColumns, [matrix.months.length + 1]: { cellWidth: 32 } },
        horizontalPageBreak: true,
        horizontalPageBreakRepeat: 0,
        head: [['Type', ...matrix.months.map(label), 'Paid / requested']],
        body,
        didParseCell: (d) => {
          if (d.section === 'head' && d.column.index === 0) d.cell.styles.halign = 'left';
          if (d.section === 'body' && investor.types.length > 1 && d.row.index === body.length - 1) d.cell.styles.fillColor = [235, 235, 235];
        },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
    }

    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(120).text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }
    doc.setProperties({ title: `Paid vs remaining by investor - ${scope} - ${asOf}` });
    return String(doc.output('bloburl'));
  }

  /**
   * Per investor and type, what was requested and what was paid in each month (up to the as-of month).
   * Same investor order and type filter as the dashboard table; only investors with a missing amount are included.
   */
  private async monthMatrix(): Promise<MonthMatrix> {
    const dues = this.dues.value();
    if (!dues) return { months: [], investors: [] };
    const [requests, investments] = await Promise.all([firstValueFrom(this.api.requests()), firstValueFrom(this.api.investments())]);
    const tab = this.tab();
    const index = (month: string) => { const [y, m] = month.split('-').map(Number); return y * 12 + m - 1; };
    const last = index(dues.as_of);

    const due = new Map<string, number>();   // key: investor|type|month index
    const got = new Map<string, number>();
    const add = (map: Map<string, number>, key: string, n: number) => map.set(key, (map.get(key) ?? 0) + n);
    for (const r of requests) {
      if (tab && r.type_id !== tab) continue;
      const start = index(r.start_month);
      const end = r.recurring ? Math.min(r.end_month ? index(r.end_month) : last, last) : start;
      for (let m = start; m <= end && m <= last; m++) for (const investor of r.investor_ids) add(due, `${investor}|${r.type_id}|${m}`, r.amount);
    }
    for (const i of investments) {
      if (tab && i.type_id !== tab) continue;
      add(got, `${i.investor_id}|${i.type_id}|${index(i.month ?? i.date.slice(0, 7))}`, i.amount);
    }

    const all = [...due.keys(), ...got.keys()].map((k) => +k.split('|')[2]).filter((m) => m <= last);
    if (!all.length) return { months: [], investors: [] };
    const months = Array.from({ length: last - Math.min(...all) + 1 }, (_, i) => Math.min(...all) + i);

    const typeNames = new Map((this.stats.value()?.types ?? []).map((t) => [t.id, t.name]));
    const investors: InvestorMatrix[] = [];
    for (const row of this.rows()) {
      const typeIds = new Set<string>();
      for (const key of [...due.keys(), ...got.keys()]) {
        const [investor, typeId] = key.split('|');
        if (investor === row.id) typeIds.add(typeId);
      }
      const types = [...typeIds]
        .sort((a, b) => (typeNames.get(a) ?? '').localeCompare(typeNames.get(b) ?? ''))
        .map((typeId) => ({
          name: typeNames.get(typeId) ?? '-',
          cells: months.map((m) => ({ due: due.get(`${row.id}|${typeId}|${m}`) ?? 0, got: got.get(`${row.id}|${typeId}|${m}`) ?? 0 })),
        }));
      // Only investors who are short in at least one month make the report.
      if (types.some((t) => t.cells.some((c) => c.due > c.got))) investors.push({ name: row.name, types });
    }
    return { months, investors };
  }

  /** Renders the chart for print (dark text on white) so it stays readable when the app is in dark mode. */
  private chartImage(rows: DueRow[]): string {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 440;
    const ink = '#222222';
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.name),
        datasets: [
          { label: 'Paid', data: rows.map((r) => r.paid), backgroundColor: PAID },
          { label: 'Remaining', data: rows.map((r) => r.remaining), backgroundColor: REMAINING },
        ],
      },
      options: {
        responsive: false, animation: false, devicePixelRatio: 2,
        scales: {
          x: { stacked: true, ticks: { color: ink }, grid: { display: false } },
          y: { stacked: true, beginAtZero: true, ticks: { color: ink }, grid: { color: '#dddddd' } },
        },
        plugins: { legend: { labels: { color: ink } } },
      },
      plugins: [{
        id: 'whiteBackground',
        beforeDraw: (c) => { c.ctx.save(); c.ctx.globalCompositeOperation = 'destination-over'; c.ctx.fillStyle = '#ffffff'; c.ctx.fillRect(0, 0, c.width, c.height); c.ctx.restore(); },
      }],
    });
    const image = canvas.toDataURL('image/jpeg', 0.92); // the plugin paints a white background, so JPEG is safe and far smaller
    chart.destroy();
    return image;
  }

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
