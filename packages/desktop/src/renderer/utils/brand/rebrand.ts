/**
 * VOYAGER rebrand: the backend (aioncore binary) ships agent/assistant records
 * whose user-visible names still reference the upstream brand ("Aion CLI",
 * "AionHub", "AionCore", "AionUi"). Those names are baked into the binary and
 * cannot be edited there, so every display-name choke point funnels through
 * this helper to present the VOYAGER brand consistently.
 */
export function rebrandAgentName(name: string | null | undefined): string {
  if (!name) return name as string;
  return name
    .replace(/Aion\s*CLI/gi, 'Voyager CLI')
    .replace(/Aion\s*Hub/gi, 'Voyager Hub')
    .replace(/Aion\s*Core/gi, 'Voyager Core')
    .replace(/Aion\s*UI/gi, 'VOYAGER')
    .replace(/AionUi/gi, 'VOYAGER')
    .replace(/\bAion\b/g, 'Voyager');
}
