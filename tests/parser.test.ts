import { describe, expect, it } from 'vitest';
import { formatPrescription, parsePrescription } from '@/core/prescriptions/parser';

/**
 * Every string below is a real cell from the ANNINO ALLENAMENTO sheet
 * (including the typos). If the parser stops understanding these, it has
 * stopped understanding the coach it was built for.
 */
describe('parsePrescription — celle vere del foglio', () => {
  const cases: Array<[string, { sets: number | null; reps: number | null; loadKg: number | null }]> = [
    ['4x2@20kg', { sets: 4, reps: 2, loadKg: 20 }],
    ['5x2@20kg', { sets: 5, reps: 2, loadKg: 20 }],
    ['5x2@22.5kg', { sets: 5, reps: 2, loadKg: 22.5 }],
    ['2x4@10kg', { sets: 2, reps: 4, loadKg: 10 }],
    ['2x4@11.5kg', { sets: 2, reps: 4, loadKg: 11.5 }],
    ['3x2@1kg', { sets: 3, reps: 2, loadKg: 1 }],
    ['4x4@90kg', { sets: 4, reps: 4, loadKg: 90 }],
    ['4x4@92.5kg', { sets: 4, reps: 4, loadKg: 92.5 }],
    ['2x6@77.5kg', { sets: 2, reps: 6, loadKg: 77.5 }],
    ['4x2', { sets: 4, reps: 2, loadKg: null }],
    ['3x3', { sets: 3, reps: 3, loadKg: null }],
    ['4x4', { sets: 4, reps: 4, loadKg: null }],
  ];

  it.each(cases)('%s', (input, expected) => {
    const result = parsePrescription(input);
    expect(result.status).toBe('parsed');
    expect({ sets: result.sets, reps: result.reps, loadKg: result.loadKg }).toEqual(expected);
  });

  it('4xrir4" — tenuta isometrica in secondi', () => {
    const result = parsePrescription('4xrir4"');
    expect(result.status).toBe('parsed');
    expect(result.parsed).toEqual({
      kind: 'sets',
      blocks: [{ sets: 4, unit: 'seconds', rir: { min: 4, max: 4 } }],
    });
    // RIR is not a rep count, so the flat columns stay empty.
    expect(result.reps).toBeNull();
  });

  it('3xrir3/4 — RIR come intervallo', () => {
    const result = parsePrescription('3xrir3/4');
    expect(result.parsed).toEqual({
      kind: 'sets',
      blocks: [{ sets: 3, unit: 'reps', rir: { min: 3, max: 4 } }],
    });
  });

  it('3x2@50kg+1x6@35kg — prescrizione composta', () => {
    const result = parsePrescription('3x2@50kg+1x6@35kg');
    expect(result.status).toBe('parsed');
    expect(result.parsed).toEqual({
      kind: 'sets',
      blocks: [
        { sets: 3, reps: 2, loadKg: 50, unit: 'reps' },
        { sets: 1, reps: 6, loadKg: 35, unit: 'reps' },
      ],
    });
    // Two blocks do not fit three columns, so they stay in the JSON only.
    expect(result.sets).toBeNull();
    expect(result.loadKg).toBeNull();
  });

  it.each([
    ["AMRAP 8'", 8],
    ["AMRAP 9'", 9],
  ])('%s', (input, minutes) => {
    expect(parsePrescription(input).parsed).toEqual({ kind: 'amrap', minutes });
  });
});

describe('il fallback testuale è una feature, non un errore', () => {
  // These are the "same as last week" and relative shorthands the sheet
  // needs. Copy-forward makes them unnecessary in the app, but a coach
  // typing them must never see a validation error.
  it.each(['Uguale', 'Uguslr', 'Mantieni uguale', '1 serie in più', 'boh, a sensazione', '  '])(
    '%s -> text_only',
    (input) => {
      const result = parsePrescription(input);
      expect(result.status).toBe('text_only');
      expect(result.parsed).toBeNull();
      expect(result.sets).toBeNull();
    },
  );

  it('un blocco illeggibile invalida tutta la cella', () => {
    // Half-understanding "3x2@50kg + qualcosa" would silently drop work.
    expect(parsePrescription('3x2@50kg+qualcosa').status).toBe('text_only');
  });
});

describe('tolleranza sulla digitazione', () => {
  it.each(['4 x 2 @ 20 kg', '4X2@20KG', '4x2@20', '4x2@20,0kg'])('%s', (input) => {
    const r = parsePrescription(input);
    expect({ sets: r.sets, reps: r.reps, loadKg: r.loadKg }).toEqual({ sets: 4, reps: 2, loadKg: 20 });
  });

  it('mantiene il carico anche con RIR', () => {
    expect(parsePrescription('4xrir4@20kg').parsed).toEqual({
      kind: 'sets',
      blocks: [{ sets: 4, unit: 'reps', rir: { min: 4, max: 4 }, loadKg: 20 }],
    });
  });
});

describe('formatPrescription — la chip di conferma sotto la cella', () => {
  it.each([
    ['4x2@20kg', '4 × 2 @ 20 kg'],
    ['4xrir4"', '4 × RIR 4 (sec)'],
    ['3xrir3/4', '3 × RIR 3–4'],
    ['3x2@50kg+1x6@35kg', '3 × 2 @ 50 kg + 1 × 6 @ 35 kg'],
    ["AMRAP 8'", 'AMRAP 8′'],
  ])('%s -> %s', (input, expected) => {
    const parsed = parsePrescription(input).parsed;
    expect(parsed).not.toBeNull();
    expect(formatPrescription(parsed!)).toBe(expected);
  });
});
