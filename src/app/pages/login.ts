import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main style="max-width:360px;margin:12vh auto;padding:0 16px">
      <form class="card" [formGroup]="form" (ngSubmit)="submit()" style="display:grid;gap:1rem">
        <h1>Lodhi Farms Investment</h1>
        <label>Email <input type="email" formControlName="email" autocomplete="username" /></label>
        <label>Password <input type="password" formControlName="password" autocomplete="current-password" /></label>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <button class="primary" [disabled]="form.invalid || busy()">Sign in</button>
      </form>
    </main>
  `,
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required]],
    password: ['', Validators.required],
  });
  readonly error = signal('');
  readonly busy = signal(false);

  submit() {
    const { email, password } = this.form.getRawValue();
    this.busy.set(true);
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => { this.error.set('Incorrect email or password'); this.busy.set(false); },
    });
  }
}
