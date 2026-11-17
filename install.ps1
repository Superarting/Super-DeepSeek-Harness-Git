# 一键安装 super-deepseek-harness-git 到当前 DSH profile(Windows PowerShell)。
# 与 install.sh 完全对应的自动探测逻辑,无需手工指定实际安装目录:
#   · DSH 数据目录 : $env:USERPROFILE\.dsh(或 DSH_HOME)
#   · Profile      : desktop(或 DSH_PROFILE;否则取 profiles/ 下第一个)
#   · node 运行时  : DSH_NODE_EXECUTABLE → DSH 运行时自带 node →
#                    DeepSeek Harness.exe 内置 Electron(自动搜索常见安装位置,
#                    必要时在 Programs 目录下递归定位)→ 系统 PATH 里的 node
#   · pnpm         : DSH 运行时自带 pnpm.cjs/.mjs → 系统 PATH 里的 pnpm
#
# 用法:在 PowerShell 中进入本目录后执行  .\install.ps1
$ErrorActionPreference = 'Stop'

# ---------- ① 定位插件目录(兼容仓库根或 super-dsh-git/ 子目录布局) ----------
$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PluginDir = $null
if (Test-Path (Join-Path $RepoDir 'package.json')) {
  $PluginDir = $RepoDir
} elseif (Test-Path (Join-Path $RepoDir 'super-dsh-git\package.json')) {
  $PluginDir = Join-Path $RepoDir 'super-dsh-git'
} else {
  Write-Host "✘ 找不到插件 package.json(仓库根或 super-dsh-git/ 子目录): $RepoDir" -ForegroundColor Red
  exit 1
}

# ---------- ② 自动定位 DSH 数据目录与 profile ----------
$DshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$ProfilesDir = Join-Path $DshHome 'profiles'
if (-not (Test-Path $ProfilesDir)) {
  Write-Host "✘ 找不到 profiles 目录: $ProfilesDir" -ForegroundColor Red
  Write-Host "  请先启动一次 DeepSeek Harness(它会自动生成 profile),再重新运行本脚本。"
  exit 1
}
$ProfileName = $env:DSH_PROFILE
if (-not $ProfileName) {
  $ProfileName = 'desktop'
  if (-not (Test-Path (Join-Path $ProfilesDir $ProfileName))) {
    $first = Get-ChildItem -Path $ProfilesDir -Directory |
      Where-Object { Test-Path (Join-Path $_.FullName 'package.json') } |
      Sort-Object Name | Select-Object -First 1
    if ($first) { $ProfileName = $first.Name } else { $ProfileName = $null }
  }
}
$ProfileDir = if ($ProfileName) { Join-Path $ProfilesDir $ProfileName } else { $null }
if (-not $ProfileDir -or -not (Test-Path (Join-Path $ProfileDir 'package.json'))) {
  Write-Host "✘ 找不到有效的 profile(目录: $ProfileDir)" -ForegroundColor Red
  $names = (Get-ChildItem -Path $ProfilesDir -Directory | Select-Object -ExpandProperty Name) -join ' '
  Write-Host "  可用 profiles: $names"
  exit 1
}
Write-Host "① DSH 环境: data=$DshHome  profile=$ProfileName"

# ---------- ③ 自动定位 node ----------
$NodeBin = $null
$NodeCandidates = @()
if ($env:DSH_NODE_EXECUTABLE) { $NodeCandidates += $env:DSH_NODE_EXECUTABLE }
foreach ($rel in @(
  'dsh-runtimes\dsh-primary-runtime\dependencies\node\node.exe',
  'dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe',
  'dsh-runtimes\dsh-primary-runtime\dependencies\node\node',
  'dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node'
)) { $NodeCandidates += (Join-Path $DshHome $rel) }

# DeepSeek Harness 应用内 Electron 主程序(路径自动探测,含 SuperAPP 子目录等常见位置):
$AppCandidates = @()
if ($env:DSH_APP_DIR) { $AppCandidates += (Join-Path $env:DSH_APP_DIR 'DeepSeek Harness.exe') }
$AppCandidates += @(
  (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\DeepSeek Harness.exe'),
  (Join-Path $env:LOCALAPPDATA 'Programs\SuperAPP\DeepSeek Harness\DeepSeek Harness.exe'),
  (Join-Path $env:ProgramFiles 'DeepSeek Harness\DeepSeek Harness.exe'),
  (Join-Path $env:ProgramFiles 'SuperAPP\DeepSeek Harness\DeepSeek Harness.exe')
)
foreach ($x86 in @(${env:ProgramFiles(x86)})) {
  if ($x86) { $AppCandidates += (Join-Path $x86 'DeepSeek Harness\DeepSeek Harness.exe') }
}
$NodeCandidates += $AppCandidates
# 仍找不到时在常见安装根下浅层递归搜索:
if (-not ($NodeCandidates | Where-Object { $_ -and (Test-Path $_) })) {
  foreach ($root in @((Join-Path $env:LOCALAPPDATA 'Programs'), $env:ProgramFiles)) {
    if ($root -and (Test-Path $root)) {
      Get-ChildItem -Path $root -Recurse -Depth 3 -Filter 'DeepSeek Harness.exe' -ErrorAction SilentlyContinue |
        ForEach-Object { $NodeCandidates += $_.FullName }
    }
  }
}
$NodeCandidates += (Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
foreach ($cand in $NodeCandidates) {
  if ($cand -and (Test-Path $cand)) { $NodeBin = $cand; break }
}
if (-not $NodeBin) {
  Write-Host "✘ 找不到可用的 node(尝试过: DSH 运行时、DeepSeek Harness.exe、系统 PATH)。" -ForegroundColor Red
  Write-Host "  可设置 DSH_NODE_EXECUTABLE 指定后重试。"
  exit 1
}
$env:ELECTRON_RUN_AS_NODE = '1'
$electronHint = if ($NodeBin -like '*DeepSeek Harness.exe') { '(Electron,经 ELECTRON_RUN_AS_NODE 调用)' } else { '' }
Write-Host "② node: $NodeBin $electronHint"

# ---------- ④ 自动定位 pnpm 并安装插件依赖 ----------
$PnpmScript = $null
if ($env:DSH_PNPM_SCRIPT) { $PnpmScript = $env:DSH_PNPM_SCRIPT }
if (-not $PnpmScript) {
  $pnpmBases = @($DshHome,
    (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources'),
    (Join-Path $env:LOCALAPPDATA 'Programs\SuperAPP\DeepSeek Harness\resources'),
    (Join-Path $env:ProgramFiles 'DeepSeek Harness\resources'),
    (Join-Path $env:ProgramFiles 'SuperAPP\DeepSeek Harness\resources'))
  foreach ($base in $pnpmBases) {
    if (-not $base -or -not (Test-Path $base)) { continue }
    foreach ($rel in @(
      'runtime\primary-runtime\dependencies\pnpm\bin\pnpm.cjs',
      'runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs',
      'dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.cjs',
      'dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
    )) {
      $p = Join-Path $base $rel
      if (Test-Path $p) { $PnpmScript = $p; break }
    }
    if ($PnpmScript) { break }
  }
}
Write-Host "③ 安装插件依赖…"
$PnpmMissing = $false
Push-Location $PluginDir
try {
  if ($PnpmScript) {
    & $NodeBin $PnpmScript install
    if ($LASTEXITCODE -ne 0) { throw "pnpm install 失败(退出码 $LASTEXITCODE)" }
  } elseif (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm install
    if ($LASTEXITCODE -ne 0) { throw "pnpm install 失败(退出码 $LASTEXITCODE)" }
  } else {
    $PnpmMissing = $true
  }
} finally { Pop-Location }
if ($PnpmMissing) {
  Write-Host "✘ 找不到 pnpm(运行时与系统 PATH 均无)。可设置 DSH_PNPM_SCRIPT 指向 pnpm.cjs 后重试。" -ForegroundColor Red
  exit 1
}

# ---------- ⑤ 写入/修正 profile/package.json 的插件链接 ----------
$PluginName = & $NodeBin -p 'require(process.argv[1]).name' (Join-Path $PluginDir 'package.json')
Write-Host "④ 写入/修正 profile/package.json 的插件链接…"
# 无论依赖是缺失、还是指向旧机器的失效路径,都统一改写为本次 clone 的位置;
# 其余 link: 依赖若在本机不存在,列出提醒但不擅自改动。
$FixJs = Join-Path $env:TEMP ("fixlinks-" + [guid]::NewGuid().ToString('N') + ".js")
@'
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
  console.log(`   ${depKey}: ${prev} -> ${want}`)
} else {
  console.log(`   ${depKey} 已指向当前位置,跳过`)
}
const broken = []
for (const [k, v] of Object.entries(j.dependencies)) {
  if (typeof v === 'string' && v.startsWith('link:') && k !== depKey && !fs.existsSync(v.slice(5))) {
    broken.push(`${k} -> ${v}`)
  }
}
fs.writeFileSync(pkgPath, JSON.stringify(j, null, 2) + '\n')
if (broken.length > 0) {
  console.log('   ⚠ 以下 link: 依赖在本机路径不存在(与本项目无关,未擅自改动):')
  for (const b of broken) console.log(`     - ${b}`)
}
'@ | Set-Content -Path $FixJs -Encoding UTF8
try {
  & $NodeBin $FixJs (Join-Path $ProfileDir 'package.json') $PluginDir $PluginName
  if ($LASTEXITCODE -ne 0) { throw "改写 profile/package.json 失败(退出码 $LASTEXITCODE)" }
} finally { Remove-Item $FixJs -ErrorAction SilentlyContinue }

# ---------- ⑥ 注册(双通道去重:bundles 优先,其次 cordis.patch.yml) ----------
Write-Host "⑤ 注册到 profile…"
$ProfilePkg = Join-Path $ProfileDir 'package.json'
$Patch = Join-Path $ProfileDir 'cordis.patch.yml'
$inBundles = & $NodeBin -p 'const j=require(process.argv[1]);const b=j&&j.dsh&&j.dsh.profile&&Array.isArray(j.dsh.profile.bundles)?j.dsh.profile.bundles:[];b.includes(process.argv[2])' $ProfilePkg $PluginName
if ("$inBundles" -eq 'true') {
  Write-Host "   已在 package.json 的 dsh.profile.bundles 注册,跳过"
} elseif ((Test-Path $Patch) -and (Select-String -Path $Patch -Pattern 'super-dsh-git' -Quiet)) {
  Write-Host "   已在 cordis.patch.yml 注册,跳过"
} else {
  Add-Content -Path $Patch -Value "`r`n- insert:`r`n    - id: super-dsh-git`r`n      name: $PluginName`r`n      config: {}" -Encoding UTF8
  Write-Host "   已追加 insert 条目到 cordis.patch.yml"
}

Write-Host ""
Write-Host "✔ 安装完成(插件名: $PluginName)。"
Write-Host "  下一步:"
Write-Host "  1. 重启 DeepSeek Harness,在 插件管理 里启用 super-deepseek-harness-git;"
Write-Host "  2. 设置 → GitHub 同步 → 登录账号 → 填备份仓库 → 「从仓库恢复」(新机)或「立即同步」(备份);"
Write-Host "  3. 若 profile 中还有机器特定的绝对路径(MCP 的 node 路径、本地模型路径等),"
Write-Host "     恢复后需按新机器实际情况微调。"
