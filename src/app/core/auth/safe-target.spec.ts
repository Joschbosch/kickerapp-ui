import { clearAutoLogin, markAutoLogin, recentAutoLogin, safeTarget } from './safe-target';

describe('safeTarget', () => {
  it.each(['/turniere', '/turniere/42?x=1', '/admin/turniere/neu'])('lässt das Ziel %s innerhalb der App zu', (target) => {
    expect(safeTarget(target)).toBe(target);
  });

  it.each([undefined, null, '', 'turniere', '//evil.example', 'https://evil.example', 'javascript:alert(1)'])(
    'ersetzt das Ziel %s durch die Turnierliste',
    (target) => {
      expect(safeTarget(target)).toBe('/turniere');
    },
  );
});

describe('Schutz vor Weiterleitungsschleifen', () => {
  beforeEach(() => sessionStorage.clear());

  it('kennt ohne Weiterleitung nichts', () => {
    expect(recentAutoLogin()).toBe(false);
  });

  it('gilt nur kurz nach einer Weiterleitung', () => {
    markAutoLogin(1_000_000);

    expect(recentAutoLogin(1_000_000 + 14_999)).toBe(true);
    expect(recentAutoLogin(1_000_000 + 15_000)).toBe(false);
  });

  it('endet mit einer erfolgreichen Anmeldung', () => {
    markAutoLogin();
    clearAutoLogin();

    expect(recentAutoLogin()).toBe(false);
  });
});
