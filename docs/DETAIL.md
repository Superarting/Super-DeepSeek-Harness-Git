# Super-DeepSeek-Harness Git

One-click backup and restore of your DeepSeek Harness profile through a private GitHub repository.

## What it syncs

| Item | Source path |
|---|---|
| Profile config | `~/.dsh/profiles/desktop/cordis.patch.yml`, `package.json`, `pnpm-lock.yaml` |
| Skills | `~/.agents/skills/` |
| Plugin data | selected JSON stores under `~/.dsh/` (armory, our-free-model, task-board, …) |
| Sessions | `~/.dsh/sessions/` (chat history, `.zstd`) |

Nothing is encrypted by this plugin: the target GitHub repository must be **private**. Secrets that never sync: `~/.dsh/.credentials.yaml` and `~/.dsh/openai-gateway/`.

## Sign in

Create a fine-grained personal access token (github.com → Settings → Developer settings → Fine-grained tokens):

- Repository access: Only select repositories → your sync repo
- Permissions → Contents: **Read and write**

Paste the token in the plugin menu → Sign in. It is stored in the DSH encrypted credential store.

## New machine

1. Install DeepSeek Harness and this plugin.
2. Menu → Sign in with the same token.
3. Menu → Restore pulls the latest snapshot from the repo, applies it, and asks you to restart DeepSeek Harness.
