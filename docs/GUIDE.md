# Super-DeepSeek-Harness Git — Full Guide (English)

> One-click backup of your DeepSeek Harness (DSH) global environment to your own private GitHub repository; restore it on any new machine with one click after signing in.

A complete Chinese guide with full details lives at [GUIDE.zh.md](GUIDE.zh.md). This page summarizes the essentials in English.

---

## What it is

Everything that makes your DSH yours — model/proxy/MCP settings, installed skills, plugin data, and irreplaceable session history — lives in `~/.dsh` on one machine. This plugin adds a **"GitHub sync"** section to the DSH Settings window that snapshots that environment to **your own private GitHub repository** and restores it on any new machine. No third-party service sits in between.

## How it works

Push pipeline: scan local files → compare Git blob SHA-1 against the remote tree (only changed files upload) → build a tree via the Git Data REST API (stale remote files are pruned) → create a commit → move the `main` ref.

**Key design: everything goes through `api.github.com` REST endpoints — no git binary, no git smart-HTTP protocol.** Networks that block github.com's git transport but allow api.github.com work fine.

Restore is the reverse: files belonging to enabled sync items are downloaded and written back to their original paths, then DSH restarts to apply them.

## Features

- Integrated into DSH Settings: sign-in, repository, push/pull with live progress, per-item checklist
- Incremental push with per-file SHA comparison; remote cleanup of deleted files
- Hard-coded secret firewall (credentials, gateway keys, age keys) with a final pre-upload scan that aborts on any hit
- Token stored in the DSH encrypted credential store — never in plaintext config, never synced
- Cross-platform installers (macOS/Linux bash, Windows PowerShell) with automatic detection of the DSH installation — no manual paths required
- Works behind git-blocked corporate networks (pure REST)

## Install

The installers auto-detect the DSH data directory, profile, runtime node (including the Electron binary inside DeepSeek Harness.app / DeepSeek Harness.exe) and pnpm. Override hooks: `DSH_HOME`, `DSH_PROFILE`, `DSH_NODE_EXECUTABLE`, `DSH_PNPM_SCRIPT`, `DSH_APP_DIR`.

**macOS / Linux:**

```bash
git clone https://github.com/Superarting/Super-DeepSeek-Harness-Git.git
cd Super-DeepSeek-Harness-Git
./install.sh
```

**Windows (PowerShell):**

```powershell
git clone https://github.com/Superarting/Super-DeepSeek-Harness-Git.git
cd Super-DeepSeek-Harness-Git\super-dsh-git
.\install.ps1
```

If execution policy blocks the script: `Set-ExecutionPolicy -Scope Process Bypass`.

The script links the plugin into your profile's `package.json`, runs `pnpm install`, and registers the bundle with double-channel de-duplication (`dsh.profile.bundles` first, `cordis.patch.yml` second). Restart DeepSeek Harness, then enable the plugin in **Settings → Plugins**.

## Create a GitHub token

Use a **fine-grained personal access token**:

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token
2. Repository access: **Only select repositories** → your (private) backup repo
3. Permissions → Repository permissions → **Contents: Read and write** (nothing else needed)
4. Generate and copy the token

Keep the repository **private** — the plugin does not encrypt content.

## Daily use

Open **DeepSeek Harness → Settings → GitHub sync**:

- **Sign in** with the token; it is stored in the encrypted credential store
- Enter the repository URL, e.g. `https://github.com/<you>/<backup-repo>`
- Check the items to sync, then click **Sync now** — progress runs to "Pushed ✓"
- On a new machine: sign in, set the same repo, click **Restore from repo**, restart DSH

Restore is repo-wins overwrite: remote files replace local ones; local-only files are kept. Restart DSH after restoring.

## What gets synced

| Item | Source | Default |
|---|---|---|
| Profile config | `~/.dsh/profiles/<profile>/{cordis.patch.yml,package.json,pnpm-lock.yaml}` | ✅ |
| Skills | `~/.agents/skills/` | ✅ |
| Plugin data (armory, our-free-model, task-board, workspace index, skin, pet, mcp-runtime, channel-pack, wb-market) | selected stores under `~/.dsh/` | ✅ |
| Session history | `~/.dsh/sessions/` (`.zstd` / `.json`) | ✅ |
| Auto-discovered dirs | other entries under `~/.dsh/` | ❌ (opt-in) |

Never synced: `.credentials.yaml`, `openai-gateway/`, `token-ledger`, `age.key`/`AGE-SECRET` paths, `dsh-runtimes/`. Files above 80 MiB are skipped (GitHub blob limit).

## FAQ highlights

- **403/404 on push** — check the token: correct repo selected, Contents = Read and write, not expired
- **Corporate network** — works as long as api.github.com is reachable; no git protocol involved
- **99% pause** — waiting for GitHub to create the commit; normal for a few seconds
- **Nothing changed after restore** — restart DeepSeek Harness; restore only writes files
- **Multiple machines** — last-writer-wins snapshot; designate one machine to push, others restore

## Uninstall

Disable/uninstall the plugin in Settings → Plugins; optionally remove the `super-deepseek-harness-git` dependency and bundle entry from your profile, delete the clone directory and `~/.dsh/super-dsh-git/`; revoke the token on GitHub and keep or delete the backup repo as you wish.

## Version history

| Version | Notes |
|---|---|
| 1.1.2 | Cross-platform auto-detecting installers (bash + PowerShell); dual-channel registration de-dup |
| 1.1.1 | Removed the self-publish experiment (manual version control) |
| 1.1.0 | Sync engine moved to GitHub REST API (bypasses blocked git protocol); progress-bar fix; more plugin-data stores |
| 1.0.0 | First release: settings section, git-protocol push, per-item checklist, auto-discovery |

---

- Design details: [DETAIL.md](DETAIL.md) / [DETAIL.zh.md](DETAIL.zh.md)
- License: [MIT](../LICENSE)
