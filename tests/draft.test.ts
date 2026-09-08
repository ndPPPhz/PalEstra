import { describe, expect, it } from 'vitest';
import { parseStructureDraft, validateStructureDraft } from '@/core/programs/draft';

describe('parseStructureDraft', () => {
  it('usa la riga vuota come separatore fra giornate', () => {
    expect(parseStructureDraft('Trazioni\nHSPU\n\nSquat\nStacco')).toEqual([
      { label: null, exercises: ['Trazioni', 'HSPU'] },
      { label: null, exercises: ['Squat', 'Stacco'] },
    ]);
  });

  it('riconosce l’intestazione della giornata quando c’è', () => {
    expect(parseStructureDraft('DAY 1\nTrazioni\n\nGiorno 2\nSquat')).toEqual([
      { label: 'DAY 1', exercises: ['Trazioni'] },
      { label: 'Giorno 2', exercises: ['Squat'] },
    ]);
  });

  it('tollera elenchi puntati e numerati incollati da altrove', () => {
    expect(parseStructureDraft('- Trazioni\n* HSPU\n1. Panca piana')).toEqual([
      { label: null, exercises: ['Trazioni', 'HSPU', 'Panca piana'] },
    ]);
  });

  it('ignora spazi, righe vuote multiple e blocchi senza esercizi', () => {
    // "DAY 3" da solo è un errore di battitura, non una giornata vuota.
    expect(parseStructureDraft('  Trazioni  \n\n\n\nDAY 3\n\n  \n')).toEqual([
      { label: null, exercises: ['Trazioni'] },
    ]);
  });

  it('un testo vuoto non produce giornate', () => {
    expect(parseStructureDraft('   \n\n  ')).toEqual([]);
  });
});

describe('validateStructureDraft', () => {
  it('rifiuta una bozza vuota con un messaggio comprensibile', () => {
    expect(() => validateStructureDraft([])).toThrow(/almeno una giornata/);
  });

  it('mette un tetto alle giornate', () => {
    const days = Array.from({ length: 21 }, () => ({ label: null, exercises: ['x'] }));
    expect(() => validateStructureDraft(days)).toThrow(/Massimo 20 giornate/);
  });

  it('mette un tetto agli esercizi per giornata', () => {
    const days = [{ label: null, exercises: Array.from({ length: 61 }, (_, i) => `e${i}`) }];
    expect(() => validateStructureDraft(days)).toThrow(/Massimo 60 esercizi/);
  });
});
