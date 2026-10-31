import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { EVENT_SOURCE_FACTORY, LiveMessage, LiveUpdates, RETRY_FIRST_MS, RETRY_MAX_MS } from './live-updates';

const TICKET_URL = 'http://localhost:8080/api/tournaments/t1/events/ticket';
const TICKET = { ticket: 'abc', expiresInSeconds: 120, streamUrl: '/api/tournaments/t1/events?ticket=abc' };
const STREAM_URL = 'http://localhost:8080/api/tournaments/t1/events?ticket=abc';

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

/** Ein `EventSource` zum Steuern aus dem Test. */
class FakeEventSource {
  readyState = OPEN;
  onerror: (() => void) | null = null;
  closed = false;
  private readonly listeners = new Map<string, ((event: Event) => void)[]>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
    this.readyState = CLOSED;
  }

  emit(type: string, lastEventId = ''): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new MessageEvent(type, { lastEventId, data: '{}' }));
    }
  }

  fail(readyState: number): void {
    this.readyState = readyState;
    this.onerror?.();
  }
}

describe('LiveUpdates', () => {
  let http: HttpTestingController;
  let sources: FakeEventSource[];
  let messages: LiveMessage[];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    sources = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: EVENT_SOURCE_FACTORY,
          useValue: (url: string) => {
            const source = new FakeEventSource(url);
            sources.push(source);
            return source;
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    messages = [];
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      vi.useRealTimers();
    }
  });

  const statuses = () => messages.flatMap((message) => (message.kind === 'status' ? [message.status] : []));
  const changes = () => messages.filter((message) => message.kind === 'change');

  async function settle(): Promise<void> {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
    }
  }

  /** Abonniert und beantwortet das Ticket, der Stream ist danach geöffnet. */
  async function open() {
    const subscription = TestBed.inject(LiveUpdates)
      .watch('t1')
      .subscribe((message) => messages.push(message));
    http.expectOne({ method: 'POST', url: TICKET_URL }).flush(TICKET);
    await settle();
    return subscription;
  }

  it('holt ein Ticket und öffnet den Stream mit dessen Adresse', async () => {
    await open();

    expect(sources.map((source) => source.url)).toEqual([STREAM_URL]);
    expect(statuses()).toEqual(['connecting']);

    sources[0].emit('connected');
    expect(statuses()).toEqual(['connecting', 'live']);
    expect(changes()).toEqual([]);
  });

  it('meldet eine Änderung bei jedem Änderungs-Event', async () => {
    await open();

    for (const type of ['TOURNAMENT_CHANGED', 'PARTICIPANTS_CHANGED', 'ROUND_STARTED', 'MATCHES_CHANGED', 'RANKING_CHANGED']) {
      sources[0].emit(type, 'x-1');
    }

    expect(changes()).toEqual(Array(5).fill({ kind: 'change', resync: false }));
  });

  it('meldet bei RESYNC, dass alles neu zu laden ist', async () => {
    await open();

    sources[0].emit('RESYNC', 'x-9');

    expect(changes()).toEqual([{ kind: 'change', resync: true }]);
  });

  it('lässt den Browser selbst neu verbinden und lädt danach zur Sicherheit neu', async () => {
    await open();
    sources[0].emit('connected');

    sources[0].fail(CONNECTING);
    expect(statuses().at(-1)).toBe('offline');
    expect(sources.length).toBe(1);
    http.expectNone(TICKET_URL);

    sources[0].emit('connected');
    expect(statuses().at(-1)).toBe('live');
    expect(changes()).toEqual([{ kind: 'change', resync: true }]);
  });

  it('verbindet sich nach einem endgültigen Abbruch mit neuem Ticket und der letzten Kennung neu', async () => {
    await open();
    sources[0].emit('connected');
    sources[0].emit('MATCHES_CHANGED', 'mf3k2a-17');

    sources[0].fail(CLOSED);
    expect(sources[0].closed).toBe(true);
    expect(statuses().at(-1)).toBe('offline');

    vi.advanceTimersByTime(RETRY_FIRST_MS);
    expect(statuses().at(-1)).toBe('connecting');
    http.expectOne(TICKET_URL).flush({ ...TICKET, ticket: 'neu', streamUrl: '/api/tournaments/t1/events?ticket=neu' });
    await settle();

    expect(sources[1].url).toBe('http://localhost:8080/api/tournaments/t1/events?ticket=neu&lastEventId=mf3k2a-17');
  });

  it('hängt keine Kennung an, solange noch kein Event kam', async () => {
    await open();
    sources[0].fail(CLOSED);

    vi.advanceTimersByTime(RETRY_FIRST_MS);
    http.expectOne(TICKET_URL).flush(TICKET);
    await settle();

    expect(sources[1].url).toBe(STREAM_URL);
  });

  it('versucht es bei einem Fehler am Ticket immer wieder, mit wachsendem Abstand', async () => {
    TestBed.inject(LiveUpdates)
      .watch('t1')
      .subscribe((message) => messages.push(message));

    let wait = RETRY_FIRST_MS;
    for (let i = 0; i < 6; i++) {
      http.expectOne(TICKET_URL).flush({}, { status: 503, statusText: 'Unavailable' });
      await settle();
      expect(statuses().at(-1)).toBe('offline');

      vi.advanceTimersByTime(wait - 1);
      http.expectNone(TICKET_URL);
      vi.advanceTimersByTime(1);
      wait = Math.min(wait * 2, RETRY_MAX_MS);
    }
    expect(wait).toBe(RETRY_MAX_MS);
    http.expectOne(TICKET_URL).flush(TICKET);
    await settle();
    expect(sources.length).toBe(1);
  });

  it('beginnt nach erfolgreichem Verbinden wieder mit dem kurzen Abstand', async () => {
    TestBed.inject(LiveUpdates)
      .watch('t1')
      .subscribe((message) => messages.push(message));
    http.expectOne(TICKET_URL).flush({}, { status: 503, statusText: 'Unavailable' });
    await settle();
    vi.advanceTimersByTime(RETRY_FIRST_MS);
    http.expectOne(TICKET_URL).flush(TICKET);
    await settle();
    sources[0].emit('connected');

    sources[0].fail(CLOSED);
    vi.advanceTimersByTime(RETRY_FIRST_MS);

    http.expectOne(TICKET_URL).flush(TICKET);
    await settle();
  });

  it('schließt den Stream, wenn niemand mehr zuhört', async () => {
    const subscription = await open();

    subscription.unsubscribe();

    expect(sources[0].closed).toBe(true);
  });

  it('öffnet nach dem Abbestellen keinen Stream mehr, auch wenn das Ticket noch kommt', async () => {
    const subscription = TestBed.inject(LiveUpdates)
      .watch('t1')
      .subscribe((message) => messages.push(message));

    subscription.unsubscribe();
    http.expectOne(TICKET_URL).flush(TICKET);
    await settle();

    expect(sources).toEqual([]);
  });

  it('versucht es nach dem Abbestellen nicht mehr', async () => {
    const subscription = await open();
    sources[0].fail(CLOSED);

    subscription.unsubscribe();
    vi.advanceTimersByTime(RETRY_MAX_MS);

    http.expectNone(TICKET_URL);
  });
});
