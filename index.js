/**
 * Host half of the Super-DeepSeek-Harness Git bundle.
 *
 * Owns the sync engine. Snapshots the enabled sync items (profile files,
 * skills, plugin data stores, sessions, auto-discovered ~/.dsh entries) into
 * a local staging tree, then commits them to the user's private GitHub
 * repository **through the GitHub REST API** (git data endpoints):
 *
 *   base commit → tree(per-file SHA-1) → commit → update ref
 *
 * This bypasses the git smart-HTTP protocol on github.com, which corporate
 * networks commonly block while api.github.com stays reachable. Downloads
 * (restore) read tree entries as raw blobs. Files >80 MiB are skipped
 * (REST blob limit; nothing in the sync scope legitimately exceeds it).
 * The token lives in the DSH credential store.
 */

const { default: Schema } = await import('@deepseek-ai/schemastery')
const crypto = await import('node:crypto')

const NS = 'super-dsh-git'
const TOKEN_KEY = `${NS}/github-token`
const STAGING = `${NS}/staging`
const BRANCH = 'main'
const API = 'https://api.github.com'
const MAX_BLOB_BYTES = 80 * 1024 * 1024
const DISCOVER_MAX = 40

export const Config = Schema.object({
  repoUrl: Schema.string().default(''),
  accountLogin: Schema.string().default(''),
  /** Per-item enable overrides; absent ids use the item's default. */
  itemStates: Schema.dict(Schema.boolean()).default({}),
})

export const name = 'super-dsh-git'
export const inject = ['connection', 'credentials', 'configEditor']

// ---------- node utilities ----------

async function nodeModules() {
  return {
    fs: (await import('node:fs')).default,
    path: (await import('node:path')).default,
    os: (await import('node:os')).default,
  }
}

function home() {
  return process.env.HOME ?? process.env.USERPROFILE ?? ''
}

function dshDir() {
  const dir = `${home()}/.dsh`
  const profile = process.env.DSH_PROFILE ?? 'desktop'
  return { dir, profileDir: `${dir}/profiles/${profile}`, profile }
}

function repoSlug(repoUrl) {
  const match = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(repoUrl ?? '')
  return match === null ? undefined : `${match[1]}/${match[2]}`
}

// ---------- secrets that must never sync ----------

const FORBIDDEN_PATTERNS = ['.credentials.yaml', 'openai-gateway', 'token-ledger', 'age.key', 'AGE-SECRET', 'dsh-runtimes']

function pathIsForbidden(relKey) {
  return FORBIDDEN_PATTERNS.some((needle) => relKey.includes(needle))
}

// ---------- item model ----------

const RESERVED_TOP = new Set([
  'profiles', 'sessions', 'cache', 'dsh-runtimes', 'attachments', 'storages', 'node_modules',
  'armory', 'our-free-model', 'task-board', 'skin-center-active.json', 'pet.json', 'wb-market',
  'channel-pack', 'mcp-runtime', '.plugin-manager', 'super-dsh-git', '.credentials.yaml',
  'openai-gateway', 'dsh-session-manager', 'dsh-claude-style',
])

function buildItems() {
  const { dir, profileDir } = dshDir()
  const hm = home()
  const items = []
  const files = (id, group, label, rels, enabledDefault = true) => items.push({
    id, group, label, enabledDefault,
    entries: rels.map((rel) => ({ from: `${hm}/${rel}`, key: rel })),
  })
  items.push({
    id: 'profile', group: 'profile', label: '配置(模型、代理、MCP、界面)', enabledDefault: true,
    entries: ['cordis.patch.yml', 'package.json', 'pnpm-lock.yaml'].map((f) => ({ from: `${profileDir}/${f}`, key: `profile/${f}` })),
  })
  items.push({
    id: 'skills', group: 'skills', label: '技能(~/.agents/skills)', enabledDefault: true,
    entries: [{ from: `${hm}/.agents/skills`, key: 'skills' }],
  })
  files('armory', 'plugin-data', 'Armory(技能市场安装状态)', ['.dsh/armory/install-state.json', '.dsh/armory/marketplaces.json', '.dsh/armory/github-meta.json', '.dsh/armory/npm-downloads.json', '.dsh/armory/awesome-market'])
  files('our-free-model', 'plugin-data', 'Our Free Model 设置', ['.dsh/our-free-model/settings.json', '.dsh/our-free-model/availability.json', '.dsh/our-free-model/catalog.json', '.dsh/our-free-model/stats.json', '.dsh/our-free-model/feed.json'])
  files('task-board', 'plugin-data', '任务板', ['.dsh/task-board'])
  files('workspace-index', 'plugin-data', '工作区与会话索引', ['.dsh/storages/workspace.json'])
  files('skin', 'plugin-data', '皮肤中心', ['.dsh/skin-center-active.json', '.dsh/dsh-claude-style'])
  files('pet', 'plugin-data', '桌宠', ['.dsh/pet.json'])
  files('mcp-runtime', 'plugin-data', 'MCP runtime(mastergo 等)', ['.dsh/mcp-runtime'])
  files('channel-pack', 'plugin-data', '渠道包状态(不含账本)', ['.dsh/channel-pack/state.json', '.dsh/channel-pack/auto-checkin.json'])
  files('wb-market', 'plugin-data', 'WorkBuddy 专家配置', ['.dsh/wb-market/experts', '.dsh/wb-market/meta.json'])
  items.push({
    id: 'sessions', group: 'sessions', label: '会话历史(聊天记录)', enabledDefault: true,
    entries: [{ from: `${dir}/sessions`, key: 'sessions', filter: (p) => p.endsWith('.zstd') || p.endsWith('.json') }],
  })
  return items
}

async function discoverItems() {
  const { fs } = await nodeModules()
  const top = dshDir().dir
  const found = []
  let entries
  try { entries = await fs.promises.readdir(top, { withFileTypes: true }) } catch { return found }
  for (const entry of entries) {
    if (RESERVED_TOP.has(entry.name) || entry.name.startsWith('.')) continue
    found.push({
      id: `d:${entry.name}`, group: 'discovered', label: entry.name, discovered: true, enabledDefault: false,
      entries: [{ from: `${top}/${entry.name}`, key: `.dsh/${entry.name}` }],
    })
    if (found.length >= DISCOVER_MAX) break
  }
  return found
}

function itemEnabled(config, item) {
  const override = config.itemStates?.[item.id]
  return typeof override === 'boolean' ? override : item.enabledDefault === true
}

async function dirSize(fs, dir, depth = 0, budget = { count: 4000, bytes: 0 }) {
  if (depth > 6) return budget
  let entries
  try { entries = await fs.promises.readdir(dir, { withFileTypes: true }) } catch { return budget }
  for (const entry of entries) {
    if (budget.count-- <= 0) return budget
    const full = `${dir}/${entry.name}`
    if (entry.isDirectory()) await dirSize(fs, full, depth + 1, budget)
    else {
      try { budget.bytes += (await fs.promises.stat(full)).size } catch { /* skip */ }
    }
  }
  return budget
}

async function itemSize(fs, item) {
  let total = 0
  for (const entry of item.entries) {
    const stat = await fs.promises.stat(entry.from).catch(() => undefined)
    if (stat === undefined) continue
    if (stat.isDirectory()) total += (await dirSize(fs, entry.from)).bytes
    else total += stat.size
  }
  return total
}

async function effectiveItems(config, withSizes = false) {
  const { fs } = await nodeModules()
  const all = [...buildItems(), ...(await discoverItems())]
  const enabled = []
  for (const item of all) {
    if (!itemEnabled(config, item)) continue
    if (item.entries.some((entry) => pathIsForbidden(entry.key))) continue
    if (withSizes) item.size = await itemSize(fs, item)
    enabled.push(item)
  }
  return { all, enabled }
}

// ---------- credentials ----------

async function readToken(ctx) {
  const credentials = ctx.credentials
  if (credentials === undefined) return undefined
  try {
    const record = await credentials.readRecord(TOKEN_KEY)
    if (record?.kind === 'api-key' && typeof record.key === 'string' && record.key.length > 0) return record.key
  } catch { /* absent */ }
  return undefined
}

async function writeToken(ctx, token) {
  const credentials = ctx.credentials
  if (credentials === undefined) throw new Error('credential store unavailable')
  if (token === '') {
    await credentials.deleteRecord(TOKEN_KEY).catch(() => {})
    return
  }
  await credentials.modifyRecord(TOKEN_KEY, async () => ({ kind: 'api-key', key: token }))
}

// ---------- progress ----------

const progress = new Map()

function setProgress(kind, patch) {
  const current = progress.get(kind) ?? { running: false, percent: 0, stage: '', error: undefined }
  progress.set(kind, { ...current, ...patch })
}

// ---------- GitHub REST client ----------

function gh(token) {
  /** call('path', { method, body }) — JSON in/out; raw=true returns an ArrayBuffer. */
  async function call(path, { method = 'GET', body, raw = false, label = path } = {}) {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'super-deepseek-harness-git',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      const hint = (response.status === 404 || response.status === 403)
        ? '(请检查令牌:Repository access 已选此仓库,且 Contents 为 Read and write)'
        : ''
      throw new Error(`GitHub API ${response.status} @ ${label}: ${text.slice(0, 160)} ${hint}`)
    }
    if (response.status === 204) return undefined
    if (raw) return response.arrayBuffer()
    const type = response.headers.get('content-type') ?? ''
    if (type.includes('json')) return response.json()
    return response.arrayBuffer()
  }
  return call
}

function gitSha1(kind, content) {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8')
  const header = Buffer.from(`${kind} ${body.length}\0`, 'utf8')
  return crypto.createHash('sha1').update(header).update(body).digest('hex')
}

// ---------- staging: collect files ----------

async function collectFiles(fs, path, config) {
  const { enabled } = await effectiveItems(config)
  if (enabled.length === 0) throw new Error('no sync items enabled')
  const files = [] // { key, abs, size }
  for (const item of enabled) {
    for (const entry of item.entries) {
      const stat = await fs.promises.stat(entry.from).catch(() => undefined)
      if (stat === undefined) continue
      if (stat.isFile()) {
        if (entry.filter !== undefined && !entry.filter(entry.from)) continue
        files.push({ key: entry.key, abs: entry.from, size: stat.size })
      } else {
        await walk(fs, path, entry, entry.from, files)
      }
    }
  }
  // Defensive secret scan on final keys.
  const violations = files.filter((file) => pathIsForbidden(file.key))
  if (violations.length > 0) throw new Error(`refusing to sync secret files: ${violations.map((v) => v.key).join(', ')}`)
  return files
}

async function walk(fs, path, entry, dir, files) {
  let entries
  try { entries = await fs.promises.readdir(dir, { withFileTypes: true }) } catch { return }
  for (const item of entries) {
    if (item.name === '.git' || item.name === 'node_modules' || item.name === '.DS_Store') continue
    const full = `${dir}/${item.name}`
    const relKey = `${entry.key}${full.slice(entry.from.length)}`
    if (item.isDirectory()) await walk(fs, path, { ...entry, key: relKey, from: full }, full, files)
    else if (item.isFile()) {
      if (entry.filter !== undefined && !entry.filter(full)) continue
      const stat = await fs.promises.stat(full).catch(() => undefined)
      if (stat === undefined) continue
      files.push({ key: relKey, abs: full, size: stat.size })
    }
  }
}

// ---------- push via REST ----------

async function runPush(ctx, config, token, onStage) {
  const { fs, path, os } = await nodeModules()
  const slug = repoSlug(config.repoUrl)
  if (slug === undefined) throw new Error('invalid repository URL')
  const call = gh(token)
  onStage(3, 'collect')
  const files = (await collectFiles(fs, path, config)).filter((file) => file.size <= MAX_BLOB_BYTES)
  const skipped = (await collectFiles(fs, path, config)).length - files.length

  onStage(8, 'base')
  let baseCommitSha
  let baseTreeSha
  try {
    const ref = await call(`/repos/${slug}/git/ref/heads/${BRANCH}`)
    baseCommitSha = ref.object.sha
    const commit = await call(`/repos/${slug}/git/commits/${baseCommitSha}`)
    baseTreeSha = commit.tree.sha
  } catch {
    baseCommitSha = undefined
    baseTreeSha = undefined
  }

  // Build flat { path → sha } of the existing tree when there is one.
  const existing = new Map()
  if (baseTreeSha !== undefined) {
    onStage(14, 'tree-read')
    await readTreeFlat(call, slug, baseTreeSha, '', existing)
  }

  onStage(20, 'blobs')
  const treeEntries = []
  const total = files.length
  let done = 0
  // Delete entries present remotely but absent locally (stale files).
  const localKeys = new Set(files.map((file) => normalizeKey(file.key)))
  for (const [remotePath] of existing) {
    if (!localKeys.has(remotePath)) treeEntries.push({ path: remotePath, mode: '100644', type: 'blob', sha: null })
  }
  for (const file of files) {
    const norm = normalizeKey(file.key)
    const content = await fs.promises.readFile(file.abs)
    const sha = gitSha1('blob', content)
    if (existing.get(norm) !== sha) {
      await call(`/repos/${slug}/git/blobs`, { method: 'POST', body: { content: content.toString('base64'), encoding: 'base64' }, label: 'create blob' })
      treeEntries.push({ path: norm, mode: '100644', type: 'blob', sha })
    }
    done += 1
    if (done % 25 === 0 || done === total) onStage(20 + Math.round((done / Math.max(1, total)) * 45), 'blobs')
  }

  onStage(72, 'tree')
  const tree = await call(`/repos/${slug}/git/trees`, { method: 'POST', body: { base_tree: baseTreeSha, tree: treeEntries }, label: 'create tree' })

  onStage(86, 'commit')
  const message = `sync from DeepSeek Harness (${new Date().toISOString()})`
  const commit = baseCommitSha !== undefined
    ? await call(`/repos/${slug}/git/commits`, { method: 'POST', body: { message, tree: tree.sha, parents: [baseCommitSha] }, label: 'create commit' })
    : await call(`/repos/${slug}/git/commits`, { method: 'POST', body: { message, tree: tree.sha }, label: 'create commit' })

  onStage(94, 'ref')
  if (baseCommitSha !== undefined) {
    await call(`/repos/${slug}/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: { sha: commit.sha }, label: 'update ref' })
  } else {
    await call(`/repos/${slug}/git/refs`, { method: 'POST', body: { ref: `refs/heads/${BRANCH}`, sha: commit.sha }, label: 'create ref' })
  }
  onStage(100, 'done')
  return { ok: true, commit: commit.sha.slice(0, 8), files: files.length, skipped }
}

async function readTreeFlat(call, slug, treeSha, prefix, out) {
  const tree = await call(`/repos/${slug}/git/trees/${treeSha}?recursive=1`)
  for (const entry of tree.tree) {
    if (entry.type === 'blob') out.set(`${prefix}${entry.path}`, entry.sha)
  }
}

function normalizeKey(key) {
  // Repo layout mirrors local keys directly; legacy layouts collapse in.
  return key
}

// ---------- pull via REST ----------

function legacyAltKey(normKey) {
  // Map new layout keys to the older dsh-dotfiles layout when reading.
  if (normKey.startsWith('.dsh/')) return `plugin-data/${normKey.slice(5)}`
  if (normKey === 'sessions') return 'plain/sessions'
  return undefined
}

async function runPull(ctx, config, token, onStage) {
  const { fs, path } = await nodeModules()
  const slug = repoSlug(config.repoUrl)
  if (slug === undefined) throw new Error('invalid repository URL')
  const call = gh(token)
  const { enabled } = await effectiveItems(config)
  onStage(8, 'tree-read')
  let ref
  try {
    ref = await call(`/repos/${slug}/git/ref/heads/${BRANCH}`)
  } catch {
    throw new Error('repository is empty — nothing to restore')
  }
  const commit = await call(`/repos/${slug}/git/commits/${ref.object.sha}`)
  const remote = new Map()
  await readTreeFlat(call, slug, commit.tree.sha, '', remote)

  // Build enabled entry list (with legacy alternates).
  const wanted = []
  for (const item of enabled) {
    for (const entry of item.entries) wanted.push({ entry, norm: normalizeKey(entry.key) })
  }

  const actions = []
  const list = [...remote.keys()].filter((key) => {
    if (wanted.some(({ norm }) => key === norm || key.startsWith(`${norm}/`))) return true
    return wanted.some(({ norm }) => legacyAltKey(norm) !== undefined && (key === legacyAltKey(norm) || key.startsWith(`${legacyAltKey(norm)}/`)))
  })
  const total = list.length
  let done = 0
  onStage(15, 'blobs')
  for (const key of list) {
    // Find the destination: direct match, or legacy alternate mapping.
    let target
    let sub = ''
    for (const { entry, norm } of wanted) {
      if (key === norm || key.startsWith(`${norm}/`)) { target = entry; sub = key.slice(norm.length); break }
      const alt = legacyAltKey(norm)
      if (alt !== undefined && (key === alt || key.startsWith(`${alt}/`))) { target = entry; sub = key.slice(alt.length); break }
    }
    if (target === undefined) continue
    const dest = sub === '' ? target.from : `${target.from}/${sub}`
    if (pathIsForbidden(dest) || sub === '') continue // never write whole-root secrets; skip root aliases
    const blobPath = key.replaceAll('#', '%23').replaceAll('?', '%3F')
    const raw = await fetch(`${API}/repos/${slug}/contents/${encodeURI(blobPath)}?ref=${BRANCH}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github.raw', 'user-agent': 'super-deepseek-harness-git' },
      signal: AbortSignal.timeout(60_000),
    })
    if (!raw.ok) continue
    const buf = await raw.arrayBuffer()
    const content = Buffer.from(buf)
    await fs.promises.mkdir(path.dirname(dest), { recursive: true })
    await fs.promises.writeFile(dest, content)
    actions.push(key)
    done += 1
    if (done % 25 === 0 || done === total) onStage(15 + Math.round((done / Math.max(1, total)) * 80), 'blobs')
  }
  onStage(100, 'done')
  return { ok: true, actions, restartRequired: actions.length > 0 }
}

// ---------- account state ----------

async function accountState(token) {
  if (token === undefined) return { signedIn: false }
  try {
    const response = await fetch(`${API}/user`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'super-deepseek-harness-git' },
      signal: AbortSignal.timeout(15_000),
    })
    if (response.status === 401) return { signedIn: false, invalid: true }
    if (!response.ok) return { signedIn: false, network: true }
    const body = await response.json()
    return { signedIn: true, login: body.login, name: body.name ?? body.login, avatarUrl: body.avatar_url }
  } catch {
    return { signedIn: false, network: true }
  }
}

async function remoteHead(config, token) {
  if (token === undefined) return undefined
  const slug = repoSlug(config.repoUrl)
  if (slug === undefined) return undefined
  try {
    const body = await gh(token)(`/repos/${slug}/commits/${BRANCH}`)
    return { sha: String(body.sha).slice(0, 8), date: body.commit?.committer?.date, message: body.commit?.message }
  } catch {
    return undefined
  }
}

async function saveConfig(ctx, patch) {
  const entry = ctx.fiber?.entry
  const editor = ctx.configEditor
  if (entry === undefined || editor === undefined) throw new Error('configuration cannot be saved in this profile')
  await editor.edit(entry, (current) => ({ ...current, ...patch }))
}

// ---------- routes ----------

async function routeRequest(ctx, config, request) {
  const url = new URL(request.url)
  const op = url.searchParams.get('op') ?? ''
  if (request.method === 'POST') {
    let body = {}
    try { body = await request.json() } catch { /* empty ok */ }
    if (op === 'signin') {
      const token = String(body.token ?? '').trim()
      if (token.length < 20) return Response.json({ ok: false, message: 'token looks too short' }, { status: 400 })
      const state = await accountState(token)
      if (!state.signedIn) return Response.json({ ok: false, message: state.invalid ? 'GitHub rejected the token(令牌无效或已被撤销)' : 'GitHub unreachable(网络不可达)' }, { status: 401 })
      await writeToken(ctx, token)
      await saveConfig(ctx, { accountLogin: state.login ?? '' }).catch(() => {})
      return Response.json({ ok: true, login: state.login, name: state.name, avatarUrl: state.avatarUrl })
    }
    if (op === 'signout') {
      await writeToken(ctx, '')
      await saveConfig(ctx, { accountLogin: '' }).catch(() => {})
      return Response.json({ ok: true })
    }
    if (op === 'settings') {
      const patch = { repoUrl: String(body.repoUrl ?? '').trim() }
      if (body.itemStates !== undefined && typeof body.itemStates === 'object' && !Array.isArray(body.itemStates)) {
        patch.itemStates = Object.fromEntries(Object.entries(body.itemStates).filter(([, v]) => typeof v === 'boolean'))
      }
      await saveConfig(ctx, patch)
      return Response.json({ ok: true })
    }
    if (op === 'push' || op === 'pull') {
      const kind = op
      if (progress.get(kind)?.running === true) return Response.json({ ok: false, message: 'another sync is running' }, { status: 409 })
      const token = await readToken(ctx)
      if (token === undefined) return Response.json({ ok: false, message: 'not signed in' }, { status: 401 })
      if (!config.repoUrl) return Response.json({ ok: false, message: 'repository not configured' }, { status: 400 })
      setProgress(kind, { running: true, percent: 1, stage: 'start', error: undefined, result: undefined })
      const onStage = (percent, stage) => setProgress(kind, { percent: Math.max(1, Math.min(99, percent)), stage })
      void (async () => {
        try {
          const result = kind === 'push' ? await runPush(ctx, config, token, onStage) : await runPull(ctx, config, token, onStage)
          setProgress(kind, {
            running: false, percent: 100, stage: 'done', error: undefined,
            result: { ...result, doneAt: Date.now() },
          })
        } catch (error) {
          setProgress(kind, { running: false, percent: 100, stage: 'error', error: String(error?.message ?? error), finishedAt: Date.now(), result: undefined })
        }
      })()
      return Response.json({ ok: true, started: true })
    }
  }
  if (op === 'list') {
    const { all } = await effectiveItems(config, true)
    return Response.json({
      ok: true,
      items: all.map((item) => ({
        id: item.id, group: item.group, label: item.label, size: item.size ?? 0,
        discovered: item.discovered === true,
        enabled: itemEnabled(config, item),
      })),
    })
  }
  if (op === 'state') {
    const push = progress.get('push') ?? { running: false, percent: 0 }
    const pull = progress.get('pull') ?? { running: false, percent: 0 }
    if (url.searchParams.get('light') === '1') {
      return Response.json({ ok: true, account: { signedIn: Boolean(config.accountLogin) }, repoUrl: config.repoUrl, push, pull })
    }
    const token = await readToken(ctx)
    const account = await accountState(token)
    const remote = account.signedIn ? await remoteHead(config, token) : undefined
    return Response.json({ ok: true, account, repoUrl: config.repoUrl, push, pull, remote, profile: dshDir().profile })
  }
  return Response.json({ ok: false, message: 'unknown op' }, { status: 400 })
}

// ---------- apply ----------

export async function apply(ctx, config) {
  const handler = (request) => {
    const entry = ctx.fiber?.entry
    return routeRequest(ctx, entry?.config ?? config, request)
  }
  if (ctx.connection?.fetch?.register !== undefined) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/syncgit', methods: ['GET', 'POST'], requestBody: 'buffered',
      fetch: handler,
    }), `${NS}: /api/syncgit route`)
  }
  const { fs, os, path } = await nodeModules()
  try {
    const tmp = os.tmpdir()
    const now = Date.now()
    for (const name of await fs.promises.readdir(tmp)) {
      if (!name.startsWith(`${NS}-`)) continue
      const full = path.join(tmp, name)
      const stat = await fs.promises.stat(full).catch(() => undefined)
      if (stat === undefined) continue
      if (now - stat.mtimeMs > 3_600_000) await fs.promises.rm(full, { recursive: true, force: true })
    }
  } catch { /* best effort */ }
}
