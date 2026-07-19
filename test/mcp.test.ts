import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { once } from 'node:events'

const here = dirname(fileURLToPath(import.meta.url))
const MCP = join(here, '..', 'dist', 'mcp.js')

function mcpSession() {
  const child = spawn(process.execPath, [MCP], { stdio: ['pipe', 'pipe', 'inherit'] })
  let buf = ''
  const pending = new Map<number, (msg: any) => void>()
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    buf += chunk
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line) continue
      let msg: any
      try { msg = JSON.parse(line) } catch { continue }
      if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)!(msg); pending.delete(msg.id) }
    }
  })
  const send = (msg: unknown) => child.stdin.write(JSON.stringify(msg) + '\n')
  const request = (id: number, method: string, params: unknown) =>
    new Promise<any>((resolve) => { pending.set(id, resolve); send({ jsonrpc: '2.0', id, method, params }) })
  const notify = (method: string, params?: unknown) => send({ jsonrpc: '2.0', method, params })
  return { child, request, notify }
}

test('MCP: initialize → list tools → check_package rejects an invalid name (offline)', async () => {
  const s = mcpSession()
  try {
    const init = await s.request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } })
    assert.equal(init.result?.serverInfo?.name, 'voyager')
    s.notify('notifications/initialized')

    const list = await s.request(2, 'tools/list', {})
    const names = (list.result?.tools ?? []).map((t: any) => t.name)
    assert.ok(names.includes('check_package'))
    assert.ok(names.includes('retrieve'))

    // Invalid name is rejected by validation before any network call — deterministic offline.
    const res = await s.request(3, 'tools/call', { name: 'check_package', arguments: { name: '../../etc/passwd', ecosystem: 'npm' } })
    const payload = JSON.parse(res.result.content[0].text)
    assert.equal(payload.verdict, 'rejected')
    // A tool/registry failure (here: invalid-name guard) must set isError so the
    // client can tell "could not verify" apart from "package is unsafe".
    assert.equal(res.result.isError, true)
    assert.ok(payload.error, 'the error channel must be populated on a tool failure')

    // STRICT validation: an over-long name is REJECTED (isError), never silently
    // truncated into a different subject.
    const long = await s.request(4, 'tools/call', { name: 'check_package', arguments: { name: 'x'.repeat(500) } })
    assert.equal(long.result.isError, true)
    assert.match(long.result.content[0].text, /exceeds 214/)

    // An invalid ecosystem is rejected, not coerced to npm.
    const badEco = await s.request(5, 'tools/call', { name: 'check_package', arguments: { name: 'left-pad', ecosystem: 'cargo' } })
    assert.equal(badEco.result.isError, true)
    assert.match(badEco.result.content[0].text, /ecosystem/)
  } finally {
    s.child.kill()
    await once(s.child, 'exit').catch(() => {})
  }
})
