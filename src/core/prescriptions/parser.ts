/**
 * Parser for the week cell the coach types.
 *
 * The rule that shapes everything here: the raw text is always kept and
 * always wins on screen. Parsing is a bonus that unlocks progressions and
 * charts later; it is never allowed to reject a save. Anything the grammar
 * does not cover simply comes back as `text_only`, which is a normal
 * outcome and not an error.
 *
 * Grammar, taken from the real sheet:
 *
 *   prescription := amrap | block ('+' block)*
 *   amrap        := 'amrap' number ("'" | 'min')?
 *   block        := sets 'x' repSpec ('@' load)?
 *   repSpec      := number | 'rir' number ('/' number)? | 'max'
 *   load         := number 'kg'?
 *
 * A trailing `"` marks the work as a hold measured in seconds (`4xrir4"`),
 * a trailing `'` as minutes.
 */

export type PrescriptionUnit = 'reps' | 'seconds' | 'minutes';

export interface PrescriptionBlock {
  sets: number;
  /** Fixed repetitions, when the coach gave a number. */
  reps?: number;
  /** Reps in reserve. A single value is stored as an equal min/max range. */
  rir?: { min: number; max: number };
  /** `max`: as many as possible. */
  toFailure?: boolean;
  loadKg?: number;
  unit: PrescriptionUnit;
}

export type ParsedPrescription =
  | { kind: 'sets'; blocks: PrescriptionBlock[] }
  | { kind: 'amrap'; minutes: number };

export interface PrescriptionParseResult {
  status: 'parsed' | 'text_only';
  parsed: ParsedPrescription | null;
  /**
   * Flattened copy of the single-block case, mirrored into real columns so
   * that "show me the load progression" stays plain SQL. Null for compound
   * prescriptions, AMRAP, and anything unparsed.
   */
  sets: number | null;
  reps: number | null;
  loadKg: number | null;
}

const TEXT_ONLY: PrescriptionParseResult = {
  status: 'text_only',
  parsed: null,
  sets: null,
  reps: null,
  loadKg: null,
};

/** `22,5` and `22.5` are the same number to an Italian coach. */
function toNumber(raw: string): number | null {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Pulls a trailing `"` (seconds) or `'` (minutes) off a token. */
function takeUnit(token: string): { rest: string; unit: PrescriptionUnit } {
  if (token.endsWith('"') || token.endsWith('”') || token.endsWith('sec')) {
    return { rest: token.replace(/(sec|["”])$/, '').trim(), unit: 'seconds' };
  }
  if (token.endsWith("'") || token.endsWith('’') || token.endsWith('min')) {
    return { rest: token.replace(/(min|['’])$/, '').trim(), unit: 'minutes' };
  }
  return { rest: token, unit: 'reps' };
}

function parseLoad(token: string): number | null {
  const m = /^(\d+(?:[.,]\d+)?)\s*(?:kg)?$/.exec(token.trim().toLowerCase());
  return m?.[1] ? toNumber(m[1]) : null;
}

function parseBlock(text: string): PrescriptionBlock | null {
  const [work, loadPart, ...extra] = text.split('@').map((p) => p.trim());
  if (extra.length > 0 || !work) return null;

  let loadKg: number | undefined;
  if (loadPart !== undefined) {
    const load = parseLoad(loadPart);
    if (load === null) return null;
    loadKg = load;
  }

  // `4x2` -> sets 4, rep spec "2". The `x` may be surrounded by spaces.
  const m = /^(\d+)\s*x\s*(.+)$/i.exec(work);
  if (!m?.[1] || !m[2]) return null;

  const sets = Number(m[1]);
  if (sets <= 0) return null;

  const { rest, unit } = takeUnit(m[2].trim().toLowerCase());
  const block: PrescriptionBlock = { sets, unit };
  if (loadKg !== undefined) block.loadKg = loadKg;

  const rir = /^rir\s*(\d+)(?:\s*[/-]\s*(\d+))?$/.exec(rest);
  if (rir?.[1]) {
    const min = Number(rir[1]);
    const max = rir[2] ? Number(rir[2]) : min;
    // `rir4/3` and `rir3/4` mean the same range.
    block.rir = { min: Math.min(min, max), max: Math.max(min, max) };
    return block;
  }

  if (rest === 'max' || rest === 'amrap') {
    block.toFailure = true;
    return block;
  }

  const reps = /^(\d+)$/.exec(rest);
  if (reps?.[1]) {
    block.reps = Number(reps[1]);
    return block;
  }

  return null;
}

export function parsePrescription(rawText: string): PrescriptionParseResult {
  const text = rawText.trim();
  if (!text) return TEXT_ONLY;

  const amrap = /^amrap\s*(\d+(?:[.,]\d+)?)\s*(?:['’]|min|minuti)?$/i.exec(text);
  if (amrap?.[1]) {
    const minutes = toNumber(amrap[1]);
    if (minutes !== null && minutes > 0) {
      return { status: 'parsed', parsed: { kind: 'amrap', minutes }, sets: null, reps: null, loadKg: null };
    }
    return TEXT_ONLY;
  }

  const blocks: PrescriptionBlock[] = [];
  for (const part of text.split('+')) {
    const block = parseBlock(part.trim());
    // One unreadable block makes the whole cell text: a half-understood
    // prescription is worse than an honestly unparsed one.
    if (!block) return TEXT_ONLY;
    blocks.push(block);
  }
  if (blocks.length === 0) return TEXT_ONLY;

  const only = blocks.length === 1 ? blocks[0] : undefined;
  return {
    status: 'parsed',
    parsed: { kind: 'sets', blocks },
    sets: only?.sets ?? null,
    reps: only?.reps ?? null,
    loadKg: only?.loadKg ?? null,
  };
}

/** Renders the confirmation chip shown under the cell while the coach types. */
export function formatPrescription(parsed: ParsedPrescription): string {
  if (parsed.kind === 'amrap') return `AMRAP ${parsed.minutes}′`;

  return parsed.blocks
    .map((b) => {
      const suffix = b.unit === 'seconds' ? '″' : b.unit === 'minutes' ? '′' : '';
      let work: string;
      if (b.rir) {
        work = b.rir.min === b.rir.max ? `RIR ${b.rir.min}` : `RIR ${b.rir.min}–${b.rir.max}`;
      } else if (b.toFailure) {
        work = 'max';
      } else {
        work = `${b.reps ?? '?'}${suffix}`;
      }
      const rirSuffix = b.rir && suffix ? ` (${suffix === '″' ? 'sec' : 'min'})` : '';
      const load = b.loadKg !== undefined ? ` @ ${b.loadKg} kg` : '';
      return `${b.sets} × ${work}${rirSuffix}${load}`;
    })
    .join(' + ');
}
