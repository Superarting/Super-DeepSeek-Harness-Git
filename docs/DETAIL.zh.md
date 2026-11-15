# Super-DeepSeek-Harness Git

通过你的 GitHub 私有仓库,一键备份与恢复 DeepSeek Harness 的全局配置。

## 同步什么

| 项目 | 来源路径 |
|---|---|
| 配置 | `~/.dsh/profiles/desktop/cordis.patch.yml`、`package.json`、`pnpm-lock.yaml` |
| 技能 | `~/.agents/skills/` |
| 插件数据 | `~/.dsh/` 下选定的 JSON 存储(armory、our-free-model、task-board 等) |
| 会话 | `~/.dsh/sessions/`(聊天历史,`.zstd`) |

本插件不做加密:目标仓库必须是**私有仓库**。永不同步的敏感文件:`~/.dsh/.credentials.yaml`、`~/.dsh/openai-gateway/`。

## 登录

创建细粒度个人访问令牌(github.com → Settings → Developer settings → Fine-grained tokens):

- Repository access:Only select repositories → 选择你的同步仓库
- Permissions → Contents:**Read and write**

在插件菜单 → 登录 中粘贴令牌。令牌保存在 DSH 加密凭证库中,不写入任何配置文件。

## 换新电脑

1. 安装 DeepSeek Harness 和本插件。
2. 菜单 → 登录,使用同一个令牌。
3. 菜单 → 拉取恢复:从仓库拉取最新快照并落位,按提示重启 DeepSeek Harness 即可。
