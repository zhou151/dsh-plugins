/**
 * 浏览器半：把 agent 的 todo 清单固定在会话右上角，做成一张悬浮卡片。
 *
 * - 数据：`conversation.input.dock` 槽位（会话域）里读 `todos` 投影，
 *   这是 dsh-tool-todo / dsh-tool-todo-plus 写入的整表快照。
 * - 呈现：卡片通过 portal 挂到 body，`position: fixed` 贴右上角，
 *   因此不受 composer 裁剪；收起后是一条只显示当前任务的胶囊。
 * - 主题：全部颜色吃宿主 token，浅色白面 / 深色黑面自动跟随。
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-task-board',
  factory(require) {
    const React = require('react')
    const { createPortal } = require('react-dom')
    const { useEffect, useState } = React
    const h = React.createElement

    /** 本插件拥有的 locale 命名空间。 */
    const NS = 'taskBoard'

    /** 样式表 id：apply 时注入一次，插件卸载时移除。 */
    const STYLE_ID = 'dstb-task-board-styles'

    /** 收起状态在浏览器侧的持久化键。 */
    const COLLAPSED_KEY = 'dsh-task-board.collapsed'

    /** 读取上次的收起状态。 */
    function readCollapsed() {
      try {
        return window.localStorage.getItem(COLLAPSED_KEY) === '1'
      } catch {
        return false
      }
    }

    /** 写入收起状态。 */
    function writeCollapsed(value) {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0')
      } catch {
        /* 隐私模式下忽略 */
      }
    }

    /** 状态圆点：完成 = 实心勾，进行中 = 脉冲点，待办 = 空心圈。 */
    function StatusDot(props) {
      const status = props.status
      if (status === 'completed') {
        return h('span', { className: 'dstb-dot dstb-dot-done', 'aria-hidden': true },
          h('svg', { viewBox: '0 0 16 16' },
            h('path', {
              d: 'M3.6 8.4 6.5 11.3 12.4 4.9',
              fill: 'none', stroke: 'currentColor', strokeWidth: 2.1,
              strokeLinecap: 'round', strokeLinejoin: 'round',
            })))
      }
      if (status === 'in_progress') {
        return h('span', { className: 'dstb-dot dstb-dot-active', 'aria-hidden': true },
          h('span', { className: 'dstb-dot-core' }))
      }
      return h('span', { className: 'dstb-dot dstb-dot-pending', 'aria-hidden': true })
    }

    /**
     * 悬浮任务卡片；没有任务时不渲染任何东西。
     * @param {object} props - 会话标准 props + locale。
     * @returns {object|null} React 节点。
     */
    function TaskBoard(props) {
      const { t, useProjection } = props
      const todos = useProjection('todos')
      const list = Array.isArray(todos) ? todos : []
      const [collapsed, setCollapsed] = useState(readCollapsed)

      useEffect(() => {
        writeCollapsed(collapsed)
      }, [collapsed])

      useEffect(() => {
        if (collapsed) return undefined
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          setCollapsed(true)
        }
        document.addEventListener('keydown', onKeyDown, true)
        return () => document.removeEventListener('keydown', onKeyDown, true)
      }, [collapsed])

      if (list.length === 0) return null

      const done = list.filter(item => item.status === 'completed').length
      const total = list.length
      const active = list.find(item => item.status === 'in_progress')
      const next = list.find(item => item.status === 'pending')
      const headline = active ? active.content : next ? next.content : t('allDone')
      const percent = total === 0 ? 0 : Math.round((done / total) * 100)
      const summary = t('progress', { done, total })

      if (collapsed) {
        return createPortal(h('button', {
          type: 'button',
          className: 'dstb-pill',
          'aria-expanded': 'false',
          'aria-label': t('expand', { summary, task: headline }),
          title: t('expand', { summary, task: headline }),
          onClick: () => setCollapsed(false),
        },
        h('span', { className: 'dstb-pill-dot' + (active ? ' is-active' : '') , 'aria-hidden': true }),
        h('span', { className: 'dstb-pill-summary' }, summary),
        h('span', { className: 'dstb-pill-task' }, headline),
        h('span', { className: 'dstb-chevron', 'aria-hidden': true },
          h('svg', { viewBox: '0 0 16 16' },
            h('path', {
              d: 'M4 9.6 8 5.6 12 9.6',
              fill: 'none', stroke: 'currentColor', strokeWidth: 1.7,
              strokeLinecap: 'round', strokeLinejoin: 'round',
            })))), document.body)
      }

      return createPortal(h('section', {
        className: 'dstb-card',
        role: 'region',
        'aria-label': t('title'),
      },
      h('header', { className: 'dstb-head' },
        h('span', { className: 'dstb-title' }, t('title')),
        h('span', { className: 'dstb-count' }, summary),
        h('button', {
          type: 'button',
          className: 'dstb-toggle',
          'aria-expanded': 'true',
          'aria-label': t('collapse'),
          title: t('collapse'),
          onClick: () => setCollapsed(true),
        },
        h('span', { className: 'dstb-chevron', 'aria-hidden': true },
          h('svg', { viewBox: '0 0 16 16' },
            h('path', {
              d: 'M4 6.4 8 10.4 12 6.4',
              fill: 'none', stroke: 'currentColor', strokeWidth: 1.7,
              strokeLinecap: 'round', strokeLinejoin: 'round',
            }))))),
      h('div', { className: 'dstb-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': done, 'aria-label': summary },
        h('span', { className: 'dstb-bar-fill', style: { width: percent + '%' } })),
      h('ul', { className: 'dstb-list' }, list.map((item, index) => h('li', {
        key: index,
        className: 'dstb-item dstb-item-' + item.status,
      },
      h(StatusDot, { status: item.status }),
      h('span', { className: 'dstb-item-text' }, item.content))))), document.body)
    }

    /** 本插件的字典。 */
    const en = {
      title: 'Tasks',
      progress: '{done}/{total}',
      allDone: 'All tasks done',
      collapse: 'Collapse the task list',
      expand: '{summary} tasks. Current: {task}. Expand the task list.',
    }
    const zh = {
      title: '任务清单',
      progress: '{done}/{total}',
      allDone: '全部完成',
      collapse: '收起任务清单',
      expand: '{summary} 项任务，当前：{task}。展开任务清单。',
    }

    /**
     * 样式：卡片与胶囊只用宿主主题 token（浅色白面 / 深色黑面），
     * 状态色复用宿主的 business-primary 与 label 阶梯。
     */
    const CSS = [
      '.dstb-card{position:fixed;top:56px;right:12px;z-index:1200;box-sizing:border-box;width:288px;max-height:min(60vh,460px);display:flex;flex-direction:column;padding:10px 12px 8px;border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#16161a);box-shadow:0 0 0 1px var(--dsw-alias-border-l2,rgba(0,0,0,.1)),var(--dsw-elevation-prominent,0 4px 18px rgba(0,0,0,.2));overflow:hidden;animation:dstb-in .18s cubic-bezier(.2,.9,.3,1.15)}',
      '.dstb-head{display:flex;align-items:center;gap:8px;padding-bottom:8px}',
      '.dstb-title{font-size:12px;font-weight:650;letter-spacing:.01em}',
      '.dstb-count{flex:1 1 auto;text-align:right;font-size:11px;font-weight:600;color:var(--dsw-alias-label-tertiary,#6b6b76);font-variant-numeric:tabular-nums}',
      '.dstb-toggle{flex:0 0 auto;display:grid;place-items:center;width:20px;height:20px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary,#6b6b76);cursor:pointer;transition:background .15s ease,color .15s ease}',
      '.dstb-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06));color:var(--dsw-alias-label-primary,#16161a)}',
      '.dstb-toggle:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:1px}',
      '.dstb-chevron{display:inline-flex;width:14px;height:14px}',
      '.dstb-chevron svg{width:14px;height:14px}',
      '.dstb-bar{position:relative;flex:0 0 auto;height:3px;border-radius:2px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#111) 12%,transparent);overflow:hidden}',
      '.dstb-bar-fill{display:block;height:100%;border-radius:2px;background:var(--dsw-alias-state-business-primary,#4d6bfe);transition:width .3s ease}',
      '.dstb-list{flex:1 1 auto;min-height:0;margin:8px 0 0;padding:0 2px 0 0;list-style:none;overflow-y:auto;overscroll-behavior:contain}',
      '.dstb-item{display:flex;align-items:flex-start;gap:8px;padding:5px 2px;border-radius:6px;font-size:12px;line-height:17px}',
      '.dstb-dot{position:relative;flex:0 0 auto;display:grid;place-items:center;width:14px;height:14px;margin-top:2px;corner-shape:round}',
      '.dstb-dot-pending{width:12px;height:12px;margin:3px 1px 0;border-radius:50%;box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--dsw-alias-label-primary,#111) 28%,transparent);corner-shape:round}',
      '.dstb-dot-done{color:var(--dsw-alias-label-caption,#8a8a95)}',
      '.dstb-dot-done svg{width:14px;height:14px}',
      '.dstb-dot-active{border-radius:50%;background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 18%,transparent);corner-shape:round}',
      '.dstb-dot-core{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-business-primary,#4d6bfe);animation:dstb-pulse 1.6s ease-in-out infinite;corner-shape:round}',
      '.dstb-item-text{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}',
      '.dstb-item-pending .dstb-item-text{color:var(--dsw-alias-label-secondary,#5f6368)}',
      '.dstb-item-in_progress{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 8%,transparent)}',
      '.dstb-item-in_progress .dstb-item-text{color:var(--dsw-alias-label-primary,#16161a);font-weight:600}',
      '.dstb-item-completed .dstb-item-text{color:var(--dsw-alias-label-caption,#8a8a95);text-decoration:line-through}',
      '.dstb-pill{position:fixed;top:56px;right:12px;z-index:1200;box-sizing:border-box;display:inline-flex;align-items:center;gap:7px;height:30px;max-width:min(320px,calc(100vw - 24px));padding:0 10px;border:0;border-radius:10px;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-secondary,#5f6368);box-shadow:0 0 0 1px var(--dsw-alias-border-l2,rgba(0,0,0,.1)),var(--dsw-elevation-prominent,0 4px 18px rgba(0,0,0,.2));cursor:pointer;transition:box-shadow .18s ease,transform .15s ease}',
      '.dstb-pill:hover{transform:translateY(-1px)}',
      '.dstb-pill:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px}',
      '.dstb-pill-dot{flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-label-dimmed,#b8bcc4);corner-shape:round}',
      '.dstb-pill-dot.is-active{background:var(--dsw-alias-state-business-primary,#4d6bfe);animation:dstb-pulse 1.6s ease-in-out infinite}',
      '.dstb-pill-summary{flex:0 0 auto;font-size:11px;font-weight:650;color:var(--dsw-alias-label-primary,#16161a);font-variant-numeric:tabular-nums}',
      '.dstb-pill-task{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--dsw-alias-label-tertiary,#6b6b76)}',
      '@keyframes dstb-in{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}',
      '@keyframes dstb-pulse{0%,100%{opacity:.45;transform:scale(.82)}50%{opacity:1;transform:scale(1.1)}}',
      '@media (prefers-reduced-motion:reduce){.dstb-card,.dstb-dot-core,.dstb-pill-dot,.dstb-bar-fill{animation:none!important;transition:none!important}}',
    ].join('\n')

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'task-board: dictionaries')

        ctx.effect(() => {
          if (document.getElementById(STYLE_ID)) return () => {}
          const style = document.createElement('style')
          style.id = STYLE_ID
          style.textContent = CSS
          document.head.appendChild(style)
          return () => { style.remove() }
        }, 'task-board: styles')

        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock',
          id: 'task-board',
          order: 20,
          locale: NS,
        }, TaskBoard))
      },
    }
  },
})
