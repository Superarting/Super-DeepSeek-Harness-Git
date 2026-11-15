# super-deepseek-harness-git

DeepSeek Harness (DSH) 插件 — 把你的 DSH 全局配置(模型/代理/MCP/界面)、技能、插件数据、会话历史一键备份到你自己的 GitHub 私有仓库；换新电脑时登录同一账号、一键恢复。

**特色：推送/恢复全部走 GitHub REST API,不依赖 git 命令和 git 协议** — 在封锁 `github.com` git 通道的公司网络(直连 `api.github.com` 可达)下也能正常工作。

## 功能

- 设置弹窗新增「GitHub 同步」分区：账号登录(粘贴 fine-grained PAT)、仓库地址、同步/恢复按钮、实时进度条
- 逐项勾选同步内容,自动发现 `~/.dsh` 下未登记的目录
- 密钥防线：`.credentials.yaml`、`openai-gateway`、`token-ledger`、`age.key` 等敏感路径硬编码禁止上传
- 增量推送：文件级 SHA 对比,只上传变化的文件;远端多余文件自动清理
- 令牌存入 DSH 加密凭证库,不落明文

## 安装

### 方式 A:一键脚本(推荐)

```bash
git clone https://github.com/Superarting/Super-DeepSeek-Harness-Git.git
cd Super-DeepSeek-Harness-Git
./install.sh
```

脚本自动:链接插件到当前 profile → 安装依赖 → 注册到 cordis.patch.yml。完成后重启 DeepSeek Harness。

### 方式 B:手动

```bash
git clone https://github.com/Superarting/Super-DeepSeek-Harness-Git.git
cd Super-DeepSeek-Harness-Git/super-dsh-git
# 用 DSH 运行时的 pnpm 安装依赖
ELECTRON_RUN_AS_NODE=1 "$DSH_NODE_EXECUTABLE" \
  ~/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/pnpm/bin/pnpm.cjs install
```

然后在 profile 的 `package.json` 中加入:

```json
"super-deepseek-harness-git": "link:/path/to/Super-DeepSeek-Harness-Git/super-dsh-git"
```

并在 `cordis.patch.yml` 追加:

```yaml
- insert:
    - id: super-dsh-git
      name: super-deepseek-harness-git
      config: {}
```

重启 DSH,在 插件管理 里启用该 bundle。

## 使用

1. 设置 → GitHub 同步 → 粘贴 GitHub fine-grained PAT 登录
   (令牌需勾选:Repository access 选定你的备份仓库 + Permissions → Contents: Read and write)
2. 填写备份仓库地址(建议私有仓库,如 `https://github.com/<你>/<备份仓库名>`)
3. 勾选要同步的内容 → 点「立即同步」
4. 换新电脑:装好本插件 → 登录同一账号 → 点「从仓库恢复」→ 重启 DSH

## 版本

| 版本 | 说明 |
|---|---|
| 1.1.0 | 推送/恢复引擎切换到 GitHub REST API(绕开 git 协议封锁);修复成功后进度条卡 99%;补充 armory/our-free-model 缓存文件同步 |
| 1.0.0 | 首版:设置分区 UI、git 协议推送、逐项勾选、自动发现 |

## 文档

- [设计细节(中)](docs/DETAIL.zh.md) / [Design details (EN)](docs/DETAIL.md)

## License

MIT
