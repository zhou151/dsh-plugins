/**
 * 浏览器半：composer 工具行里、模型选择器正左侧的「推理强度」控件。
 *
 * - 收起态：一根彩虹弧线 icon + 当前档位文案（如「低」）。
 * - 悬浮 / 聚焦：在控件上方浮出更大的滑动变阻器（刻度 + 彩虹填充 + 大旋钮），
 *   拖动吸附到最近档位，松手提交；方向键也能切档。
 * - 四档动效差异做大：关闭=灰、低=慢呼吸、高=流动+光环、最大=高速+轨道粒子。
 * - 档位来自当前模型公布给 Host 的 reasoning 元数据；提交走 ui-model-selection
 *   的会话级 ModelDirectory（`session.selectModel`），与模型菜单共享同一份状态。
 * - 控件本体只用宿主主题 token：浅色白面、深色黑面；彩虹只做强调。
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-reasoning-effort-rainbow',
  factory(require) {
    const React = require('react')
    const { createPortal } = require('react-dom')
    const { useCallback, useEffect, useLayoutEffect, useRef, useState } = React
    const h = React.createElement

    /** 本插件拥有的 locale 命名空间。 */
    const NS = 'reasoningEffort'

    /** 样式表 id：apply 时注入一次，插件卸载时移除。 */
    const STYLE_ID = 'dshre-reasoning-effort-styles'

    /** pi-ai 的档位升级顺序；用来把任意档位折成 0~3 四档动效强度。 */
    const LEVEL_ORDER = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']

    /**
     * 把任意档位 id 折进 0~3 四档动效。
     * @param {string} id - 适配器公布的档位 id。
     * @param {number} index - 目录里的顺序，作为未知 id 的兜底。
     * @returns {0|1|2|3} 分档。
     */
    function bucketOf(id, index) {
      const known = LEVEL_ORDER.indexOf(id)
      const position = known === -1 ? index : known
      if (position <= 0) return 0
      if (position <= 2) return 1
      if (position <= 4) return 2
      return 3
    }

    /**
     * 取本地化档位短名，字典缺该 id 时回落到适配器名称。
     * @param {Function} t - 本命名空间的翻译函数。
     * @param {string} id - 档位 id。
     * @param {string} fallback - 适配器名称。
     * @returns {string} 展示用短名。
     */
    function levelLabel(t, id, fallback) {
      const key = 'level.' + id
      const text = t(key)
      if (typeof text !== 'string' || text === key || text.slice(-key.length) === key) return fallback
      return text
    }

    /**
     * 把会话目录 + 当前模型推导成控件需要的只读快照；值不变时保持同一引用，
     * 供 slot 的 hooks 通道直接当 observable 用。
     * @param {object} directory - ui-model-selection 的会话级 ModelDirectory。
     * @returns {{ getSnapshot: Function, subscribe: Function }} 裸 observable。
     */
    function createEffortView(directory) {
      let cached = null
      let signature = null
      const listeners = new Set()
      let detach = null

      const compute = () => {
        let snapshot
        try {
          snapshot = directory.store.getSnapshot()
        } catch {
          snapshot = null
        }
        const current = snapshot && snapshot.current ? snapshot.current : null
        const groups = snapshot && Array.isArray(snapshot.groups) ? snapshot.groups : []
        let model = null
        if (current) {
          for (const group of groups) {
            if (group.id !== current.provider) continue
            for (const candidate of group.models) {
              if (candidate.id !== current.model) continue
              model = candidate
              break
            }
            break
          }
        }
        const reasoning = model && model.reasoning ? model.reasoning : null
        const efforts = reasoning && Array.isArray(reasoning.efforts) ? reasoning.efforts : []
        const followsDefault = current !== null && current.reasoningEffort === undefined
        const effort = current === null
          ? undefined
          : current.reasoningEffort !== undefined
            ? current.reasoningEffort
            : reasoning
              ? reasoning.defaultEffort
              : undefined
        const defaultEffort = reasoning && reasoning.defaultEffort !== undefined ? reasoning.defaultEffort : null
        const key = JSON.stringify([
          current ? current.provider : null,
          current ? current.model : null,
          current && current.reasoningEffort !== undefined ? current.reasoningEffort : null,
          effort === undefined ? null : effort,
          model ? model.name : null,
          efforts.map(level => level.id + ':' + level.name),
          snapshot ? snapshot.status : null,
          defaultEffort,
        ])
        if (key !== signature) {
          signature = key
          cached = {
            available: efforts.length > 0 && current !== null,
            provider: current ? current.provider : null,
            model: current ? current.model : null,
            modelName: model ? model.name : '',
            effort: effort === undefined ? null : effort,
            defaultEffort,
            followsDefault,
            efforts,
            status: snapshot ? snapshot.status : 'idle',
          }
        }
        return cached
      }

      const getSnapshot = () => cached === null ? compute() : cached

      const subscribe = (listener) => {
        listeners.add(listener)
        if (detach === null) {
          compute()
          try {
            detach = directory.store.subscribe(() => {
              const previous = cached
              const next = compute()
              if (previous === next) return
              for (const fn of Array.from(listeners)) fn()
            })
          } catch {
            detach = null
          }
        }
        return () => {
          listeners.delete(listener)
          if (listeners.size === 0 && detach !== null) {
            detach()
            detach = null
          }
        }
      }

      return { getSnapshot, subscribe }
    }

    /** 不可用会话的空视图（地址化 subagent 等）。 */
    const EMPTY_STATE = Object.freeze({
      available: false, provider: null, model: null, modelName: '',
      effort: null, defaultEffort: null, followsDefault: true, efforts: [], status: 'idle',
    })
    const EMPTY_VIEW = {
      getSnapshot: () => EMPTY_STATE,
      subscribe: () => () => {},
    }

    /** 彩虹小弧线 icon。 */
    function RainbowArc() {
      return h('svg', { className: 'dshre-arc', viewBox: '0 0 24 16', 'aria-hidden': true },
        h('g', { fill: 'none', strokeWidth: 2.4, strokeLinecap: 'round' },
          h('path', { d: 'M2.4 13.6A9.6 9.6 0 0 1 21.6 13.6', stroke: 'var(--dshre-arc-1,#ff5f7e)' }),
          h('path', { d: 'M5.6 13.6A6.4 6.4 0 0 1 18.4 13.6', stroke: 'var(--dshre-arc-2,#ffb45f)' }),
          h('path', { d: 'M8.8 13.6A3.2 3.2 0 0 1 15.2 13.6', stroke: 'var(--dshre-arc-3,#6ee7a8)' })))
    }

    /**
     * 收起胶囊 + 悬浮滑动变阻器。
     * @param {object} props - 标准会话 props + 注入面 + locale。
     * @returns {object|null} React 节点。
     */
    function EffortControl(props) {
      const { t, available, select, useEffort } = props
      const state = useEffort(snapshot => snapshot)

      const [hoverChip, setHoverChip] = useState(false)
      const [hoverPanel, setHoverPanel] = useState(false)
      const [forcedOpen, setForcedOpen] = useState(false)
      const [dragging, setDragging] = useState(false)
      const [dragRatio, setDragRatio] = useState(null)
      const [pendingId, setPendingId] = useState(null)
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(null)
      const [burst, setBurst] = useState(0)
      const [pos, setPos] = useState(null)

      const chipRef = useRef(null)
      const trackRef = useRef(null)
      const panelRef = useRef(null)
      const mountedRef = useRef(true)
      const draggingRef = useRef(false)
      const dragRatioRef = useRef(null)
      const movedRef = useRef(false)
      const closeTimer = useRef(null)
      const openTimer = useRef(null)
      const errorTimer = useRef(null)
      const pointerFocusRef = useRef(false)

      useEffect(() => {
        mountedRef.current = true
        return () => {
          mountedRef.current = false
          if (closeTimer.current !== null) clearTimeout(closeTimer.current)
          if (openTimer.current !== null) clearTimeout(openTimer.current)
          if (errorTimer.current !== null) clearTimeout(errorTimer.current)
        }
      }, [])

      const options = state && state.available
        ? state.efforts.map((level, index) => ({
          id: level.id,
          label: levelLabel(t, level.id, level.name || level.id),
          name: level.name || level.id,
          bucket: bucketOf(level.id, index),
        }))
        : []
      const lastIndex = options.length - 1
      const currentIndex = options.findIndex(option => option.id === state.effort)
      const pendingIndex = pendingId === null ? -1 : options.findIndex(option => option.id === pendingId)
      const dragNearest = dragRatio === null || lastIndex <= 0 ? -1 : Math.round(dragRatio * lastIndex)
      const displayIndex = dragNearest !== -1
        ? dragNearest
        : pendingIndex !== -1
          ? pendingIndex
          : currentIndex
      const ratio = dragRatio !== null
        ? dragRatio
        : lastIndex > 0
          ? Math.max(0, Math.min(1, (displayIndex < 0 ? 0 : displayIndex) / lastIndex))
          : 0
      const active = displayIndex >= 0 ? options[displayIndex] : undefined
      const bucket = active ? active.bucket : 0
      const label = active ? active.label : t('level.default')
      const panelLabel = active ? active.name : t('level.default')
      const expanded = hoverChip || hoverPanel || forcedOpen || dragging || busy

      const clearCloseTimer = useCallback(() => {
        if (closeTimer.current !== null) {
          clearTimeout(closeTimer.current)
          closeTimer.current = null
        }
        if (openTimer.current !== null) {
          clearTimeout(openTimer.current)
          openTimer.current = null
        }
      }, [])

      const openChip = useCallback(() => {
        clearCloseTimer()
        openTimer.current = setTimeout(() => {
          openTimer.current = null
          if (mountedRef.current) setHoverChip(true)
        }, 90)
      }, [clearCloseTimer])

      const scheduleClose = useCallback(() => {
        clearCloseTimer()
        closeTimer.current = setTimeout(() => {
          closeTimer.current = null
          if (!mountedRef.current) return
          setHoverChip(false)
          setHoverPanel(false)
        }, 260)
      }, [clearCloseTimer])

      const showError = useCallback((message) => {
        setError(message)
        if (errorTimer.current !== null) clearTimeout(errorTimer.current)
        errorTimer.current = setTimeout(() => {
          if (mountedRef.current) setError(null)
        }, 6000)
      }, [])

      // 宿主投影追上来（或失败）后收掉乐观值，避免旋钮来回跳。
      useEffect(() => {
        if (pendingId === null) return undefined
        if (state && state.available && !state.followsDefault && state.effort === pendingId) {
          setPendingId(null)
          return undefined
        }
        const timer = setTimeout(() => {
          if (mountedRef.current) setPendingId(null)
        }, 4000)
        return () => clearTimeout(timer)
      }, [pendingId, state])

      const commit = useCallback((index) => {
        const option = options[index]
        if (!option || busy || !state || !state.available) return
        if (!state.followsDefault && state.effort === option.id) return
        setBusy(true)
        setError(null)
        setPendingId(option.id)
        Promise.resolve(select(option.id)).then((result) => {
          if (!mountedRef.current) return
          setBusy(false)
          if (result && result.ok === false) {
            setPendingId(null)
            showError(result.message || t('error.failed'))
            return
          }
          setBurst(value => value + 1)
        }, (reason) => {
          if (!mountedRef.current) return
          setBusy(false)
          setPendingId(null)
          showError(reason && reason.message ? reason.message : String(reason))
        })
      }, [busy, options, select, showError, state, t])

      const ratioFromPointer = useCallback((clientX) => {
        const track = trackRef.current
        if (!track) return 0
        const rect = track.getBoundingClientRect()
        if (rect.width <= 0) return 0
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      }, [])

      const snapRatio = useCallback((value) => {
        if (lastIndex <= 0) return 0
        return Math.round(value * lastIndex) / lastIndex
      }, [lastIndex])

      const onTrackPointerDown = useCallback((event) => {
        if (busy || lastIndex < 0) return
        if (typeof event.button === 'number' && event.button !== 0) return
        event.preventDefault()
        clearCloseTimer()
        try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* 无指针捕获也能拖 */ }
        const at = ratioFromPointer(event.clientX)
        draggingRef.current = true
        movedRef.current = false
        dragRatioRef.current = at
        setDragging(true)
        setDragRatio(at)
      }, [busy, clearCloseTimer, ratioFromPointer])

      const onTrackPointerMove = useCallback((event) => {
        if (!draggingRef.current) return
        movedRef.current = true
        const at = ratioFromPointer(event.clientX)
        dragRatioRef.current = at
        setDragRatio(at)
      }, [ratioFromPointer])

      const onTrackPointerUp = useCallback((event) => {
        if (!draggingRef.current) return
        const at = movedRef.current ? ratioFromPointer(event.clientX) : dragRatioRef.current
        const snapped = snapRatio(at === null || at === undefined ? 0 : at)
        const index = Math.round(snapped * Math.max(0, lastIndex))
        draggingRef.current = false
        dragRatioRef.current = null
        movedRef.current = false
        setDragging(false)
        setDragRatio(null)
        try { event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* 已释放 */ }
        const under = typeof document.elementFromPoint === 'function'
          ? document.elementFromPoint(event.clientX, event.clientY)
          : null
        const inside = under && typeof under.closest === 'function'
          ? Boolean(under.closest('.dshre-chip') || under.closest('.dshre-panel'))
          : false
        if (!inside) {
          setHoverChip(false)
          setHoverPanel(false)
          setForcedOpen(false)
        }
        commit(index)
      }, [commit, lastIndex, ratioFromPointer, snapRatio])

      const onTrackPointerCancel = useCallback(() => {
        draggingRef.current = false
        dragRatioRef.current = null
        movedRef.current = false
        setDragging(false)
        setDragRatio(null)
      }, [])

      const onKeyDown = useCallback((event) => {
        if (lastIndex < 0) return
        const from = displayIndex >= 0 ? displayIndex : 0
        let next = from
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(lastIndex, from + 1)
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(0, from - 1)
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = lastIndex
        else if (event.key === 'Escape') {
          setForcedOpen(false)
          setHoverChip(false)
          setHoverPanel(false)
          if (chipRef.current && chipRef.current.blur) chipRef.current.blur()
          return
        } else return
        event.preventDefault()
        setForcedOpen(true)
        if (next !== from) commit(next)
      }, [commit, displayIndex, lastIndex])

      // 面板展开期间，点到胶囊与面板之外就收起（含触屏点一下后固定展开的情况）。
      useEffect(() => {
        if (!expanded) return undefined
        const onPointerDown = (event) => {
          const target = event.target
          if (chipRef.current && chipRef.current.contains(target)) return
          if (panelRef.current && panelRef.current.contains(target)) return
          setForcedOpen(false)
          setHoverChip(false)
          setHoverPanel(false)
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        return () => document.removeEventListener('pointerdown', onPointerDown, true)
      }, [expanded])

      // 面板贴着胶囊上方浮出；上方放不下就翻到下方。
      useLayoutEffect(() => {
        if (!expanded) {
          setPos(null)
          return undefined
        }
        const place = () => {
          const chip = chipRef.current
          const panel = panelRef.current
          if (!chip) return
          const rect = chip.getBoundingClientRect()
          const margin = 12
          const width = Math.min(304, window.innerWidth - margin * 2)
          const height = panel ? panel.offsetHeight : 0
          let left = rect.left + rect.width / 2 - width / 2
          left = Math.max(margin, Math.min(left, window.innerWidth - margin - width))
          let top = rect.top - 14 - height
          let below = false
          if (top < margin) {
            top = rect.bottom + 14
            below = true
          }
          top = Math.max(margin, Math.min(top, window.innerHeight - margin - height))
          setPos({ left, top, width, below })
        }
        place()
        const frame = requestAnimationFrame(place)
        const observed = panelRef.current
        const observer = typeof ResizeObserver === 'function' && observed !== null
          ? new ResizeObserver(place)
          : null
        if (observer !== null && observed !== null) observer.observe(observed)
        window.addEventListener('resize', place)
        window.addEventListener('scroll', place, true)
        return () => {
          cancelAnimationFrame(frame)
          if (observer !== null) observer.disconnect()
          window.removeEventListener('resize', place)
          window.removeEventListener('scroll', place, true)
        }
      }, [expanded])

      if (!available || !state || !state.available) return null

      const ticks = options.map((option, index) => h('span', {
        key: option.id,
        className: 'dshre-tick' + (index <= displayIndex ? ' is-lit' : ''),
      }))

      const dense = options.length > 4
      const scale = options.map((option, index) => h('span', {
        key: option.id,
        className: 'dshre-scale-label'
          + (index === displayIndex ? ' is-active' : '')
          + ' dshre-lv-' + option.bucket,
        style: { left: (lastIndex > 0 ? (index / lastIndex) * 100 : 0) + '%' },
      }, option.name))

      const chip = h('span', {
        ref: chipRef,
        className: 'dshre-chip dshre-lv-' + bucket + (expanded ? ' is-open' : '') + (busy ? ' is-busy' : '') + (error !== null ? ' is-error' : ''),
        role: 'slider',
        tabIndex: 0,
        'aria-label': t('slider.aria'),
        'aria-orientation': 'horizontal',
        'aria-valuemin': 0,
        'aria-valuemax': Math.max(0, lastIndex),
        'aria-valuenow': Math.max(0, displayIndex),
        'aria-valuetext': label,
        'aria-busy': busy ? 'true' : undefined,
        title: t('trigger.title', { effort: label }),
        onPointerEnter: openChip,
        onPointerLeave: () => {
          if (forcedOpen || draggingRef.current) return
          scheduleClose()
        },
        onPointerDown: (event) => {
          pointerFocusRef.current = true
          if (event.pointerType !== 'mouse') setForcedOpen(true)
        },
        onFocus: () => {
          if (!pointerFocusRef.current) setForcedOpen(true)
        },
        onBlur: () => {
          pointerFocusRef.current = false
          setForcedOpen(false)
        },
        onKeyDown,
      },
      h('span', { className: 'dshre-icon', 'aria-hidden': true }, h(RainbowArc, null)),
      h('span', { className: 'dshre-label-text' }, label))

      const panel = expanded
        ? createPortal(h('div', {
          ref: panelRef,
          className: 'dshre-panel dshre-lv-' + bucket
            + (pos && pos.below ? ' is-below' : '')
            + (dragging ? ' is-dragging' : '')
            + (busy ? ' is-busy' : ''),
          role: 'group',
          'aria-label': t('panel.title'),
          style: pos
            ? { left: pos.left + 'px', top: pos.top + 'px', width: pos.width + 'px', visibility: 'visible' }
            : { left: '0px', top: '0px', width: '304px', visibility: 'hidden' },
          onPointerEnter: () => {
            clearCloseTimer()
            setHoverPanel(true)
          },
          onPointerLeave: () => {
            if (draggingRef.current) return
            setHoverPanel(false)
            scheduleClose()
          },
        },
        h('div', { className: 'dshre-head' },
          h('span', { className: 'dshre-head-row' },
            h('span', { className: 'dshre-head-title' }, t('panel.title')),
            h('span', { className: 'dshre-head-level' }, panelLabel),
            state.followsDefault
              ? h('span', { className: 'dshre-head-hint', title: t('hint.default') }, t('hint.defaultShort'))
              : null),
          state.modelName
            ? h('span', { className: 'dshre-head-model', title: state.modelName }, state.modelName)
            : null),
        h('div', {
          ref: trackRef,
          className: 'dshre-track',
          onPointerDown: onTrackPointerDown,
          onPointerMove: onTrackPointerMove,
          onPointerUp: onTrackPointerUp,
          onPointerCancel: onTrackPointerCancel,
          onLostPointerCapture: onTrackPointerCancel,
        },
        h('span', { className: 'dshre-groove' }),
        h('span', { className: 'dshre-fill', style: { width: (ratio * 100) + '%' } },
          h('span', { className: 'dshre-flow' })),
        h('span', { className: 'dshre-ticks', 'aria-hidden': true }, ticks),
        h('span', { className: 'dshre-glow', 'aria-hidden': true, style: { left: (ratio * 100) + '%' } }),
        h('span', { className: 'dshre-knob', 'aria-hidden': true, style: { left: (ratio * 100) + '%' } },
          h('span', { className: 'dshre-knob-ring' }),
          h('span', { className: 'dshre-knob-core' })),
        burst > 0
          ? h('span', {
            key: 'burst-' + burst,
            className: 'dshre-burst',
            'aria-hidden': true,
            style: { left: (ratio * 100) + '%' },
          })
          : null),
        h('div', { className: 'dshre-scale' + (dense ? ' is-dense' : ''), 'aria-hidden': true }, scale),
        h('div', { className: 'dshre-foot' },
          h('span', { className: 'dshre-foot-error', role: 'status', 'aria-live': 'polite' }, error === null ? '' : error),
          h('span', { className: 'dshre-foot-hint' }, error !== null ? '' : busy ? t('panel.saving') : t('panel.hint')))), document.body)
        : null

      return h('span', { className: 'dshre-host' }, chip, panel)
    }

    /** 本插件的字典。 */
    const en = {
      'trigger.title': 'Reasoning effort: {effort}. Hover for the slider; arrow keys also switch.',
      'slider.aria': 'Reasoning effort',
      'panel.title': 'Reasoning effort',
      'panel.hint': 'Drag the knob and release to apply',
      'panel.saving': 'Switching…',
      'hint.default': 'Following the model default',
      'hint.defaultShort': 'default',
      'level.off': 'Off',
      'level.minimal': 'Minimal',
      'level.low': 'Low',
      'level.medium': 'Medium',
      'level.high': 'High',
      'level.xhigh': 'X-high',
      'level.max': 'Max',
      'level.default': 'Default',
      'error.failed': 'Could not switch reasoning effort',
    }
    const zh = {
      'trigger.title': '推理强度：{effort}。悬浮展开滑动变阻器，方向键也可切换。',
      'slider.aria': '推理强度',
      'panel.title': '推理强度',
      'panel.hint': '拖动旋钮，松手生效',
      'panel.saving': '切换中…',
      'hint.default': '当前跟随模型默认档位',
      'hint.defaultShort': '默认',
      'level.off': '关闭',
      'level.minimal': '极小',
      'level.low': '低',
      'level.medium': '中',
      'level.high': '高',
      'level.xhigh': '很高',
      'level.max': '最大',
      'level.default': '默认',
      'error.failed': '切换推理强度失败',
    }

    /**
     * 样式：控件与面板本体只用宿主主题 token（浅色白面 / 深色黑面），
     * 彩虹只出现在 icon、当前档位文字、轨道填充、旋钮环、光晕与粒子上。
     */
    const CSS = [
      '.dshre-host{display:inline-flex;align-items:center;flex:0 0 auto}',
      /* —— 收起态胶囊 —— */
      '.dshre-chip{position:relative;display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:10px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-secondary,#5f6368);box-shadow:0 0 0 1px var(--dsw-alias-border-l1,rgba(0,0,0,.04)),0 1px 2px rgba(16,18,24,.06);cursor:pointer;user-select:none;-webkit-user-select:none;white-space:nowrap;transition:box-shadow .22s ease,transform .18s cubic-bezier(.2,.8,.3,1.4)}',
      '.dshre-chip.is-open{box-shadow:0 0 0 1px var(--dsw-alias-border-l2,rgba(0,0,0,.1)),0 4px 14px -6px rgba(16,18,24,.4)}',
      '.dshre-chip:focus-visible{outline:none;box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-1,#fff),0 0 0 4px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 70%,transparent)}',
      '.dshre-chip.is-busy{cursor:progress}',
      '.dshre-chip.is-error{box-shadow:0 0 0 1.5px var(--dsw-alias-state-error-primary,#e5484d),0 2px 10px -4px rgba(229,72,77,.5);animation:dshre-shake .42s cubic-bezier(.36,.07,.19,.97) 1}',
      '.dshre-icon{position:relative;flex:0 0 auto;display:grid;place-items:center;width:20px;height:18px}',
      '.dshre-arc{position:relative;z-index:1;width:20px;height:13.5px;overflow:visible}',
      '.dshre-label-text{min-width:1em;font-size:10px;line-height:13px;font-weight:600;letter-spacing:.01em;color:var(--dsw-alias-label-secondary,#5f6368);-webkit-font-smoothing:antialiased;transition:color .2s ease}',
      '.dshre-chip:hover .dshre-label-text,.dshre-chip.is-open .dshre-label-text{color:var(--dsw-alias-label-primary,#16161a)}',
      /* —— 悬浮面板 —— */
      '.dshre-panel::before{content:"";position:absolute;left:0;right:0;bottom:-14px;height:14px}',
      '.dshre-panel.is-below::before{bottom:auto;top:-14px}',
      '.dshre-panel{position:fixed;z-index:1300;box-sizing:border-box;padding:24px;border-radius:16px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#16161a);box-shadow:0 0 0 1px var(--dsw-alias-border-l2,rgba(0,0,0,.1)),0 22px 54px -18px rgba(12,14,20,.5);animation:dshre-panel-in .22s cubic-bezier(.2,.9,.3,1.25);touch-action:none}',
      '.dshre-head{display:flex;flex-direction:column;gap:3px;padding:0 0 10px}',
      '.dshre-head-row{display:flex;align-items:center;gap:7px;min-width:0}',
      '.dshre-head-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-tertiary,#6b6b76)}',
      '.dshre-head-level{position:relative;display:inline-flex;align-items:center;gap:5px;font-size:15px;font-weight:750;line-height:1;color:var(--dsw-alias-label-primary,#16161a)}',
      '.dshre-head-level::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--dshre-ring-grad,conic-gradient(from 0deg,#ff5f7e,#ffb45f,#ffe066,#6ee7a8,#5ec8ff,#a78bfa,#ff5f7e));animation:dshre-rotate var(--dshre-ring,12s) linear infinite;corner-shape:round}',
      '.dshre-head-hint{font-size:9.5px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-caption,#8a8a95);border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.1));border-radius:5px;padding:1px 4px}',
      '.dshre-head-model{font-size:11px;line-height:14px;color:var(--dsw-alias-label-caption,#8a8a95);white-space:normal;overflow-wrap:anywhere}',
      '.dshre-track{position:relative;height:34px;margin:2px 0 0;cursor:pointer}',
      '.dshre-groove{position:absolute;left:0;right:0;top:50%;height:10px;margin-top:-5px;border-radius:5px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#111) 15%,transparent);corner-shape:round}',
      '.dshre-fill{position:absolute;left:0;top:50%;height:10px;margin-top:-5px;border-radius:5px;overflow:hidden;background:var(--dshre-fill-grad,linear-gradient(90deg,#ff5f7e,#ffb45f 22%,#ffe066 40%,#6ee7a8 60%,#5ec8ff 80%,#a78bfa));transition:width .34s cubic-bezier(.34,1.4,.5,1);corner-shape:round}',
      '.dshre-flow{position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.95),transparent);transform:translateX(-100%);opacity:.55}',
      '.dshre-ticks{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;pointer-events:none}',
      '.dshre-tick{display:block;width:2px;height:14px;border-radius:1px;background:color-mix(in srgb,var(--dsw-alias-label-primary,#111) 26%,transparent);transition:background .2s ease}',
      '.dshre-tick.is-lit{background:rgba(255,255,255,.95)}',
      '.dshre-glow{position:absolute;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:var(--dshre-glow-bg,var(--dshre-level,#a78bfa));filter:blur(10px);opacity:0;transition:opacity .25s ease;pointer-events:none;corner-shape:round}',
      '.dshre-knob{position:absolute;top:50%;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:var(--dsw-alias-bg-layer-1,#fff);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-label-primary,#111) 14%,transparent),0 1px 5px rgba(16,18,24,.32);transition:left .34s cubic-bezier(.34,1.4,.5,1),transform .16s ease;pointer-events:none;corner-shape:round}',
      '.dshre-knob-ring{position:absolute;inset:0;border-radius:50%;padding:2.2px;background:var(--dshre-ring-grad,conic-gradient(from 0deg,#ff5f7e,#ffb45f,#ffe066,#6ee7a8,#5ec8ff,#a78bfa,#ff5f7e));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude;animation:dshre-rotate var(--dshre-ring,12s) linear infinite;corner-shape:round}',
      '.dshre-knob-core{position:absolute;left:50%;top:50%;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%;background:var(--dshre-core-bg,var(--dshre-level,#8a8a95));opacity:.55;transition:opacity .2s ease,transform .2s ease;corner-shape:round}',
      '.dshre-burst{position:absolute;top:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:2px solid var(--dshre-level,#a78bfa);opacity:0;pointer-events:none;animation:dshre-burst .66s cubic-bezier(.2,.7,.3,1);corner-shape:round}',
      '.dshre-scale{position:relative;height:16px;margin:4px 0 0}',
      '.dshre-scale-label{position:absolute;top:0;transform:translateX(-50%);font-size:10.5px;line-height:14px;font-weight:600;white-space:nowrap;color:var(--dsw-alias-label-caption,#8a8a95);transition:color .2s ease}',
      '.dshre-scale.is-dense .dshre-scale-label{font-size:9px;letter-spacing:0}',
      '.dshre-scale-label:first-child{transform:none}',
      '.dshre-scale-label:last-child{transform:translateX(-100%)}',
      '.dshre-scale-label.is-active{color:color-mix(in srgb,var(--dshre-level,#4d6bfe) 68%,var(--dsw-alias-label-primary,#16161a));font-weight:750}',
      '.dshre-foot{margin-top:6px}',
      '.dshre-foot-hint{font-size:10px;color:var(--dsw-alias-label-caption,#8a8a95)}',
      '.dshre-foot-error{display:block;font-size:10.5px;line-height:15px;color:var(--dsw-alias-state-error-primary,#e5484d)}',
      /* —— 四档动效：档位差异要一眼可辨 —— */
      '.dshre-lv-0{--dshre-shift:60s;--dshre-ring:60s;--dshre-grad:linear-gradient(90deg,#8a8a95,#8a8a95);--dshre-level:#8b9099;--dshre-level-text:#6f7680;--dshre-arc-1:#8a8f97;--dshre-arc-2:#a2a7ae;--dshre-arc-3:#b9bdc3;--dshre-fill-grad:linear-gradient(90deg,#8b9099,#a8adb5);--dshre-ring-grad:conic-gradient(from 0deg,#8b9099,#c8ccd2,#8b9099)}',
      '.dshre-lv-0 .dshre-arc{opacity:.85}',
      '.dshre-lv-0 .dshre-fill{opacity:.75}',
      '.dshre-lv-0 .dshre-knob-core{opacity:.25}',
      '.dshre-lv-1{--dshre-shift:9s;--dshre-ring:16s;--dshre-grad:linear-gradient(90deg,#6ee7a8,#5ec8ff 60%,#a78bfa);--dshre-level:#5e98d9;--dshre-level-text:#2f6fb5;--dshre-arc-1:#5e98d9;--dshre-arc-2:#3aa6c4;--dshre-arc-3:#2f6fb5;--dshre-fill-grad:linear-gradient(90deg,#4a86c8,#5e98d9 55%,#8fc3f0);--dshre-ring-grad:conic-gradient(from 0deg,#4a86c8,#8fc3f0,#4a86c8)}',
      '.dshre-lv-1 .dshre-flow{animation:dshre-sweep 9s ease-in-out infinite}',
      '.dshre-lv-1 .dshre-glow{opacity:.18;animation:dshre-breathe 4.6s ease-in-out infinite}',
      '.dshre-lv-1 .dshre-knob-core{animation:dshre-breathe 3.6s ease-in-out infinite}',
      '.dshre-lv-2{--dshre-shift:3.6s;--dshre-ring:5s;--dshre-grad:linear-gradient(90deg,#ff5f7e,#ffb45f 22%,#ffe066 40%,#6ee7a8 60%,#5ec8ff 80%,#a78bfa);--dshre-level:#8847ff;--dshre-level-text:#7a3be0;--dshre-arc-1:#8847ff;--dshre-arc-2:#c04bd6;--dshre-arc-3:#6d28d9;--dshre-fill-grad:linear-gradient(90deg,#6d28d9,#8847ff 55%,#b57bff);--dshre-ring-grad:conic-gradient(from 0deg,#6d28d9,#b57bff,#6d28d9)}',
      '.dshre-lv-2 .dshre-flow{animation:dshre-sweep 2.6s ease-in-out infinite}',
      '.dshre-lv-2 .dshre-glow{opacity:.4;animation:dshre-halo 2.6s ease-in-out infinite}',
      '.dshre-lv-2 .dshre-knob-core{opacity:.85;animation:dshre-breathe 1.9s ease-in-out infinite}',
      '.dshre-lv-3{--dshre-shift:1.5s;--dshre-ring:1.9s;--dshre-grad:linear-gradient(90deg,#ff2d6f,#ff8a3d 24%,#ffe066 44%,#a78bfa 74%,#ff2d6f);--dshre-level:#a78bfa;--dshre-level-text:#7c3aed;--dshre-arc-1:#ff5f7e;--dshre-arc-2:#ffb45f;--dshre-arc-3:#6ee7a8;--dshre-fill-grad:linear-gradient(90deg,#ff5f7e,#ffb45f 22%,#ffe066 40%,#6ee7a8 60%,#5ec8ff 80%,#a78bfa);--dshre-ring-grad:conic-gradient(from 0deg,#ff5f7e,#ffb45f,#ffe066,#6ee7a8,#5ec8ff,#a78bfa,#ff5f7e);--dshre-core-bg:conic-gradient(from 0deg,#ff5f7e,#ffb45f,#ffe066,#6ee7a8,#5ec8ff,#a78bfa,#ff5f7e);--dshre-glow-bg:conic-gradient(from 0deg,#ff5f7e,#ffb45f,#ffe066,#6ee7a8,#5ec8ff,#a78bfa,#ff5f7e)}',
      '.dshre-lv-3 .dshre-flow{animation:dshre-sweep 1.1s ease-in-out infinite}',
      '.dshre-lv-3 .dshre-glow{opacity:.46;width:44px;height:44px;margin:-22px 0 0 -22px;animation:dshre-halo 1.2s ease-in-out infinite}',
      '.dshre-lv-3 .dshre-knob-core{opacity:1;animation:dshre-dot 1.4s ease-in-out infinite}',
      '.dshre-lv-3 .dshre-knob::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:1.5px solid rgba(255,255,255,.4);animation:dshre-ring-pulse 1.7s cubic-bezier(.2,.7,.3,1) infinite;corner-shape:round}',
      '.dshre-lv-3 .dshre-knob{box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-label-primary,#111) 14%,transparent),0 1px 5px rgba(16,18,24,.35),0 0 14px rgba(167,139,250,.65)}',
      '.dshre-lv-3 .dshre-tick.is-lit{background:#fff;box-shadow:0 0 6px rgba(255,255,255,.9)}',
      '.dshre-panel.is-dragging .dshre-knob{transform:scale(1.12)}',
      '.dshre-panel.is-dragging .dshre-glow{opacity:.6}',
      '.dshre-panel.is-dragging .dshre-fill,.dshre-panel.is-dragging .dshre-knob{transition:none}',
      '@keyframes dshre-rotate{to{transform:rotate(360deg)}}',
      '@keyframes dshre-shift{0%{background-position:0% 50%}100%{background-position:240% 50%}}',
      '@keyframes dshre-sweep{0%{transform:translateX(-100%)}55%,100%{transform:translateX(100%)}}',
      '@keyframes dshre-breathe{0%,100%{opacity:.4;transform:scale(.9)}50%{opacity:1;transform:scale(1.14)}}',
      '@keyframes dshre-halo{0%,100%{opacity:.28;transform:scale(.86)}50%{opacity:.78;transform:scale(1.2)}}',
      '@keyframes dshre-dot{0%,100%{opacity:.7;transform:scale(.9)}50%{opacity:1;transform:scale(1.1)}}',
      '@keyframes dshre-ring-pulse{0%{opacity:.7;transform:scale(.82)}70%,100%{opacity:0;transform:scale(1.35)}}',
      '@keyframes dshre-burst{0%{opacity:.95;transform:scale(.6)}100%{opacity:0;transform:scale(3.4)}}',
      '@keyframes dshre-panel-in{from{opacity:0;transform:translateY(6px) scale(.95)}to{opacity:1;transform:none}}',
      '@keyframes dshre-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-2px)}40%{transform:translateX(2px)}60%{transform:translateX(-1.5px)}80%{transform:translateX(1.5px)}}',
      '@media (prefers-reduced-motion:reduce){.dshre-flow,.dshre-glow,.dshre-knob-ring,.dshre-knob-core,.dshre-knob::after,.dshre-fill,.dshre-burst,.dshre-panel{animation:none!important}}',
    ].join('\n')

    return {
      inject: ['slots', 'locale', 'modelDirectories', 'sessions'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'reasoning-effort: dictionaries')

        ctx.effect(() => {
          if (document.getElementById(STYLE_ID)) return () => {}
          const style = document.createElement('style')
          style.id = STYLE_ID
          style.textContent = CSS
          document.head.appendChild(style)
          return () => { style.remove() }
        }, 'reasoning-effort: styles')

        ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
          name: 'conversation.input.right',
          id: 'reasoning-effort-rainbow',
          order: 10,
          locale: NS,
          inject: (sessionId) => {
            let available = false
            try {
              available = ctx.sessions.subagentAddress(sessionId) === undefined
            } catch {
              available = false
            }
            if (!available) {
              return { available: false, hooks: { effort: EMPTY_VIEW }, select: () => Promise.resolve({ ok: true }) }
            }
            let directory
            try {
              directory = ctx.modelDirectories.directoryFor(sessionId)
            } catch {
              return { available: false, hooks: { effort: EMPTY_VIEW }, select: () => Promise.resolve({ ok: true }) }
            }
            const view = createEffortView(directory)
            void directory.load().catch(() => { /* 失败由目录 store 自己呈现 */ })
            return {
              available: true,
              hooks: { effort: view },
              select: (effortId) => {
                const snapshot = view.getSnapshot()
                if (!snapshot.provider || !snapshot.model) return Promise.resolve({ ok: false, message: 'no model selected' })
                const selection = { provider: snapshot.provider, model: snapshot.model }
                if (effortId !== null && effortId !== undefined) selection.reasoningEffort = effortId
                return directory.select(selection).then(
                  result => result.ok ? { ok: true } : { ok: false, message: result.error.message + ' (' + result.error.code + ')' },
                  reason => ({ ok: false, message: reason && reason.message ? reason.message : String(reason) }))
              },
            }
          },
        }, EffortControl))
      },
    }
  },
})
