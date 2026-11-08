/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckOne } from '@icon-park/react';
import React from 'react';

import { KIT_STAGES } from '../utils/kitStages';

/** Compile-time i18n keys (kept in sync via scripts/generate-i18n-types). */
type KitPipelineProps = {
  /** 0 = kit not started; 1..KIT_STAGE_COUNT = current stage. */
  stage: number;
  t: (key: string) => string;
  className?: string;
};

/**
 * Compact stage stepper for the project kit, rendered as the first row of an
 * expanded named-project group: `01 Intake … 06 Build`, mirroring the mockup
 * (done = dimmed + check, active = highlighted, future = secondary).
 */
export const KitPipeline: React.FC<KitPipelineProps> = ({ stage, t, className }) => {
  return (
    <div className={`flex items-center gap-10px overflow-hidden px-6px py-4px ${className ?? ''}`}>
      {KIT_STAGES.map((kitStage) => {
        const index = kitStage.index;
        const done = stage > index;
        const active = stage === index;
        const number = String(index).padStart(2, '0');
        const title = t(kitStage.titleKey);
        return (
          <div
            key={kitStage.id}
            className={`flex flex-none items-center gap-4px text-12px ${
              done ? 'text-t-tertiary opacity-70' : active ? 'text-t-primary' : 'text-t-secondary'
            }`}
            title={title}
          >
            {done ? (
              <CheckOne theme='outline' size='12' fill='currentColor' strokeWidth={3} />
            ) : (
              <span
                className={active ? 'font-medium' : ''}
                style={active ? { color: 'rgb(var(--primary-6))' } : undefined}
              >
                {number}
              </span>
            )}
            <span className={`whitespace-nowrap ${active ? 'font-medium' : ''}`}>{title}</span>
          </div>
        );
      })}
    </div>
  );
};
