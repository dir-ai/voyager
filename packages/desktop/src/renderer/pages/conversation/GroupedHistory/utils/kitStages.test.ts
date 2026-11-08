import { beforeEach, describe, expect, it } from 'vitest';

// kitStages only needs a t() function; no window/localStorage involved.
const t = (key: string, options?: Record<string, unknown>): string => {
  let out = key;
  if (options) {
    for (const [k, v] of Object.entries(options)) out = out.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
  }
  return `${out}|${JSON.stringify(options ?? {})}`;
};

import { KIT_INLINE_BRIEF_MAX_LENGTH, KIT_STAGES, buildStageKickMessage } from './kitStages';

beforeEach(() => {});

describe('buildStageKickMessage', () => {
  it('renders the stage instruction with the project name', () => {
    const message = buildStageKickMessage({ stageIndex: 1, projectName: 'APP LABS', brief: '', t });
    expect(message).toContain('conversation.history.stageIntakeInstruction');
    expect(message).toContain('"projectName":"APP LABS"');
    expect(message).not.toContain('--- PROJECT BRIEF ---');
  });

  it('inlines the brief with a marker when it is small enough', () => {
    const message = buildStageKickMessage({ stageIndex: 3, projectName: 'P', brief: '# DNA', t });
    expect(message).toContain('conversation.history.stageDnaInstruction');
    expect(message).toContain('--- PROJECT BRIEF ---\n# DNA');
  });

  it('truncates over-size briefs with a notice', () => {
    const big = 'x'.repeat(KIT_INLINE_BRIEF_MAX_LENGTH + 10);
    const message = buildStageKickMessage({ stageIndex: 6, projectName: 'P', brief: big, t });
    expect(message).toContain('conversation.history.stageBuildInstruction');
    expect(message).toContain('conversation.history.briefTruncated');
    // The inlined part is exactly the 8KB slice.
    expect(message).toContain(big.slice(0, KIT_INLINE_BRIEF_MAX_LENGTH));
  });

  it('exposes the six stages in the documented order', () => {
    expect(KIT_STAGES.map((s) => s.id)).toEqual(['intake', 'discovery', 'dna', 'proto', 'plan', 'build']);
    expect(KIT_STAGES.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
