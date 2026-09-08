import { describe, expect, it } from 'vitest';
import { parseCsv } from '@/core/csv';

describe('parseCsv', () => {
  it('tiene insieme i campi con le virgole, come i feedback veri', () => {
    // "6,5,5,5 secondi" is a single feedback cell in the real sheet.
    expect(parseCsv('TED,"6,5,5,5 secondi",4')).toEqual([['TED', '6,5,5,5 secondi', '4']]);
  });

  it('gestisce virgolette raddoppiate e ritorni a capo dentro le celle', () => {
    expect(parseCsv('a,"dice ""ciao""","riga1\nriga2"')).toEqual([['a', 'dice "ciao"', 'riga1\nriga2']]);
  });

  it('legge più righe e celle vuote', () => {
    expect(parseCsv('DAY 1,,\nTRAZIONI,4x2@20kg,')).toEqual([
      ['DAY 1', '', ''],
      ['TRAZIONI', '4x2@20kg', ''],
    ]);
  });
});
