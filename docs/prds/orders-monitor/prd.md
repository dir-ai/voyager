# PRD — Capacità "Monitor Ordini" (Amazon / eBay / Alibaba) — v2

> Status: PROPOSTA (draft v2, 2026-11-06) · Owner: VOYAGER Company Edition · Sessione coordinamento: PROGETTO AION (a430da01)
> **v2 — cambio approccio su direttiva Fondatore:** accesso diretto con **credenziali fornite dall'utente + navigazione web semplice**. Due strumenti: **OpenClaw** (a vista) e **motore headless** (background). Fuori scope l'approccio v1 email/IMAP (resta come fallback opzionale).

## 1. Obiettivo

L'utente fornisce **username e password di ciascun account** (Amazon, eBay, Alibaba). Voyager accede agli account e controlla lo stato degli ordini, segnalando spedizioni e consegne. Due modalità di esecuzione:

| Modalità | Strumento | Cosa vede l'utente |
| --- | --- | --- |
| **A VISTA** | **OpenClaw** (agente browser, backend `openclaw`/ACP già integrato in AionUi) | Browser **visibile** che naviga: login → pagina ordini → lettura stati → report in conversazione. L'utente guarda la navigazione in diretta e può intervenire (es. completare 2FA/captcha). |
| **BACKGROUND** | **Motore headless** (Playwright/CDP su profilo browser persistente dedicato), eseguito come **Scheduled Task dal backend scheduler** | Nulla in diretta: notifica (messaggio in conversazione / toast desktop) quando rileva spedizione o consegna nuova. |

Stessa skill `orders-monitor`, due motori: la modalità è attributo del task proposto.

## 2. Flusso Voyager (vincolante, identico per entrambe le modalità)

```
Utente in chat → intent "monitora ordini" / "controlla i miei ordini adesso"
  → Voyager raccoglie: piattaforme, modalità, [frequenza se background]
  → PROPOSTA strutturata (skill + credenziali richieste via UI + [cron se background])
  → Approvazione utente
  → Apply via backend — mai dal modello
  → Read-back + conferma
  → (background) notifica su evento spedizione/consegna
```

## 3. Credenziali — regole hard

1. L'utente **non incolla mai le credenziali in chat**. Le inserisce una volta sola nell'**UI del connettore/vault** (o file `.env` locale git-ignorato per il profilo dev). Se le incolla in chat comunque, Voyager le ignora, le fa rimuovere e indirizza all'UI.
2. Il vault passa le credenziali **solo al motore browser** (OpenClaw o headless) come segreto di ambiente — mai nel prompt visibile, mai nei log, mai nella cronologia conversazione.
3. Le credenziali sono per-piattaforma, aggiornabili/revocabili dall'UI.
4. Nota registrata (una tantum, a consapevolezza del Fondatore): il login automatizzato può violare i ToS di alcune piattaforme e in rari casi far segnalare l'account; il Fondatore ha accettato il rischio esplicitamente.

## 4. Gestione sessione e 2FA

- **Profilo browser persistente per piattaforma** (cookie/storage riusati): login completo solo alla prima esecuzione o quando la sessione scade — riduce drasticamente i login ripetuti (e il rischio anti-bot).
- **2FA/captcha:**
  - *A vista:* l'utente lo completa lui stesso nel browser visibile, OpenClaw attende.
  - *Background:* il task si ferma e marca lo stato `needs_attention` → notifica all'utente ("serve il tuo intervento: apri la sessione a vista"). Mai tentativi di bypassare 2FA.
- Anti-bot igiene: frequenze basse (default: 1 check ogni 30–60 min per piattaforma), profilo reale con user-agent coerente, nessun bursting.

## 5. Esecuzione — cosa fa l'agente browser (entrambe le modalità)

Per ciascuna piattaforma abilitata:
1. Apre il sito e verifica sessione valida; se scaduta, login dal vault (con regole §4).
2. Naviga alla pagina **Ordini / I miei ordini**.
3. Estrae: numero ordine, articoli, stato (spedito/consegnato/in transito), data, tracking se presente.
4. Confronta con lo **stato precedente** (snapshot persistente per piattaforma, dedup su numero ordine + stato).
5. Output:
   - *A vista:* report in conversazione + evidenza visiva (l'utente ha visto la pagina).
   - *Background:* solo diff → se nuovo stato "spedito"/"consegnato" → **notifica** (conversazione + toast); se nessuna novità, silenzio o digest configurabile.

## 6. Notifiche (background)

- Trigger: nuovo stato spedizione/consegna (dedup §5.4) oppure `needs_attention` (2FA, login fallito, captcha ricorrente).
- Canali: messaggio in conversazione Voyager (delivery del task) e/o toast desktop. Scelta in proposta.
- Errore ricorrente (es. login fallito 3 volte) → notifica di anomalia + suggerimento rotazione credenziale, senza mai mostrare la password.

## 7. Dipendenze

- **OpenClaw integrato e avviato** (già presente nel fork; tipo `openclaw` → ACP; `openclaw gateway` su 127.0.0.1:18789 per il remote).
- **Skill `orders-monitor`** con due implementazioni dello stesso contratto: `mode=visible` (delega ad agente OpenClaw con browser) e `mode=headless` (Playwright/CDP, profilo persistente, avviata dal backend scheduler).
- **Vault/connettore credenziali** per-piattaforma con inserimento via UI (gap noto: registro connettori per reparto).
- **Snapshot di stato persistente** per piattaforma (per dedup).
- **Scheduled Task** su backend scheduler con delivery a conversazione.

## 8. Acceptance

- [ ] Utente chiede in chat → proposta con piattaforme + modalità + frequenza + canale.
- [ ] Credenziali inserite SOLO via UI del vault; zero credenziali in chat/log/prompt/cronologia.
- [ ] A VISTA: browser visibile, login (eventuale 2FA completata dall'utente), report ordini in conversazione.
- [ ] BACKGROUND: check schedulato headless su profilo persistente; notifica alla prima spedizione/consegna rilevata; `needs_attention` su 2FA/login.
- [ ] Attivazione confermata dal backend (read-back), mai dal modello.
- [ ] Fallback: se un sito cambia layout e l'estrazione fallisce → notifica di anomalia, mai dati inventati.

## 9. Fuori scope v2

- Azioni **oltre la lettura** (cancellazioni, resi, acquisti, modifiche account) — la capacità è **sola lettura**.
- Rotazione automatica delle password.
- Fallback email/IMAP e CSV Amazon della v1 (conservati come opzione se il Fondatore la vorrà).
