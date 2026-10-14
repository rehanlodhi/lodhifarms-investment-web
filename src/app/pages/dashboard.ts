import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { Api } from '../core/api';
import { Stats } from '../core/models';

Chart.register(...registerables);

const PALETTE = ['#2f6b3a', '#d9a441', '#3b7dd8', '#b5533c', '#7a5cc2', '#2a9d8f', '#c0568f', '#8a8f3a'];

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Dashboard</h1>
    @if (stats.value(); as s) {
      <div class="grid">
        <div class="card"><div class="muted">Total raised</div><div class="stat">{{ s.total_raised | currency: 'PKR ' : 'symbol' : '1.0-0' }}</div></div>
        <div class="card"><div class="muted">Total goal</div><div class="stat">{{ s.total_goal | currency: 'PKR ' : 'symbol' : '1.0-0' }}</div></div>
        <div class="card"><div class="muted">Progress</div><div class="stat">{{ s.total_goal ? (s.total_raised / s.total_goal * 100).toFixed(1) : 0 }}%</div></div>
      </div>
      <section class="card">
        <h2>Raised vs goal by type</h2>
        <div class="canvas-box" [style.height.px]="height(s)"><canvas #goalCanvas role="img" aria-label="Raised versus goal for each investment type"></canvas></div>
      </section>
      <section class="card">
        <h2>Monthly contributions by type</h2>
        <div class="canvas-box" [style.height.px]="height(s)"><canvas #monthCanvas role="img" aria-label="Monthly contributions stacked per investment type"></canvas></div>
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
  private readonly goalCanvas = viewChild<ElementRef<HTMLCanvasElement>>('goalCanvas');
  private readonly monthCanvas = viewChild<ElementRef<HTMLCanvasElement>>('monthCanvas');

  protected height(s: Stats) { return Math.max(160, s.types.length * 70 + 70); }

  constructor() {
    effect((onCleanup) => {
      const s = this.stats.value();
      const g = this.goalCanvas(), m = this.monthCanvas();
      if (!s || !g || !m) return;
      const text = getComputedStyle(document.body).color;
      const grid = 'rgba(128,128,128,.25)';
      const base = { indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false };
      const scales = (stacked: boolean) => ({
        x: { stacked, beginAtZero: true, ticks: { color: text }, grid: { color: grid } },
        y: { stacked, ticks: { color: text }, grid: { display: false } },
      });
      const months = [...new Set(s.type_months.flatMap((t) => Object.keys(t.months)))].sort();

      const charts = [
        // Gantt-style progress: a wide goal track with a narrower raised bar on top.
        new Chart(g.nativeElement, {
          type: 'bar',
          data: {
            labels: s.types.map((t) => t.name),
            datasets: [
              { label: 'Goal', data: s.types.map((t) => t.goal), backgroundColor: 'rgba(128,128,128,.3)', grouped: false, barPercentage: 0.8, order: 2 },
              { label: 'Raised', data: s.types.map((t) => t.raised), backgroundColor: PALETTE[0], grouped: false, barPercentage: 0.45, order: 1 },
            ],
          },
          options: { ...base, scales: scales(false), plugins: { legend: { labels: { color: text } } } },
        }),
        // One bar per type, split into month segments.
        new Chart(m.nativeElement, {
          type: 'bar',
          data: {
            labels: s.type_months.map((t) => t.name),
            datasets: months.map((month, i) => ({
              label: month,
              data: s.type_months.map((t) => t.months[month] ?? 0),
              backgroundColor: PALETTE[i % PALETTE.length],
            })),
          },
          options: { ...base, scales: scales(true), plugins: { legend: { labels: { color: text } } } },
        }),
      ];
      onCleanup(() => charts.forEach((c) => c.destroy()));
    });
  }
}
