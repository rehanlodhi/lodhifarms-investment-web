import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    header { display:flex; flex-wrap:wrap; align-items:center; gap:1rem; padding:.75rem 16px; background:var(--card); border-bottom:1px solid var(--line); }
    nav { display:flex; gap:.25rem; flex:1; flex-wrap:wrap; }
    nav a { padding:.35rem .7rem; border-radius:6px; color:var(--ink); text-decoration:none; }
    nav a.active { background:var(--brand); color:var(--brand-ink); }
    main { max-width:1100px; margin:0 auto; padding:16px; }
  `,
  template: `
    <header>
      <strong>🌾 Lodhi Farms</strong>
      <nav aria-label="Main">
        <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
        <a routerLink="/investments" routerLinkActive="active">Investments</a>
        <a routerLink="/requests" routerLinkActive="active">Requests</a>
        <a routerLink="/investors" routerLinkActive="active">Investors</a>
        <a routerLink="/types" routerLinkActive="active">Types</a>
      </nav>
      <button (click)="auth.logout()">Log out</button>
    </header>
    <main><router-outlet /></main>
  `,
})
export class Shell {
  protected readonly auth = inject(Auth);
}
