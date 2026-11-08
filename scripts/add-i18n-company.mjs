import fs from 'node:fs';
import path from 'node:path';

const localesDir = 'C:/dev/AionUi-fork/packages/desktop/src/renderer/services/i18n/locales';

const en = {
  'company.home.cardTitle': 'Create your company with Voyager',
  'company.home.cardSubtitle': 'Describe your business — Voyager drafts the organization, you approve it',
  'company.home.orgFixtureHint': 'Demo organization — will reflect your real PSX organization once connected',
  'company.founder.title': 'Create your company',
  'company.founder.subtitle': 'Talk with Voyager — it will build the organization with you',
  'company.founder.mockBadge': 'Preview UI — no real changes',
  'company.founder.intro':
    'Hi! I am Voyager, your company builder. Tell me about your business and I will draft the organization for you: departments, people and their specialties. Shall we start?',
  'company.founder.askName': 'First: what is the name of your company?',
  'company.founder.askSector': 'Great name! What sector does it operate in? (e.g. construction, marketing agency, retail…)',
  'company.founder.askHq': 'Where is it based? (city or headquarters)',
  'company.founder.askWebsite': 'And the website address? (if you have one)',
  'company.founder.proposalTitle': 'Proposed organization — review',
  'company.founder.approve': 'Approve and create',
  'company.founder.applying': 'Working on it… (mock: no backend call is made yet)',
  'company.founder.appliedTitle': 'Simulation complete',
  'company.founder.restart': 'Start over',
  'company.founder.error': 'Something went wrong.',
  'company.founder.inputPlaceholder': 'Type your answer…',
  'company.founder.openEntry': 'Open founder onboarding (UI preview)',
  'company.founder.connectTitle': 'Connect your Workbench account',
  'company.founder.connectSubtitle': 'Sign in with your PSX account — Voyager reads your organization live (read-only)',
  'company.founder.emailPlaceholder': 'Email',
  'company.founder.passwordPlaceholder': 'Password',
  'company.founder.connect': 'Sign in',
  'company.founder.connectedTitle': 'Connected',
  'company.founder.liveBadge': 'LIVE — real PSX data',
  'company.founder.structureCounts': 'Companies: {{aziende}} · Sites: {{sedi}} · Departments: {{reparti}}',
  'company.founder.orgsList': 'Your organizations: {{orgs}}',
  'company.account.title': 'Account',
  'company.account.checking': 'Checking session…',
  'company.account.signInTitle': 'Sign in to your account',
  'company.account.signInSubtitle': 'Use your PSX Workbench account — your organization loads automatically next time (encrypted session)',
  'company.account.noPasswordStored': 'Passwords are never stored — only an encrypted, revocable session.',
  'company.account.loginFailed': 'Sign in failed. Check your credentials.',
  'company.account.signOut': 'Sign out',
  'company.account.orgTitle': 'Your organization',
  'company.account.noOrgs': 'No organization for this account yet.',
  'company.account.authorityNote': 'Identity, organization, membership and roles are canonical PSX data — shown as-is, never duplicated.',
  'company.team.title': 'Team',
  'company.team.signInRequired': 'Sign in from the Account page to see your team.',
  'company.team.noOrgSelected': 'No organization selected. Choose one on the Account page.',
  'company.team.aiEmployees': 'AI employees',
  'company.team.canonical': 'Canonical PSX records',
  'company.team.loading': 'Loading…',
  'company.team.noEmployees': 'No AI employees yet — they are created through the canonical provisioning flow.',
  'company.team.inactive': 'inactive',
  'company.team.humanMembers': 'Human team members',
  'company.team.humanNotAvailable': 'Not available yet: the Runtime payload does not expose human membership — it will appear here via the canonical contract, without duplicates.',
  'company.team.invite': 'Invite collaborator',
  'company.team.inviteDisabled': 'Invite is disabled until PSX delivers the canonical invitation contract.',
};

const it = {
  'company.home.cardTitle': 'Crea la tua azienda con Voyager',
  'company.home.cardSubtitle': 'Racconta la tua attività — Voyager prepara l’organizzazione, tu la approvi',
  'company.home.orgFixtureHint': 'Organizzazione dimostrativa — rifletterà la tua organizzazione PSX reale una volta collegata',
  'company.founder.title': 'Crea la tua azienda',
  'company.founder.subtitle': 'Parla con Voyager — costruirà l’organizzazione con te',
  'company.founder.mockBadge': 'Anteprima UI — nessuna modifica reale',
  'company.founder.intro':
    'Ciao! Sono Voyager, il tuo costruttore di azienda. Raccontami la tua attività e ti preparo la proposta di organizzazione: reparti, persone e le loro specialità. Iniziamo?',
  'company.founder.askName': 'Prima cosa: come si chiama la tua azienda?',
  'company.founder.askSector': 'Bellissimo nome! In che settore opera? (es. edilizia, agenzia marketing, commercio…)',
  'company.founder.askHq': 'Dove ha sede? (città o sede principale)',
  'company.founder.askWebsite': 'E l’indirizzo del sito web? (se ce l’hai)',
  'company.founder.proposalTitle': 'Proposta di organizzazione — revisione',
  'company.founder.approve': 'Approva e crea',
  'company.founder.applying': 'Sto lavorandoci… (mock: nessuna chiamata al backend per ora)',
  'company.founder.appliedTitle': 'Simulazione completata',
  'company.founder.restart': 'Ricomincia',
  'company.founder.error': 'Qualcosa è andato storto.',
  'company.founder.inputPlaceholder': 'Scrivi la risposta…',
  'company.founder.openEntry': 'Apri onboarding Fondatore (anteprima UI)',
  'company.founder.connectTitle': 'Collega il tuo account Workbench',
  'company.founder.connectSubtitle': 'Accedi con il tuo account PSX — Voyager legge la tua organizzazione in tempo reale (sola lettura)',
  'company.founder.emailPlaceholder': 'Email',
  'company.founder.passwordPlaceholder': 'Password',
  'company.founder.connect': 'Accedi',
  'company.founder.connectedTitle': 'Collegato',
  'company.founder.liveBadge': 'LIVE — dati PSX reali',
  'company.founder.structureCounts': 'Aziende: {{aziende}} · Sedi: {{sedi}} · Reparti: {{reparti}}',
  'company.founder.orgsList': 'Le tue organizzazioni: {{orgs}}',
  'company.account.title': 'Account',
  'company.account.checking': 'Verifica della sessione…',
  'company.account.signInTitle': 'Accedi al tuo account',
  'company.account.signInSubtitle': 'Usa il tuo account PSX Workbench — la tua organizzazione si ricarica automaticamente alla prossima apertura (sessione cifrata)',
  'company.account.noPasswordStored': 'Le password non vengono mai salvate — solo una sessione cifrata e revocabile.',
  'company.account.loginFailed': 'Accesso non riuscito. Controlla le credenziali.',
  'company.account.signOut': 'Esci',
  'company.account.orgTitle': 'La tua organizzazione',
  'company.account.noOrgs': 'Ancora nessuna organizzazione per questo account.',
  'company.account.authorityNote': 'Identità, organizzazione, membership e ruoli sono dati canonici PSX — mostrati così come sono, mai duplicati.',
  'company.team.title': 'Team',
  'company.team.signInRequired': 'Accedi dalla pagina Account per vedere il tuo team.',
  'company.team.noOrgSelected': 'Nessuna organizzazione selezionata. Scegline una nella pagina Account.',
  'company.team.aiEmployees': 'Dipendenti AI',
  'company.team.canonical': 'Record canonici PSX',
  'company.team.loading': 'Caricamento…',
  'company.team.noEmployees': 'Ancora nessun dipendente AI — vengono creati dal flusso di provisioning canonico.',
  'company.team.inactive': 'inattivo',
  'company.team.humanMembers': 'Membri umani del team',
  'company.team.humanNotAvailable': 'Non ancora disponibile: il payload del Runtime non espone la membership umana — apparirà qui via contratto canonico, senza duplicati.',
  'company.team.invite': 'Invita collaboratore',
  'company.team.inviteDisabled': 'L’invito resta disabilitato finché PSX non consegna il contratto canonico di invito.',
};

for (const locale of fs.readdirSync(localesDir)) {
  const dir = path.join(localesDir, locale);
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, 'utf8');
    if (!src.includes('editionCoding')) continue; // only the main locale files
    const json = JSON.parse(src);
    const pack = locale.startsWith('it') ? it : en;
    json['company'] = json['company'] || {};
    for (const [k, v] of Object.entries(pack)) {
      json[k] = json[k] || v;
    }
    fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n', 'utf8');
    console.log('updated:', path.relative(localesDir, p));
  }
}
console.log('done');
