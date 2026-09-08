import { contract } from '@/api/contract';
import { upsertPrescription } from '@/core/programs';
import { formatted } from '@/api/dto';
import { authed } from '@/server/api';

export const PUT = authed<typeof contract.setPrescription, { weekId: string }>(
  contract.setPrescription,
  async ({ user, params, body }) => {
    const row = await upsertPrescription(user, { weekId: params.weekId, ...body });
    // An empty cell deletes the prescription and returns nulls, which is a
    // normal outcome and not an error.
    return { rawText: row?.rawText ?? null, formatted: row ? formatted(row.parsed) : null };
  },
);
