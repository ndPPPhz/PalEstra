'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { revokeSession } from '@/core/auth';
import { archiveExercise, createExercise } from '@/core/exercises';
import { createInvite, revokeInvite } from '@/core/relationships';
import {
  addDay,
  addWeek,
  completeMesocycle,
  completeSession,
  completeWeek,
  createMesocycle,
  publishWeek,
  reopenSession,
  setSessionNote,
} from '@/core/programs';
import { updateProfile } from '@/core/users';
import { SESSION_COOKIE, requireUserPage } from '@/server/session';

/**
 * Server actions for form submissions. Like the REST handlers, they only
 * identify the caller and delegate: every rule lives in src/core, so the
 * web app and the future native client cannot diverge in behaviour.
 */

const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export async function logoutAction() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(token);
  jar.delete(SESSION_COOKIE);
  redirect('/login');
}

export async function updateProfileAction(form: FormData) {
  const user = await requireUserPage();
  await updateProfile(user, {
    displayName: text(form, 'displayName'),
    publicName: text(form, 'publicName') || null,
  });
  revalidatePath('/', 'layout');
}

export async function createInviteAction(form: FormData) {
  const user = await requireUserPage();
  await createInvite(user, text(form, 'label'));
  revalidatePath('/atleti');
}

export async function revokeInviteAction(form: FormData) {
  const user = await requireUserPage();
  await revokeInvite(user, text(form, 'inviteId'));
  revalidatePath('/atleti');
}

export async function createExerciseAction(form: FormData) {
  const user = await requireUserPage();
  await createExercise(user, { name: text(form, 'name'), description: text(form, 'description') });
  revalidatePath('/esercizi');
}


export async function archiveExerciseAction(form: FormData) {
  const user = await requireUserPage();
  await archiveExercise(user, text(form, 'exerciseId'));
  revalidatePath('/esercizi');
}

export async function createMesocycleAction(form: FormData) {
  const user = await requireUserPage();
  const meso = await createMesocycle(user, {
    relationshipId: text(form, 'relationshipId'),
    title: text(form, 'title'),
  });
  redirect(`/schede/${meso.id}`);
}

export async function addDayAction(form: FormData) {
  const user = await requireUserPage();
  const mesocycleId = text(form, 'mesocycleId');
  await addDay(user, mesocycleId, text(form, 'label'));
  revalidatePath(`/schede/${mesocycleId}`);
}



export async function addWeekAction(form: FormData) {
  const user = await requireUserPage();
  const mesocycleId = text(form, 'mesocycleId');
  // Copy-forward is the default: it is what replaces the sheet's "Uguale".
  await addWeek(user, mesocycleId, { copyFromPrevious: form.get('copy') !== 'no' });
  revalidatePath(`/schede/${mesocycleId}`);
}

export async function publishWeekAction(form: FormData) {
  const user = await requireUserPage();
  await publishWeek(user, text(form, 'weekId'));
  revalidatePath(`/schede/${text(form, 'mesocycleId')}`);
  revalidatePath('/home');
}

export async function completeMesocycleAction(form: FormData) {
  const user = await requireUserPage();
  await completeMesocycle(user, text(form, 'mesocycleId'));
  revalidatePath('/home');
  revalidatePath(`/schede/${text(form, 'mesocycleId')}`);
}

export async function completeSessionAction(form: FormData) {
  const user = await requireUserPage();
  await completeSession(user, text(form, 'sessionId'));
  revalidatePath('/', 'layout');
}

export async function reopenSessionAction(form: FormData) {
  const user = await requireUserPage();
  await reopenSession(user, text(form, 'sessionId'));
  revalidatePath('/', 'layout');
}

export async function completeWeekAction(form: FormData) {
  const user = await requireUserPage();
  await completeWeek(user, text(form, 'weekId'));
  revalidatePath('/', 'layout');
}

export async function setSessionNoteAction(form: FormData) {
  const user = await requireUserPage();
  await setSessionNote(user, text(form, 'sessionId'), text(form, 'note'));
  revalidatePath(`/allenamenti/${text(form, 'sessionId')}`);
}
