// One-shot: add VOYAGER edition-switch i18n keys to all locale files.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = 'packages/desktop/src/renderer/services/i18n/locales';

const S = {
  'en-US': {
    edition: 'Edition',
    editionCoding: 'Coding',
    editionCompany: 'Company',
    editionCodingDescription: 'Developer workspaces: projects, agents and build kits.',
    editionCompanyDescription: 'Organization mode: departments with context inherited from your PSX runtime.',
    editionActive: 'Active',
    editionNote: 'The switch applies immediately — your conversations and settings are shared between editions.',
    editionCompanyPreview: 'Preview — organization features arrive soon',
  },
};

const OVERRIDES = {
  'de-DE': {
    edition: 'Edition',
    editionCoding: 'Coding',
    editionCompany: 'Company',
    editionCodingDescription: 'Entwickler-Workspaces: Projekte, Agenten und Build-Kits.',
    editionCompanyDescription: 'Organisationsmodus: Abteilungen mit Kontext aus Ihrer PSX-Runtime.',
    editionActive: 'Aktiv',
    editionNote: 'Der Wechsel wirkt sofort — Konversationen und Einstellungen bleiben erhalten.',
    editionCompanyPreview: 'Vorschau — Organisationsfunktionen folgen bald',
  },
  'es-ES': {
    edition: 'Edición',
    editionCoding: 'Coding',
    editionCompany: 'Company',
    editionCodingDescription: 'Espacios de desarrollo: proyectos, agentes y kits de construcción.',
    editionCompanyDescription: 'Modo organización: departamentos con contexto heredado de su runtime PSX.',
    editionActive: 'Activa',
    editionNote: 'El cambio se aplica al instante — sus conversaciones y ajustes se comparten entre ediciones.',
    editionCompanyPreview: 'Vista previa — las funciones de organización llegarán pronto',
  },
  'fr-FR': {
    edition: 'Édition',
    editionCoding: 'Coding',
    editionCompany: 'Company',
    editionCodingDescription: 'Espaces de développement : projets, agents et kits de construction.',
    editionCompanyDescription: 'Mode organisation : départements avec contexte hérité de votre runtime PSX.',
    editionActive: 'Active',
    editionNote:
      'Le changement s\u2019applique immédiatement — vos conversations et réglages sont partagés entre les éditions.',
    editionCompanyPreview: 'Aperçu — les fonctions d\u2019organisation arrivent bientôt',
  },
  'pt-BR': {
    edition: 'Edição',
    editionCoding: 'Coding',
    editionCompany: 'Company',
    editionCodingDescription: 'Espaços de desenvolvedor: projetos, agentes e kits de construção.',
    editionCompanyDescription: 'Modo organização: departamentos com contexto herdado do seu runtime PSX.',
    editionActive: 'Ativa',
    editionNote:
      'A troca é aplicada imediatamente — suas conversas e configurações são compartilhadas entre as edições.',
    editionCompanyPreview: 'Prévia — os recursos de organização chegam em breve',
  },
  'ru-RU': {
    edition: 'Редакция',
    editionCoding: 'Coding',
    editionCompany: 'Company',
    editionCodingDescription: 'Рабочие пространства разработчика: проекты, агенты и сборочные киты.',
    editionCompanyDescription: 'Режим организации: отделы с контекстом, унаследованным из вашего PSX-рантайма.',
    editionActive: 'Активна',
    editionNote: 'Переключение применяется сразу — разговоры и настройки общие для обеих редакций.',
    editionCompanyPreview: 'Предпросмотр — функции организации появятся скоро',
  },
  'zh-CN': {
    edition: '版本模式',
    editionCoding: 'Coding',
    editionCompany: 'Company',
    editionCodingDescription: '开发者工作区：项目、智能体与构建套件。',
    editionCompanyDescription: '组织模式：部门上下文继承自您的 PSX 运行时。',
    editionActive: '当前模式',
    editionNote: '切换立即生效 — 会话与设置在两种模式间共享。',
    editionCompanyPreview: '预览 — 组织功能即将上线',
  },
  'zh-TW': {
    edition: '版本模式',
    editionCoding: 'Coding',
    editionCompany: 'Company',
    editionCodingDescription: '開發者工作區：專案、智慧代理與建置套件。',
    editionCompanyDescription: '組織模式：部門上下文繼承自您的 PSX 執行時。',
    editionActive: '目前模式',
    editionNote: '切換立即生效 — 會話與設定在兩種模式間共用。',
    editionCompanyPreview: '預覽 — 組織功能即將推出',
  },
  'ja-JP': {
    edition: 'エディション',
    editionCoding: 'Coding',
    editionCompany: 'Company',
    editionCodingDescription: '開発者ワークスペース：プロジェクト、エージェント、ビルドキット。',
    editionCompanyDescription: '組織モード：PSXランタイムからコンテキストを引き継ぐ部門。',
    editionActive: '使用中',
    editionNote: '切り替えは即時反映されます — 会話と設定は両エディションで共有されます。',
    editionCompanyPreview: 'プレビュー — 組織機能は近日公開',
  },
  'ko-KR': {
    edition: '에디션',
    editionCoding: 'Coding',
    editionCompany: 'Company',
    editionCodingDescription: '개발자 워크스페이스: 프로젝트, 에이전트, 빌드 키트.',
    editionCompanyDescription: '조직 모드: PSX 런타임에서 컨텍스트를 상속하는 부서.',
    editionActive: '활성',
    editionNote: '전환은 즉시 적용됩니다 — 대화와 설정은 두 에디션에서 공유됩니다.',
    editionCompanyPreview: '미리보기 — 조직 기능이 곧 제공됩니다',
  },
  'tr-TR': {
    edition: 'Sürüm',
    editionCoding: 'Coding',
    editionCompany: 'Company',
    editionCodingDescription: 'Geliştirici çalışma alanları: projeler, ajanlar ve inşa kitleri.',
    editionCompanyDescription: 'Kuruluş modu: PSX çalışma zamanınızdan bağlam devralan departmanlar.',
    editionActive: 'Etkin',
    editionNote: 'Geçiş anında uygulanır — sohbetler ve ayarlar iki sürümde ortaktır.',
    editionCompanyPreview: 'Önizleme — kuruluş özellikleri yakında',
  },
  'uk-UA': {
    edition: 'Редакція',
    editionCoding: 'Coding',
    editionCompany: 'Company',
    editionCodingDescription: 'Робочі простори розробника: проєкти, агенти та збірні кіти.',
    editionCompanyDescription: 'Режим організації: відділи з контекстом, успадкованим з вашого PSX-рантайму.',
    editionActive: 'Активна',
    editionNote: 'Перемикання застосовується одразу — розмови та налаштування спільні для обох редакцій.',
    editionCompanyPreview: 'Попередній перегляд — функції організації з\u2019являться скоро',
  },
};

const CONV_ADDITIONS = {
  'en-US': { departmentsSection: 'Departments' },
  'de-DE': { departmentsSection: 'Abteilungen' },
  'es-ES': { departmentsSection: 'Departamentos' },
  'fr-FR': { departmentsSection: 'Départements' },
  'pt-BR': { departmentsSection: 'Departamentos' },
  'ru-RU': { departmentsSection: 'Отделы' },
  'zh-CN': { departmentsSection: '部门' },
  'zh-TW': { departmentsSection: '部門' },
  'ja-JP': { departmentsSection: '部門' },
  'ko-KR': { departmentsSection: '부서' },
  'tr-TR': { departmentsSection: 'Departmanlar' },
  'uk-UA': { departmentsSection: 'Відділи' },
};

for (const locale of readdirSync(LOCALES_DIR)) {
  const dir = join(LOCALES_DIR, locale);
  // settings.json
  const settingsFile = join(dir, 'settings.json');
  const settings = JSON.parse(readFileSync(settingsFile, 'utf8'));
  const sTable = { ...S['en-US'], ...(OVERRIDES[locale] ?? {}) };
  for (const [key, value] of Object.entries(sTable)) {
    if (settings[key] === undefined) settings[key] = value;
  }
  writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  // conversation.json
  const convFile = join(dir, 'conversation.json');
  const conv = JSON.parse(readFileSync(convFile, 'utf8'));
  const cTable = CONV_ADDITIONS[locale] ?? CONV_ADDITIONS['en-US'];
  const history = conv.history ?? (conv.history = {});
  for (const [key, value] of Object.entries(cTable)) {
    if (history[key] === undefined) history[key] = value;
  }
  writeFileSync(convFile, JSON.stringify(conv, null, 2) + '\n', 'utf8');
}
console.log('done');
