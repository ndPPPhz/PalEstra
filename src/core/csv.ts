/**
 * Minimal RFC 4180 reader.
 *
 * Written by hand rather than pulled in as a dependency because the only
 * hard requirement is quoted fields: a feedback cell like
 * `"6,5,5,5 secondi"` is full of commas, and a naive split on `,` would
 * silently shred exactly the data worth importing.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
