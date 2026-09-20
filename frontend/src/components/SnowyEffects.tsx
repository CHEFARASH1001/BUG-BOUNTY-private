'use client';

import { useTheme } from '@/lib/theme-context';

/**
 * SnowyEffects Component
 *
 * Renders snowfall animation and Santa with reindeer
 * Only visible when the snowy theme is active
 */
export function SnowyEffects() {
  const { theme } = useTheme();

  // Only render effects for snowy theme
  if (theme !== 'snowy') {
    return null;
  }

  return (
    <>
      {/* Snowflakes */}
      <div className="snowflakes" aria-hidden="true">
        <div className="snowflake">❄</div>
        <div className="snowflake">❅</div>
        <div className="snowflake">❆</div>
        <div className="snowflake">❄</div>
        <div className="snowflake">❅</div>
        <div className="snowflake">❆</div>
        <div className="snowflake">❄</div>
        <div className="snowflake">❅</div>
        <div className="snowflake">❆</div>
        <div className="snowflake">❄</div>
      </div>

      {/* Santa and Reindeer */}
      <div className="santa-container" aria-hidden="true">
        <div className="santa-sleigh" />
      </div>
    </>
  );
}

export default SnowyEffects;
