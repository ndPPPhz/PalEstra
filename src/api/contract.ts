import { z } from 'zod';
import {
  AthleteDto,
  CoachDto,
  DayViewDto,
  ExerciseDto,
  GridDto,
  InviteDto,
  InvitePreviewDto,
  MesocycleSummaryDto,
  OkDto,
  PendingUpdateDto,
  UserDto,
  WeekViewDto,
} from './dto';

/**
 * The single description of the HTTP surface.
 *
 * Route handlers validate against these schemas and
 * `npm run openapi` turns the same object into openapi/openapi.json, which
 * Apple's swift-openapi-generator compiles into a typed Swift client. One
 * definition, so the iOS app cannot drift away from the server: rename a
 * field here and the Swift build breaks instead of the app crashing.
 */
export interface Endpoint {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  summary: string;
  auth: boolean;
  body?: z.ZodTypeAny;
  response: z.ZodTypeAny;
}

const uuid = z.string().uuid();

export const contract = {
  requestOtp: {
    method: 'post',
    path: '/auth/otp',
    summary: 'Invia un codice di accesso a 6 cifre via email',
    auth: false,
    body: z.object({ email: z.string().email() }),
    // devCode is returned outside production only, so that `npm run dev`
    // and the end-to-end tests do not need a mailbox.
    response: z.object({ ok: z.literal(true), devCode: z.string().optional() }),
  },
  createSession: {
    method: 'post',
    path: '/auth/session',
    summary: 'Verifica il codice e apre una sessione',
    auth: false,
    body: z.object({ email: z.string().email(), code: z.string().min(4).max(10) }),
    // The browser also receives an httpOnly cookie; a native client stores
    // this token in the Keychain and sends it as a bearer header.
    response: z.object({ token: z.string(), user: UserDto, isNewUser: z.boolean() }),
  },
  deleteSession: {
    method: 'delete',
    path: '/auth/session',
    summary: 'Chiude la sessione corrente',
    auth: true,
    response: OkDto,
  },
  me: {
    method: 'get',
    path: '/me',
    summary: 'Profilo dell’utente autenticato',
    auth: true,
    response: UserDto,
  },
  updateMe: {
    method: 'patch',
    path: '/me',
    summary: 'Aggiorna nome visualizzato e handle',
    auth: true,
    body: z.object({
      displayName: z.string().min(1).max(80).optional(),
      publicName: z.string().max(120).nullable().optional(),
    }),
    response: UserDto,
  },

  listExercises: {
    method: 'get',
    path: '/exercises',
    summary: 'Libreria esercizi: i propri più quelli globali',
    auth: true,
    response: z.array(ExerciseDto),
  },
  createExercise: {
    method: 'post',
    path: '/exercises',
    summary: 'Aggiunge un esercizio alla propria libreria',
    auth: true,
    body: z.object({ name: z.string().min(1).max(120), description: z.string().max(4000).optional() }),
    response: ExerciseDto,
  },
  updateExercise: {
    method: 'patch',
    path: '/exercises/{exerciseId}',
    summary: 'Modifica un esercizio della propria libreria',
    auth: true,
    body: z.object({ name: z.string().min(1).max(120).optional(), description: z.string().max(4000).optional() }),
    response: ExerciseDto,
  },
  archiveExercise: {
    method: 'delete',
    path: '/exercises/{exerciseId}',
    summary: 'Archivia un esercizio (le schede vecchie restano valide)',
    auth: true,
    response: OkDto,
  },

  listInvites: {
    method: 'get',
    path: '/invites',
    summary: 'Inviti inviati, con stato derivato',
    auth: true,
    response: z.array(InviteDto),
  },
  createInvite: {
    method: 'post',
    path: '/invites',
    summary: 'Genera un link di invito monouso per un atleta',
    auth: true,
    body: z.object({ label: z.string().min(1).max(80) }),
    response: InviteDto,
  },
  revokeInvite: {
    method: 'delete',
    path: '/invites/{inviteId}',
    summary: 'Revoca un invito non ancora accettato',
    auth: true,
    response: OkDto,
  },
  previewInvite: {
    method: 'get',
    path: '/invites/code/{code}',
    summary: 'Chi sta invitando: mostrato prima del login',
    auth: false,
    response: InvitePreviewDto,
  },
  acceptInvite: {
    method: 'post',
    path: '/invites/code/{code}/accept',
    summary: 'L’atleta accetta l’invito e la relazione diventa attiva',
    auth: true,
    response: z.object({ relationshipId: uuid }),
  },

  listAthletes: {
    method: 'get',
    path: '/athletes',
    summary: 'Atleti seguiti',
    auth: true,
    response: z.array(AthleteDto),
  },
  listCoaches: {
    method: 'get',
    path: '/coaches',
    summary: 'Preparatori da cui si è seguiti',
    auth: true,
    response: z.array(CoachDto),
  },
  pendingUpdates: {
    method: 'get',
    path: '/coach/pending-updates',
    summary: 'Schede da aggiornare: settimane finite senza una successiva',
    auth: true,
    response: z.array(PendingUpdateDto),
  },

  listMesocycles: {
    method: 'get',
    path: '/mesocycles',
    summary: 'Schede in cui si compare, come PT o come atleta',
    auth: true,
    response: z.object({ asCoach: z.array(MesocycleSummaryDto), asAthlete: z.array(MesocycleSummaryDto) }),
  },
  createMesocycle: {
    method: 'post',
    path: '/mesocycles',
    summary: 'Crea una scheda per un atleta seguito',
    auth: true,
    body: z.object({ relationshipId: uuid, title: z.string().min(1).max(120) }),
    response: z.object({ id: uuid }),
  },
  getMesocycle: {
    method: 'get',
    path: '/mesocycles/{mesocycleId}',
    summary: 'La griglia completa: giornate, righe, settimane, celle e feedback',
    auth: true,
    response: GridDto,
  },
  completeMesocycle: {
    method: 'post',
    path: '/mesocycles/{mesocycleId}/complete',
    summary: 'Chiude il mesociclo',
    auth: true,
    response: OkDto,
  },
  addDay: {
    method: 'post',
    path: '/mesocycles/{mesocycleId}/days',
    summary: 'Aggiunge una giornata',
    auth: true,
    body: z.object({ label: z.string().max(60).optional() }),
    response: z.object({ id: uuid, label: z.string(), position: z.number().int() }),
  },
  addSlot: {
    method: 'post',
    path: '/days/{dayId}/slots',
    summary: 'Aggiunge una riga esercizio alla giornata',
    auth: true,
    body: z.object({
      exerciseId: uuid.nullish(),
      labelOverride: z.string().max(160).nullish(),
    }),
    response: z.object({ id: uuid, position: z.number().int() }),
  },
  removeSlot: {
    method: 'delete',
    path: '/slots/{slotId}',
    summary: 'Rimuove una riga esercizio',
    auth: true,
    response: OkDto,
  },
  reorderSlots: {
    method: 'put',
    path: '/days/{dayId}/slots/order',
    summary: 'Riordina le righe della giornata',
    auth: true,
    body: z.object({ slotIds: z.array(uuid).min(1) }),
    response: OkDto,
  },

  addWeek: {
    method: 'post',
    path: '/mesocycles/{mesocycleId}/weeks',
    summary: 'Aggiunge la settimana successiva, precompilata dalla precedente',
    auth: true,
    body: z.object({ copyFromPrevious: z.boolean().default(true), label: z.string().max(60).optional() }),
    response: z.object({ id: uuid, label: z.string(), position: z.number().int(), copiedFromWeekId: uuid.nullable() }),
  },
  publishWeek: {
    method: 'post',
    path: '/weeks/{weekId}/publish',
    summary: 'Pubblica la settimana e crea gli allenamenti per ogni giornata',
    auth: true,
    response: OkDto,
  },
  setPrescription: {
    method: 'put',
    path: '/weeks/{weekId}/prescriptions',
    summary: 'Scrive una cella. Testo libero ammesso: non capire non è un errore',
    auth: true,
    body: z.object({
      slotId: uuid,
      rawText: z.string().max(200),
      coachNote: z.string().max(1000).nullish(),
    }),
    response: z.object({ rawText: z.string().nullable(), formatted: z.string().nullable() }),
  },
  deleteWeek: {
    method: 'delete',
    path: '/weeks/{weekId}',
    summary: 'Elimina una settimana non ancora completata dall’atleta',
    auth: true,
    response: OkDto,
  },
  getWeek: {
    method: 'get',
    path: '/weeks/{weekId}',
    summary: 'Vista atleta della settimana: una card per giornata',
    auth: true,
    response: WeekViewDto,
  },
  completeWeek: {
    method: 'post',
    path: '/weeks/{weekId}/complete',
    summary: 'L’atleta chiude la settimana anche con giornate saltate',
    auth: true,
    response: OkDto,
  },

  getSession: {
    method: 'get',
    path: '/sessions/{sessionId}',
    summary: 'La schermata da palestra: esercizi, prescrizioni e settimana scorsa',
    auth: true,
    response: DayViewDto,
  },
  setSessionNote: {
    method: 'patch',
    path: '/sessions/{sessionId}',
    summary: 'Nota di giornata dell’atleta',
    auth: true,
    body: z.object({ note: z.string().max(2000) }),
    response: OkDto,
  },
  setFeedback: {
    method: 'put',
    path: '/sessions/{sessionId}/feedback',
    summary: 'Feedback dell’atleta su un esercizio',
    auth: true,
    body: z.object({ slotId: uuid, rawText: z.string().max(500) }),
    response: OkDto,
  },
  completeSession: {
    method: 'post',
    path: '/sessions/{sessionId}/complete',
    summary: 'Segna la giornata come fatta; chiude la settimana se era l’ultima',
    auth: true,
    response: z.object({ weekComplete: z.boolean() }),
  },
  reopenSession: {
    method: 'delete',
    path: '/sessions/{sessionId}/complete',
    summary: 'Riapre la giornata (e quindi la settimana)',
    auth: true,
    response: OkDto,
  },
} satisfies Record<string, Endpoint>;

export type Contract = typeof contract;
