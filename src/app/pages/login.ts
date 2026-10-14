import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../core/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="login-wrap">
      <form class="card login-card" [formGroup]="form" (ngSubmit)="submit()">
        <h1>Lodhi Farms Investment</h1>
        <label>Username or email <input formControlName="username" autocomplete="username" /></label>
        <label>Password <input type="password" formControlName="password" autocomplete="current-password" /></label>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <button class="primary" [class.is-loading]="busy()" [disabled]="form.invalid || busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
      </form>
    </main>
  `,
})
export class Login {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });
  readonly error = signal('');
  readonly busy = signal(false);

  submit() {
    const { username, password } = this.form.getRawValue();
    this.busy.set(true);
    this.auth.login(username, password).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => { this.error.set('Incorrect username or password'); this.busy.set(false); },
    });
  }
}
