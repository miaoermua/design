/**
 * 桌面导航双态验收：Editorial Bar / Floating Dock
 *
 * 三态（top / hidden / floating）只能在真实滚动下才成立，静态 HTML 看不出来，
 * 所以这里用系统 Chrome + CDP 真滚一遍，并同时取三样证据：
 *   1. 计算样式（高度 / 宽度 / 圆角 / 玻璃不透明度 / 模糊 / 光斑）；
 *   2. 状态机的实际跳转（data-mode 序列，含 40–72px 迟滞）；
 *   3. 截图（每态一张，另有下拉与菜单）。
 *
 * 截图**不写进仓库**（仓库不接受截图文件）：
 *   默认输出到 `<系统临时目录>/folio-nav-dual`
 *   可用 `FOLIO_SHOTS=<目录>` 覆盖。
 *
 * 前置：`MX_MOCK=1 ./node_modules/.bin/next dev -p 3000` 已在跑。
 * 用法：`node scripts/visual/nav-dual-state.mjs`
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { launchChrome, navigate, openPage, preparePage, screenshot, settle, sleep } from './cdp.mjs'

const BASE = process.env.FOLIO_BASE_URL ?? 'http://127.0.0.1:3000'
const OUT = process.env.FOLIO_SHOTS ?? join(tmpdir(), 'folio-nav-dual')
const DESKTOP = [1024, 1104, 1280, 1440, 1920]

/** 取当前导航的几何与材质 */
const PROBE = `(() => {
  const nav = document.querySelector('header.site-nav')
  const card = document.querySelector('.nav-card')
  if (!nav || !card) return { error: 'no nav' }
  const glass = card.querySelector(':scope > .nav-glass')
  const spot = card.querySelector(':scope > .nav-spotlight')
  const cs = getComputedStyle(card)
  const gs = getComputedStyle(glass)
  const ss = getComputedStyle(spot)
  const rect = card.getBoundingClientRect()
  // 页面容器：Container 组件的 max-w-[var(--container-wide)] + px-[var(--spacing-gutter)]
  const page = document.querySelector('main [class*="container-wide"]')
  const pageRect = page ? page.getBoundingClientRect() : null
  const firstLink = document.querySelector('.nav-avatar')
  const lastAction = document.querySelector('.nav-menu-trigger')
  return {
    mode: nav.dataset.mode,
    scrollY: Math.round(window.scrollY),
    card: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      radius: cs.borderRadius,
      opacity: cs.opacity,
      visibility: cs.visibility,
      maxWidth: cs.maxWidth,
    },
    glass: {
      opacity: gs.opacity,
      background: gs.backgroundColor,
      backdropFilter: gs.backdropFilter || gs.webkitBackdropFilter,
      borderWidth: gs.borderTopWidth,
      borderColor: gs.borderTopColor,
      boxShadow: gs.boxShadow === 'none' ? 'none' : 'set',
    },
    spotlight: { display: ss.display, opacity: ss.opacity },
    page: pageRect
      ? {
          left: Math.round(pageRect.left),
          width: Math.round(pageRect.width),
          contentLeft: Math.round(pageRect.left + parseFloat(getComputedStyle(page).paddingLeft)),
        }
      : null,
    contentBox: {
      left: Math.round((firstLink?.getBoundingClientRect().left ?? 0)),
      right: Math.round((lastAction?.getBoundingClientRect().right ?? 0)),
    },
    headerCount: document.querySelectorAll('header.site-nav').length,
    links: [...document.querySelectorAll('.nav-link')].map((a) => a.getAttribute('href')),
    spacer: Math.round(
      document.querySelector('.site-nav-spacer')?.getBoundingClientRect().height ?? -1,
    ),
    // 正文第一块内容的上边缘：应为正数，说明没被导航压住
    firstContentTop: Math.round(
      document.querySelector('main h1')?.getBoundingClientRect().top ?? -1,
    ),
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    topbar: getComputedStyle(document.documentElement).getPropertyValue('--nav-topbar-height').trim(),
    dockHeight: getComputedStyle(document.documentElement)
      .getPropertyValue('--nav-dock-height')
      .trim(),
  }
})()`

/** 真滚（分步走，避免每次位移都超过 240px 的跳转阈值） */
async function scrollBySteps(client, target) {
  await client.evaluate(`(async () => {
    const start = window.scrollY
    const steps = 20
    for (let i = 1; i <= steps; i += 1) {
      window.scrollTo(0, start + ((${target} - start) * i) / steps)
      await new Promise((r) => setTimeout(r, 16))
    }
    await new Promise((r) => setTimeout(r, 120))
  })()`)
  await sleep(260)
}

async function shoot(client, name) {
  const png = await screenshot(client)
  writeFileSync(join(OUT, `${name}.png`), png)
  return `${name}.png`
}

/** 把鼠标移到某个元素中心（下拉靠 hover 展开） */
async function hover(client, selector) {
  const box = await client.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })()`)
  if (!box) throw new Error(`hover target missing: ${selector}`)
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: box.x,
    y: box.y,
    buttons: 0,
  })
  await sleep(420)
}

/** 按下拉所属入口取面板（页面里第一个 .nav-flyout 是「首页」的，不能直接 querySelector） */
const FLYOUT = `.nav-flyout:has(> .nav-link[href="/articles"]) .nav-flyout__panel`

/** 下拉面板是否真的展开、是否压在卡片下方且不出视口 */
const FLYOUT_PROBE = `(() => {
  const panel = document.querySelector(${JSON.stringify(FLYOUT)})
  if (!panel) return null
  const card = panel.querySelector('.nav-flyout__card')
  const r = card.getBoundingClientRect()
  const bar = document.querySelector('.nav-card').getBoundingClientRect()
  const cs = getComputedStyle(panel)
  return {
    mode: document.querySelector('header.site-nav').dataset.mode,
    visible: cs.visibility,
    opacity: cs.opacity,
    top: Math.round(r.top),
    right: Math.round(r.right),
    cardBottom: Math.round(bar.bottom),
    belowBar: r.top >= Math.round(bar.bottom) - 8,
    insideViewport: r.top >= 0 && r.right <= window.innerWidth,
  }
})()`

const chrome = await launchChrome({ port: 9341 })
const client = await openPage(chrome.port)
const report = { base: BASE, out: OUT, desktop: {}, mobile: {}, checks: {} }

mkdirSync(OUT, { recursive: true })

try {
  /* ── 桌面：逐视口跑三态 ───────────────────────────────────── */
  for (const width of DESKTOP) {
    await preparePage(client, { width, height: 900, theme: 'light' })
    await navigate(client, `${BASE}/`)
    await settle(client)

    const top = await client.evaluate(PROBE)
    const files = {}
    files.top = await shoot(client, `desktop-${width}-top`)

    // 向下滚 → hidden
    await scrollBySteps(client, 640)
    const hidden = await client.evaluate(PROBE)
    files.hidden = await shoot(client, `desktop-${width}-hidden`)

    // 向上滚 → floating
    await scrollBySteps(client, 380)
    const floating = await client.evaluate(PROBE)
    files.floating = await shoot(client, `desktop-${width}-floating`)

    // 回顶 → top
    await client.evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`)
    await sleep(300)
    const back = await client.evaluate(PROBE)

    report.desktop[width] = { top, hidden, floating, back, files }
  }

  /* ── 桌面 1440：下拉与菜单 ─────────────────────────────────── */
  await preparePage(client, { width: 1440, height: 900, theme: 'light' })
  await navigate(client, `${BASE}/`)
  await settle(client)

  // 顶部状态下拉
  await hover(client, '.nav-flyout .nav-link[href="/articles"]')
  report.checks.flyoutTop = await client.evaluate(FLYOUT_PROBE)
  await shoot(client, 'desktop-1440-flyout-top')

  // 悬浮态下的下拉（先把指针挪开，否则悬停冻结会让导航不动）
  await client.evaluate(`window.scrollTo(0, 700)`)
  await sleep(260)
  await scrollBySteps(client, 600)
  await hover(client, '.nav-flyout .nav-link[href="/articles"]')
  report.checks.flyoutFloating = await client.evaluate(FLYOUT_PROBE)
  await shoot(client, 'desktop-1440-flyout-floating')
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 8, y: 500, buttons: 0 })
  await sleep(220)

  // 菜单面板（点击打开）：两种状态各一张
  await client.evaluate(`document.querySelector('.nav-menu-trigger').click()`)
  await sleep(320)
  report.checks.menuFloating = await client.evaluate(`(() => {
    const panel = document.getElementById('site-nav-menu')
    if (!panel) return null
    const r = panel.getBoundingClientRect()
    const trigger = document.querySelector('.nav-menu-trigger').getBoundingClientRect()
    return {
      mode: document.querySelector('header.site-nav').dataset.mode,
      width: Math.round(r.width),
      right: Math.round(r.right),
      triggerRight: Math.round(trigger.right),
      belowTrigger: r.top >= trigger.bottom,
    }
  })()`)
  await shoot(client, 'desktop-1440-menu-floating')
  await client.evaluate(`document.querySelector('.nav-menu-trigger').click()`)
  await sleep(320)

  // 回到顶部后菜单也跟着回到顶部形态
  await client.evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`)
  await sleep(300)
  await client.evaluate(`document.querySelector('.nav-menu-trigger').click()`)
  await sleep(320)
  report.checks.menuTop = await client.evaluate(`(() => {
    const panel = document.getElementById('site-nav-menu')
    if (!panel) return null
    const r = panel.getBoundingClientRect()
    const trigger = document.querySelector('.nav-menu-trigger').getBoundingClientRect()
    return {
      mode: document.querySelector('header.site-nav').dataset.mode,
      width: Math.round(r.width),
      right: Math.round(r.right),
      triggerRight: Math.round(trigger.right),
      insideViewport: r.right <= window.innerWidth,
    }
  })()`)
  await shoot(client, 'desktop-1440-menu-top')
  await client.evaluate(`document.querySelector('.nav-menu-trigger').click()`)
  await sleep(320)

  /* ── 多页面：占位与对齐不能因页面不同而不同 ───────────────── */
  const PAGES = [
    { path: '/', name: 'home' },
    { path: '/articles', name: 'article-list' },
    { path: '/diaries', name: 'diary-list' },
    { path: '/friends', name: 'friends' },
    { path: '/explore', name: 'explore' },
  ]
  report.pages = {}

  for (const page of PAGES) {
    await preparePage(client, { width: 1280, height: 900, theme: 'light' })
    await navigate(client, `${BASE}${page.path}`)
    await settle(client)
    report.pages[page.name] = { path: page.path, probe: await client.evaluate(PROBE) }
  }

  // 文章详情：顶部内容与导航的关系最容易出问题（标题紧贴导航）
  const articleHref = await client.evaluate(`(() => {
    const link = document.querySelector('main a[href^="/articles/"]')
    return link ? link.getAttribute('href') : null
  })()`)
  if (articleHref) {
    await navigate(client, `${BASE}${articleHref}`)
    await settle(client)
    report.pages.articleDetail = {
      path: articleHref,
      probe: await client.evaluate(PROBE),
    }
    await shoot(client, 'page-article-detail-top')
  }

  /* ── 菜单打开时滚动：面板不能消失，形态也不能切 ──────────── */
  await preparePage(client, { width: 1440, height: 900, theme: 'light' })
  await navigate(client, `${BASE}/`)
  await settle(client)
  await client.evaluate(`document.querySelector('.nav-menu-trigger').click()`)
  await sleep(340)
  await scrollBySteps(client, 700)
  report.checks.menuWhileScrolling = await client.evaluate(`(() => {
    const panel = document.getElementById('site-nav-menu')
    const nav = document.querySelector('header.site-nav')
    const bar = document.querySelector('.nav-card').getBoundingClientRect()
    if (!panel) return { open: false }
    const r = panel.getBoundingClientRect()
    return {
      open: true,
      mode: nav.dataset.mode,
      barVisible: getComputedStyle(document.querySelector('.nav-card')).visibility,
      barTop: Math.round(bar.top),
      panelTop: Math.round(r.top),
      panelVisible: getComputedStyle(panel).visibility,
      panelInsideViewport: r.top >= 0 && r.bottom <= window.innerHeight,
      scrollY: Math.round(window.scrollY),
    }
  })()`)
  await shoot(client, 'desktop-1440-menu-while-scrolling')
  // 关掉菜单（点页面空白处）
  await client.evaluate(
    `document.querySelector('main').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`,
  )
  await sleep(320)
  // 菜单关了之后再滚动，形态应恢复跟随
  await scrollBySteps(client, 400)
  report.checks.afterMenuClosed = await client.evaluate(PROBE)

  /* ── 下拉的鼠标穿越与键盘可达（需求 §7.6 / §7.7 / §7.10）────── */
  await preparePage(client, { width: 1440, height: 900, theme: 'light' })
  await navigate(client, `${BASE}/`)
  await settle(client)

  const flyoutOpen = () =>
    client.evaluate(`(() => {
      const panel = document.querySelector(${JSON.stringify(FLYOUT)})
      const cs = getComputedStyle(panel)
      return { visible: cs.visibility, opacity: Number(cs.opacity) }
    })()`)

  // 1) 悬停入口 → 面板展开
  await hover(client, '.nav-flyout .nav-link[href="/articles"]')
  const hoverEntry = await flyoutOpen()

  // 2) 鼠标下移到面板第一项（中间隔着 --nav-gap 的 padding-top 缝）→ 面板仍在
  const panelBox = await client.evaluate(`(() => {
    const card = document.querySelector(${JSON.stringify(FLYOUT)}).querySelector('.nav-flyout__card')
    const r = card.getBoundingClientRect()
    return { x: Math.round(r.x + 40), y: Math.round(r.y + 18) }
  })()`)
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: panelBox.x,
    y: panelBox.y,
    buttons: 0,
  })
  await sleep(360)
  const inPanel = await flyoutOpen()

  // 3) 鼠标移出导航区域 → 面板收起
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 200, y: 600, buttons: 0 })
  await sleep(420)
  const away = await flyoutOpen()

  report.checks.flyoutHover = { hoverEntry, inPanel, away }

  /* ── 下拉展开时滚动：面板不能消失，形态也不能切（需求 §7.5 / §7.6）── */
  //    下拉靠 hover 维持，滚动时指针仍在面板上，所以两侧都不该动
  await hover(client, '.nav-flyout .nav-link[href="/articles"]')
  await scrollBySteps(client, 700)
  report.checks.flyoutWhileScrolling = await client.evaluate(`(() => {
    const panel = document.querySelector(${JSON.stringify(FLYOUT)})
    const cs = getComputedStyle(panel)
    const bar = document.querySelector('.nav-card').getBoundingClientRect()
    return {
      mode: document.querySelector('header.site-nav').dataset.mode,
      visible: cs.visibility,
      cardVisible: getComputedStyle(document.querySelector('.nav-card')).visibility,
      barTop: Math.round(bar.top),
      panelTop: Math.round(panel.querySelector('.nav-flyout__card').getBoundingClientRect().top),
      scrollY: Math.round(window.scrollY),
    }
  })()`)
  // 把指针挪开并回顶，避免影响后续用例
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 200, y: 700, buttons: 0 })
  await sleep(240)
  await client.evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`)
  await sleep(300)

  /* ── 英文文案下的 Dock：入口更短，宽高与间距仍成立 ─────────── */
  await client.evaluate(`(() => {
    document.cookie = 'folio-lang=en; path=/; max-age=3600'
    return document.cookie
  })()`)
  await navigate(client, `${BASE}/`)
  await settle(client)
  await scrollBySteps(client, 900)
  await scrollBySteps(client, 700)
  report.checks.dockEn = await client.evaluate(`(() => {
    const card = document.querySelector('.nav-card')
    const r = card.getBoundingClientRect()
    const links = [...document.querySelectorAll('.nav-link')]
    // 相邻链接的边框盒间距 = .nav-quick__list 的 flex gap（0.25rem = 4px）
    const boxGaps = links.slice(1).map((link, i) => {
      const prev = links[i].getBoundingClientRect()
      return Math.round(link.getBoundingClientRect().left - prev.right)
    })
    // 文字之间的视觉间距 = 边框盒间距 + 两侧 padding-inline
    const textGaps = links.slice(1).map((link, i) => {
      const prev = links[i].getBoundingClientRect()
      const prevPad = parseFloat(getComputedStyle(links[i]).paddingRight)
      const pad = parseFloat(getComputedStyle(link).paddingLeft)
      return Math.round(link.getBoundingClientRect().left + pad - (prev.right - prevPad))
    })
    return {
      mode: document.querySelector('header.site-nav').dataset.mode,
      width: Math.round(r.width),
      height: Math.round(r.height),
      boxGaps,
      textGaps,
      // 头像与第一条入口之间的盒间距：英文单行更短，这里最容易挤在一起
      avatarGap: Math.round(
        links[0].getBoundingClientRect().left -
          document.querySelector('.nav-avatar').getBoundingClientRect().right,
      ),
      labels: links.map((link) => (link.textContent || '').trim()),
      // 任何一条入口被压扁（内容宽超过可点宽度）都说明挤了
      squeezed: links.some((link) => link.scrollWidth > link.clientWidth + 1),
      overflow: card.scrollWidth - card.clientWidth,
    }
  })()`)
  await shoot(client, 'desktop-1440-floating-en')
  // 恢复中文
  await client.evaluate(`(() => { document.cookie = 'folio-lang=; path=/; max-age=0' })()`)

  // 4) 键盘：Tab 进到入口时下拉应展开（:focus-within）
  await client.evaluate(`(() => {
    const link = document.querySelector('.nav-flyout .nav-link[href="/articles"]')
    link.focus()
  })()`)
  await sleep(320)
  report.checks.flyoutFocus = await flyoutOpen()

  // 5) 键盘：菜单键 Enter 打开、Escape 关闭并归还焦点
  //    两种桌面形态各跑一次：顶部态复位成 top，浮动态先滚到中段
  //    CDP 合成按键必须带 `text`，否则浏览器不执行按钮的默认激活行为（实测：不带 text 时 click 为 0）
  const descActive = `(() => {
    const a = document.activeElement
    return a ? a.tagName + '.' + (typeof a.className === 'string' ? a.className.split(' ')[0] : '') : 'none'
  })()`

  const pressEnter = async () => {
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
      text: '\r',
      unmodifiedText: '\r',
    })
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
      nativeVirtualKeyCode: 13,
    })
  }

  const pressEscape = async () => {
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    })
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    })
  }

  /**
   * 跑一次键盘菜单流程。
   *
   * 关键是关闭之后**不能**把整块收走：`visibility: hidden` 会让浏览器把刚回到
   * 触发按钮的焦点丢弃。这条在中段（floating）最容易出问题，是本次实测抓到的
   * 真实缺陷（修复前 400ms 后 activeElement 变成 BODY）。
   */
  const runMenuKeyboard = async (label) => {
    const modeBefore = await client.evaluate(
      `document.querySelector('header.site-nav').dataset.mode`,
    )
    await client.evaluate(`document.querySelector('.nav-menu-trigger').focus()`)
    await pressEnter()
    await sleep(340)
    const opened = await client.evaluate(`Boolean(document.getElementById('site-nav-menu'))`)
    const expandedAttr = await client.evaluate(
      `document.querySelector('.nav-menu-trigger').getAttribute('aria-expanded')`,
    )
    // 打开后焦点按设计进入了面板（键盘触发时 openMenu(focusFirst)）
    const activeAfterOpen = await client.evaluate(descActive)

    await pressEscape()
    await sleep(60)
    const activeAt60 = await client.evaluate(descActive)
    // 等关闭动画（200ms）走完、面板卸载之后再读一次：
    // 焦点必须仍在触发按钮上，否则就是「关掉菜单把导航一起收走」的回归
    await sleep(340)
    const closed = await client.evaluate(`Boolean(document.getElementById('site-nav-menu'))`)
    const focusBack = await client.evaluate(`(() => {
      const trigger = document.querySelector('.nav-menu-trigger')
      const active = document.activeElement
      return {
        ok: active === trigger,
        activeTag: active ? active.tagName : null,
        activeClass: active && typeof active.className === 'string' ? active.className.split(' ')[0] : null,
      }
    })()`)
    const modeAfter = await client.evaluate(
      `document.querySelector('header.site-nav').dataset.mode`,
    )
    return {
      label,
      modeBefore,
      modeAfter,
      opened,
      expandedAttr,
      activeAfterOpen,
      activeAt60,
      closed,
      focusBack,
    }
  }

  // 顶部态
  await client.evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`)
  await sleep(320)
  report.checks.menuKeyboardTop = await runMenuKeyboard('top')

  // 浮动态：滚到中段，等状态稳定
  await scrollBySteps(client, 900)
  await scrollBySteps(client, 700)
  report.checks.menuKeyboardFloating = await runMenuKeyboard('floating')

  /* ── 隐藏态：真的不能 Tab 进去 ─────────────────────────────── */
  await navigate(client, `${BASE}/`)
  await settle(client)
  await scrollBySteps(client, 700)
  await client.evaluate(
    `document.body.focus(); document.activeElement && document.activeElement.blur()`,
  )
  const hiddenFocus = await client.evaluate(`(() => {
    const mode = document.querySelector('header.site-nav').dataset.mode
    const link = document.querySelector('.nav-flyout .nav-link[href="/articles"]')
    link.focus()
    const focusable = document.activeElement === link
    // visibility: hidden 的元素无法接收焦点，焦点应留在 body
    return {
      mode,
      focusable,
      activeTag: document.activeElement ? document.activeElement.tagName : null,
      cardVisibility: getComputedStyle(document.querySelector('.nav-card')).visibility,
    }
  })()`)
  report.checks.hiddenFocus = hiddenFocus

  /* ── 深色主题抽查 ─────────────────────────────────────────── */
  await client.evaluate(`document.documentElement.dataset.theme = 'dark'`)
  await sleep(320)
  await scrollBySteps(client, 500)
  await client.evaluate(`window.scrollTo(0, 500)`)
  await sleep(120)
  await scrollBySteps(client, 380)
  report.checks.dark = await client.evaluate(PROBE)
  await shoot(client, 'desktop-1440-dark-floating')
  await client.evaluate(`delete document.documentElement.dataset.theme`)

  /* ── 手机：底部导航回归（768px 已是桌面断点，单独按桌面验证）──── */
  for (const width of [320, 375, 390, 430]) {
    await preparePage(client, { width, height: 844, theme: 'light' })
    await navigate(client, `${BASE}/`)
    await settle(client)

    const bottom = await client.evaluate(PROBE)
    await scrollBySteps(client, 700)
    const scrolled = await client.evaluate(PROBE)
    const file = await shoot(client, `mobile-${width}`)
    report.mobile[width] = { bottom, scrolled, file }
  }

  // 手机菜单（390）
  await preparePage(client, { width: 390, height: 844, theme: 'light' })
  await navigate(client, `${BASE}/`)
  await settle(client)
  await client.evaluate(`document.querySelector('.nav-menu-trigger').click()`)
  await sleep(340)
  report.checks.mobileMenu = await client.evaluate(`(() => {
    const panel = document.getElementById('site-nav-menu')
    if (!panel) return null
    const r = panel.getBoundingClientRect()
    const nav = document.querySelector('header.site-nav').getBoundingClientRect()
    return {
      mode: document.querySelector('header.site-nav').dataset.mode,
      width: Math.round(r.width),
      viewport: window.innerWidth,
      bottom: Math.round(r.bottom),
      navTop: Math.round(nav.top),
    }
  })()`)
  await shoot(client, 'mobile-390-menu')

  // 768px 是 48rem 断点本身：按桌面验一次，确认它贴在顶部
  await preparePage(client, { width: 768, height: 844, theme: 'light' })
  await navigate(client, `${BASE}/`)
  await settle(client)
  report.checks.bp768 = await client.evaluate(PROBE)
  await shoot(client, 'breakpoint-768')

  /* ── 断言 ────────────────────────────────────────────────── */
  const problems = []
  const expect = (ok, message) => {
    if (!ok) problems.push(message)
  }

  for (const width of DESKTOP) {
    const entry = report.desktop[width]
    const { top, hidden, floating, back } = entry

    expect(top.mode === 'top', `${width}: 初始应为 top，实际 ${top.mode}`)
    expect(hidden.mode === 'hidden', `${width}: 向下滚动应为 hidden，实际 ${hidden.mode}`)
    expect(floating.mode === 'floating', `${width}: 向上滚动应为 floating，实际 ${floating.mode}`)
    expect(back.mode === 'top', `${width}: 回顶应为 top，实际 ${back.mode}`)

    expect(top.headerCount === 1, `${width}: 出现了多个 header.site-nav`)
    expect(new Set(top.links).size === top.links.length, `${width}: 导航链接重复`)

    // 顶部：透明、无玻璃、无光斑、与页面容器同宽
    expect(top.glass.opacity === '0', `${width}: 顶部状态玻璃未关闭（${top.glass.opacity}）`)
    expect(top.spotlight.display === 'none', `${width}: 顶部状态光斑未关闭`)
    // 版心 = min(视口, --container-wide 1152)
    expect(
      top.card.width === Math.min(width, 1152),
      `${width}: 顶部条宽 ${top.card.width} ≠ 版心 ${Math.min(width, 1152)}`,
    )
    // 导航内容的左缘与 Container 的内容左缘对齐（px-gutter 之内）
    expect(
      top.page && Math.abs(top.contentBox.left - top.page.contentLeft) <= 1,
      `${width}: 导航左缘 ${top.contentBox.left} ≠ 正文左缘 ${top.page?.contentLeft}`,
    )
    expect(
      top.spacer === Math.round(parseFloat(top.topbar) * 16),
      `${width}: 占位高度与顶部条不一致`,
    )

    // 悬浮：玻璃亮起、有边框与模糊、圆角是微圆角
    expect(
      floating.glass.opacity === '1',
      `${width}: 悬浮状态玻璃未亮起（${floating.glass.opacity}）`,
    )
    expect(
      /blur/.test(floating.glass.backdropFilter ?? ''),
      `${width}: 悬浮状态没有毛玻璃（${floating.glass.backdropFilter}）`,
    )
    expect(floating.glass.borderWidth === '1px', `${width}: 悬浮状态缺少发丝边`)
    expect(floating.card.radius === '16px', `${width}: 悬浮圆角 ${floating.card.radius} ≠ 16px`)
    expect(
      floating.card.height === Math.round(parseFloat(floating.dockHeight) * 16),
      `${width}: 悬浮高度 ${floating.card.height} ≠ ${floating.dockHeight}`,
    )
    expect(floating.card.width === 560, `${width}: 悬浮宽度 ${floating.card.width} ≠ 560`)
    expect(
      Math.abs(floating.card.x + floating.card.width / 2 - width / 2) <= 1,
      `${width}: 悬浮 Dock 未水平居中`,
    )
    expect(floating.card.y === 14, `${width}: 悬浮 Dock 距顶 ${floating.card.y} ≠ 14`)

    // 隐藏：透明度归零并离开可聚焦树
    expect(hidden.card.opacity === '0', `${width}: 隐藏状态未淡出`)
    expect(hidden.card.visibility === 'hidden', `${width}: 隐藏状态仍可聚焦`)

    expect(top.overflowX <= 0, `${width}: 出现横向溢出 ${top.overflowX}px`)
  }

  expect(
    Math.abs(report.checks.menuFloating.right - report.checks.menuFloating.triggerRight) <= 1,
    `菜单面板右边缘与菜单键未对齐（${report.checks.menuFloating.right} / ${report.checks.menuFloating.triggerRight}）`,
  )
  expect(report.checks.menuFloating.belowTrigger, '菜单面板与菜单键重叠')
  expect(report.checks.menuTop.insideViewport, '顶部状态的菜单面板溢出视口')
  expect(
    report.checks.flyoutTop?.visible === 'visible',
    `顶部状态下拉未展开（${report.checks.flyoutTop?.visible}）`,
  )
  expect(
    report.checks.flyoutFloating?.visible === 'visible',
    `悬浮状态下拉未展开（${report.checks.flyoutFloating?.visible}）`,
  )
  expect(report.checks.flyoutFloating?.insideViewport, '悬浮状态下拉溢出视口')

  for (const width of [320, 375, 390, 430]) {
    const entry = report.mobile[width]
    // 手机：贴底、三态不生效、滚动后仍在原处
    expect(entry.bottom.card.y > 600, `${width}: 手机导航不在底部（y=${entry.bottom.card.y}）`)
    expect(
      entry.scrolled.card.y === entry.bottom.card.y,
      `${width}: 手机导航随滚动移动了（${entry.bottom.card.y} → ${entry.scrolled.card.y}）`,
    )
    expect(entry.scrolled.card.opacity === '1', `${width}: 手机导航被淡出`)
    expect(entry.scrolled.card.visibility === 'visible', `${width}: 手机导航被隐藏`)
    expect(entry.scrolled.glass.opacity === '1', `${width}: 手机导航玻璃被关闭`)
    expect(entry.bottom.card.radius === '999px', `${width}: 手机胶囊不再是药丸`)
  }
  // 768px 正好是 48rem：这里已经进入桌面断点，导航贴顶而不是贴底
  expect(
    report.checks.bp768.card.y === 0,
    `768: 断点处应为桌面贴顶（y=${report.checks.bp768.card.y}）`,
  )
  expect(
    report.checks.mobileMenu.viewport - report.checks.mobileMenu.width <= 48,
    `手机菜单未接近满宽（${report.checks.mobileMenu.width} / ${report.checks.mobileMenu.viewport}）`,
  )

  // 多页面：spacer 一致、正文不被导航压住
  for (const [name, entry] of Object.entries(report.pages)) {
    const p = entry.probe
    expect(p.mode === 'top', `${name}: 顶部应为 top，实际 ${p.mode}`)
    expect(p.spacer === 68, `${name}: 占位高度 ${p.spacer} ≠ 68，页面间不一致`)
    expect(p.firstContentTop >= 68, `${name}: 正文首块顶部 ${p.firstContentTop} 被导航压住`)
    expect(p.overflowX <= 0, `${name}: 出现横向溢出 ${p.overflowX}px`)
  }

  // 菜单打开时滚动：面板不消失、卡片不走
  const mws = report.checks.menuWhileScrolling
  expect(mws.open, '菜单在滚动后消失了')
  expect(mws.mode === 'top', `菜单打开时形态被切换为 ${mws.mode}`)
  expect(mws.panelVisible === 'visible', '菜单面板被隐藏')
  expect(mws.barVisible === 'visible', '卡片在菜单打开时被隐藏')
  expect(mws.panelInsideViewport, '菜单面板滚出了视口')
  expect(mws.scrollY > 400, `菜单打开期间页面没滚动（scrollY=${mws.scrollY}）`)
  // 菜单关闭后恢复跟随滚动
  expect(
    ['hidden', 'floating'].includes(report.checks.afterMenuClosed.mode),
    `菜单关闭后导航没有恢复跟随（${report.checks.afterMenuClosed.mode}）`,
  )

  // 下拉：悬停展开 → 鼠标移到面板仍展开 → 移开收起
  const fh = report.checks.flyoutHover
  expect(fh.hoverEntry.visible === 'visible', `悬停入口时下拉未展开（${fh.hoverEntry.visible}）`)
  expect(fh.inPanel.visible === 'visible', '鼠标移到下拉面板时面板消失了（hover 断层）')
  expect(fh.away.visible !== 'visible', '鼠标移出导航后下拉没有收起')
  expect(
    report.checks.flyoutFocus.visible === 'visible',
    '键盘聚焦入口时下拉未展开（:focus-within）',
  )

  // 下拉展开时滚动：面板不消失、形态不切
  const fws = report.checks.flyoutWhileScrolling
  expect(fws.mode === 'top', `下拉展开时滚动，形态被切为 ${fws.mode}`)
  expect(fws.visible === 'visible', '下拉展开时滚动，面板消失了')
  expect(fws.cardVisible === 'visible', '下拉展开时滚动，卡片被隐藏')
  expect(fws.scrollY > 400, `下拉展开期间页面没滚动（scrollY=${fws.scrollY}）`)

  // 英文文案：Dock 仍然成立，入口不挤压
  const en = report.checks.dockEn
  expect(en.mode === 'floating', `英文下应为 floating，实际 ${en.mode}`)
  expect(en.width === 560 && en.height === 50, `英文下 Dock 尺寸 ${en.width}×${en.height} ≠ 560×50`)
  expect(!en.squeezed, '英文下有条目被压扁')
  expect(en.overflow <= 0, `英文下卡片内容溢出 ${en.overflow}px`)
  // 边框盒间距是列表的 flex gap（4px），文字之间的视觉间距 = 4 + 两侧各 1rem
  expect(
    en.boxGaps.every((gap) => gap === 4),
    `英文下链接盒间距异常：${en.boxGaps.join(',')}`,
  )
  expect(
    en.textGaps.every((gap) => gap >= 30),
    `英文下文字间距过小：${en.textGaps.join(',')}`,
  )
  // 头像与第一条入口之间要有明确的呼吸位（实测 38px；低于 24px 就是贴住了）
  expect(en.avatarGap >= 24, `英文下头像与首条入口过近：${en.avatarGap}px`)

  // 菜单键键盘操作：两种桌面形态都要成立
  for (const key of ['menuKeyboardTop', 'menuKeyboardFloating']) {
    const kb = report.checks[key]
    const where = key === 'menuKeyboardTop' ? '顶部态' : '浮动态'
    expect(kb.opened, `${where}：Enter 未能打开菜单`)
    expect(kb.expandedAttr === 'true', `${where}：aria-expanded 未变 true（${kb.expandedAttr}）`)
    expect(kb.activeAfterOpen !== 'BODY.', `${where}：菜单打开后焦点没有进入面板`)
    expect(!kb.closed, `${where}：Escape 未能关闭菜单`)
    expect(
      kb.focusBack.ok,
      `${where}：Escape 关闭后焦点未回到菜单键（当前在 ${kb.focusBack.activeTag}.${kb.focusBack.activeClass}）`,
    )
    // 关闭菜单不能把导航一起收走：形态应保持可见（top 或 floating），绝不是 hidden
    expect(kb.modeAfter !== 'hidden', `${where}：关闭菜单后导航被收走（mode=${kb.modeAfter}）`)
  }
  // 浮动态关闭菜单后应仍是 Dock（用户刚在用导航，不该突然消失）
  expect(
    report.checks.menuKeyboardFloating.modeAfter === 'floating',
    `浮动态关闭菜单后形态为 ${report.checks.menuKeyboardFloating.modeAfter}`,
  )

  // 隐藏态不能聚焦
  const hf = report.checks.hiddenFocus
  expect(hf.mode === 'hidden', `隐藏态检查时状态为 ${hf.mode}`)
  expect(!hf.focusable, '隐藏状态的导航链接仍能被键盘聚焦')
  expect(hf.cardVisibility === 'hidden', `隐藏态卡片 visibility 为 ${hf.cardVisibility}`)

  report.checks.problems = problems
  report.passed = problems.length === 0
} finally {
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  client.close()
  await chrome.close()
}

console.log(
  JSON.stringify({ out: OUT, passed: report.passed, problems: report.checks.problems }, null, 2),
)
if (!report.passed) process.exitCode = 1
