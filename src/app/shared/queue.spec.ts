import { match } from '../testing/fixtures';
import { queueInfo, queueText } from './queue';

describe('queueInfo', () => {
  const waiting = (id: string, position: number) => match({ id, position, status: 'QUEUED', table: null });
  const round = [
    match({ id: 'a', position: 1, status: 'ON_TABLE' }),
    match({ id: 'b', position: 2, status: 'ON_TABLE' }),
    waiting('c', 3),
    waiting('d', 4),
    waiting('e', 5),
    waiting('f', 6),
    waiting('g', 7),
  ];

  it('gibt Platz und Welle bei zwei Tischen an', () => {
    expect(queueInfo(round[2], round, 2)).toEqual({ position: 1, wave: 1 });
    expect(queueInfo(round[3], round, 2)).toEqual({ position: 2, wave: 1 });
    expect(queueInfo(round[4], round, 2)).toEqual({ position: 3, wave: 2 });
    expect(queueInfo(round[6], round, 2)).toEqual({ position: 5, wave: 3 });
  });

  it('sortiert nach der Reihenfolge der Auslosung, nicht nach der Reihenfolge in der Liste', () => {
    const shuffled = [round[4], round[2], round[3], round[0]];

    expect(queueInfo(round[4], shuffled, 2)).toEqual({ position: 3, wave: 2 });
  });

  it('zählt nur wartende Matches', () => {
    expect(queueInfo(round[2], round, 2)?.position).toBe(1);
  });

  it('hat für ein Match am Tisch keinen Platz', () => {
    expect(queueInfo(round[0], round, 2)).toBeNull();
  });

  it('hat für ein unbekanntes Match keinen Platz', () => {
    expect(queueInfo(waiting('x', 99), round, 2)).toBeNull();
  });

  it('rechnet mit mindestens einem Tisch', () => {
    expect(queueInfo(round[3], round, 0)).toEqual({ position: 2, wave: 2 });
  });
});

describe('queueText', () => {
  it.each([
    [{ position: 1, wave: 1 }, 'Du bist in der nächsten Welle dran (Platz 1 in der Warteschlange).'],
    [{ position: 3, wave: 2 }, 'Du bist in der übernächsten Welle dran (Platz 3 in der Warteschlange).'],
    [{ position: 7, wave: 4 }, 'Du bist in 4 Wellen dran (Platz 7 in der Warteschlange).'],
  ])('formuliert %j', (info, expected) => {
    expect(queueText(info)).toBe(expected);
  });
});
