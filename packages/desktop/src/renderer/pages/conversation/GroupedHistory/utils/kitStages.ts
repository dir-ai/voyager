/**
 * Project Kit — the standard industry pipeline for a project group.
 * The project lead receives a per-stage instruction (plus the project brief)
 * and drives the stage; the stage advances when the kick message is sent, and
 * a human reviews the result before kicking the next stage.
 */

type TFunction = (key: string, options?: Record<string, unknown>) => string;

export const KIT_STAGE_COUNT = 6;
/** Briefs up to this size are inlined into the kick message; larger ones are truncated with a notice. */
export const KIT_INLINE_BRIEF_MAX_LENGTH = 8 * 1024;

export type KitStageId = 'intake' | 'discovery' | 'dna' | 'proto' | 'plan' | 'build';

export type KitStage = {
  id: KitStageId;
  index: number; // 1-based
  titleKey: string;
  instructionKey: string;
};

export const KIT_STAGES: KitStage[] = [
  {
    id: 'intake',
    index: 1,
    titleKey: 'conversation.history.stageIntake',
    instructionKey: 'conversation.history.stageIntakeInstruction',
  },
  {
    id: 'discovery',
    index: 2,
    titleKey: 'conversation.history.stageDiscovery',
    instructionKey: 'conversation.history.stageDiscoveryInstruction',
  },
  {
    id: 'dna',
    index: 3,
    titleKey: 'conversation.history.stageDna',
    instructionKey: 'conversation.history.stageDnaInstruction',
  },
  {
    id: 'proto',
    index: 4,
    titleKey: 'conversation.history.stageProto',
    instructionKey: 'conversation.history.stageProtoInstruction',
  },
  {
    id: 'plan',
    index: 5,
    titleKey: 'conversation.history.stagePlan',
    instructionKey: 'conversation.history.stagePlanInstruction',
  },
  {
    id: 'build',
    index: 6,
    titleKey: 'conversation.history.stageBuild',
    instructionKey: 'conversation.history.stageBuildInstruction',
  },
];

export const getKitStageById = (index: number): KitStage | null => {
  const i = Math.min(Math.max(index, 1), KIT_STAGE_COUNT) - 1;
  return KIT_STAGES[i] ?? null;
};

/**
 * Compose the kick message for a stage: the stage instruction followed by the
 * project brief (inlined when small enough, otherwise truncated with a notice
 * telling the lead to ask the user for the remainder).
 */
export const buildStageKickMessage = ({
  stageIndex,
  projectName,
  brief,
  t,
}: {
  stageIndex: number;
  projectName: string;
  brief: string;
  t: TFunction;
}): string => {
  const stage = getKitStageById(stageIndex);
  let body = stage
    ? t(stage.instructionKey, { projectName })
    : t('conversation.history.stageIntakeInstruction', { projectName });
  if (brief) {
    body += '\n\n--- PROJECT BRIEF ---\n';
    if (brief.length <= KIT_INLINE_BRIEF_MAX_LENGTH) {
      body += brief;
    } else {
      body += `${brief.slice(0, KIT_INLINE_BRIEF_MAX_LENGTH)}…\n[${t('conversation.history.briefTruncated')}]`;
    }
  }
  return body;
};
