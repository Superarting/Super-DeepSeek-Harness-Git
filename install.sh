#!/usr/bin/env bash
# 一键安装 super-deepseek-harness-git 到当前 DSH profile。
# 前提:本脚本在仓库克隆目录内执行;DeepSeek Harness 已安装。
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_DIR="$REPO_DIR/super-dsh-git"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE="${DSH_PROFILE:-desktop}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"

if [[ ! -d "$PLUGIN_DIR" ]]; then echo "✘ 找不到插件目录: $PLUGIN_DIR" >&2; exit 1; fi
if [[ ! -d "$PROFILE_DIR" ]]; then echo "✘ 找不到 profile 目录: $PROFILE_DIR" >&2; exit 1; fi

# DSH 运行时的 node / pnpm
NODE_BIN=""
for cand in "$DSH_NODE_EXECUTABLE" \
  "$DSH_HOME/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node" \
  "/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness" \
  "/Applications/SuperAPP/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness"; do
  if [[ -n "$cand" && -x "$cand" ]]; then NODE_BIN="$cand"; break; fi
done
if [[ -z "$NODE_BIN" ]]; then echo "✘ 找不到 DSH 运行时 node(设置 DSH_NODE_EXECUTABLE 后重试)" >&2; exit 1; fi
PNPM="$DSH_HOME/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.cjs"

echo "① 安装插件依赖…"
( cd "$PLUGIN_DIR" && ELECTRON_RUN_AS_NODE=1 "$NODE_BIN" "$PNPM" install )

echo "② 链接插件到 profile/package.json…"
PKG="$PROFILE_DIR/package.json"
if ! grep -q '"super-deepseek-harness-git"' "$PKG"; then
  NODE_SCRIPT="const fs=require('fs'),p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,'utf8'));j.dependencies=j.dependencies||{};j.dependencies['super-deepseek-harness-git']='link:$PLUGIN_DIR';fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n')"
  ELECTRON_RUN_AS_NODE=1 "$NODE_BIN" -e "$NODE_SCRIPT" "$PKG"
  echo "   已写入 dependencies"
else
  echo "   已存在,跳过"
fi

echo "③ 注册到 profile/cordis.patch.yml…"
PATCH="$PROFILE_DIR/cordis.patch.yml"
if ! grep -q 'super-dsh-git' "$PATCH"; then
  printf '\n- insert:\n    - id: super-dsh-git\n      name: super-deepseek-harness-git\n      config: {}\n' >> "$PATCH"
  echo "   已追加 insert 条目"
else
  echo "   已存在,跳过"
fi

echo
echo "✔ 安装完成。请重启 DeepSeek Harness,然后在 插件管理 里启用 super-deepseek-harness-git,"
echo "  再到 设置 → GitHub 同步 登录并选择备份仓库。"
