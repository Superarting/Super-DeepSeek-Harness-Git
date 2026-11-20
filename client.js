/**
 * Client half of the Super-DeepSeek-Harness Git bundle.
 *
 * Registers one section into the Settings window (`settings.section`, id
 * "super-dsh-git", placed last): left-nav entry "GitHub 同步" with a GitHub
 * mark icon, right pane with account sign-in, repository field, push/pull
 * with live progress, and the itemized sync checklist. All styling is inline
 * (React style objects) so host stylesheets cannot distort the layout.
 */

window.__ModuleLoader__.load({
  id: 'super-deepseek-harness-git',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    // ---------- locale ----------
    const DICTS = {
      en: {
        nav: 'GitHub sync',
        intro: 'Back up your DeepSeek Harness setup to a private GitHub repository, and restore it on any new machine.',
        account: 'GitHub account',
        notSignedIn: 'Not signed in',
        signIn: 'Sign in',
        signOut: 'Sign out',
        tokenLabel: 'Fine-grained personal access token',
        tokenHint: 'Repository access: only your sync repo · Contents: Read and write',
        repoLabel: 'Repository (https://github.com/user/repo)',
        syncNow: 'Sync now',
        syncNowAll: 'Sync all',
        restore: 'Restore from repo',
        syncing: 'Pushing… {p}%',
        restoring: 'Restoring… {p}%',
        pushDone: 'Pushed to GitHub ✓',
        pullDone: 'Restored — restart DeepSeek Harness to apply',
        failed: 'Failed',
        whatSync: 'Sync items',
        reloadItems: 'Rescan ~/.dsh',
        scanning: 'Scanning…',
        scanDone: 'Scan complete · {n} items ({a} auto-discovered)',
        scanFailed: 'Scan failed',
        discovered: 'auto',
        lastCommit: 'Remote',
        syncHistory: 'Sync history',
        noHistory: 'No sync history yet.',
        historyOpPush: 'Push',
        historyOpPull: 'Restore',
        historyStatusOk: 'OK',
        historyStatusErr: 'Error',
        diffPreview: 'Diff preview',
        diffAdd: '+ Add',
        diffMod: '~ Modify',
        diffDel: '- Delete',
        confirmOverwrite: 'This will overwrite {n} local file(s) with remote content. Continue?',
        cancel: 'Cancel',
        confirm: 'Confirm',
        needRepo: 'Set the repository first',
        needSignIn: 'Sign in first',
        localRepo: 'Private repo only · credentials never sync · WeChat: Susuperoo',
        confirmSignOut: 'Sign out of GitHub on this machine?',
        tokenExpired: 'Token expired or revoked — please sign in again.',
        diffHint: 'Click "Sync all" to preview which files will be uploaded/deleted before syncing.',
        diffNone: 'No changes.',
        diffTitle: 'Pending changes',
        startPush: 'Push now',
        diffSection: 'Diff preview',
      },
      zh: {
        nav: 'GitHub 同步',
        intro: '把你的 DeepSeek Harness 全局配置备份到私有 GitHub 仓库;换新电脑时一键恢复。',
        account: 'GitHub 账户',
        notSignedIn: '未登录',
        signIn: '登录',
        signOut: '退出登录',
        tokenLabel: '细粒度个人访问令牌',
        tokenHint: 'Repository access:仅你的同步仓库 · Contents:Read and write',
        repoLabel: '仓库地址(https://github.com/user/repo)',
        syncNow: '立即同步',
        syncNowAll: '同步全部',
        restore: '从仓库恢复',
        syncing: '推送中… {p}%',
        restoring: '恢复中… {p}%',
        pushDone: '已推送到 GitHub ✓',
        pullDone: '已恢复 —— 重启 DeepSeek Harness 后生效',
        failed: '失败',
        whatSync: '同步内容',
        reloadItems: '重新扫描 ~/.dsh',
        scanning: '扫描中…',
        scanDone: '扫描完成 · 共 {n} 项(自动发现 {a} 项)',
        scanFailed: '扫描失败',
        discovered: '自动发现',
        lastCommit: '远端',
        syncHistory: '同步历史',
        noHistory: '暂无同步历史。',
        historyOpPush: '推送',
        historyOpPull: '恢复',
        historyStatusOk: '成功',
        historyStatusErr: '失败',
        diffPreview: '变更预览',
        diffAdd: '+ 新增',
        diffMod: '~ 变更',
        diffDel: '- 删除',
        confirmOverwrite: '恢复将覆盖本地 {n} 个文件，确定继续？',
        cancel: '取消',
        confirm: '确定',
        needRepo: '请先填写仓库地址',
        needSignIn: '请先登录',
        localRepo: '仅私有仓库 · 凭证永不同步 · 微信号:Susuperoo',
        confirmSignOut: '在这台电脑上退出 GitHub 登录?',
        tokenExpired: '令牌已失效或被撤销，请重新登录。',
        diffHint: '点击「同步全部」先预览将要上传/删除的文件，确认后才会执行同步。',
        diffNone: '无变更，本地与远端一致。',
        diffTitle: '待同步变更',
        startPush: '立即推送',
        diffSection: '变更预览',
      },
    }
    let currentLocale = 'zh'
    function t(key, params) {
      let text = (DICTS[currentLocale] ?? DICTS.zh)[key] ?? DICTS.en[key] ?? key
      if (params !== undefined) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v))
      return text
    }

    // ---------- inline styles ----------
    const S = {
      section: { maxWidth: 620, padding: '4px 0 32px', color: 'var(--dsw-alias-label-primary)', fontSize: 13 },
      intro: { color: 'var(--dsw-alias-label-secondary)', fontSize: 12, lineHeight: '18px', margin: '0 0 16px' },
      block: { border: '1px solid var(--dsw-alias-border-l1)', borderRadius: 10, padding: '14px 16px', marginBottom: 14, background: 'var(--dsw-alias-bg-layer-1)' },
      blockTitle: { fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 },
      acct: { display: 'flex', alignItems: 'center', gap: 10 },
      avatar: { width: 28, height: 28, borderRadius: '50%', flex: 'none' },
      login: { flex: 1, minWidth: 0 },
      name: { fontSize: 13, fontWeight: 600 },
      sub: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      field: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 },
      fieldLabel: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      input: { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 7, background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)', padding: '7px 9px', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box', height: 'auto', lineHeight: 'normal' },
      btn: (primary, disabled) => ({
        border: primary ? '1px solid var(--dsw-alias-brand-primary)' : '1px solid var(--dsw-alias-border-l2)',
        background: primary ? 'var(--dsw-alias-brand-primary)' : 'transparent',
        color: primary ? '#ffffff' : 'var(--dsw-alias-label-primary)',
        borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap', flex: 'none', lineHeight: '18px', height: 'auto',
      }),
      btnRow: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
      progress: { height: 4, borderRadius: 2, background: 'var(--dsw-alias-bg-layer-2)', overflow: 'hidden', margin: '10px 0 4px' },
      progressFill: (p) => ({ display: 'block', height: '100%', width: `${p}%`, background: 'var(--dsw-alias-brand-primary)', transition: 'width .25s ease' }),
      items: { display: 'flex', flexDirection: 'column' },
      item: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 2px', borderBottom: '1px solid var(--dsw-alias-border-l1)', cursor: 'pointer' },
      itemLast: { borderBottom: 'none' },
      checkbox: { accentColor: 'var(--dsw-alias-brand-primary)', width: 14, height: 14, flex: 'none' },
      itemLabel: { flex: 1, minWidth: 0, fontSize: 12 },
      itemSize: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', flex: 'none' },
      badge: { fontSize: 10, padding: '1px 6px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-secondary)', marginLeft: 6 },
      msgOk: { fontSize: 11, marginTop: 8, color: 'var(--dsw-alias-state-success-primary)' },
      msgErr: { fontSize: 11, marginTop: 8, color: 'var(--dsw-alias-state-error-primary)' },
      foot: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', marginTop: 12 },
      remote: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      miniBtn: { marginLeft: 'auto', padding: '3px 10px', fontSize: 11 },
      historyTime: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', flex: 'none' },
      historyOp: { fontSize: 11, marginLeft: 8, flex: 'none' },
      historyTag: { fontSize: 11, marginLeft: 8, flex: 'none' },
      diffHead: (color) => ({ fontSize: 11, fontWeight: 600, margin: '8px 0 4px', color }),
      diffFile: { fontSize: 11, marginLeft: 14, color: 'var(--dsw-alias-label-secondary)' },
      diffSummary: { fontSize: 12, margin: '4px 0' },
    }

    function GitHubIcon(size = 16) {
      return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'currentColor', 'aria-hidden': true },
        h('path', { d: 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z' }))
    }
    function NavIcon({ size }) {
      return GitHubIcon(typeof size === 'number' ? size : 16)
    }

    // ---------- data ----------
    async function api(op, params = {}) {
      const query = new URLSearchParams({ op, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) })
      const response = await fetch(`api/syncgit?${query}`, { headers: { accept: 'application/json' } })
      const payload = await response.json().catch(() => ({ ok: false, message: `HTTP ${response.status}` }))
      if (!payload.ok) throw new Error(payload.message ?? 'request failed')
      return payload
    }
    async function post(op, body) {
      const response = await fetch(`api/syncgit?op=${op}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({ ok: false, message: `HTTP ${response.status}` }))
      if (!payload.ok) throw new Error(payload.message ?? 'request failed')
      return payload
    }

    function fmtSize(bytes) {
      if (!Number.isFinite(bytes) || bytes <= 0) return '—'
      if (bytes < 1024) return `${bytes} B`
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    }

    /** Flat diff list renderer: green additions, yellow modifications, red deletions. */
    function renderDiffList(diff) {
      const groups = [
        { title: `${t('diffAdd')} ${diff.additions?.length ?? 0}`, color: 'var(--dsw-alias-state-success-primary)', items: diff.additions ?? [], sign: '+' },
        { title: `${t('diffMod')} ${diff.modifications?.length ?? 0}`, color: 'var(--dsw-alias-state-warning-primary, #f1c40f)', items: diff.modifications ?? [], sign: '~' },
        { title: `${t('diffDel')} ${diff.deletions?.length ?? 0}`, color: 'var(--dsw-alias-state-error-primary)', items: diff.deletions ?? [], sign: '-' },
      ]
      const total = groups.reduce((n, g) => n + g.items.length, 0)
      if (total === 0) return h('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', marginTop: 4 } }, t('diffNone'))
      return h('div', { style: { ...S.items, marginTop: 8 } },
        groups.filter((g) => g.items.length > 0).map((g) => h('div', { key: g.title },
          h('div', { style: S.diffHead(g.color) }, g.title),
          g.items.map((key) => h('div', { key, style: S.diffFile }, `${g.sign} ${key}`)))))
    }

    // ---------- section component ----------
    function SyncSection() {
      const [state, setState] = React.useState(undefined)
      const [items, setItems] = React.useState([])
      const [token, setToken] = React.useState('')
      const [repo, setRepo] = React.useState('')
      const [busy, setBusy] = React.useState('')
      const [msg, setMsg] = React.useState(undefined)
      const [scanMsg, setScanMsg] = React.useState(undefined)
      const [scanning, setScanning] = React.useState(false)
      const [showToken, setShowToken] = React.useState(false)
      const [previewOpen, setPreviewOpen] = React.useState(false)
      const [diff, setDiff] = React.useState(null)
      const [confirmOpen, setConfirmOpen] = React.useState(false)
      const [confirmOp, setConfirmOp] = React.useState(null)

      const refresh = React.useCallback((withItems = true) => {
        api('state').then((value) => { setState(value); setRepo(value.repoUrl ?? '') }).catch(() => {})
        if (withItems) api('list').then((value) => setItems(value.items ?? [])).catch(() => {})
      }, [])
      React.useEffect(() => { refresh() }, [refresh])

      React.useEffect(() => {
        const timer = window.setInterval(() => {
          api('state', { light: '1' }).then((value) => {
            setState((prev) => {
              if (prev === undefined) return value
              const wasPush = prev.push?.running === true
              const wasPull = prev.pull?.running === true
              if (wasPush && value.push.running === false && value.push.stage !== 'error') setMsg({ kind: 'ok', text: t('pushDone') })
              if (wasPush && value.push.stage === 'error') setMsg({ kind: 'err', text: `${t('failed')}: ${value.push.error ?? ''}` })
              if (wasPull && value.pull.running === false && value.pull.stage !== 'error') { setMsg({ kind: 'ok', text: t('pullDone') }); refresh(true) }
              if (wasPull && value.pull.stage === 'error') setMsg({ kind: 'err', text: `${t('failed')}: ${value.pull.error ?? ''}` })
              return { ...prev, push: value.push, pull: value.pull }
            })
          }).catch(() => {})
        }, 900)
        return () => window.clearInterval(timer)
      }, [refresh])

      const account = state?.account
      const signedIn = account?.signedIn === true
      const push = state?.push ?? { running: false, percent: 0 }
      const pull = state?.pull ?? { running: false, percent: 0 }
      const syncing = push.running === true || pull.running === true
      const active = push.running ? push : (pull.running ? pull : undefined)

      const startSync = async (op) => { previewSync(op) }
      const doSignIn = async () => {
        setBusy('signin'); setMsg(undefined)
        try {
          await post('signin', { token: token.trim() })
          setToken(''); setShowToken(false); refresh()
        } catch (error) { setMsg({ kind: 'err', text: String(error.message ?? error) }) }
        setBusy('')
      }
      const doSignOut = async () => {
        if (!window.confirm(t('confirmSignOut'))) return
        try { await post('signout', {}) } catch { /* ignore */ }
        refresh()
      }
      const saveRepo = async () => {
        setBusy('repo'); setMsg(undefined)
        try { await post('settings', { repoUrl: repo.trim() }); refresh(false) } catch (error) { setMsg({ kind: 'err', text: String(error.message ?? error) }) }
        setBusy('')
      }
      const toggleItem = async (item) => {
        const next = { ...Object.fromEntries(items.map((entry) => [entry.id, entry.enabled])), [item.id]: !item.enabled }
        setItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, enabled: !entry.enabled } : entry))
        try { await post('settings', { itemStates: next }) } catch { refresh(true) }
      }
      const rescan = async () => {
        if (scanning) return
        setScanning(true); setScanMsg(undefined)
        try {
          const value = await api('list')
          const list = value.items ?? []
          setItems(list)
          const auto = list.filter((entry) => entry.discovered === true).length
          setScanMsg({ kind: 'ok', text: t('scanDone', { n: list.length, a: auto }) })
        } catch (error) {
          setScanMsg({ kind: 'err', text: `${t('scanFailed')}: ${String(error.message ?? error)}` })
        }
        setScanning(false)
      }
      const previewSync = async (op) => {
        if (!repo.trim()) { setMsg({ kind: 'err', text: t('needRepo') }); return }
        if (!signedIn) { setMsg({ kind: 'err', text: t('needSignIn') }); return }
        setMsg(undefined)
        try {
          const d = await api('diff')
          setDiff(d)
          setPreviewOpen(true)
        } catch (error) { setMsg({ kind: 'err', text: String(error.message ?? error) }) }
      }
      const confirmSync = async (op) => {
        if (!diff) return
        const deletions = (diff.deletions || []).length
        if (op === 'pull' && deletions > 0 && !window.confirm(t('confirmOverwrite', { n: deletions }))) return
        setPreviewOpen(false)
        setBusy(op === 'push' ? 'push' : 'pull'); setMsg(undefined)
        try {
          await post(op, {})
          setDiff(null)
          refresh(true)
        } catch (error) {
          setMsg({ kind: 'err', text: String(error.message ?? error) })
        }
        setBusy('')
      }

      return h('div', { style: S.section },
        h('p', { style: S.intro }, t('intro')),

        h('div', { style: S.block },
          h('div', { style: S.blockTitle }, GitHubIcon(15), t('account')),
          signedIn
            ? h('div', { style: S.acct },
                account.avatarUrl ? h('img', { src: account.avatarUrl, alt: '', style: S.avatar }) : h('span', { style: S.avatar }, GitHubIcon(28)),
                h('div', { style: S.login },
                  h('div', { style: S.name }, account.name ?? account.login ?? ''),
                  h('div', { style: S.sub }, account.login ?? '')),
                h('button', { style: S.btn(false, false), onClick: doSignOut }, t('signOut')))
            : (showToken
                ? h('div', null,
                    h('div', { style: S.field },
                      h('label', { style: S.fieldLabel }, t('tokenLabel')),
                      h('input', { style: S.input, type: 'password', value: token, autoFocus: true, onChange: (e) => setToken(e.target.value),
                        onKeyDown: (e) => { if (e.key === 'Enter' && token.trim().length >= 20 && busy !== 'signin') doSignIn() } }),
                      h('label', { style: S.fieldLabel }, t('tokenHint'))),
                    h('div', { style: S.btnRow },
                      h('button', { style: S.btn(true, busy === 'signin' || token.trim().length < 20), onClick: doSignIn },
                        busy === 'signin' ? '…' : t('signIn'))))
                : h('div', { style: S.btnRow },
                    h('button', { style: S.btn(true, false), onClick: () => setShowToken(true) }, t('signIn'))))),

        h('div', { style: S.block },
          h('div', { style: S.field },
            h('label', { style: S.fieldLabel }, t('repoLabel')),
            h('input', { style: S.input, type: 'text', value: repo, placeholder: 'https://github.com/user/repo',
              onChange: (e) => setRepo(e.target.value),
              onBlur: () => { if (repo.trim() !== (state?.repoUrl ?? '')) saveRepo() },
              onKeyDown: (e) => { if (e.key === 'Enter') saveRepo() } }),
            state?.remote?.sha !== undefined && h('label', { style: S.fieldLabel }, `${t('lastCommit')}: ${state.remote.sha}`))),

        h('div', { style: S.block },
          h('div', { style: S.btnRow },
            h('button', { style: S.btn(true, syncing || !signedIn), onClick: () => startSync('push') }, t('syncNow')),
            h('button', { style: S.btn(false, syncing || !signedIn), onClick: () => startSync('pull') }, t('restore'))),
          active !== undefined && h('div', { style: S.progress }, h('i', { style: S.progressFill(active.percent) })),
          active !== undefined && h('div', { style: S.remote }, (push.running ? t('syncing', { p: push.percent }) : t('restoring', { p: pull.percent }))),
          account?.invalid === true && h('div', { style: S.msgErr }, t('tokenExpired')),
          msg !== undefined && h('div', { style: msg.kind === 'ok' ? S.msgOk : S.msgErr }, msg.text)),

        h('div', { style: S.block },
          h('div', { style: S.blockTitle }, t('whatSync'),
            h('button', { style: { ...S.btn(false, scanning), ...S.miniBtn }, disabled: scanning, onClick: rescan },
              scanning ? t('scanning') : t('reloadItems'))),
          h('div', { style: S.items },
            items.map((item, index) => h('label', { style: { ...S.item, ...(index === items.length - 1 ? S.itemLast : {}) }, key: item.id },
              h('input', { style: S.checkbox, type: 'checkbox', checked: item.enabled === true, onChange: () => toggleItem(item) }),
              h('span', { style: S.itemLabel }, item.label,
                item.discovered === true && h('span', { style: S.badge }, t('discovered'))),
              h('span', { style: S.itemSize }, fmtSize(item.size))))),
          scanMsg !== undefined && h('div', { style: scanMsg.kind === 'ok' ? S.msgOk : S.msgErr }, scanMsg.text)),

        h('div', { style: S.block },
          h('div', { style: S.blockTitle }, t('diffPreview'),
            h('button', { style: { ...S.btn(false, syncing || !signedIn), ...S.miniBtn }, disabled: syncing || !signedIn, onClick: () => previewSync('push') }, t('syncNowAll'))),
          previewOpen && diff && renderDiffList(diff),
          !previewOpen && h('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', marginTop: 4 } }, t('diffHint'))),

        h('div', { style: S.block },
          h('div', { style: S.blockTitle }, t('syncHistory')),
          (state?.history?.length ?? 0) > 0
            ? h('div', { style: S.items },
                state.history.slice(0, 10).map((rec) => h('div', { key: rec.at, style: { ...S.item, cursor: 'default' } },
                  h('span', { style: S.historyTime }, new Date(rec.at).toLocaleString()),
                  h('span', { style: S.historyOp }, rec.kind === 'push' ? t('historyOpPush') : t('historyOpPull')),
                  rec.error
                    ? h('span', { style: { ...S.historyTag, color: 'var(--dsw-alias-state-error-primary)' } }, t('historyStatusErr'))
                    : h('span', { style: { ...S.historyTag, color: 'var(--dsw-alias-state-success-primary)' } }, t('historyStatusOk')),
                  rec.files !== undefined && h('span', { style: S.remote }, `${rec.files} files`),
                  rec.commit !== undefined && h('span', { style: S.remote }, rec.commit))))
            : h('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)', marginTop: 4 } }, t('noHistory'))),

        h('div', { style: S.foot }, t('localRepo')))
    }

    // ---------- module ----------
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          const readActive = () => {
            try {
              const snapshot = ctx.locale.getSnapshot()
              const active = snapshot?.active ?? 'zh'
              return String(active).toLowerCase().startsWith('zh') ? 'zh' : 'en'
            } catch { return 'zh' }
          }
          currentLocale = readActive()
          return ctx.locale.subscribe(() => { currentLocale = readActive() })
        }, 'super-dsh-git: locale')
        ctx.effect(() => ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
          name: 'settings.section.icon',
          id: 'super-dsh-git',
        }, NavIcon)), 'super-dsh-git: section icon')
        ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'super-dsh-git',
          order: 900,
          label: () => t('nav'),
        }, SyncSection)), 'super-dsh-git: settings section')
      },
    }
  },
})
