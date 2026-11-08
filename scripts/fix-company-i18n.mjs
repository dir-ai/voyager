import fs from 'node:fs';
import path from 'node:path';

const root = 'C:/dev/AionUi-fork/packages/desktop/src/renderer/services/i18n/locales';

const en = {
  home: {
    cardTitle: 'Create your company with Voyager',
    cardSubtitle: 'Describe your business — Voyager drafts the organization, you approve it',
    orgFixtureHint: 'Demo organization — will reflect your real PSX organization once connected',
  },
  founder: {
    title: 'Create your company',
    subtitle: 'Talk with Voyager — it will build the organization with you',
    mockBadge: 'Preview UI — no real changes',
    intro: 'Hi! I am Voyager, your company builder. Tell me about your business and I will draft the organization for you: departments, people and their specialties. Shall we start?',
    askName: 'First: what is the name of your company?',
    askSector: 'Great name! What sector does it operate in? (e.g. construction, marketing agency, retail…)',
    askHq: 'Where is it based? (city or headquarters)',
    askWebsite: 'And the website address? (if you have one)',
    proposalTitle: 'Proposed organization — review',
    approve: 'Approve and create',
    applying: 'Working on it… (mock: no backend call is made yet)',
    appliedTitle: 'Simulation complete',
    restart: 'Start over',
    error: 'Something went wrong.',
    inputPlaceholder: 'Type your answer…',
    openEntry: 'Open founder onboarding (UI preview)',
    connectTitle: 'Connect your Workbench account',
    connectSubtitle: 'Sign in with your PSX account — Voyager reads your organization live (read-only)',
    emailPlaceholder: 'Email',
    passwordPlaceholder: 'Password',
    connect: 'Sign in',
    connectedTitle: 'Connected',
    liveBadge: 'LIVE — real PSX data',
    structureCounts: 'Companies: {{aziende}} · Sites: {{sedi}} · Departments: {{reparti}}',
    orgsList: 'Your organizations: {{orgs}}',
  },
  account: {
    title: 'Account',
    checking: 'Checking session…',
    signInTitle: 'Sign in to your account',
    signInSubtitle: 'Use your PSX Workbench account — your organization loads automatically next time (encrypted session)',
    noPasswordStored: 'Passwords are never stored — only an encrypted, revocable session.',
    loginFailed: 'Sign in failed. Check your credentials.',
    signOut: 'Sign out',
    orgTitle: 'Your organization',
    noOrgs: 'No organization for this account yet.',
    authorityNote: 'Identity, organization, membership and roles are canonical PSX data — shown as-is, never duplicated.',
  },
  team: {
    title: 'Team',
    signInRequired: 'Sign in from the Account page to see your team.',
    noOrgSelected: 'No organization selected. Choose one on the Account page.',
    aiEmployees: 'AI employees',
    canonical: 'Canonical PSX records',
    loading: 'Loading…',
    noEmployees: 'No AI employees yet — they are created through the canonical provisioning flow.',
    inactive: 'inactive',
    humanMembers: 'Human team members',
    humanNotAvailable: 'Not available yet: the Runtime payload does not expose human membership — it will appear here via the canonical contract, without duplicates.',
    invite: 'Invite collaborator',
    inviteDisabled: 'Invite is disabled until PSX delivers the canonical invitation contract.',
  },
};

const it = {
  home: {
    cardTitle: 'Crea la tua azienda con Voyager',
    cardSubtitle: 'Racconta la tua attività — Voyager prepara l’organizzazione, tu la approvi',
    orgFixtureHint: 'Organizzazione dimostrativa — rifletterà la tua organizzazione PSX reale una volta collegata',
  },
  founder: {
    title: 'Crea la tua azienda',
    subtitle: 'Parla con Voyager — costruirà l’organizzazione con te',
    mockBadge: 'Anteprima UI — nessuna modifica reale',
    intro: 'Ciao! Sono Voyager, il tuo costruttore di azienda. Raccontami la tua attività e ti preparo la proposta di organizzazione: reparti, persone e le loro specialità. Iniziamo?',
    askName: 'Prima cosa: come si chiama la tua azienda?',
    askSector: 'Bellissimo nome! In che settore opera? (es. edilizia, agenzia marketing, commercio…)',
    askHq: 'Dove ha sede? (città o sede principale)',
    askWebsite: 'E l’indirizzo del sito web? (se ce l’hai)',
    proposalTitle: 'Proposta di organizzazione — revisione',
    approve: 'Approva e crea',
    applying: 'Sto lavorandoci… (mock: nessuna chiamata al backend per ora)',
    appliedTitle: 'Simulazione completata',
    restart: 'Ricomincia',
    error: 'Qualcosa è andato storto.',
    inputPlaceholder: 'Scrivi la risposta…',
    openEntry: 'Apri onboarding Fondatore (anteprima UI)',
    connectTitle: 'Collega il tuo account Workbench',
    connectSubtitle: 'Accedi con il tuo account PSX — Voyager legge la tua organizzazione in tempo reale (sola lettura)',
    emailPlaceholder: 'Email',
    passwordPlaceholder: 'Password',
    connect: 'Accedi',
    connectedTitle: 'Collegato',
    liveBadge: 'LIVE — dati PSX reali',
    structureCounts: 'Aziende: {{aziende}} · Sedi: {{sedi}} · Reparti: {{reparti}}',
    orgsList: 'Le tue organizzazioni: {{orgs}}',
  },
  account: {
    title: 'Account',
    checking: 'Verifica della sessione…',
    signInTitle: 'Accedi al tuo account',
    signInSubtitle: 'Usa il tuo account PSX Workbench — la tua organizzazione si ricarica automaticamente alla prossima apertura (sessione cifrata)',
    noPasswordStored: 'Le password non vengono mai salvate — solo una sessione cifrata e revocabile.',
    loginFailed: 'Accesso non riuscito. Controlla le credenziali.',
    signOut: 'Esci',
    orgTitle: 'La tua organizzazione',
    noOrgs: 'Ancora nessuna organizzazione per questo account.',
    authorityNote: 'Identità, organizzazione, membership e ruoli sono dati canonici PSX — mostrati così come sono, mai duplicati.',
  },
  team: {
    title: 'Team',
    signInRequired: 'Accedi dalla pagina Account per vedere il tuo team.',
    noOrgSelected: 'Nessuna organizzazione selezionata. Scegline una nella pagina Account.',
    aiEmployees: 'Dipendenti AI',
    canonical: 'Record canonici PSX',
    loading: 'Caricamento…',
    noEmployees: 'Ancora nessun dipendente AI — vengono creati dal flusso di provisioning canonico.',
    inactive: 'inattivo',
    humanMembers: 'Membri umani del team',
    humanNotAvailable: 'Non ancora disponibile: il payload del Runtime non espone la membership umana — apparirà qui via contratto canonico, senza duplicati.',
    invite: 'Invita collaboratore',
    inviteDisabled: 'L’invito resta disabilitato finché PSX non consegna il contratto canonico di invito.',
  },
};

const nestedKeys = ['home', 'founder', 'account', 'team'];

for (const locale of fs.readdirSync(root)) {
  const dir = path.join(root, locale);
  if (!fs.statSync(dir).isDirectory()) continue;

  // 1) clean flat dotted keys + empty company object from settings.json
  const settingsPath = path.join(dir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    const json = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    let changed = false;
    for (const key of Object.keys(json)) {
      if (key.startsWith('company.') || key === 'company') {
        delete json[key];
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(settingsPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  }

  // 2) add nested company section to common.json (fallback = en)
  const commonPath = path.join(dir, 'common.json');
  if (!fs.existsSync(commonPath)) continue;
  const common = JSON.parse(fs.readFileSync(commonPath, 'utf8'));
  const isIt = locale.startsWith('it');
  common.company = isIt ? it : en;
  fs.writeFileSync(commonPath, JSON.stringify(common, null, 2) + '\n', 'utf8');
  console.log('company keys ->', path.relative(root, path.join(dir, 'common.json')));
}
console.log('done');
