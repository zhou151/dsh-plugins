# 悬浮任务清单（DSH 插件）

> 本目录是 [DSH 插件集合](../../README.md) 里的一个插件；安装时选**这个子目录**。

把 agent 的 todo 清单固定在会话**右上角**，做成一张悬浮卡片，随时能看到当前在做什么、还剩几项。不需要点开任何侧栏或命令。

- 卡片：标题 + 进度计数（`3/7`）+ 进度条 + 每条任务及状态（完成划线、进行中高亮、待办灰）
- 收起：变成一条胶囊，只显示进度和当前任务；收起状态记在 localStorage，下次打开还是收起的
- 位置：`position: fixed`，右上角（`top: 56px; right: 12px`），不受 composer 裁剪，也不占布局
- 主题：全部吃宿主 token，浅色白面、深色黑面自动跟随
- 键盘：展开时按 `Esc` 收起；按钮都带 `aria-expanded` / `aria-label`

## 数据来源

读 DSH 的 `todos` 会话投影（`dsh-tool-todo` 声明，`dsh-tool-todo-plus` 写入同一份数据），所以官方 todo 工具和 todo-plus 的清单都能显示。没有任务时控件完全不出现。

## 安装

```bash
git clone <本仓库地址> dsh-plugins
```

DSH 里 **Plugins → Add plugin → 选本地目录**，指向 `dsh-plugins/plugins/task-board`；或让 agent 装这个路径。装完刷新页面（⌘R）。

## 已知限制

- 位置固定在右上角，不提供拖动；如果你的布局里右上角有别的浮层（比如 `dsh-tool-todo-plus` 自己的浮窗），两个同时打开会重叠——建议只留一个。
- 只在有任务清单时出现；任务全部完成后仍会显示，方便确认收尾。
- 针对 DSH `0.2.2-rc.3` 开发，依赖 `conversation.input.dock` 槽位和 `todos` 投影；DSH 大版本升级后可能需要适配。
