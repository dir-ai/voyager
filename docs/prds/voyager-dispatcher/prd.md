# PRD — Voyager Dispatcher (funzione interna del Voyager Super CEO)

> Status: CANONICO v1 (2026-11-06) · Owner: VOYAGER Company Edition · Sessione coordinamento: PROGETTO AION (a430da01)
> Fonte: mansionario dettato dal Fondatore. Il Dispatcher è **una funzione interna di Voyager Super CEO, non un agente separato** che si limita a distribuire incarichi. **Voyager rimane l'unico interlocutore principale dell'imprenditore.**

## 0. Definizione

> Voyager Dispatcher è il sistema di comprensione, decisione e instradamento operativo integrato nel Super CEO. Trasforma il linguaggio naturale dell'imprenditore in azioni eseguibili, utilizzando il contesto, gli strumenti, gli agenti e le capacità disponibili nella sua azienda digitale.
>
> **La distinzione da mantenere:** il Dispatcher capisce *come muoversi*. Voyager Super CEO *si muove*, fa lavorare il sistema e porta il risultato.

Quando una richiesta rivela una capacità mancante, Voyager può attivare **Factory** o **Developer Agent** per acquisirla, anziché fermarsi a un semplice «non disponibile».

## 1. Le 15 caratteristiche fondamentali

| # | Caratteristica | Funzione |
|---|---|---|
| 1 | Comprensione semantica | Capisce ciò che l'utente vuole ottenere, anche con frasi incomplete, indirette o colloquiali |
| 2 | Multilinguismo | Comprende richieste in diverse lingue, anche mescolate, e mantiene il contesto |
| 3 | Consapevolezza del contesto | Conosce persona, azienda, progetto, conversazione, attività e risultati precedenti |
| 4 | Continuità multi-turno | Riconosce correzioni, precisazioni, nuove richieste, interruzioni e follow-up |
| 5 | Intent Recognition | Distingue conversazione, ricerca, analisi, azione, progetto, missione, workflow, automazione |
| 6 | Dynamic Tool Discovery | Trova gli strumenti pertinenti nel Tool Album senza caricare tutto il catalogo nel prompt |
| 7 | Capability Gap Detection | Riconosce se una capacità esiste, è scollegata, non autorizzata oppure deve essere sviluppata |
| 8 | Smart Routing | Sceglie il percorso di esecuzione più efficace, senza coinvolgere agenti inutilmente |
| 9 | Agent Selection | Individua il dipendente digitale più adatto, secondo competenze e autorizzazioni |
| 10 | Task Force Orchestration | Coinvolge Commander e più specialisti quando il lavoro richiede collaborazione |
| 11 | Agent Factory Integration | Quando necessario, avvia preparazione o configurazione di nuovi agenti |
| 12 | Developer Agent Integration | Quando manca una funzione realizzabile, coinvolge lo sviluppatore per costruirla e provarla |
| 13 | Adaptive Execution | Osserva gli esiti e cambia strategia quando il primo tentativo è insufficiente |
| 14 | Result Verification | Distingue un'azione avviata da un risultato realmente ottenuto |
| 15 | Learning & Improvement | Usa risultati, correzioni e capacità verificate per migliorare le esecuzioni successive |

## 2. Flusso

```
Richiesta dell'imprenditore (chat, voce, altro canale)
        │
        ▼
VOYAGER SUPER CEO — Dispatcher integrato
Comprende • Contestualizza • Decide • Agisce
        │
        ├─ Risposta diretta
        ├─ Ricerca e analisi
        ├─ Tool e Computer Use
        ├─ Commander / Task Force
        ├─ Agent Factory
        ├─ Developer Agent
        ├─ Workflow aziendali
        └─ Knowledge e memoria
        │
        ▼
Risultato VERIFICATO, restituito nella stessa conversazione
```

Il percorso non è rigido: Voyager può usare più capacità nella stessa richiesta, in sequenza o in parallelo.

## 3. Le tre decisioni operative

| Stato | Quando | Comportamento |
|---|---|---|
| **TALK** | Spiegazione, parere, chiarimento, ragionamento | Voyager risponde; può usare strumenti informativi se utili |
| **WORK-PREPARE** | Obiettivo operativo espresso, strumenti/contesto non ancora pronti | Identifica cosa serve, recupera contesto, **prepara** il lavoro anche senza gli strumenti ancora |
| **WORK-EXECUTE** | Capacità e autorizzazioni sufficienti | Esegue direttamente o delega agli specialisti appropriati |

**Regola non negoziabile:** la mancanza di uno strumento NON trasforma una richiesta operativa in TALK (difetto individuato nel precedente banco di valutazione). Strumento mancante → WORK-PREPARE → procura (skill/MCP/connettore/Factory/Developer).

## 4. Intelligenza contestuale (caratteristica chiave)

Sequenza d'esempio che il Dispatcher deve gestire senza ripartire da zero:
1. «Questo preventivo è troppo alto.» → esamina il preventivo e propone una revisione, NON una lezione generica sui prezzi.
2. «No, considera soltanto i trasporti tedeschi.» → correzione applicata alla richiesta precedente, non nuova richiesta.
3. «Fallo preparare al commerciale.» → sa quale commerciale digitale esiste e che lavoro deve riceverlo.

Stato di lavoro persistente per conversazione: obiettivo corrente, oggetto su cui si lavora, vincoli/correzioni accumulate, destinatari/scelte già fatte.

## 5. Integrazione con la creazione dell'azienda digitale (onboarding)

- «Ho un'azienda di logistica e voglio digitalizzarla.» → richiesta di **costruzione organizzativa**:
  Comprensione dell'azienda → Organization Factory → individuazione dei processi → Agent Factory → configurazione degli agenti → collaudo → operatività.
- «Mi serve una persona che controlli tutte le mattine la posta commerciale.» → possibile **agente email** con workflow programmato, non una semplice ricerca. Ordine di precedenza: 1) riusare/migliorare un agente esistente; 2) solo se necessario creare un nuovo dipendente digitale.

## 6. Velocità — tre percorsi logici (non tre modelli separati)

- **Fast Path:** eventi espliciti, STOP, conferme collegate a un'attività, comandi già strutturati → reazione immediata (es. «grazie» non avvia inferenze).
- **Semantic Path:** richieste naturali, ambigue, indirette o incomplete → comprensione prima dell'azione.
- **Agentic Path:** lavori complessi che richiedono pianificazione, ricerca, strumenti o specialisti → pianifica e orchestra.

Obiettivo: minimizzare la latenza senza sacrificare comprensione e qualità.

## 7. Caratteristiche comportamentali del Super CEO

Proattivo · Tenace (non si ferma alla prima ricerca insufficiente o al primo problema risolvibile) · Pragmatico (la soluzione più semplice che funziona) · Non burocratico (evita approvazioni e domande inutili) · Intuitivo (recupera il significato dal contesto, non pretende istruzioni perfette) · Orientato al risultato (misura la conclusione, non il numero di strumenti chiamati) · Consapevole dei limiti reali (sa distinguere: fattibile ora / da configurare / capacità da costruire) · Governato (usa solo le autorizzazioni effettive, non si inventa privilegi, non aggira i controlli).

## 8. KPI

| KPI | Obiettivo |
|---|---|
| Comprensione dell'intento | Interpretazione corretta del bisogno |
| Continuità conversazionale | Correzioni applicate al lavoro giusto |
| Selezione delle capacità | Strumenti pertinenti, senza deleghe inutili |
| Completamento operativo | Richieste realmente risolte |
| Domande superflue | Riduzione del lavoro imposto al cliente |
| Tempo di esecuzione | Minore latenza pratica |
| Costo per risultato | Efficienza di inferenza e strumenti |
| Miglioramento nel tempo | Più capacità riutilizzabili, meno errori, meno interventi |

**KPI principale: tasso di richieste completate correttamente, con risultati verificati.**

## 9. Apertura del client

**Ogni client Voyager si apre con l'agente Voyager già aperto e pronto a rispondere**: nessuna selezione di assistente, nessuna schermata vuota. La prima voce che l'imprenditore incontra è sempre Voyager (persona concierge + Dispatcher integrato).

## 10. Mappatura sull'implementazione attuale (AionUi/Voyager Company Edition)

| Concetto del Dispatcher | Implementazione |
|---|---|
| Tool Album / catalogo | Cataloghi CLI: `config assistants list`, `config skills list` + `skills capabilities`, `config mcp servers/tools list`, `config providers list`, `config crons list` |
| Dynamic Tool Discovery | Le skill CLI (`capabilities`, `show`, `cat`) sono la discovery: si consulta a runtime, niente catalogo intero nel prompt |
| Capability Gap Detection | Gap → 1) riuso, 2) config, 3) creazione skill (skill-creator), 4) richiesta contratto a CLIENT RUNTIME/PSX, 5) Developer Agent |
| Agent Selection / Task Force | Registrazione agenti (PSX/Agent Registry canonico), team (cowork), Commander («Capo Cantiere / Dispatcher» esistente per cantieri pesanti) |
| Result Verification | Read-back obbligatorio dopo ogni write; attivazioni confermate dal backend, mai dal modello |
| Autorizzazioni / Governato | Boundary contract PSX: proposal → approval → apply → read-back; credenziali solo nel vault; niente doppio scheduler |
| Knowledge e memoria | File di memoria persistenti per progetto + contesto di conversazione |
| Apertura con Voyager | Default del client Company Edition: nuova conversazione pre-aperta sull'assistente "Voyager" |

## 11. Acceptance

- [ ] Ogni richiesta operativa con strumento mancante produce WORK-PREPARE (procura), mai TALK generico.
- [ ] Correzioni e follow-up applicati al lavoro in corso senza ripartire da zero.
- [ ] Result verification: nessuna "azione avviata" presentata come risultato.
- [ ] Gap di capacità → Factory/Developer/skill-creator, mai «non disponibile» secco.
- [ ] Latenza: richieste banali risposte senza orchestrazione (Fast Path).
- [ ] Ogni client apre su Voyager pronto.
