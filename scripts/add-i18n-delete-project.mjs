// One-shot: add delete-project i18n keys to all locale conversation.json files.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = 'packages/desktop/src/renderer/services/i18n/locales';

const T = {
  'en-US': {
    deleteProject: 'Delete project',
    confirmDeleteProject: 'Delete "{{project}}"?',
    deleteProjectHint:
      'The conversations return to the normal list (nothing is deleted). The project lead, brief, kit and settings are discarded.',
    projectDeleted: 'Project deleted.',
  },
  'de-DE': {
    deleteProject: 'Projekt löschen',
    confirmDeleteProject: '„{{project}}" löschen?',
    deleteProjectHint:
      'Die Unterkehrungen kehren zur normalen Liste zurück (nichts wird gelöscht). Leiter, Briefing, Kit und Einstellungen des Projekts werden verworfen.',
    projectDeleted: 'Projekt gelöscht.',
  },
  'es-ES': {
    deleteProject: 'Eliminar proyecto',
    confirmDeleteProject: '¿Eliminar «{{project}}»?',
    deleteProjectHint:
      'Las conversaciones vuelven a la lista normal (no se elimina nada). Se descartan el líder, el brief, el kit y los ajustes del proyecto.',
    projectDeleted: 'Proyecto eliminado.',
  },
  'fr-FR': {
    deleteProject: 'Supprimer le projet',
    confirmDeleteProject: 'Supprimer « {{project}} » ?',
    deleteProjectHint:
      'Les conversations reviennent dans la liste normale (rien n\u2019est supprimé). Le responsable, le brief, le kit et les paramètres du projet sont abandonnés.',
    projectDeleted: 'Projet supprimé.',
  },
  'ja-JP': {
    deleteProject: 'プロジェクトを削除',
    confirmDeleteProject: '「{{project}}」を削除しますか？',
    deleteProjectHint:
      '会話は通常のリストに戻ります（削除はされません）。リーダー・ブリーフ・キット・設定は破棄されます。',
    projectDeleted: 'プロジェクトを削除しました。',
  },
  'ko-KR': {
    deleteProject: '프로젝트 삭제',
    confirmDeleteProject: '"{{project}}"을(를) 삭제할까요?',
    deleteProjectHint: '대화는 일반 목록으로 돌아갑니다(아무것도 삭제되지 않음). 리더·브리프·키트·설정은 폐기됩니다.',
    projectDeleted: '프로젝트가 삭제되었습니다.',
  },
  'pt-BR': {
    deleteProject: 'Excluir projeto',
    confirmDeleteProject: 'Excluir "{{project}}"?',
    deleteProjectHint:
      'As conversas voltam para a lista normal (nada é excluído). O líder, o brief, o kit e as configurações do projeto são descartados.',
    projectDeleted: 'Projeto excluído.',
  },
  'ru-RU': {
    deleteProject: 'Удалить проект',
    confirmDeleteProject: 'Удалить «{{project}}»?',
    deleteProjectHint:
      'Разговоры вернутся в обычный список (ничего не удаляется). Руководитель, бриф, кит и настройки проекта будут отброшены.',
    projectDeleted: 'Проект удалён.',
  },
  'tr-TR': {
    deleteProject: 'Projeyi sil',
    confirmDeleteProject: '"{{project}}" silinsin mi?',
    deleteProjectHint:
      'Sohbetler normal listeye döner (hiçbir şey silinmez). Lider, brief, kit ve proje ayarları atılır.',
    projectDeleted: 'Proje silindi.',
  },
  'uk-UA': {
    deleteProject: 'Видалити проєкт',
    confirmDeleteProject: 'Видалити «{{project}}»?',
    deleteProjectHint:
      'Розмови повернуться до звичайного списку (нічого не видаляється). Керівника, бріф, кіт і налаштування проєкту буде відкинуто.',
    projectDeleted: 'Проєкт видалено.',
  },
  'zh-CN': {
    deleteProject: '删除项目',
    confirmDeleteProject: '删除「{{project}}」？',
    deleteProjectHint: '会话将回到普通列表（不会删除任何会话）。项目的负责人、简报、工具包和设置将被丢弃。',
    projectDeleted: '项目已删除。',
  },
  'zh-TW': {
    deleteProject: '刪除專案',
    confirmDeleteProject: '刪除「{{project}}」？',
    deleteProjectHint: '會話將回到普通列表（不會刪除任何會話）。專案的負責人、簡報、工具包和設定將被丟棄。',
    projectDeleted: '專案已刪除。',
  },
};

for (const locale of readdirSync(LOCALES_DIR)) {
  const file = join(LOCALES_DIR, locale, 'conversation.json');
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const history = json.history ?? (json.history = {});
  const table = T[locale] ?? T['en-US'];
  for (const [key, value] of Object.entries(table)) {
    if (history[key] === undefined) history[key] = value;
  }
  writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
}
console.log('done');
