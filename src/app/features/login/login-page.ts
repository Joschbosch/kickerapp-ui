import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';

import { AppConfigService } from '../../core/app-config';
import { AuthService, LoginError } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  /** Die Seite, zu der nach der Anmeldung zurückgekehrt wird (Abfrageparameter `weiter`). */
  readonly weiter = input<string | undefined>();

  protected readonly developmentMode = inject(AppConfigService).config().authMode === 'password';
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const { username, password } = this.form.getRawValue();
      await this.auth.login(username.trim(), password);
      await this.router.navigateByUrl(this.safeTarget());
    } catch (error) {
      this.error.set(error instanceof LoginError ? error.message : 'Die Anmeldung ist fehlgeschlagen.');
    } finally {
      this.busy.set(false);
    }
  }

  /** Nur Ziele innerhalb der App, damit niemand über den Parameter auf eine fremde Seite geleitet werden kann. */
  private safeTarget(): string {
    const target = this.weiter();
    return target !== undefined && target.startsWith('/') && !target.startsWith('//') ? target : '/turniere';
  }
}
