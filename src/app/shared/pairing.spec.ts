import { ANNA, BEN, CLARA, DAVID, match, slot } from '../testing/fixtures';
import { joinNames, pairing, pairingText } from './pairing';

describe('pairing', () => {
  it('liefert Partner und Gegner aus Sicht von Team A', () => {
    expect(pairing(match({ mySide: 'A' }), ANNA.id)).toEqual({
      partner: 'Ben Beispiel',
      opponents: ['Clara Beispiel', 'David Beispiel'],
    });
  });

  it('liefert Partner und Gegner aus Sicht von Team B', () => {
    expect(pairing(match({ mySide: 'B' }), CLARA.id)).toEqual({
      partner: 'David Beispiel',
      opponents: ['Anna Beispiel', 'Ben Beispiel'],
    });
  });

  it('liefert nichts, wenn der Spieler nicht im Match steht', () => {
    expect(pairing(match({ mySide: null }), 'p-fremd')).toBeNull();
  });

  it('erkennt den Spieler auch als Einspringer auf einem Dummy-Platz', () => {
    const asStandIn = match({
      mySide: 'A',
      teamA: { members: [{ type: 'DUMMY', player: null, standIn: ANNA }, slot(BEN)] },
    });

    expect(pairing(asStandIn, ANNA.id)?.partner).toBe('Ben Beispiel');
  });

  it('kennzeichnet einen Gast als Partner und Einspringer bei den Gegnern', () => {
    const withGuest = match({
      mySide: 'A',
      teamA: { members: [slot(ANNA), { type: 'DUMMY', player: null, standIn: null }] },
      teamB: { members: [slot(CLARA), { type: 'DUMMY', player: null, standIn: DAVID }] },
    });

    expect(pairing(withGuest, ANNA.id)).toEqual({
      partner: 'Gast',
      opponents: ['Clara Beispiel', 'David Beispiel (Einspringer)'],
    });
  });

  it('hat ohne zweiten Spieler im Team keinen Partner', () => {
    const alone = match({ mySide: 'A', teamA: { members: [slot(ANNA)] } });

    expect(pairing(alone, ANNA.id)?.partner).toBeNull();
    expect(pairingText(pairing(alone, ANNA.id)!)).toBe('gegen Clara Beispiel und David Beispiel');
  });

  it('formuliert den Satz zum Spiel', () => {
    expect(pairingText(pairing(match(), ANNA.id)!)).toBe('mit Ben Beispiel gegen Clara Beispiel und David Beispiel');
  });
});

describe('joinNames', () => {
  it.each([
    [[], ''],
    [['Anna'], 'Anna'],
    [['Anna', 'Ben'], 'Anna und Ben'],
    [['Anna', 'Ben', 'Clara'], 'Anna, Ben und Clara'],
  ])('verbindet %j zu „%s“', (names, expected) => {
    expect(joinNames(names)).toBe(expected);
  });
});
