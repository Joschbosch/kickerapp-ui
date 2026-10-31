import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { controlledLiveUpdates } from '../../testing/live';
import { LIVE_DEBOUNCE_MS, liveReload } from './live-reload';

describe('liveReload', () => {
  let live: ReturnType<typeof controlledLiveUpdates>;
  let reload = vi.fn<() => void>();
  let busy: boolean;
  let id: ReturnType<typeof signal<string>>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    live = controlledLiveUpdates();
    TestBed.configureTestingModule({ providers: [live.provider] });
    reload = vi.fn<() => void>();
    busy = false;
    id = signal('t1');
  });

  afterEach(() => vi.useRealTimers());

  function start() {
    const status = TestBed.runInInjectionContext(() =>
      liveReload({ id, reload: () => reload(), busy: () => busy, fallbackMs: 15_000 }),
    );
    TestBed.tick();
    return status;
  }

  it('beginnt als „Verbinde“ und folgt dem Status des Streams', () => {
    const status = start();
    expect(status()).toBe('connecting');

    live.messages.next({ kind: 'status', status: 'live' });
    expect(status()).toBe('live');

    live.messages.next({ kind: 'status', status: 'offline' });
    expect(status()).toBe('offline');
  });

  it('verbindet sich mit dem Turnier der Seite', () => {
    start();

    expect(live.watched).toEqual(['t1']);
  });

  it('verbindet sich neu, wenn die Seite zu einem anderen Turnier wechselt', () => {
    start();

    id.set('t2');
    TestBed.tick();

    expect(live.watched).toEqual(['t1', 't2']);
  });

  it('lädt nach einer Änderung neu, gebündelt bei mehreren Events kurz hintereinander', () => {
    start();
    live.messages.next({ kind: 'status', status: 'live' });

    live.messages.next({ kind: 'change', resync: false });
    live.messages.next({ kind: 'change', resync: false });
    live.messages.next({ kind: 'change', resync: true });
    expect(reload).not.toHaveBeenCalled();

    vi.advanceTimersByTime(LIVE_DEBOUNCE_MS);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('fragt ohne Live-Verbindung in Abständen nach', () => {
    start();

    vi.advanceTimersByTime(15_000 * 2);

    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('fragt mit stehender Verbindung nicht nach', () => {
    start();
    live.messages.next({ kind: 'status', status: 'live' });
    TestBed.tick();

    vi.advanceTimersByTime(15_000 * 4);

    expect(reload).not.toHaveBeenCalled();
  });

  it('fragt wieder nach, sobald die Verbindung abreißt', () => {
    start();
    live.messages.next({ kind: 'status', status: 'live' });
    TestBed.tick();
    live.messages.next({ kind: 'status', status: 'offline' });
    TestBed.tick();

    vi.advanceTimersByTime(15_000);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('fragt nicht doppelt nach, solange noch geladen wird', () => {
    start();
    busy = true;

    vi.advanceTimersByTime(15_000);
    expect(reload).not.toHaveBeenCalled();

    busy = false;
    vi.advanceTimersByTime(15_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('hört auf, wenn die Seite zerstört wird', () => {
    start();
    live.messages.next({ kind: 'change', resync: false });

    TestBed.resetTestingModule();
    vi.advanceTimersByTime(60_000);

    expect(reload).not.toHaveBeenCalled();
    expect(live.messages.observed).toBe(false);
  });
});
