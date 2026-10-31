import { TestBed } from '@angular/core/testing';

import { loadConfig } from '../testing/config';
import { AppConfigService } from './app-config';

describe('AppConfigService', () => {
  const config = () => TestBed.inject(AppConfigService).config();

  it('hat Vorgaben für lokale Entwicklung', () => {
    expect(config()).toEqual({
      apiBaseUrl: 'http://localhost:8080',
      authMode: 'password',
      oidc: { authority: 'http://localhost:8180/realms/kickertool', clientId: 'kickertool-app' },
    });
  });

  it('übernimmt Backend-Adresse ohne abschließenden Schrägstrich und den Modus', async () => {
    await loadConfig({ apiBaseUrl: 'https://api.example.org//', authMode: 'oidc' });

    expect(config().apiBaseUrl).toBe('https://api.example.org');
    expect(config().authMode).toBe('oidc');
  });

  it('ergänzt fehlende OIDC-Angaben aus den Vorgaben', async () => {
    await loadConfig({ authMode: 'oidc', oidc: { authority: 'https://sso.example.org/realms/kicker' } });

    expect(config().oidc).toEqual({ authority: 'https://sso.example.org/realms/kicker', clientId: 'kickertool-app' });
  });

  it('baut Adressen am Backend', async () => {
    await loadConfig({ apiBaseUrl: 'https://api.example.org' });

    expect(TestBed.inject(AppConfigService).url('/api/me')).toBe('https://api.example.org/api/me');
  });

  it('meldet, wenn die Konfiguration nicht geladen werden kann', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    try {
      await expect(TestBed.inject(AppConfigService).load()).rejects.toThrow('config.json konnte nicht geladen werden (HTTP 404)');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
