import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { LiveStatus } from '../core/events/live-updates';

const LABEL: Record<LiveStatus, string> = {
  live: 'Live',
  connecting: 'Verbinde …',
  offline: 'Offline',
};

const HINT: Record<LiveStatus, string> = {
  live: 'Änderungen erscheinen sofort.',
  connecting: 'Die Live-Verbindung wird aufgebaut.',
  offline: 'Keine Live-Verbindung, die Seite fragt in Abständen selbst nach.',
};

/** Kleine Anzeige, ob die Seite Live-Updates bekommt. */
@Component({
  selector: 'app-live-badge',
  template: `<span class="badge" [attr.data-status]="status()" [title]="hint()" role="status">
    <span class="dot" aria-hidden="true"></span>{{ label() }}
  </span>`,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 1px 10px 1px 8px;
      border-radius: 12px;
      font: var(--mat-sys-label-small);
      background: var(--mat-sys-surface-container-highest);
      color: var(--mat-sys-on-surface-variant);
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--mat-sys-outline);
    }

    [data-status='live'] .dot {
      background: #2e7d32;
    }

    [data-status='offline'] .dot {
      background: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveBadge {
  readonly status = input.required<LiveStatus>();

  protected label(): string {
    return LABEL[this.status()];
  }

  protected hint(): string {
    return HINT[this.status()];
  }
}
