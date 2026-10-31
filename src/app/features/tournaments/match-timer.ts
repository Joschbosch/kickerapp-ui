import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

const KEY_PREFIX = 'kickertool.timer.';

/**
 * Zähler für die Spielzeit eines Matches. Das Backend kennt keinen Startzeitpunkt, deshalb startet man ihn am Tisch von
 * Hand. Er läuft nur in diesem Browser, übersteht aber ein Neuladen (Startzeit im `sessionStorage`). Läuft die Zeit ab,
 * vibriert das Gerät einmal.
 */
@Component({
  selector: 'app-match-timer',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (startedAt() === null) {
      <button mat-stroked-button type="button" (click)="start()">
        <mat-icon aria-hidden="true">timer</mat-icon>
        Spielzeit starten ({{ minutes() }} Min.)
      </button>
    } @else {
      <span class="clock" [class.over]="over()" role="timer">{{ display() }}</span>
      @if (over()) {
        <strong class="over-text" role="status">Zeit ist um</strong>
      }
      <button mat-button type="button" (click)="reset()">Zurücksetzen</button>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }

    .clock {
      font: var(--mat-sys-headline-small);
      font-variant-numeric: tabular-nums;
    }

    .over,
    .over-text {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchTimer {
  readonly matchId = input.required<string>();
  readonly minutes = input.required<number>();

  protected readonly startedAt = signal<number | null>(null);
  private readonly now = signal(Date.now());
  private signalled = false;

  private readonly remainingMs = computed(() => {
    const started = this.startedAt();
    return started === null ? null : Math.max(0, started + this.minutes() * 60_000 - this.now());
  });
  protected readonly over = computed(() => this.remainingMs() === 0);
  protected readonly display = computed(() => {
    const seconds = Math.ceil((this.remainingMs() ?? 0) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  });

  constructor() {
    // Beim Wechsel auf ein anderes Match die gespeicherte Startzeit dieses Matches laden
    effect(() => {
      const stored = read(this.matchId());
      untracked(() => {
        this.signalled = false;
        this.startedAt.set(stored);
        this.now.set(Date.now());
      });
    });

    // Solange die Zeit läuft, jede Sekunde nachrechnen
    effect((onCleanup) => {
      if (this.startedAt() !== null && !this.over()) {
        const timer = setInterval(() => {
          this.now.set(Date.now());
          if (this.over() && !this.signalled) {
            this.signalled = true;
            vibrate();
          }
        }, 1000);
        onCleanup(() => clearInterval(timer));
      }
    });
  }

  protected start(): void {
    const now = Date.now();
    write(this.matchId(), now);
    this.signalled = false;
    this.now.set(now);
    this.startedAt.set(now);
  }

  protected reset(): void {
    write(this.matchId(), null);
    this.startedAt.set(null);
  }
}

function read(matchId: string): number | null {
  try {
    const value = Number(sessionStorage.getItem(KEY_PREFIX + matchId));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

function write(matchId: string, value: number | null): void {
  try {
    if (value === null) {
      sessionStorage.removeItem(KEY_PREFIX + matchId);
    } else {
      sessionStorage.setItem(KEY_PREFIX + matchId, String(value));
    }
  } catch {
    // Speicher gesperrt: der Zähler läuft dann nur bis zum Neuladen
  }
}

function vibrate(): void {
  try {
    navigator.vibrate?.([300, 150, 300]);
  } catch {
    // nicht überall verfügbar
  }
}
