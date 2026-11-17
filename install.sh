#!/usr/bin/env bash
# 一键安装 super-deepseek-harness-git 到当前 DSH profile(macOS / Linux / Git Bash)。
#
# 全程自动探测,无需手工指定实际安装目录:
#   · DSH 数据目录   : ~/.dsh(或 DSH_HOME)
#   · Profile        : desktop(或 DSH_PROFILE;否则取 profiles/ 下第一个)
#   · node 运行时    : DSH_NODE_EXECUTABLE → DSH 运行时自带 node →
#                      DeepSeek Harness.app 内置 Electron(自动搜索 /Applications、
#                      ~/Applications,必要时用 mdfind 全盘定位)→ 系统 PATH 里的 node
#   · pnpm           : DSH 运行时自带 pnpm.cjs/.mjs → 系统 PATH 里的 pnpm
#
# Windows 用户请改用 install.ps1(同样的自动探测逻辑)。
#
# 支持两种场景:
#   A. 全新机器:clone 本仓库后直接运行;
#   B. 恢复过备份的机器:profile 里残留旧机器的 link: 路径 → 自动改写为本次 clone 的实际位置。
# 前提:DeepSeek Harness 至少启动过一次(生成 profile)。
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
# 兼容两种仓库布局:插件文件在仓库根(package.json 与本脚本同目录),或在 super-dsh-git/ 子目录。
if [[ -f "$REPO_DIR/package.json" ]]; then
  PLUGIN_DIR="$REPO_DIR"
elif [[ -f "$REPO_DIR/super-dsh-git/package.json" ]]; then
  PLUGIN_DIR="$REPO_DIR/super-dsh-git"
else
  echo "✘ 找不到插件 package.json(仓库根或 super-dsh-git/ 子目录): $REPO_DIR" >&2
  exit 1
fi

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    if [[ -n "${DSH_NODE_EXECUTABLE:-}" ]]; then
      echo "⚠ 检测到 Windows(Git Bash)。建议改在 PowerShell 中运行 install.ps1;本次继续使用 DSH_NODE_EXECUTABLE。"
    else
      echo "✘ Windows 请在 PowerShell 中运行 install.ps1(同样的自动探测逻辑)。" >&2
      exit 1
    fi ;;
esac

# ---------- ① 自动定位 DSH 数据目录与 profile ----------
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
if [[ ! -d "$DSH_HOME" && -n "${USERPROFILE:-}" && -d "$USERPROFILE/.dsh" ]]; then
  DSH_HOME="$USERPROFILE/.dsh"
fi
PROFILES_DIR="$DSH_HOME/profiles"
if [[ ! -d "$PROFILES_DIR" ]]; then
  echo "✘ 找不到 profiles 目录: $PROFILES_DIR" >&2
  echo "  请先启动一次 DeepSeek Harness(它会自动生成 profile),再重新运行本脚本。" >&2
  exit 1
fi
PROFILE="${DSH_PROFILE:-}"
if [[ -z "$PROFILE" ]]; then
  PROFILE="desktop"
  if [[ ! -d "$PROFILES_DIR/$PROFILE" ]]; then
    PROFILE="$(find "$PROFILES_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | head -1 | xargs -I{} basename "{}")"
  fi
fi
PROFILE_DIR="$PROFILES_DIR/$PROFILE"
if [[ -z "$PROFILE" || ! -f "$PROFILE_DIR/package.json" ]]; then
  echo "✘ 找不到有效的 profile(目录: $PROFILE_DIR)" >&2
  echo "  可用 profiles: $(ls "$PROFILES_DIR" 2>/dev/null | tr '\n' ' ')" >&2
  exit 1
fi
echo "① DSH 环境: data=$DSH_HOME  profile=$PROFILE"

# ---------- ② 自动定位 node ----------
NODE_BIN=""
ELECTRON_HINT=""
NODE_CANDIDATES=()
[[ -n "${DSH_NODE_EXECUTABLE:-}" ]] && NODE_CANDIDATES+=("$DSH_NODE_EXECUTABLE")
NODE_CANDIDATES+=("$DSH_HOME/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node")
# DeepSeek Harness 应用内 Electron 主程序(路径自动探测,含旧版/新版两种安装位置):
APP_CANDIDATES=("${DSH_APP_DIR:-}")
for base in "/Applications" "$HOME/Applications"; do
  APP_CANDIDATES+=("$base/SuperAPP/DeepSeek Harness.app" "$base/DeepSeek Harness.app")
done
for app in "${APP_CANDIDATES[@]}"; do
  [[ -n "$app" ]] || continue
  NODE_CANDIDATES+=("$app/Contents/MacOS/DeepSeek Harness")
done
# 仍找不到时全盘 Spotlight 搜索(仅 macOS):
if command -v mdfind >/dev/null 2>&1; then
  while IFS= read -r app; do
    NODE_CANDIDATES+=("$app/Contents/MacOS/DeepSeek Harness")
  done < <(mdfind "kMDItemFSName == 'DeepSeek Harness.app'" 2>/dev/null | head -3)
fi
NODE_CANDIDATES+=("$(command -v node 2>/dev/null || true)")
for cand in "${NODE_CANDIDATES[@]}"; do
  [[ -n "$cand" && -x "$cand" ]] || continue
  NODE_BIN="$cand"
  case "$cand" in *".app/"*) ELECTRON_HINT="(Electron,经 ELECTRON_RUN_AS_NODE 调用)";; esac
  break
done
if [[ -z "$NODE_BIN" ]] || ! ELECTRON_RUN_AS_NODE=1 "$NODE_BIN" -p "1+1" >/dev/null 2>&1; then
  echo "✘ 找不到可用的 node(尝试过: DSH 运行时、DeepSeek Harness.app、系统 PATH)。" >&2
  echo "  可设置 DSH_NODE_EXECUTABLE 指定后重试。" >&2
  exit 1
fi
echo "② node: $NODE_BIN $ELECTRON_HINT"

# ---------- ③ 自动定位 pnpm 并安装插件依赖 ----------
PNPM_SCRIPT=""
PNPM_CANDIDATES=("${DSH_PNPM_SCRIPT:-}")
for base in "$DSH_HOME" /Applications/SuperAPP/DeepSeek\ Harness.app/Contents/Resources /Applications/DeepSeek\ Harness.app/Contents/Resources; do
  [[ -n "$base" ]] || continue
  PNPM_CANDIDATES+=("$base/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs" \
                    "$base/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs" \
                    "$base/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.cjs" \
                    "$base/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.mjs")
done
for cand in "${PNPM_CANDIDATES[@]}"; do
  [[ -n "$cand" && -f "$cand" ]] && { PNPM_SCRIPT="$cand"; break; }
done
echo "③ 安装插件依赖…"
(
  cd "$PLUGIN_DIR"
  if [[ -n "$PNPM_SCRIPT" ]]; then
    ELECTRON_RUN_AS_NODE=1 "$NODE_BIN" "$PNPM_SCRIPT" install
  elif command -v pnpm >/dev/null 2>&1; then
    pnpm install
  else
    echo "✘ 找不到 pnpm(运行时与系统 PATH 均无)。可设置 DSH_PNPM_SCRIPT 指向 pnpm.cjs 后重试。" >&2
    exit 1
  fi
)

# ---------- ④ 写入/修正 profile/package.json 的插件链接 ----------
PLUGIN_NAME="$(ELECTRON_RUN_AS_NODE=1 "$NODE_BIN" -p "require(process.argv[1]).name" "$PLUGIN_DIR/package.json")"
echo "④ 写入/修正 profile/package.json 的插件链接…"
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

# ---------- ⑤ 注册(双通道去重:bundles 优先,其次 cordis.patch.yml) ----------
echo "⑤ 注册到 profile…"
PATCH="$PROFILE_DIR/cordis.patch.yml"
IN_BUNDLES="$(ELECTRON_RUN_AS_NODE=1 "$NODE_BIN" -p "
const j = require(process.argv[1]);
const b = j && j.dsh && j.dsh.profile && Array.isArray(j.dsh.profile.bundles) ? j.dsh.profile.bundles : [];
b.includes(process.argv[2]);
" "$PROFILE_DIR/package.json" "$PLUGIN_NAME")"
if [[ "$IN_BUNDLES" == "true" ]]; then
  echo "   已在 package.json 的 dsh.profile.bundles 注册,跳过"
elif grep -q 'super-dsh-git' "$PATCH" 2>/dev/null; then
  echo "   已在 cordis.patch.yml 注册,跳过"
else
  printf '\n- insert:\n    - id: super-dsh-git\n      name: %s\n      config: {}\n' "$PLUGIN_NAME" >> "$PATCH"
  echo "   已追加 insert 条目到 cordis.patch.yml"
fi

echo
echo "✔ 安装完成(插件名: $PLUGIN_NAME)。"
echo "  下一步:"
echo "  1. 重启 DeepSeek Harness,在 插件管理 里启用 super-deepseek-harness-git;"
echo "  2. 设置 → GitHub 同步 → 登录账号 → 填备份仓库 → 「从仓库恢复」(新机)或「立即同步」(备份);"
echo "  3. 若 profile 中还有机器特定的绝对路径(mastergo MCP 的 node 路径、本地模型路径等),"
echo "     恢复后需按新机器实际情况微调。"
