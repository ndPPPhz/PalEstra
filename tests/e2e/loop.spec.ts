import { expect, test, type Page } from '@playwright/test';

/**
 * The milestone, as one test: the weekly loop that replaces the shared
 * spreadsheet, walked end to end by two different people in two browser
 * contexts.
 */

/** Logs in through the real UI. In dev the page shows the code it just sent. */
async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('La tua email').fill(email);
  await page.getByRole('button', { name: 'Ricevi il codice' }).click();

  const hint = page.getByText('Modalità sviluppo:');
  await expect(hint).toBeVisible();
  const code = (await hint.textContent())!.match(/\d{6}/)![0];

  await page.getByLabel('Codice a 6 cifre').fill(code);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page).toHaveURL(/\/home/);
}

test('dal link di invito alla settimana successiva', async ({ browser }) => {
  const coachContext = await browser.newContext();
  const athleteContext = await browser.newContext({ ...(await import('@playwright/test')).devices['iPhone 13'] });
  const coach = await coachContext.newPage();
  const athlete = await athleteContext.newPage();

  // ── il PT si registra e genera un invito nominale ───────────────────
  await login(coach, 'perruccio@example.com');
  await coach.goto('/atleti');
  await coach.getByLabel('Invita un atleta').fill('Andrea');
  await coach.getByRole('button', { name: 'Genera link' }).click();

  await expect(coach.getByText('Andrea')).toBeVisible();
  await expect(coach.getByText('Inviti in sospeso')).toBeVisible();

  // The invite URL is only in the clipboard button, so read it from the API
  // the page itself uses.
  const invites = await coach.request.get('/api/v1/invites');
  const inviteUrl = (await invites.json())[0].url as string;
  const code = inviteUrl.split('/').pop()!;

  // ── l'atleta apre il link e accetta ─────────────────────────────────
  await athlete.goto(`/invite/${code}`);
  await expect(athlete.getByText('vuole seguirti come preparatore')).toBeVisible();
  await athlete.getByRole('link', { name: 'Accedi per accettare' }).click();
  await athlete.getByLabel('La tua email').fill('andrea@example.com');
  await athlete.getByRole('button', { name: 'Ricevi il codice' }).click();
  const hint = athlete.getByText('Modalità sviluppo:');
  await expect(hint).toBeVisible();
  await athlete.getByLabel('Codice a 6 cifre').fill((await hint.textContent())!.match(/\d{6}/)![0]);
  await athlete.getByRole('button', { name: 'Entra' }).click();
  await athlete.getByRole('button', { name: 'Accetta e inizia' }).click();
  await expect(athlete).toHaveURL(/\/home/);

  // ── il PT costruisce la scheda ──────────────────────────────────────
  await coach.goto('/esercizi');
  await coach.getByLabel('Nome').fill('Trazioni');
  await coach.getByLabel('Descrizione').fill('Presa prona, scapole attive.');
  await coach.getByRole('button', { name: 'Aggiungi esercizio' }).click();
  await expect(coach.getByText('Presa prona, scapole attive.')).toBeVisible();

  await coach.goto('/atleti');
  await coach.getByRole('button', { name: 'Nuova scheda' }).click();
  await coach.getByPlaceholder('Mesociclo di Andrea').fill('Callistenics Meso 3');
  await coach.getByRole('button', { name: 'Crea' }).click();
  await expect(coach).toHaveURL(/\/schede\//);
  const mesocycleUrl = coach.url();

  // Una scheda vuota si costruisce in un colpo solo, non riga per riga.
  await coach
    .getByLabel('Struttura della scheda')
    .fill('DAY 1\nTrazioni\nPLANCHE TUCK CELESTE');

  // L'anteprima gira lo stesso parser del server: quello che promette e'
  // quello che verra' creato. "Trazioni" e' gia' in libreria e non viene
  // duplicato, l'altro e' nuovo.
  const preview = coach.getByRole('listitem').filter({ hasText: 'PLANCHE TUCK CELESTE' });
  await expect(preview.getByText('nuovo')).toBeVisible();
  await expect(
    coach.getByRole('listitem').filter({ hasText: /^Trazioni/ }).getByText('nuovo'),
  ).toHaveCount(0);

  await coach.getByRole('button', { name: 'Crea la struttura' }).click();
  await expect(coach.getByRole('columnheader', { name: 'DAY 1' })).toBeVisible();

  // ── WEEK 1: compila e pubblica ──────────────────────────────────────
  await coach.getByRole('button', { name: 'Aggiungi settimana' }).click();
  await expect(coach.getByRole('columnheader', { name: /WEEK 1/ })).toBeVisible();

  // Scoped per row rather than by global index: the table renders row by
  // row, so a flat index would silently mean a different cell once a
  // second week column appears.
  const trazioniRow = coach.getByRole('row').filter({ hasText: 'Trazioni' });
  const plancheRow = coach.getByRole('row').filter({ hasText: 'PLANCHE TUCK CELESTE' });

  await trazioniRow.getByPlaceholder('4x2@20kg').first().fill('4x2@20kg');
  await plancheRow.getByPlaceholder('4x2@20kg').first().fill('4xrir4"');
  await plancheRow.getByPlaceholder('4x2@20kg').first().blur();

  // The parsed reading appears under the cell: the coach's confirmation
  // that the shorthand was understood.
  await expect(coach.getByText('4 × 2 @ 20 kg')).toBeVisible();
  await expect(coach.getByText('4 × RIR 4 (sec)')).toBeVisible();

  await coach.getByRole('button', { name: 'Pubblica WEEK 1' }).click();
  await expect(coach.getByText('pubblicata')).toBeVisible();

  // ── l'atleta si allena dal telefono ─────────────────────────────────
  await athlete.goto('/home');
  await athlete.getByRole('link', { name: /Callistenics Meso 3/ }).click();
  await athlete.getByRole('link', { name: /WEEK 1/ }).click();
  await athlete.getByRole('link', { name: /DAY 1/ }).click();

  await expect(athlete.getByText('4x2@20kg')).toBeVisible();

  // Tapping the exercise name shows what the coach wrote about it.
  await athlete.getByRole('button', { name: 'Trazioni' }).click();
  await expect(athlete.getByText('Presa prona, scapole attive.')).toBeVisible();
  await athlete.getByRole('button', { name: 'Chiudi' }).click();

  const feedback = athlete.getByPlaceholder('6,5,5,5 secondi');
  await feedback.nth(0).fill('2 la prima, 3 la seconda');
  await feedback.nth(0).blur();
  await feedback.nth(1).fill('6,5,5,5 secondi');
  await feedback.nth(1).blur();
  await expect(athlete.getByText('salvato').first()).toBeVisible();

  await athlete.getByRole('button', { name: 'Giornata completata' }).click();
  await expect(athlete.getByText('giornata fatta')).toBeVisible();

  // ── la settimana chiusa arriva in coda al PT ────────────────────────
  await coach.goto('/home');
  await expect(coach.getByText('Andrea ha finito WEEK 1')).toBeVisible();

  // ── WEEK 2 nasce copiata dalla WEEK 1 ───────────────────────────────
  await coach.goto(mesocycleUrl);
  await coach.getByRole('button', { name: 'Aggiungi settimana' }).click();
  await expect(coach.getByRole('columnheader', { name: /WEEK 2/ })).toBeVisible();

  // Copy-forward: the new column is already filled in, which is what
  // replaces writing "Uguale" by hand.
  await expect(coach.getByRole('row').filter({ hasText: 'Trazioni' }).getByPlaceholder('4x2@20kg').nth(1)).toHaveValue(
    '4x2@20kg',
  );
  await expect(
    coach.getByRole('row').filter({ hasText: 'PLANCHE TUCK CELESTE' }).getByPlaceholder('4x2@20kg').nth(1),
  ).toHaveValue('4xrir4"');

  // The athlete's feedback is visible next to the week it belongs to.
  await expect(coach.getByText('2 la prima, 3 la seconda')).toBeVisible();

  // Adding the week clears the coach's queue: the ball is back with them.
  await coach.goto('/home');
  await expect(coach.getByText('Andrea ha finito WEEK 1')).toHaveCount(0);
  await expect(coach.getByText('Niente in coda')).toBeVisible();

  await coachContext.close();
  await athleteContext.close();
});
