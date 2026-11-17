# Super-DeepSeek-Harness Git 完整使用指南

> 把你的 DeepSeek Harness（DSH）全局环境一键备份到自己的 GitHub 私有仓库；换新电脑时登录同一账号，一键恢复。

---

## 目录

1. [这是什么](#一这是什么)
2. [工作原理](#二工作原理)
3. [功能特性](#三功能特性)
4. [安装](#四安装)
5. [准备工作:创建 GitHub 令牌](#五准备工作创建-github-令牌)
6. [日常使用](#六日常使用)
7. [同步内容明细](#七同步内容明细)
8. [安全与隐私](#八安全与隐私)
9. [新电脑迁移完整流程](#九新电脑迁移完整流程)
10. [常见问题 FAQ](#十常见问题-faq)
11. [卸载](#十一卸载)
12. [版本历史](#十二版本历史)

---

## 一、这是什么

DeepSeek Harness 用得越久,积累的全局资产越多:精心调好的模型与代理配置、装好的 MCP 服务、几十个技能、插件数据、以及无法再现的会话历史。这些全部存在本机 `~/.dsh` 目录里——**换电脑、重装系统、或多台机器同时使用时,它们不会自己跟过去**。

**Super-DeepSeek-Harness Git** 解决的就是这个问题:在 DSH 的设置界面里加入一个「GitHub 同步」分区,把你的全局环境快照推送到**你自己的 GitHub 私有仓库**,并在任何一台新机器上一键恢复。

它不依赖任何第三方服务:备份仓库是你的,令牌是你的,数据始终在你和 GitHub 之间,插件服务器不存在。

## 二、工作原理

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│  DSH 设置界面    │  HTTP   │   插件 Host 端引擎     │  HTTPS  │  GitHub REST API │
│  「GitHub 同步」  │ ──────→ │  (index.js)          │ ──────→ │  api.github.com  │
│  分区(client.js) │         │  扫描→对比→上传        │         │  你的私有仓库      │
└─────────────────┘         └──────────────────────┘         └─────────────────┘
```

推送一条提交的完整过程:

1. **扫描**:按勾选的同步项收集本机文件(跳过 `node_modules`、`.git`、`.DS_Store`);
2. **对比**:逐文件计算 Git blob SHA-1,与远端仓库现有树对比,**只上传有变化的文件**;
3. **建树**:通过 Git Data REST 接口创建 tree(base_tree 继承远端,远端多余文件自动删除);
4. **提交**:创建 commit 并把 `main` 分支指针移到新提交。

**关键设计:全程走 `api.github.com` 的 REST 接口,不使用 git 命令、不使用 git smart-HTTP 协议。** 很多公司网络封锁 github.com 的 git 通道,但放行 api.github.com——此插件在这样的网络里照常工作。

恢复则是反向过程:读取远端仓库文件树,把属于已启用同步项的文件逐个下载写回本机原位,完成后提示重启 DSH 生效。

## 三、功能特性

- **设置内集成**:DSH 设置窗口新增「GitHub 同步」分区(左侧导航 GitHub 图标),登录、配置、同步、恢复全在一个页面完成;
- **逐项勾选**:每个同步项独立开关,精确控制备份范围;自动发现 `~/.dsh` 下未登记的目录(标记「自动发现」,默认不勾选);
- **增量推送**:文件级 SHA 对比,无变化的文件零流量;远端已删除的本地文件自动清理;
- **实时进度**:推送/恢复显示进度百分比和当前阶段(收集 → 对比 → 上传 → 建树 → 提交);
- **密钥防线**:凭证、网关密钥等敏感路径硬编码禁止上传,上传前还有最终防线扫描,命中即中止整个推送;
- **令牌安全**:GitHub 令牌存入 DSH 加密凭证库(credentials store),绝不写入配置文件、绝不随备份上传;
- **跨平台**:macOS / Windows 一键安装脚本,自动探测 DSH 安装位置,无需手工指定路径;
- **离线 REST**:不依赖 git 协议,公司网络封锁 git 通道时依然可用。

## 四、安装

安装脚本会**自动探测**以下内容,一般无需任何手工配置:

| 探测对象 | 自动查找顺序 |
|---|---|
| DSH 数据目录 | `~/.dsh`(或 `DSH_HOME`) |
| Profile | `desktop` → 不存在则取 `profiles/` 下第一个 |
| node 运行时 | `DSH_NODE_EXECUTABLE` → DSH 运行时自带 node → DeepSeek Harness 应用内置 Electron(自动搜索常见安装位置)→ 系统 PATH |
| pnpm | DSH 运行时自带 pnpm → 系统 PATH |

### macOS / Linux

```bash
git clone https://github.com/Superarting/Super-DeepSeek-Harness-Git.git
cd Super-DeepSeek-Harness-Git
./install.sh
```

### Windows(PowerShell)

```powershell
git clone https://github.com/Superarting/Super-DeepSeek-Harness-Git.git
cd Super-DeepSeek-Harness-Git\super-dsh-git
.\install.ps1
```

> 若执行策略限制,先运行 `Set-ExecutionPolicy -Scope Process Bypass` 放行当前会话。

### 脚本做了什么

1. 定位 DSH 数据目录与 profile;
2. 定位可用的 node(应用内置 Electron 会被自动发现并以 `ELECTRON_RUN_AS_NODE=1` 调用);
3. 在插件目录执行 `pnpm install` 安装依赖;
4. 把本插件以 `link:` 形式写入 profile 的 `package.json`(恢复过备份的旧机器若残留失效路径,会自动改写为本次 clone 的位置);
5. 注册到 profile:**优先检测 `dsh.profile.bundles`,其次 `cordis.patch.yml`,双通道去重,重复运行不会重复注册**。

完成后**重启 DeepSeek Harness**,在 设置 → 插件 里启用 `super-deepseek-harness-git`。

### 可选环境变量(自动探测失败时才需要)

| 变量 | 作用 | 示例 |
|---|---|---|
| `DSH_HOME` | 指定 DSH 数据目录 | `/data/.dsh` |
| `DSH_PROFILE` | 指定 profile 名 | `work` |
| `DSH_NODE_EXECUTABLE` | 指定 node 可执行文件 | `/usr/local/bin/node` |
| `DSH_PNPM_SCRIPT` | 指定 pnpm.cjs 路径 | `.../pnpm/bin/pnpm.cjs` |
| `DSH_APP_DIR` | 指定应用安装目录(辅助定位内置 node) | `/Applications/SuperAPP` |

## 五、准备工作:创建 GitHub 令牌

插件使用 **GitHub fine-grained personal access token**(细粒度令牌),权限最小化:

1. 登录 GitHub → 右上角头像 → **Settings** → 左侧最底部 **Developer settings**;
2. **Personal access tokens → Fine-grained tokens** → **Generate new token**;
3. 填写:
   - **Token name**:随意,如 `dsh-sync`;
   - **Expiration**:建议 90 天以上(到期需重新生成并重新登录);
   - **Repository access**:选 **Only select repositories**,勾选你的备份仓库(建议新建一个**私有**仓库,如 `dsh-backup`);
   - **Permissions → Repository permissions → Contents**:设为 **Read and write**(其他权限一概不需要);
4. **Generate token**,复制生成的令牌(只显示一次)。

> 备份仓库请务必选择 **Private(私有)**。插件不做任何加密,仓库内容就是你的配置和会话原文。

## 六、日常使用

所有操作都在 **DeepSeek Harness → 设置 → GitHub 同步** 分区完成:

### 首次登录

1. 点击「登录」,粘贴刚才创建的令牌,回车;
2. 登录成功后显示 GitHub 头像与账号名;令牌随即存入本机加密凭证库。

### 配置备份仓库

在「仓库地址」输入框填入 `https://github.com/<你的用户名>/<备份仓库>`,失焦或回车自动保存。下方会显示远端最新提交短哈希(已登录且仓库可达时)。

### 备份(推送)

1. 在「同步内容」清单里勾选要备份的项(详见下一节);
2. 点击 **「立即同步」**,进度条走完显示「已推送到 GitHub ✓」。

### 恢复(拉取)

点击 **「从仓库恢复」**,插件把仓库里属于已勾选项的文件写回本机原位,完成后提示**重启 DeepSeek Harness 生效**。

> 恢复是「以仓库为准覆盖本机」:仓库里有的文件会覆盖本机同名文件;仓库里没有的本机文件不会被删除。若想完全镜像仓库状态,先手动清空对应本机目录再恢复。

### 退出登录

点击「退出登录」并确认:删除本机存储的令牌与账号记录(不影响 GitHub 端,也不删除仓库内容)。

## 七、同步内容明细

| 同步项 | 本机来源 | 默认 | 说明 |
|---|---|---|---|
| 配置 | `~/.dsh/profiles/<profile>/` 下的 `cordis.patch.yml`、`package.json`、`pnpm-lock.yaml` | ✅ | 模型、代理、MCP、界面、插件清单 |
| 技能 | `~/.agents/skills/` | ✅ | 全部技能目录 |
| Armory | `~/.dsh/armory/`(安装状态、市场配置等) | ✅ | 技能市场安装记录 |
| Our Free Model | `~/.dsh/our-free-model/`(设置、目录、统计等) | ✅ | 免费模型插件数据 |
| 任务板 | `~/.dsh/task-board/` | ✅ | 共享任务板数据 |
| 工作区索引 | `~/.dsh/storages/workspace.json` | ✅ | 工作区/会话索引 |
| 皮肤中心 | `~/.dsh/skin-center-active.json`、`~/.dsh/dsh-claude-style` | ✅ | 皮肤与样式 |
| 桌宠 | `~/.dsh/pet.json` | ✅ | 桌宠配置 |
| MCP runtime | `~/.dsh/mcp-runtime/` | ✅ | mastergo 等本地 MCP 运行时 |
| 渠道包 | `~/.dsh/channel-pack/`(仅状态文件) | ✅ | 渠道包状态(不含账本) |
| WorkBuddy 专家 | `~/.dsh/wb-market/`(experts、meta) | ✅ | 专家配置 |
| 会话历史 | `~/.dsh/sessions/`(`.zstd` / `.json`) | ✅ | 聊天记录 |
| 自动发现项 | `~/.dsh/` 下其他未登记目录 | ❌ | 需手动勾选,最多显示 40 个 |

> 仓库目录布局与本机 key 一致:`profile/…`、`skills/…`、`sessions/…`、`.dsh/…`。

## 八、安全与隐私

### 永不上传的内容(硬编码防线)

- `~/.dsh/.credentials.yaml` — DSH 加密凭证库文件
- `~/.dsh/openai-gateway/` — 网关密钥
- `token-ledger`、`age.key`、`AGE-SECRET` 命中路径
- `dsh-runtimes/` — DSH 运行时本体(体积大且可重新下载)

防线有三层:同步项定义时排除 → 生效项过滤 → 上传前对最终文件清单整体扫描,**命中即拒绝整个推送**并报错。

### 令牌存储

GitHub 令牌保存在 DSH 的**加密凭证库**(credentials store)中,不写入任何明文配置,也不会被本插件同步上传。退出登录即从凭证库删除。

### 仓库要求

- 必须是**私有仓库**(插件不加密内容);
- 仓库仅通过 GitHub REST API 访问,内容只存在你的 GitHub 账号里;
- 会话历史是 DSH 自有格式(`.zstd` 压缩),仓库中不便于人直接阅读,但请仍按敏感数据对待。

## 九、新电脑迁移完整流程

1. 新电脑安装 DeepSeek Harness,**至少启动一次**(生成 profile);
2. 安装本插件(见第四节,一键脚本或手动);
3. 重启 DSH → 设置 → GitHub 同步 → 登录(同一令牌或重新创建一个);
4. 填写同一个备份仓库地址;
5. 勾选要恢复的项(建议与旧机器一致)→ 点击 **「从仓库恢复」**;
6. 完成后**重启 DeepSeek Harness**;
7. 微调机器特定路径:profile 里若有绝对路径(如 MCP 服务的 node 路径、本地模型路径),需按新机器实际情况调整;`link:` 形式的插件依赖若路径失效,重跑一次 install.sh 即可自动改写。

## 十、常见问题 FAQ

**Q:推送报 `GitHub API 403/404 … (请检查令牌…)`?**
令牌权限不足或未包含目标仓库。检查三点:Repository access 是否勾选了备份仓库;Contents 是否为 Read and write;令牌是否已过期。

**Q:公司网络里 GitHub 网页都打不开,还能用吗?**
只要 `api.github.com` 可达就可以。本插件全部走 REST API,不碰 git 协议。若 API 也被封锁,则无法使用(可尝试系统代理,插件请求走系统网络栈)。

**Q:进度条到 99% 后停留一会儿?**
99% 阶段在等 GitHub 创建 commit 和移动分支指针,大仓库可能数秒,属正常。完成后显示 ✓。

**Q:恢复后界面没变化?**
恢复只写文件,**必须重启 DeepSeek Harness** 才会重新加载配置、技能与插件数据。

**Q:同一仓库可以多台机器一起用吗?**
可以,但它是"最后写入获胜"的快照模型,不做合并。推荐做法:一台主力机负责「立即同步」,其他机器只做「从仓库恢复」;或在切换机器前先推送一次。

**Q:自动发现的项目敢勾选吗?**
自动发现项是 `~/.dsh` 下未登记目录,默认不勾选。勾选前建议确认它不含敏感信息(密钥防线仍会拦截已知的敏感路径)。

**Q:单个文件有大小限制吗?**
有。超过 80 MiB 的文件会被跳过(GitHub REST blob 上限),其余照常同步。

**Q:如何彻底退出?**
设置分区里「退出登录」删除本机令牌;再在 插件管理 里停用/卸载本插件即可。远端仓库与令牌本身不受影响(可到 GitHub 设置里删除令牌)。

## 十一、卸载

1. DSH 设置 → 插件 → 停用并卸载 `super-deepseek-harness-git`;
2. 清理 profile(可选):
   - 删除 `~/.dsh/profiles/desktop/package.json` 里 `"super-deepseek-harness-git"` 依赖及 `dsh.profile.bundles` 中的同名条目;
   - 删除 `~/.dsh/profiles/desktop/cordis.patch.yml` 里的 `super-dsh-git` insert 条目(若有);
3. 删除插件目录与本机数据(可选):插件 clone 目录、`~/.dsh/super-dsh-git/`;
4. GitHub 端:删除令牌(Settings → Developer settings),备份仓库按需保留或删除。

## 十二、版本历史

| 版本 | 说明 |
|---|---|
| 1.1.2 | 安装脚本跨平台自动探测(自动定位 DSH 数据目录/profile/运行时 node/pnpm,含应用内 Electron);新增 Windows install.ps1;注册双通道去重 |
| 1.1.1 | 移除自动发布实验(改为手动版本控制) |
| 1.1.0 | 同步引擎切换到 GitHub REST API(绕开 git 协议封锁);修复成功后进度条卡 99%;补充 armory/our-free-model 缓存文件同步 |
| 1.0.0 | 首版:设置分区 UI、git 协议推送、逐项勾选、自动发现 |

---

- 设计细节:[DETAIL.zh.md](DETAIL.zh.md) / [DETAIL.md](DETAIL.md)
- License: [MIT](../LICENSE)
