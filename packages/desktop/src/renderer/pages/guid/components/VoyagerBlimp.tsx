import React from 'react';
import styles from './VoyagerBlimp.module.css';

/**
 * VoyagerBlimp — the "The World Is Yours..." dirigible from Scarface.
 * A dark blimp drifting across a deep-blue sky with the lit motto on its side.
 * Rendered on the Guid welcome page while the Voyager assistant is selected:
 * the message is about the user's power, not the agent's.
 */
export const VoyagerBlimp: React.FC = () => {
  return (
    <div className={styles.sky} aria-hidden='true'>
      <div className={styles.blimp}>
        <div className={styles.envelope}>
          <span className={styles.motto}>THE WORLD IS YOURS...</span>
        </div>
        <div className={styles.gondola} />
      </div>
    </div>
  );
};

export default VoyagerBlimp;
