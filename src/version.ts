import { createRequire } from 'node:module'
// Single source of truth: the published package.json version, read at runtime so
// CLI/MCP banners never drift from the release tag.
const require = createRequire(import.meta.url)
export const VERSION: string = (require('../package.json') as { version: string }).version
