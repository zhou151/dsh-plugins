# DSH 插件集合

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）用的自研插件仓库，**一个插件一个目录**，放在 `plugins/` 下。每个目录都是一个可直接安装的 DSH 插件包（自包含、无 npm 依赖）。

## 插件列表

| 插件 | 作用 | 安装目录 |
| --- | --- | --- |
| [推理强度彩虹控件](plugins/reasoning-effort-rainbow/README.md) | 在 composer 模型选择器左侧独立控制推理强度，收起态只显示当前档位，悬浮展开无级滑动变阻器 | `plugins/reasoning-effort-rainbow` |
| [悬浮任务清单](plugins/task-board/README.md) | 把 agent 的 todo 清单固定在会话右上角，悬浮卡片 / 收起胶囊，跟随黑白主题 | `plugins/task-board` |

## 安装某个插件

克隆仓库后，在 DSH 里二选一：

1. **图形界面**：Plugins（插件）→ Add plugin（添加插件）→ 选择本地目录 → 选中 `plugins/<插件名>`（注意是插件子目录，不是仓库根目录）。
2. **让 agent 装**：告诉 DSH 里的 agent「把 `<仓库路径>/plugins/<插件名>` 装成插件」。

安装后刷新页面（⌘R）生效。

- 安装会在该机器的 profile 里写入一条 `link:/绝对路径`，所以**每台机器只需装一次**，不能靠拷贝 profile 目录搬家。
- 更新：`git pull` 后刷新页面即可；插件是链接安装，代码直接读仓库目录，不用重装。

## 新增插件约定

```
plugins/
└── <插件名>/
    ├── package.json        # 包名唯一；dsh.bundle.patch + dsh.client 必须写全
    ├── cordis.patch.yml    # 插入行的 id 必须唯一，name 与包名一致
    ├── index.js            # Host 半（可以 export function apply() {}）
    ├── client.js           # 浏览器半：window.__ModuleLoader__.load({ id: '<包名>', factory })
    ├── locale/en.json      # 插件页标题/描述（meta.title / meta.description）
    ├── locale/zh.json
    ├── icon.svg            # 插件页图标，36×36 viewBox
    ├── docs/               # 可选：详情页图片 + DETAIL.md
    └── README.md           # 用法、截图、限制
```

要点：

- 包名用 `@local/<插件名>` 之类不会与官方冲突的前缀；`client.js` 里的 loader id 必须与包名完全一致。
- 插槽（slot）、CSS 类名、`data-*` 属性都加自己的前缀，避免和宿主或别的插件撞车。
- 样式优先吃宿主主题 token（`--dsw-alias-*`），这样浅色/深色自动跟随；注意宿主给所有元素加了 `corner-shape: superellipse(1.5)`，正圆要显式写 `corner-shape: round`。
- 不 import 宿主的 Client 包（如 `dsh-client-ui-primitives`），控件自己写。
- 提交前至少跑 `node --check client.js`，并确认 `package.json` / locale JSON / SVG 都能解析。

## 兼容性

这些插件针对 DSH `0.2.2-rc.3` 开发，依赖的插槽与服务接口（如 `conversation.input.right`、`ctx.modelDirectories`）在 DSH 大版本升级后可能变化，届时需要跟着适配。
