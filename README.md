# PalEstra

Piattaforma per preparatori atletici e atleti: schede di allenamento a
mesocicli, feedback settimanali e libreria esercizi. Sostituisce il foglio
di calcolo condiviso che oggi fa da scheda.

## Come funziona

Il ciclo di lavoro e' quello che PT e atleta gia' usano su Google Sheets,
reso esplicito:

```
PT                                                        ATLETA
 |
 |-- crea la scheda: giornate, esercizi
 |-- compila WEEK 1 e la pubblica  ------------------------>  la vede sul telefono
 |                                                            si allena, scrive i feedback
 |                                                            tap "Giornata completata"
 |<-- "Andrea ha finito WEEK 1 - 18 ore fa"
 |-- legge i feedback
 |-- "Aggiungi settimana": WEEK 2 nasce COPIATA dalla WEEK 1
 |-- cambia le 3 celle che cambiano davvero e pubblica ---->  ricomincia
```

Due cose che il foglio non sa fare:

- **Copy-forward al posto di "Uguale".** Aggiungere una settimana duplica
  tutte le celle della precedente. Ogni cella contiene sempre valori reali,
  quindi lo storico resta interrogabile e i grafici futuri sono possibili.
- **Sapere quando l'atleta ha finito.** Le giornate completate chiudono la
  settimana, e la settimana chiusa senza una successiva compare da sola
  nella lista "Schede da aggiornare" del PT.

### Il PT crea la scheda dal portale

Questo e' il flusso di produzione; l'import da CSV piu' sotto serve solo a
portarsi dietro lo storico di chi arriva da un foglio di calcolo.

Da **Atleti** il PT apre "Nuova scheda". Una scheda vuota non mostra una
griglia deserta ma un editor: si scrivono (o si incollano) gli esercizi,
uno per riga, con una riga vuota a separare le giornate.

```
DAY 1              una riga vuota separa le giornate; se la prima riga
Trazioni           di un blocco e' tipo "DAY 1" diventa il nome della
HSPU               giornata, altrimenti viene numerata da sola
                   
Squat              elenchi puntati o numerati incollati da altrove
Stacco             vengono ripuliti automaticamente
```

Un'anteprima dal vivo mostra cosa verra' creato e marca come `nuovo` gli
esercizi che non sono ancora in libreria: i nomi gia' presenti vengono
riusati, quindi si portano dietro descrizione e (in futuro) i video, e la
libreria si riempie da sola invece di essere un modulo da compilare prima.
Un salvataggio solo, non una riga alla volta.

Da li' in poi comanda la griglia: le righe si aggiungono, si spostano e si
eliminano dove le stai gia' guardando, senza ricaricare la pagina.

### Le prescrizioni sono ibride

Il PT scrive come su Excel; un parser riempie i campi strutturati quando
riconosce la sintassi, e quando non capisce non succede niente:

| scritto            | interpretato                        |
| ------------------ | ----------------------------------- |
| `4x2@20kg`         | 4 serie x 2 rip @ 20 kg             |
| `4xrir4"`          | 4 serie, RIR 4, tenuta in secondi   |
| `3xrir3/4`         | 4 serie, RIR fra 3 e 4              |
| `3x2@50kg+1x6@35kg`| due blocchi                         |
| `AMRAP 8'`         | AMRAP, 8 minuti                     |
| `boh, a sensazione`| testo libero — salvato lo stesso    |

Il testo grezzo e' sempre conservato e vince a schermo. Sul foglio reale di
partenza, 35 celle su 35 con sintassi vera vengono interpretate; le 22
rimanenti sono tutte e sole `Uguale` / `Uguslr` / `1 serie in piu'`, che
con il copy-forward non servono piu'.

### Gli inviti sono nominali e monouso

Il PT genera un link con un'etichetta ("Andrea") e lo manda su WhatsApp.
Vale per una persona sola e si consuma quando viene accettato, cosi' la
lista "Inviti in sospeso" dice davvero a chi e' stato scritto. Nessuna
ricerca utenti.

## Setup in sviluppo

Serve Node 22 e un Postgres raggiungibile.

```bash
npm install
cp .env.example .env          # poi controlla DATABASE_URL
npm run db:migrate            # crea le tabelle
npm run seed                  # esercizi globali (Panca piana, Squat, ...)
npm run dev                   # http://localhost:3000
```

Senza `RESEND_API_KEY` le email non partono: il codice di accesso viene
stampato nei log **e mostrato nella pagina di login**, cosi' si entra senza
casella di posta. In produzione la chiave va impostata.

### Importare il foglio esistente

Esporta un tab da Google Sheets come CSV e lancia:

```bash
npm run import:sheet -- --file "3 Ciclo.csv" \
  --coach pt@example.com --athlete atleta@example.com --title "3 Ciclo"
```

Si aspetta il layout del foglio originale: colonna A con i marcatori
`DAY n` e i nomi degli esercizi, prima riga con `WEEK n` alternate a
`FEEDBACK`. Stampa quante celle ha interpretato: e' il collaudo onesto del
parser. In `scripts/fixtures/esempio-3-ciclo.csv` c'e' un esempio reale.

## Test

```bash
npm test           # parser, CSV, dominio (su Postgres: palestra_test)
npm run test:e2e   # il loop completo su browser, PT e atleta insieme
```

Il test end-to-end e' il milestone in una funzione: invito, accettazione,
costruzione della scheda, allenamento dell'atleta da viewport mobile,
settimana in coda al PT, e WEEK 2 gia' precompilata.

Se la macchina ha gia' un Chromium (container, CI), indicalo con
`PLAYWRIGHT_CHROMIUM_PATH=/percorso/chrome` invece di scaricarne un altro.

## Deploy in produzione (Arch Linux / systemd)

Setup iniziale sul server, una volta sola:

```bash
sudo pacman -Syu nodejs npm git postgresql nginx certbot certbot-nginx

# Postgres, se non e' gia' avviato
sudo -u postgres initdb -D /var/lib/postgres/data
sudo systemctl enable --now postgresql
sudo -u postgres createuser palestra --pwprompt
sudo -u postgres createdb -O palestra palestra

# /opt e' di root: crea l'utente dedicato e assegnagli la directory PRIMA
# di clonarci dentro, altrimenti git e npm falliscono per permessi.
sudo useradd -r -m -d /opt/palestra -s /usr/bin/nologin palestra
sudo mkdir -p /opt/palestra/app
sudo chown palestra:palestra /opt/palestra/app

sudo -u palestra git clone https://github.com/ndPPPhz/PalEstra.git /opt/palestra/app
cd /opt/palestra/app
sudo -u palestra npm ci
sudo -u palestra cp .env.example .env
sudo -u palestra nano .env    # DATABASE_URL, APP_URL, RESEND_API_KEY veri
sudo -u palestra npm run build
sudo -u palestra cp -r .next/static .next/standalone/.next/static
sudo -u palestra npm run db:migrate
sudo -u palestra npm run seed

sudo cp deploy/palestra.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now palestra
```

Controlla che sia davvero partito prima di andare avanti:

```bash
systemctl status palestra --no-pager        # deve dire "active (running)"
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/login   # 200
journalctl -u palestra -n 50 --no-pager     # se qualcosa non torna
```

Se il servizio non parte, il sospetto numero uno e' `.env`: viene letto
anche da systemd, che non e' una shell, quindi i valori con spazi vanno
fra virgolette (vedi i commenti in `.env.example`). Dopo ogni modifica a
`.env` serve `sudo systemctl restart palestra`.

Poi il reverse proxy con HTTPS:

```bash
sudo cp deploy/nginx-palestra.conf /etc/nginx/sites-available/palestra.conf
sudo ln -s /etc/nginx/sites-available/palestra.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d palestra.annino.dev
```

HTTPS non e' opzionale: in produzione il cookie di sessione e' marcato
`Secure` e su HTTP non verrebbe inviato. Ricordati di mettere
`APP_URL=https://palestra.annino.dev` in `.env`, perche' e' con quello che
vengono costruiti i link di invito.

E il backup, che senza non e' un deploy:

```bash
sudo cp deploy/palestra-backup.{service,timer} /etc/systemd/system/
sudo systemctl enable --now palestra-backup.timer
```

Per gli aggiornamenti successivi, **da un tuo utente normale con sudo**
(non da `palestra`, che non ha shell):

```bash
./deploy/deploy.sh
```

fa pull, `npm ci`, build, migrazioni e riavvio. Non cancella mai dati.

## Architettura

```
   Browser (Next.js)                 iOS / Android  (in futuro)
        |  Server Components               |  Authorization: Bearer <token>
        v                                  v
   +--------------------------------------------------+
   |  src/app/api/v1/*   <- adattatore REST sottile    |
   +--------------------------------------------------+
                        |
   +--------------------------------------------------+
   |  src/core/*   <- TUTTA la logica di dominio       |
   +--------------------------------------------------+
              |                          |
        Postgres (Drizzle)        Cloudflare R2 (dalla milestone media)
```

Regola dura: **la logica sta in `src/core/`**. I route handler REST e i
server component chiamano gli stessi servizi, quindi l'app nativa non
trovera' un sottoinsieme dell'API ma quella gia' collaudata dal web.

- **`src/core/authz.ts`** e' l'unico posto dove si decidono i permessi. Un
  utente non ha un ruolo globale: e' PT in alcune relazioni e atleta in
  altre, quindi il ruolo si risolve sempre rispetto al mesociclo.
- **Auth**: codice a 6 cifre via email, niente password. Il browser riceve
  il token in un cookie `httpOnly` (che nemmeno il nostro JS puo' leggere,
  cosi' un XSS non lo puo' rubare e riusare); un client nativo lo terra' nel
  Keychain e lo mandera' come `Authorization: Bearer`. Stesso token, stessa
  riga in `auth_sessions`, stessa revoca.
- **`openapi/openapi.json`** e' generato da `src/api/contract.ts` con
  `npm run openapi` e verificato in CI. Da li'
  [swift-openapi-generator](https://github.com/apple/swift-openapi-generator)
  produce il client Swift tipizzato: rinominare un campo qui rompe la build
  iOS invece di far crashare l'app in palestra.

## Prossimi passi

1. **Media** (Cloudflare R2 o MinIO sul server): foto e video sugli
   esercizi, pagina media dell'atleta con foto di progresso datate, e video
   di esecuzione agganciati alla singola sessione di allenamento.
   Bucket privato e URL firmati: le foto di progresso sono dati sensibili.
2. **PWA e palestra offline**: bozze dei feedback in IndexedDB, timer di
   recupero, pagina pubblica del PT su `/@handle`.
3. **App iOS**: client Swift generato da `openapi.json`, nessuna API nuova
   da scrivere.
4. **Pagamenti**: Stripe Connect, con la commissione della piattaforma come
   `application_fee_amount`. La relazione PT-atleta e' gia' il soggetto
   giusto per la fatturazione.
