import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';

import { AppConfigService } from '../../core/app-config';
import { AuthService, LoginError } from '../../core/auth/auth.service';
import { markAutoLogin, recentAutoLogin, safeTarget } from '../../core/auth/safe-target';

/**
 * Anmeldeseite. Im Entwicklungsmodus (`authMode: password`) ein Formular. Mit OIDC-Provider (`authMode: oidc`) leitet sie
 * ohne Eingabe zum Provider weiter. Dort ist meist nichts mehr einzugeben, wenn die Sitzung noch läuft, so holen sich
 * z. B. neu geöffnete Anzeige-Fenster ihre Anmeldung selbst.
 */
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
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  /** Die Seite, zu der nach der Anmeldung zurückgekehrt wird (Abfrageparameter `weiter`). */
  readonly weiter = input<string | undefined>();
  /** Gesetzt auf der Seite `/abgemeldet`: Dort gibt es keine automatische Weiterleitung. */
  readonly abgemeldet = input(false);

  private readonly authMode = inject(AppConfigService).config().authMode;
  protected readonly developmentMode = this.authMode === 'password';
  protected readonly provider = this.authMode === 'oidc';
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  ngOnInit(): void {
    if (this.provider && !this.abgemeldet()) {
      void this.signInWithProvider(true);
    }
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const { username, password } = this.form.getRawValue();
      await this.auth.login(username.trim(), password);
      await this.router.navigateByUrl(safeTarget(this.weiter()));
    } catch (error) {
      this.error.set(error instanceof LoginError ? error.message : 'Die Anmeldung ist fehlgeschlagen.');
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Leitet zum Provider. Automatisch nur, wenn nicht gerade erst eine Weiterleitung lief, sonst würde eine Anmeldung, die
   * das Backend ablehnt, endlos zwischen App und Provider pendeln.
   */
  protected async signInWithProvider(automatic = false): Promise<void> {
    if (this.busy()) {
      return;
    }
    if (automatic && recentAutoLogin()) {
      this.error.set('Die Anmeldung hat nicht geklappt. Bitte noch einmal versuchen.');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    markAutoLogin();
    try {
      await this.auth.startLogin(safeTarget(this.weiter()));
      // Der Browser wechselt jetzt zum Provider, `busy` bleibt bis dahin gesetzt
    } catch (error) {
      this.error.set(error instanceof LoginError ? error.message : 'Der Anmeldeserver ist nicht erreichbar.');
      this.busy.set(false);
    }
  }
}
