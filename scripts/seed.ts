import 'dotenv/config';
import { isNull } from 'drizzle-orm';
import { db, sql as client } from '../src/db';
import { exercises } from '../src/db/schema';

/**
 * Global exercises (`owner_user_id is null`): visible to every coach and
 * editable by none, so nobody has to retype "Panca piana" on day one.
 *
 * Safe to re-run: it only inserts what is missing and never touches a
 * coach's own library.
 */
const CATALOGUE: Array<{ name: string; description: string }> = [
  { name: 'Panca piana', description: 'Scapole retratte e depresse, gomiti a circa 45°, bilanciere allo sterno.' },
  { name: 'Squat', description: 'Piedi a larghezza spalle, ginocchia in linea con le punte, schiena neutra.' },
  { name: 'Stacco da terra', description: 'Bilanciere sopra il medio piede, dorsali attivi, spinta di gambe.' },
  { name: 'Military press', description: 'In piedi, glutei e addome contratti, testa che passa sotto il bilanciere.' },
  { name: 'Trazioni', description: 'Presa prona, partenza a braccia distese, mento sopra la sbarra.' },
  { name: 'Dip', description: 'Spalle depresse, discesa fino a 90° di gomito, busto leggermente inclinato.' },
  { name: 'Lat machine', description: 'Petto alto, tirare con i gomiti verso il basso, non con le mani.' },
  { name: 'HSPU', description: 'Verticale al muro, discesa controllata fino a sfiorare il pavimento con la testa.' },
  { name: 'Planche tuck', description: 'Spalle protratte e avanti rispetto alle mani, bacino in retroversione.' },
  { name: 'Front lever tuck', description: 'Scapole depresse, ginocchia al petto, corpo parallelo al suolo.' },
  { name: 'Dragon flag', description: 'Corpo rigido dalla spalla alla caviglia, discesa lenta, lombare a contatto.' },
  { name: 'L-sit', description: 'Spalle depresse, gambe tese e parallele al suolo, punte in avanti.' },
  { name: 'Muscle up', description: 'Trazione esplosiva, transizione del polso sopra la sbarra, dip finale.' },
  { name: 'Plank', description: 'Gomiti sotto le spalle, bacino in retroversione, nessun cedimento lombare.' },
];

async function main() {
  const existing = new Set(
    (await db.select({ name: exercises.name }).from(exercises).where(isNull(exercises.ownerUserId))).map((row) =>
      row.name.toLowerCase(),
    ),
  );

  const missing = CATALOGUE.filter((exercise) => !existing.has(exercise.name.toLowerCase()));
  if (missing.length > 0) {
    await db.insert(exercises).values(missing.map((exercise) => ({ ...exercise, ownerUserId: null })));
  }

  console.info(`Esercizi globali: ${missing.length} aggiunti, ${existing.size} già presenti.`);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
