import { BrowserAlertEffects, TurnCall, callBody, callLine, callTitle } from './alert-effects';

const CALL: TurnCall = {
  matchId: 'm1',
  tournamentId: 't1',
  tournamentName: 'Demo-Turnier',
  round: 3,
  table: 2,
  partner: 'Ben Beispiel',
  opponents: ['Clara Beispiel', 'David Beispiel'],
};

describe('Texte zum Aufruf', () => {
  it('nennt den Tisch im Titel', () => {
    expect(callTitle(CALL)).toBe('Du bist dran – Tisch 2');
  });

  it('beschreibt Partner und Gegner', () => {
    expect(callLine(CALL)).toBe('Mit Ben Beispiel gegen Clara Beispiel und David Beispiel');
  });

  it('nennt im Text auch Turnier und Runde', () => {
    expect(callBody(CALL)).toBe('Mit Ben Beispiel gegen Clara Beispiel und David Beispiel · Demo-Turnier, Runde 3');
  });

  it('kommt ohne Partner aus', () => {
    expect(callLine({ ...CALL, partner: null })).toBe('Gegen Clara Beispiel und David Beispiel');
  });
});

describe('BrowserAlertEffects', () => {
  let vibrate: ReturnType<typeof vi.fn>;
  let showNotification: ReturnType<typeof vi.fn>;
  let created: { title: string; options: NotificationOptions }[];
  let oscillators: number;
  let audioState: AudioContextState;

  function setVisibility(value: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', { value, configurable: true });
  }

  function stubNotification(permission: NotificationPermission): void {
    class FakeNotification {
      static permission = permission;
      static requestPermission = vi.fn().mockResolvedValue('granted');
      constructor(title: string, options: NotificationOptions) {
        created.push({ title, options });
      }
    }
    vi.stubGlobal('Notification', FakeNotification);
  }

  beforeEach(() => {
    created = [];
    oscillators = 0;
    audioState = 'running';
    vibrate = vi.fn();
    showNotification = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: vi.fn().mockResolvedValue({ showNotification }) },
      configurable: true,
    });
    setVisibility('visible');
    stubNotification('granted');
    vi.stubGlobal(
      'AudioContext',
      class {
        currentTime = 0;
        destination = {};
        get state() {
          return audioState;
        }
        resume = vi.fn().mockResolvedValue(undefined);
        createGain() {
          const param = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
          return { gain: param, connect: (next: unknown) => next };
        }
        createOscillator() {
          oscillators++;
          return { frequency: {}, connect: (next: unknown) => next, start: vi.fn(), stop: vi.fn() };
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'vibrate');
    Reflect.deleteProperty(navigator, 'serviceWorker');
    Reflect.deleteProperty(document, 'visibilityState');
  });

  /** Ein Tippen auf die Seite schaltet den Ton frei, wie in einem echten Browser. */
  const unlockAudio = () => window.dispatchEvent(new Event('pointerdown'));

  it('vibriert bei jedem Aufruf', () => {
    new BrowserAlertEffects().announce(CALL, { sound: false });

    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('spielt drei Töne, wenn der Ton an ist und die Seite freigeschaltet wurde', () => {
    const effects = new BrowserAlertEffects();
    unlockAudio();

    effects.announce(CALL, { sound: true });

    expect(oscillators).toBe(3);
  });

  it('bleibt stumm, wenn der Ton aus ist', () => {
    const effects = new BrowserAlertEffects();
    unlockAudio();

    effects.announce(CALL, { sound: false });

    expect(oscillators).toBe(0);
  });

  it('bleibt stumm, solange der Browser den Ton noch nicht freigegeben hat', () => {
    const effects = new BrowserAlertEffects();

    effects.announce(CALL, { sound: true });
    expect(oscillators).toBe(0);

    unlockAudio();
    audioState = 'suspended';
    effects.announce(CALL, { sound: true });
    expect(oscillators).toBe(0);
  });

  it('zeigt bei sichtbarer Seite keine Systembenachrichtigung, der Hinweis in der App genügt', async () => {
    new BrowserAlertEffects().announce(CALL, { sound: false });
    await Promise.resolve();

    expect(showNotification).not.toHaveBeenCalled();
    expect(created).toEqual([]);
  });

  it('zeigt bei versteckter Seite eine Systembenachrichtigung über den Service Worker', async () => {
    setVisibility('hidden');

    new BrowserAlertEffects().announce(CALL, { sound: false });
    await vi.waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));

    const [title, options] = showNotification.mock.calls[0] as [string, NotificationOptions];
    expect(title).toBe('Du bist dran – Tisch 2');
    expect(options.body).toBe('Mit Ben Beispiel gegen Clara Beispiel und David Beispiel · Demo-Turnier, Runde 3');
    expect(options.tag).toBe('call-m1');
    expect(options.data).toEqual({
      onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: '/turniere/t1' } },
    });
  });

  it('nimmt ohne Service Worker die einfache Benachrichtigung', async () => {
    setVisibility('hidden');
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });

    new BrowserAlertEffects().announce(CALL, { sound: false });
    await vi.waitFor(() => expect(created.length).toBe(1));

    expect(created[0].title).toBe('Du bist dran – Tisch 2');
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('zeigt ohne Erlaubnis keine Systembenachrichtigung', async () => {
    setVisibility('hidden');
    stubNotification('default');

    new BrowserAlertEffects().announce(CALL, { sound: false });
    await Promise.resolve();

    expect(showNotification).not.toHaveBeenCalled();
    expect(created).toEqual([]);
  });

  it('übersteht eine fehlschlagende Benachrichtigung', async () => {
    setVisibility('hidden');
    showNotification.mockRejectedValue(new Error('nicht erlaubt'));

    expect(() => new BrowserAlertEffects().announce(CALL, { sound: false })).not.toThrow();
    await vi.waitFor(() => expect(showNotification).toHaveBeenCalled());
  });

  it('übersteht fehlende Vibration', () => {
    Reflect.deleteProperty(navigator, 'vibrate');

    expect(() => new BrowserAlertEffects().announce(CALL, { sound: false })).not.toThrow();
  });

  describe('Erlaubnis', () => {
    it('gibt den Stand der Erlaubnis weiter', () => {
      stubNotification('default');

      expect(new BrowserAlertEffects().permission()).toBe('default');
    });

    it('meldet, wenn der Browser keine Benachrichtigungen kennt', async () => {
      vi.stubGlobal('Notification', undefined);
      const effects = new BrowserAlertEffects();

      expect(effects.permission()).toBe('unsupported');
      expect(await effects.requestPermission()).toBe('unsupported');
    });

    it('fragt den Nutzer', async () => {
      stubNotification('default');

      expect(await new BrowserAlertEffects().requestPermission()).toBe('granted');
    });
  });
});
