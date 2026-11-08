// One-shot: add phase-3.5 (project settings) i18n keys to all locale conversation.json files.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = 'packages/desktop/src/renderer/services/i18n/locales';

const T = {
  'en-US': {
    projectSettings: 'Project settings — {{project}}',
    projectSettingsShort: 'Project settings',
    settingsGuidelines: 'Development guidelines',
    settingsGuidelinesHint: 'Conventions, stack rules, do/don\u2019t …',
    settingsUiGuidelines: 'UI guidelines',
    settingsUiGuidelinesHint: 'Design system, layout rules, reference assets …',
    settingsDelivery: 'Delivery mode',
    settingsRepo: 'Repository URL',
    deliveryGit: 'Commit to repository',
    deliveryWorkspace: 'Deliverable files in workspace',
    deliveryBoth: 'Repository + workspace files',
    settingsSaved: 'Project settings saved.',
    settingsSaveFailed: 'Could not save the project settings.',
  },
};

// Non-English locales reuse concise translations; fall back to English where unsure.
const OVERRIDES = {
  'it-IT': {},
  'de-DE': {
    projectSettings: 'Projekteinstellungen — {{project}}',
    projectSettingsShort: 'Projekteinstellungen',
    settingsGuidelines: 'Entwicklungsrichtlinien',
    settingsUiGuidelines: 'UI-Richtlinien',
    settingsDelivery: 'Liefermodus',
    settingsRepo: 'Repository-URL',
    deliveryGit: 'Ins Repository committen',
    deliveryWorkspace: 'Ergebnisdateien im Workspace',
    deliveryBoth: 'Repository + Workspace-Dateien',
    settingsSaved: 'Projekteinstellungen gespeichert.',
    settingsSaveFailed: 'Projekteinstellungen konnten nicht gespeichert werden.',
  },
  'es-ES': {
    projectSettings: 'Ajustes del proyecto — {{project}}',
    projectSettingsShort: 'Ajustes del proyecto',
    settingsGuidelines: 'Directrices de desarrollo',
    settingsUiGuidelines: 'Directrices de UI',
    settingsDelivery: 'Modo de entrega',
    settingsRepo: 'URL del repositorio',
    deliveryGit: 'Commit al repositorio',
    deliveryWorkspace: 'Archivos en el workspace',
    deliveryBoth: 'Repositorio + archivos del workspace',
    settingsSaved: 'Ajustes guardados.',
    settingsSaveFailed: 'No se pudieron guardar los ajustes.',
  },
  'fr-FR': {
    projectSettings: 'Paramètres du projet — {{project}}',
    projectSettingsShort: 'Paramètres du projet',
    settingsGuidelines: 'Directives de développement',
    settingsUiGuidelines: 'Directives UI',
    settingsDelivery: 'Mode de livraison',
    settingsRepo: 'URL du dépôt',
    deliveryGit: 'Commit dans le dépôt',
    deliveryWorkspace: 'Fichiers dans le workspace',
    deliveryBoth: 'Dépôt + fichiers workspace',
    settingsSaved: 'Paramètres enregistrés.',
    settingsSaveFailed: 'Impossible d\u2019enregistrer les paramètres.',
  },
  'pt-BR': {
    projectSettings: 'Configurações do projeto — {{project}}',
    projectSettingsShort: 'Configurações do projeto',
    settingsGuidelines: 'Diretrizes de desenvolvimento',
    settingsUiGuidelines: 'Diretrizes de UI',
    settingsDelivery: 'Modo de entrega',
    settingsRepo: 'URL do repositório',
    deliveryGit: 'Commit no repositório',
    deliveryWorkspace: 'Arquivos no workspace',
    deliveryBoth: 'Repositório + arquivos do workspace',
    settingsSaved: 'Configurações salvas.',
    settingsSaveFailed: 'Não foi possível salvar as configurações.',
  },
  'ru-RU': {
    projectSettings: 'Настройки проекта — {{project}}',
    projectSettingsShort: 'Настройки проекта',
    settingsGuidelines: 'Правила разработки',
    settingsUiGuidelines: 'Правила UI',
    settingsDelivery: 'Режим доставки',
    settingsRepo: 'URL репозитория',
    deliveryGit: 'Коммиты в репозиторий',
    deliveryWorkspace: 'Файлы в workspace',
    deliveryBoth: 'Репозиторий + файлы workspace',
    settingsSaved: 'Настройки сохранены.',
    settingsSaveFailed: 'Не удалось сохранить настройки.',
  },
  'zh-CN': {
    projectSettings: '项目设置 — {{project}}',
    projectSettingsShort: '项目设置',
    settingsGuidelines: '开发规范',
    settingsUiGuidelines: 'UI 规范',
    settingsDelivery: '交付方式',
    settingsRepo: '仓库地址',
    deliveryGit: '提交到仓库',
    deliveryWorkspace: '交付文件在工作区',
    deliveryBoth: '仓库 + 工作区文件',
    settingsSaved: '项目设置已保存。',
    settingsSaveFailed: '无法保存项目设置。',
  },
  'zh-TW': {
    projectSettings: '專案設定 — {{project}}',
    projectSettingsShort: '專案設定',
    settingsGuidelines: '開發規範',
    settingsUiGuidelines: 'UI 規範',
    settingsDelivery: '交付方式',
    settingsRepo: '儲存庫地址',
    deliveryGit: '提交到儲存庫',
    deliveryWorkspace: '交付檔案在工作區',
    deliveryBoth: '儲存庫 + 工作區檔案',
    settingsSaved: '專案設定已儲存。',
    settingsSaveFailed: '無法儲存專案設定。',
  },
  'ja-JP': {
    projectSettings: 'プロジェクト設定 — {{project}}',
    projectSettingsShort: 'プロジェクト設定',
    settingsGuidelines: '開発ガイドライン',
    settingsUiGuidelines: 'UIガイドライン',
    settingsDelivery: '納品モード',
    settingsRepo: 'リポジトリURL',
    deliveryGit: 'リポジトリにコミット',
    deliveryWorkspace: 'ワークスペースにファイル納品',
    deliveryBoth: 'リポジトリ＋ワークスペース',
    settingsSaved: 'プロジェクト設定を保存しました。',
    settingsSaveFailed: '保存できませんでした。',
  },
  'ko-KR': {
    projectSettings: '프로젝트 설정 — {{project}}',
    projectSettingsShort: '프로젝트 설정',
    settingsGuidelines: '개발 가이드라인',
    settingsUiGuidelines: 'UI 가이드라인',
    settingsDelivery: '전달 방식',
    settingsRepo: '저장소 URL',
    deliveryGit: '저장소에 커밋',
    deliveryWorkspace: '워크스페이스에 파일 전달',
    deliveryBoth: '저장소 + 워크스페이스',
    settingsSaved: '프로젝트 설정이 저장되었습니다.',
    settingsSaveFailed: '설정을 저장할 수 없습니다.',
  },
  'tr-TR': {
    projectSettings: 'Proje ayarları — {{project}}',
    projectSettingsShort: 'Proje ayarları',
    settingsGuidelines: 'Geliştirme kuralları',
    settingsUiGuidelines: 'UI kuralları',
    settingsDelivery: 'Teslim modu',
    settingsRepo: 'Depo URL\u2019si',
    deliveryGit: 'Depoya commit',
    deliveryWorkspace: 'Workspace\u2019e dosya teslimi',
    deliveryBoth: 'Depo + workspace dosyaları',
    settingsSaved: 'Proje ayarları kaydedildi.',
    settingsSaveFailed: 'Ayarlar kaydedilemedi.',
  },
  'uk-UA': {
    projectSettings: 'Налаштування проєкту — {{project}}',
    projectSettingsShort: 'Налаштування проєкту',
    settingsGuidelines: 'Правила розробки',
    settingsUiGuidelines: 'Правила UI',
    settingsDelivery: 'Режим доставки',
    settingsRepo: 'URL репозиторію',
    deliveryGit: 'Коміти до репозиторію',
    deliveryWorkspace: 'Файли у workspace',
    deliveryBoth: 'Репозиторій + файли workspace',
    settingsSaved: 'Налаштування збережено.',
    settingsSaveFailed: 'Не вдалося зберегти налаштування.',
  },
  'fa-IR': {},
};

for (const locale of readdirSync(LOCALES_DIR)) {
  const file = join(LOCALES_DIR, locale, 'conversation.json');
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const history = json.history ?? (json.history = {});
  const table = { ...T['en-US'], ...(OVERRIDES[locale] ?? {}) };
  for (const [key, value] of Object.entries(table)) {
    if (history[key] === undefined) history[key] = value;
  }
  writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
}
console.log('done');
