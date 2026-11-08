// One-shot: add phase-3 (brief + kit) i18n keys to all locale conversation.json files.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const LOCALES_DIR = 'packages/desktop/src/renderer/services/i18n/locales';

// stage instructions use {{project}} placeholder
const T = {
  'en-US': {
    editBrief: 'Edit brief',
    projectBrief: 'Project brief — {{project}}',
    startKit: 'Start kit',
    runNextStage: 'Run next stage',
    resetKit: 'Reset kit',
    stageIntake: 'Intake',
    stageDiscovery: 'Discovery',
    stageDna: 'DNA',
    stageProto: 'Proto',
    stagePlan: 'Plan',
    stageBuild: 'Build',
    stageIntakeInstruction:
      'You are the lead of project "{{project}}". Stage 1 — Intake: read the project brief below, list every client requirement, and ask the user to clarify anything missing or ambiguous before moving on. Do not start building.',
    stageDiscoveryInstruction:
      'You are the lead of project "{{project}}". Stage 2 — Discovery: study the existing codebase, assets and constraints relevant to this project. Summarize what exists and what is missing, then report back and wait for review.',
    stageDnaInstruction:
      'You are the lead of project "{{project}}". Stage 3 — DNA: write the project DNA (architecture, data model, standards, definition-of-done) based on the brief and your discovery. Save it as a document and report back for review.',
    stageProtoInstruction:
      'You are the lead of project "{{project}}". Stage 4 — Proto: build the prototype / UI skeleton (use any reference UI assets provided in the brief). Report back with what is working and what is not.',
    stagePlanInstruction:
      'You are the lead of project "{{project}}". Stage 5 — Plan: turn the DNA into a build plan: ordered tasks with owners (member conversations of this project), acceptance criteria and dependencies. Report the plan for approval before execution.',
    stageBuildInstruction:
      'You are the lead of project "{{project}}". Stage 6 — Build: execute the plan. Assign each task to a member conversation via @@ project messaging, verify their results, and iterate until the definition-of-done is met. Report progress regularly.',
    briefPlaceholder: 'Project DNA: client requirements, blueprint, constraints, definition-of-done... (markdown)',
    briefTooLarge: 'The brief is too large (max 200 KB).',
    briefTruncated: '…brief truncated — ask the user for the remainder',
    briefSaved: 'Brief saved.',
    noLeadForKit: 'Set a lead first — the kit stages are delivered to the lead conversation.',
    kitStarted: 'Kit started — stage 1 delivered to the lead.',
    stageAdvanced: 'Next stage delivered to the lead.',
    kitReset: 'Kit reset.',
  },
  'de-DE': {
    editBrief: 'Briefing bearbeiten',
    projectBrief: 'Projekt-Briefing — {{project}}',
    startKit: 'Kit starten',
    runNextStage: 'Nächste Phase starten',
    resetKit: 'Kit zurücksetzen',
    stageIntake: 'Intake',
    stageDiscovery: 'Discovery',
    stageDna: 'DNA',
    stageProto: 'Proto',
    stagePlan: 'Plan',
    stageBuild: 'Build',
    stageIntakeInstruction:
      'Du bist Leiter des Projekts "{{project}}". Phase 1 — Intake: Lies das Projekt-Briefing unten, liste alle Kundenanforderungen auf und kläre Unklarheiten mit dem Benutzer, bevor du weitermachst. Beginne nicht mit dem Aufbau.',
    stageDiscoveryInstruction:
      'Du bist Leiter des Projekts "{{project}}". Phase 2 — Discovery: Untersuche den bestehenden Code, Assets und Einschränkungen dieses Projekts. Fasse zusammen, was vorhanden ist und was fehlt, und warte auf Rückmeldung.',
    stageDnaInstruction:
      'Du bist Leiter des Projekts "{{project}}". Phase 3 — DNA: Erstelle die Projekt-DNA (Architektur, Datenmodell, Standards, Definition of Done) auf Basis des Briefings. Dokumentiere sie und melde dich zur Prüfung.',
    stageProtoInstruction:
      'Du bist Leiter des Projekts "{{project}}". Phase 4 — Proto: Baue den Prototyp / das UI-Gerüst (Referenz-Assets im Briefing verwenden). Berichte, was funktioniert und was nicht.',
    stagePlanInstruction:
      'Du bist Leiter des Projekts "{{project}}". Phase 5 — Plan: Wandle die DNA in einen Bauplan um: geordnete Aufgaben mit Verantwortlichen (Mitglieder dieses Projekts), Abnahmekriterien und Abhängigkeiten. Lege den Plan zur Freigabe vor.',
    stageBuildInstruction:
      'Du bist Leiter des Projekts "{{project}}". Phase 6 — Build: Führe den Plan aus. Weise jede Aufgabe über @@-Projektmessaging einem Mitglied zu, prüfe die Ergebnisse und iteriere, bis die Definition of Done erfüllt ist.',
    briefPlaceholder: 'Projekt-DNA: Kundenanforderungen, Blueprint, Einschränkungen, Definition of Done... (Markdown)',
    briefTooLarge: 'Das Briefing ist zu groß (max. 200 KB).',
    briefTruncated: '…Briefing gekürzt — bitte den Benutzer um den Rest',
    briefSaved: 'Briefing gespeichert.',
    noLeadForKit: 'Lege zuerst einen Leiter fest — die Kit-Phasen werden an die Leiter-Konversation zugestellt.',
    kitStarted: 'Kit gestartet — Phase 1 an den Leiter zugestellt.',
    stageAdvanced: 'Nächste Phase an den Leiter zugestellt.',
    kitReset: 'Kit zurückgesetzt.',
  },
  'es-ES': {
    editBrief: 'Editar brief',
    projectBrief: 'Brief del proyecto — {{project}}',
    startKit: 'Iniciar kit',
    runNextStage: 'Ejecutar siguiente fase',
    resetKit: 'Reiniciar kit',
    stageIntake: 'Intake',
    stageDiscovery: 'Discovery',
    stageDna: 'ADN',
    stageProto: 'Proto',
    stagePlan: 'Plan',
    stageBuild: 'Build',
    stageIntakeInstruction:
      'Eres el líder del proyecto "{{project}}". Fase 1 — Intake: lee el brief del proyecto, enumera todos los requisitos del cliente y pide aclaraciones antes de continuar. No empieces a construir.',
    stageDiscoveryInstruction:
      'Eres el líder del proyecto "{{project}}". Fase 2 — Discovery: estudia el código, los recursos y las restricciones existentes. Resume qué hay y qué falta, y espera revisión.',
    stageDnaInstruction:
      'Eres el líder del proyecto "{{project}}". Fase 3 — ADN: redacta el ADN del proyecto (arquitectura, modelo de datos, estándares, definición de hecho) y entrégalo para revisión.',
    stageProtoInstruction:
      'Eres el líder del proyecto "{{project}}". Fase 4 — Proto: construye el prototipo / esqueleto de UI (usa los recursos de referencia del brief). Informa qué funciona y qué no.',
    stagePlanInstruction:
      'Eres el líder del proyecto "{{project}}". Fase 5 — Plan: convierte el ADN en un plan de construcción: tareas ordenadas con responsables (miembros del proyecto), criterios de aceptación y dependencias. Presenta el plan para aprobación.',
    stageBuildInstruction:
      'Eres el líder del proyecto "{{project}}". Fase 6 — Build: ejecuta el plan. Asigna cada tarea a un miembro vía @@ (mensajería del proyecto), verifica los resultados e itera hasta cumplir la definición de hecho.',
    briefPlaceholder:
      'ADN del proyecto: requisitos del cliente, blueprint, restricciones, definición de hecho... (markdown)',
    briefTooLarge: 'El brief es demasiado grande (máx. 200 KB).',
    briefTruncated: '…brief truncado — pide el resto al usuario',
    briefSaved: 'Brief guardado.',
    noLeadForKit: 'Designa primero un líder — las fases del kit se entregan a la conversación del líder.',
    kitStarted: 'Kit iniciado — fase 1 entregada al líder.',
    stageAdvanced: 'Siguiente fase entregada al líder.',
    kitReset: 'Kit reiniciado.',
  },
  'fr-FR': {
    editBrief: 'Modifier le brief',
    projectBrief: 'Brief du projet — {{project}}',
    startKit: 'Démarrer le kit',
    runNextStage: 'Lancer l\u2019étape suivante',
    resetKit: 'Réinitialiser le kit',
    stageIntake: 'Intake',
    stageDiscovery: 'Discovery',
    stageDna: 'ADN',
    stageProto: 'Proto',
    stagePlan: 'Plan',
    stageBuild: 'Build',
    stageIntakeInstruction:
      'Vous êtes le responsable du projet « {{project}} ». Étape 1 — Intake : lisez le brief du projet, listez toutes les exigences du client et demandez des clarifications avant de continuer. Ne commencez pas la construction.',
    stageDiscoveryInstruction:
      'Vous êtes le responsable du projet « {{project}} ». Étape 2 — Discovery : étudiez le code, les ressources et les contraintes existantes. Résumez ce qui existe et ce qui manque, puis attendez la revue.',
    stageDnaInstruction:
      'Vous êtes le responsable du projet « {{project}} ». Étape 3 — ADN : rédigez l\u2019ADN du projet (architecture, modèle de données, standards, définition du terminé) et soumettez-le pour revue.',
    stageProtoInstruction:
      'Vous êtes le responsable du projet « {{project}} ». Étape 4 — Proto : construisez le prototype / le squelette UI (utilisez les ressources de référence du brief). Signalez ce qui fonctionne et ce qui ne fonctionne pas.',
    stagePlanInstruction:
      'Vous êtes le responsable du projet « {{project}} ». Étape 5 — Plan : transformez l\u2019ADN en plan de construction : tâches ordonnées avec responsables (membres du projet), critères d\u2019acceptation et dépendances. Soumettez le plan pour approbation.',
    stageBuildInstruction:
      'Vous êtes le responsable du projet « {{project}} ». Étape 6 — Build : exécutez le plan. Attribuez chaque tâche à un membre via la messagerie projet @@, vérifiez les résultats et itérez jusqu\u2019à la définition du terminé.',
    briefPlaceholder: 'ADN du projet : exigences client, blueprint, contraintes, définition du terminé... (markdown)',
    briefTooLarge: 'Le brief est trop volumineux (max 200 Ko).',
    briefTruncated: '…brief tronqué — demandez le reste à l\u2019utilisateur',
    briefSaved: 'Brief enregistré.',
    noLeadForKit:
      'Désignez d\u2019abord un responsable — les étapes du kit sont livrées à la conversation du responsable.',
    kitStarted: 'Kit démarré — étape 1 livrée au responsable.',
    stageAdvanced: 'Étape suivante livrée au responsable.',
    kitReset: 'Kit réinitialisé.',
  },
  'ja-JP': {
    editBrief: 'ブリーフを編集',
    projectBrief: 'プロジェクトブリーフ — {{project}}',
    startKit: 'キットを開始',
    runNextStage: '次のステージを実行',
    resetKit: 'キットをリセット',
    stageIntake: 'Intake',
    stageDiscovery: 'Discovery',
    stageDna: 'DNA',
    stageProto: 'Proto',
    stagePlan: 'Plan',
    stageBuild: 'Build',
    stageIntakeInstruction:
      'あなたはプロジェクト「{{project}}」のリーダーです。ステージ1 — Intake：以下のプロジェクトブリーフを読み、クライアントの要件をすべて列挙し、不明点をユーザーに確認してから次へ進んでください。構築はまだ始めないでください。',
    stageDiscoveryInstruction:
      'あなたはプロジェクト「{{project}}」のリーダーです。ステージ2 — Discovery：既存のコードベース・資産・制約を調査し、何があり何が欠けているかをまとめて報告し、レビューを待ってください。',
    stageDnaInstruction:
      'あなたはプロジェクト「{{project}}」のリーダーです。ステージ3 — DNA：ブリーフと調査結果に基づきプロジェクトDNA（アーキテクチャ、データモデル、標準、完了定義）を作成し、レビューのために報告してください。',
    stageProtoInstruction:
      'あなたはプロジェクト「{{project}}」のリーダーです。ステージ4 — Proto：プロトタイプ/UIスケルトンを構築してください（ブリーフ内の参考アセットを活用）。動作状況を報告してください。',
    stagePlanInstruction:
      'あなたはプロジェクト「{{project}}」のリーダーです。ステージ5 — Plan：DNAを実行計画に変換してください（メンバーへの割り当て、受入基準、依存関係を含む）。実行前に計画の承認を求めてください。',
    stageBuildInstruction:
      'あなたはプロジェクト「{{project}}」のリーダーです。ステージ6 — Build：計画を実行してください。@@プロジェクトメッセージングでメンバーにタスクを割り当て、結果を検証し、完了定義を満たすまで繰り返してください。',
    briefPlaceholder: 'プロジェクトDNA：クライアント要件、ブループリント、制約、完了定義…（Markdown）',
    briefTooLarge: 'ブリーフが大きすぎます（最大200KB）。',
    briefTruncated: '…ブリーフは切り詰められました — ユーザーに残りを依頼してください',
    briefSaved: 'ブリーフを保存しました。',
    noLeadForKit: '先にリーダーを設定してください — キットのステージはリーダーの会話に配信されます。',
    kitStarted: 'キットを開始しました — ステージ1をリーダーに配信しました。',
    stageAdvanced: '次のステージをリーダーに配信しました。',
    kitReset: 'キットをリセットしました。',
  },
  'ko-KR': {
    editBrief: '브리프 편집',
    projectBrief: '프로젝트 브리프 — {{project}}',
    startKit: '키트 시작',
    runNextStage: '다음 단계 실행',
    resetKit: '키트 초기화',
    stageIntake: 'Intake',
    stageDiscovery: 'Discovery',
    stageDna: 'DNA',
    stageProto: 'Proto',
    stagePlan: 'Plan',
    stageBuild: 'Build',
    stageIntakeInstruction:
      '당신은 프로젝트 "{{project}}"의 리더입니다. 1단계 — Intake: 아래 프로젝트 브리프를 읽고 고객 요구사항을 모두 정리한 뒤, 모호한 부분을 사용자에게 확인하세요. 아직 구현을 시작하지 마세요.',
    stageDiscoveryInstruction:
      '당신은 프로젝트 "{{project}}"의 리더입니다. 2단계 — Discovery: 기존 코드베이스·자산·제약을 조사하고 무엇이 있고 무엇이 부족한지 요약해 보고한 뒤 검토를 기다리세요.',
    stageDnaInstruction:
      '당신은 프로젝트 "{{project}}"의 리더입니다. 3단계 — DNA: 브리프와 조사 결과를 바탕으로 프로젝트 DNA(아키텍처, 데이터 모델, 표준, 완료 정의)를 작성하고 검토를 요청하세요.',
    stageProtoInstruction:
      '당신은 프로젝트 "{{project}}"의 리더입니다. 4단계 — Proto: 프로토타입/UI 뼈대를 만드세요(브리프의 참고 자산 활용). 동작 현황을 보고하세요.',
    stagePlanInstruction:
      '당신은 프로젝트 "{{project}}"의 리더입니다. 5단계 — Plan: DNA를 빌드 계획으로 변환하세요(멤버별 작업, 수용 기준, 의존성 포함). 실행 전 계획 승인을 요청하세요.',
    stageBuildInstruction:
      '당신은 프로젝트 "{{project}}"의 리더입니다. 6단계 — Build: 계획을 실행하세요. @@ 프로젝트 메시징으로 멤버에게 작업을 할당하고, 결과를 검증하며, 완료 정의를 충족할 때까지 반복하세요.',
    briefPlaceholder: '프로젝트 DNA: 고객 요구사항, 블루프린트, 제약, 완료 정의... (마크다운)',
    briefTooLarge: '브리프가 너무 큽니다(최대 200KB).',
    briefTruncated: '…브리프 잘림 — 사용자에게 나머지를 요청하세요',
    briefSaved: '브리프가 저장되었습니다.',
    noLeadForKit: '먼저 리더를 지정하세요 — 키트 단계는 리더 대화에 전달됩니다.',
    kitStarted: '키트 시작 — 1단계가 리더에게 전달되었습니다.',
    stageAdvanced: '다음 단계가 리더에게 전달되었습니다.',
    kitReset: '키트가 초기화되었습니다.',
  },
  'pt-BR': {
    editBrief: 'Editar brief',
    projectBrief: 'Brief do projeto — {{project}}',
    startKit: 'Iniciar kit',
    runNextStage: 'Executar próxima etapa',
    resetKit: 'Reiniciar kit',
    stageIntake: 'Intake',
    stageDiscovery: 'Discovery',
    stageDna: 'DNA',
    stageProto: 'Proto',
    stagePlan: 'Plano',
    stageBuild: 'Build',
    stageIntakeInstruction:
      'Você é o líder do projeto "{{project}}". Etapa 1 — Intake: leia o brief do projeto, liste todos os requisitos do cliente e peça esclarecimentos antes de continuar. Não comece a construir.',
    stageDiscoveryInstruction:
      'Você é o líder do projeto "{{project}}". Etapa 2 — Discovery: estude o código existente, recursos e restrições. Resuma o que existe e o que falta, e aguarde revisão.',
    stageDnaInstruction:
      'Você é o líder do projeto "{{project}}". Etapa 3 — DNA: escreva o DNA do projeto (arquitetura, modelo de dados, padrões, definição de pronto) e envie para revisão.',
    stageProtoInstruction:
      'Você é o líder do projeto "{{project}}". Etapa 4 — Proto: construa o protótipo / esqueleto de UI (use os recursos de referência do brief). Informe o que funciona e o que não funciona.',
    stagePlanInstruction:
      'Você é o líder do projeto "{{project}}". Etapa 5 — Plano: transforme o DNA em um plano de construção: tarefas ordenadas com responsáveis (membros do projeto), critérios de aceitação e dependências. Apresente o plano para aprovação.',
    stageBuildInstruction:
      'Você é o líder do projeto "{{project}}". Etapa 6 — Build: execute o plano. Atribua cada tarefa a um membro via @@ (mensageria do projeto), verifique os resultados e itere até cumprir a definição de pronto.',
    briefPlaceholder: 'DNA do projeto: requisitos do cliente, blueprint, restrições, definição de pronto... (markdown)',
    briefTooLarge: 'O brief é muito grande (máx. 200 KB).',
    briefTruncated: '…brief truncado — peça o restante ao usuário',
    briefSaved: 'Brief salvo.',
    noLeadForKit: 'Defina primeiro um líder — as etapas do kit são entregues à conversa do líder.',
    kitStarted: 'Kit iniciado — etapa 1 entregue ao líder.',
    stageAdvanced: 'Próxima etapa entregue ao líder.',
    kitReset: 'Kit reiniciado.',
  },
  'ru-RU': {
    editBrief: 'Редактировать бриф',
    projectBrief: 'Бриф проекта — {{project}}',
    startKit: 'Запустить кит',
    runNextStage: 'Запустить следующий этап',
    resetKit: 'Сбросить кит',
    stageIntake: 'Intake',
    stageDiscovery: 'Discovery',
    stageDna: 'ДНК',
    stageProto: 'Прото',
    stagePlan: 'План',
    stageBuild: 'Build',
    stageIntakeInstruction:
      'Вы руководитель проекта «{{project}}». Этап 1 — Intake: прочитайте бриф проекта, перечислите все требования клиента и запросите уточнения прежде чем продолжать. Не начинайте разработку.',
    stageDiscoveryInstruction:
      'Вы руководитель проекта «{{project}}». Этап 2 — Discovery: изучите существующий код, ресурсы и ограничения. Обобщите, что есть и чего не хватает, и дождитесь проверки.',
    stageDnaInstruction:
      'Вы руководитель проекта «{{project}}». Этап 3 — ДНК: напишите ДНК проекта (архитектура, модель данных, стандарты, определение готовности) и представьте на проверку.',
    stageProtoInstruction:
      'Вы руководитель проекта «{{project}}». Этап 4 — Прото: создайте прототип / каркас UI (используйте референсы из брифа). Сообщите, что работает и что нет.',
    stagePlanInstruction:
      'Вы руководитель проекта «{{project}}». Этап 5 — План: превратите ДНК в план разработки: упорядоченные задачи с исполнителями (участниками проекта), критериями приёмки и зависимостями. Представьте план на утверждение.',
    stageBuildInstruction:
      'Вы руководитель проекта «{{project}}». Этап 6 — Build: выполняйте план. Назначайте задачи участникам через @@-переписку проекта, проверяйте результаты и повторяйте до выполнения определения готовности.',
    briefPlaceholder: 'ДНК проекта: требования клиента, blueprint, ограничения, определение готовности... (markdown)',
    briefTooLarge: 'Бриф слишком большой (макс. 200 КБ).',
    briefTruncated: '…бриф усечён — запросите остаток у пользователя',
    briefSaved: 'Бриф сохранён.',
    noLeadForKit: 'Сначала назначьте руководителя — этапы кита доставляются в чат руководителя.',
    kitStarted: 'Кит запущен — этап 1 доставлен руководителю.',
    stageAdvanced: 'Следующий этап доставлен руководителю.',
    kitReset: 'Кит сброшен.',
  },
  'tr-TR': {
    editBrief: 'Briefi düzenle',
    projectBrief: 'Proje briefi — {{project}}',
    startKit: 'Kiti başlat',
    runNextStage: 'Sonraki aşamayı çalıştır',
    resetKit: 'Kiti sıfırla',
    stageIntake: 'Intake',
    stageDiscovery: 'Discovery',
    stageDna: 'DNA',
    stageProto: 'Proto',
    stagePlan: 'Plan',
    stageBuild: 'Build',
    stageIntakeInstruction:
      '"{{project}}" projesinin lideri sizsiniz. Aşama 1 — Intake: aşağıdaki proje briefini okuyun, tüm müşteri gereksinimlerini listeleyin ve belirsizlikleri kullanıcıya sorun. İnşaata başlamayın.',
    stageDiscoveryInstruction:
      '"{{project}}" projesinin lideri sizsiniz. Aşama 2 — Discovery: mevcut kod tabanını, varlıkları ve kısıtları inceleyin. Ne olduğunu ve ne eksik olduğunu özetleyip incelemeyi bekleyin.',
    stageDnaInstruction:
      '"{{project}}" projesinin lideri sizsiniz. Aşama 3 — DNA: brief ve keşiflere dayanarak proje DNA\u2019sını yazın (mimari, veri modeli, standartlar, bitirme tanımı) ve incelemeye sunun.',
    stageProtoInstruction:
      '"{{project}}" projesinin lideri sizsiniz. Aşama 4 — Proto: prototip / UI iskeletini oluşturun (briefteki referans varlıkları kullanın). Çalışanları ve çalışmayanları bildirin.',
    stagePlanInstruction:
      '"{{project}}" projesinin lideri sizsiniz. Aşama 5 — Plan: DNA\u2019yı inşa planına dönüştürün: sıralı görevler, sorumlular (proje üyeleri), kabul kriterleri ve bağımlılıklar. Planı onaya sunun.',
    stageBuildInstruction:
      '"{{project}}" projesinin lideri sizsiniz. Aşama 6 — Build: planı uygulayın. Her görevi @@ proje mesajlaşmasıyla bir üyeye atayın, sonuçları doğrulayın ve bitirme tanımı sağlanana kadar yineleyin.',
    briefPlaceholder: 'Proje DNA\u2019sı: müşteri gereksinimleri, blueprint, kısıtlar, bitirme tanımı... (markdown)',
    briefTooLarge: 'Brief çok büyük (en fazla 200 KB).',
    briefTruncated: '…brief kısaltıldı — kalanını kullanıcıdan isteyin',
    briefSaved: 'Brief kaydedildi.',
    noLeadForKit: 'Önce bir lider atayın — kit aşamaları liderin sohbetine iletilir.',
    kitStarted: 'Kit başlatıldı — 1. aşama lidere iletildi.',
    stageAdvanced: 'Sonraki aşama lidere iletildi.',
    kitReset: 'Kit sıfırlandı.',
  },
  'uk-UA': {
    editBrief: 'Редагувати бріф',
    projectBrief: 'Бріф проєкту — {{project}}',
    startKit: 'Запустити кіт',
    runNextStage: 'Запустити наступний етап',
    resetKit: 'Скинути кіт',
    stageIntake: 'Intake',
    stageDiscovery: 'Discovery',
    stageDna: 'ДНК',
    stageProto: 'Прото',
    stagePlan: 'План',
    stageBuild: 'Build',
    stageIntakeInstruction:
      'Ви керівник проєкту «{{project}}». Етап 1 — Intake: прочитайте бріф проєкту, перелічіть усі вимоги клієнта і попросіть уточнення, перш ніж продовжувати. Не починайте розробку.',
    stageDiscoveryInstruction:
      'Ви керівник проєкту «{{project}}». Етап 2 — Discovery: вивчіть наявний код, ресурси та обмеження. Узагальніть, що є і чого бракує, і дочекайтеся перевірки.',
    stageDnaInstruction:
      'Ви керівник проєкту «{{project}}». Етап 3 — ДНК: напишіть ДНК проєкту (архітектура, модель даних, стандарти, визначення готовності) і подайте на перевірку.',
    stageProtoInstruction:
      'Ви керівник проєкту «{{project}}». Етап 4 — Прото: створіть прототип / каркас UI (використайте референси з бріфу). Повідомте, що працює, а що ні.',
    stagePlanInstruction:
      'Ви керівник проєкту «{{project}}». Етап 5 — План: перетворіть ДНК на план розробки: упорядковані задачі з виконавцями (учасниками проєкту), критеріями приймання та залежностями. Подайте план на затвердження.',
    stageBuildInstruction:
      'Ви керівник проєкту «{{project}}». Етап 6 — Build: виконуйте план. Призначайте задачі учасникам через @@-переписку проєкту, перевіряйте результати та повторюйте до виконання визначення готовності.',
    briefPlaceholder: 'ДНК проєкту: вимоги клієнта, blueprint, обмеження, визначення готовності... (markdown)',
    briefTooLarge: 'Бріф завеликий (макс. 200 КБ).',
    briefTruncated: '…бріф обрізано — запитайте решту в користувача',
    briefSaved: 'Бріф збережено.',
    noLeadForKit: 'Спочатку призначте керівника — етапи кіт доставляються до чату керівника.',
    kitStarted: 'Кіт запущено — етап 1 доставлено керівнику.',
    stageAdvanced: 'Наступний етап доставлено керівнику.',
    kitReset: 'Кіт скинуто.',
  },
  'zh-CN': {
    editBrief: '编辑项目简报',
    projectBrief: '项目简报 — {{project}}',
    startKit: '启动工具包',
    runNextStage: '执行下一阶段',
    resetKit: '重置工具包',
    stageIntake: '需求',
    stageDiscovery: '探索',
    stageDna: 'DNA',
    stageProto: '原型',
    stagePlan: '计划',
    stageBuild: '构建',
    stageIntakeInstruction:
      '你是项目「{{project}}」的负责人。阶段 1 — 需求：阅读下面的项目简报，列出客户的所有需求，并在继续之前向用户确认任何缺失或模糊之处。不要开始构建。',
    stageDiscoveryInstruction:
      '你是项目「{{project}}」的负责人。阶段 2 — 探索：研究现有的代码库、资产和约束。总结已有内容和缺失内容，然后汇报并等待审核。',
    stageDnaInstruction:
      '你是项目「{{project}}」的负责人。阶段 3 — DNA：基于简报和探索结果编写项目 DNA（架构、数据模型、规范、完成定义），并提交审核。',
    stageProtoInstruction:
      '你是项目「{{project}}」的负责人。阶段 4 — 原型：构建原型 / UI 骨架（使用简报中提供的参考素材）。汇报哪些能用、哪些不能用。',
    stagePlanInstruction:
      '你是项目「{{project}}」的负责人。阶段 5 — 计划：把 DNA 转化为构建计划：有序任务及负责人（本项目成员会话）、验收标准和依赖关系。执行前提交计划供批准。',
    stageBuildInstruction:
      '你是项目「{{project}}」的负责人。阶段 6 — 构建：执行计划。通过 @@ 项目消息把任务分配给成员会话，验证结果，并迭代直到满足完成定义。',
    briefPlaceholder: '项目 DNA：客户需求、蓝图、约束、完成定义……（Markdown）',
    briefTooLarge: '简报太大（最大 200 KB）。',
    briefTruncated: '……简报已截断 — 请向用户索取剩余部分',
    briefSaved: '简报已保存。',
    noLeadForKit: '请先设置负责人 — 工具包阶段会发送到负责人的会话。',
    kitStarted: '工具包已启动 — 阶段 1 已发送给负责人。',
    stageAdvanced: '下一阶段已发送给负责人。',
    kitReset: '工具包已重置。',
  },
  'zh-TW': {
    editBrief: '編輯專案簡報',
    projectBrief: '專案簡報 — {{project}}',
    startKit: '啟動工具包',
    runNextStage: '執行下一階段',
    resetKit: '重設工具包',
    stageIntake: '需求',
    stageDiscovery: '探索',
    stageDna: 'DNA',
    stageProto: '原型',
    stagePlan: '計畫',
    stageBuild: '建置',
    stageIntakeInstruction:
      '你是專案「{{project}}」的負責人。階段 1 — 需求：閱讀下面的專案簡報，列出客戶的所有需求，並在繼續之前向使用者確認任何缺失或模糊之處。不要開始建置。',
    stageDiscoveryInstruction:
      '你是專案「{{project}}」的負責人。階段 2 — 探索：研究現有的程式碼庫、資產與限制。總結既有內容與缺失內容，然後回報並等待審核。',
    stageDnaInstruction:
      '你是專案「{{project}}」的負責人。階段 3 — DNA：根據簡報與探索結果撰寫專案 DNA（架構、資料模型、規範、完成定義），並提交審核。',
    stageProtoInstruction:
      '你是專案「{{project}}」的負責人。階段 4 — 原型：建構原型 / UI 骨架（使用簡報中提供的參考素材）。回報哪些可用、哪些不可用。',
    stagePlanInstruction:
      '你是專案「{{project}}」的負責人。階段 5 — 計畫：把 DNA 轉化為建置計畫：有序任務及負責人（本專案成員會話）、驗收標準與相依性。執行前提交計畫供核准。',
    stageBuildInstruction:
      '你是專案「{{project}}」的負責人。階段 6 — 建置：執行計畫。透過 @@ 專案訊息把任務分配給成員會話，驗證結果，並迭代直到滿足完成定義。',
    briefPlaceholder: '專案 DNA：客戶需求、藍圖、限制、完成定義……（Markdown）',
    briefTooLarge: '簡報太大（最大 200 KB）。',
    briefTruncated: '……簡報已截斷 — 請向使用者索取剩餘部分',
    briefSaved: '簡報已儲存。',
    noLeadForKit: '請先設定負責人 — 工具包階段會傳送到負責人的會話。',
    kitStarted: '工具包已啟動 — 階段 1 已傳送給負責人。',
    stageAdvanced: '下一階段已傳送給負責人。',
    kitReset: '工具包已重設。',
  },
};

for (const locale of readdirSync(LOCALES_DIR)) {
  const file = join(LOCALES_DIR, locale, 'conversation.json');
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const history = json.history ?? (json.history = {});
  const additions = T[locale] ?? T['en-US'];
  for (const [key, value] of Object.entries(additions)) {
    if (history[key] === undefined) history[key] = value;
  }
  writeFileSync(file, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log('updated', locale, 'keys:', Object.keys(history).length);
}
console.log('done');
