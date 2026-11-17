#!/usr/bin/env bash
# 一键安装 super-deepseek-harness-git 到当前 DSH profile。
# 支持两种场景:
#   A. 全新机器:clone 本仓库后直接运行;
#   B. 恢复过备份的机器:profile 里残留旧机器的 link: 路径 → 自动改写为本次 clone 的实际位置。
# 前提:DeepSeek Harness 至少启动过一次(生成 profile)。
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
# 兼容两种仓库布局:插件文件在仓库根(package.json 与本脚本同目录),或在 super-dsh-git/ 子目录。
if [[ -f "$REPO_DIR/package.json" ]]; then
  PLUGIN_DIR="$REPO_DIR"
else
  PLUGIN_DIR="$REPO_DIR/super-dsh-git"
fi
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE="${DSH_PROFILE:-desktop}"
PROFILE_DIR="$DSH_HOME/profiles/$PROFILE"

if [[ ! -f "$PLUGIN_DIR/package.json" ]]; then echo "✘ 找不到插件 package.json: $PLUGIN_DIR" >&2; exit 1; fi
if [[ ! -d "$PROFILE_DIR" ]]; then
  echo "✘ 找不到 profile 目录: $PROFILE_DIR" >&2
  echo "  请先启动一次 DeepSeek Harness(它会自动生成 profile),再重新运行本脚本。" >&2
  exit 1
fi

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

PLUGIN_NAME="$(ELECTRON_RUN_AS_NODE=1 "$NODE_BIN" -p "require('$PLUGIN_DIR/package.json').name")"

echo "① 安装插件依赖…"
( cd "$PLUGIN_DIR" && ELECTRON_RUN_AS_NODE=1 "$NODE_BIN" "$PNPM" install )

echo "② 写入/修正 profile/package.json 的插件链接…"
# 无论依赖是缺失、还是指向旧机器的失效路径,都统一改写为本次 clone 的位置;
# 其余 link: 依赖若在本机不存在,列出提醒但不擅自改动。
FIXJS="$(mktemp).fixlinks.js"
cat > "$FIXJS" <<'JS'
const fs = require('node:fs')
const pkgPath = process.argv[2]
const pluginDir = process.argv[3]
const depKey = process.argv[4]
const j = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
j.dependencies = j.dependencies ?? {}
const want = 'link:' + pluginDir
if (j.dependencies[depKey] !== want) {
  const prev = j.dependencies[depKey] ?? '(缺失)'
  j.dependencies[depKey] = want
  console.log(`   ${depKey}: ${prev} → ${want}`)
} else {
  console.log(`   ${depKey} 已指向当前位置,跳过`)
}
const broken = []
for (const [k, v] of Object.entries(j.dependencies)) {
  if (typeof v === 'string' && v.startsWith('link:') && k !== depKey && !fs.existsSync(v.slice(5))) {
    broken.push(`${k} → ${v}`)
  }
}
fs.writeFileSync(pkgPath, JSON.stringify(j, null, 2) + '\n')
if (broken.length > 0) {
  console.log('   ⚠ 以下 link: 依赖在本机路径不存在(与本项目无关,未擅自改动):')
  for (const b of broken) console.log(`     - ${b}`)
}
JS
ELECTRON_RUN_AS_NODE=1 "$NODE_BIN" "$FIXJS" "$PROFILE_DIR/package.json" "$PLUGIN_DIR" "$PLUGIN_NAME"
rm -f "$FIXJS"

echo "③ 注册到 profile/cordis.patch.yml…"
PATCH="$PROFILE_DIR/cordis.patch.yml"
if ! grep -q 'super-dsh-git' "$PATCH"; then
  printf '\n- insert:\n    - id: super-dsh-git\n      name: %s\n      config: {}\n' "$PLUGIN_NAME" >> "$PATCH"
  echo "   已追加 insert 条目"
else
  echo "   已存在,跳过"
fi

echo
echo "✔ 安装完成(插件名: $PLUGIN_NAME)。"
echo "  下一步:"
echo "  1. 重启 DeepSeek Harness,在 插件管理 里启用 super-deepseek-harness-git;"
echo "  2. 设置 → GitHub 同步 → 登录账号 → 填备份仓库 → 「从仓库恢复」(新机)或「立即同步」(备份);"
echo "  3. 若 profile 中还有机器特定的绝对路径(mastergo MCP 的 node 路径、本地模型路径等),"
echo "     恢复后需按新机器实际情况微调。"
