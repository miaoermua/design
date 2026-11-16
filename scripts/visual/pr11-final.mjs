/**
 * PR #11 最终验收（一次性，覆盖任务 §6 全范围）
 *
 * 设计原则：
 *   - **只测量，不优化**；每条断言带实测值，失败时能直接判断是"没做到"还是"做到了但没达标"。
 *   - 不新造浏览器框架：复用 `cdp.mjs`，与 `capture.mjs` / `contrast.mjs` 同一套。
 *   - 覆盖 5 个视口 × 2 主题 × 11 个页面，外加交互 / forced-colors / print / 控制台错误。
 *
 * 明确不做的事：不声称性能指标。CLS 用 PerformanceObserver 实测（可复现）；
 * LCP / INP / FCP 不测，报告里写 NOT TESTED。
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launchChrome, navigate, openPage, preparePage, screenshot, settle, sleep } from './cdp.mjs'

const OUT = join(process.env.TEMP ?? '.', 'folio-final')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.FOLIO_BASE_URL ?? 'http://127.0.0.1:3000'

const problems = []
const notes = { viewports: {}, pages: {}, interactions: {}, cls: {}, console: [] }
const expect = (ok, msg) => {
  if (!ok) problems.push(msg)
}

const VIEWPORTS = [
  { w: 390, h: 844, name: 'mobile' },
  { w: 768, h: 1024, name: 'tablet' },
  { w: 1024, h: 768, name: 'laptop' },
  { w: 1280, h: 800, name: 'desktop' },
  { w: 1440, h: 900, name: 'wide' },
]

const PAGES = [
  ['首页', '/'],
  ['文章列表', '/articles'],
  ['文章详情', '/articles/blog/qbittorrent'],
  ['日记列表', '/diaries'],
  ['日记详情', '/diaries/155695797663436800'],
  ['标签', '/tags'],
  ['分类', '/categories'],
  ['归档', '/archives'],
  ['探索', '/explore'],
  ['友链', '/friends'],
  ['搜索', '/search'],
  ['关于', '/about'],
]

const chrome = await launchChrome({ port: 9441 })
const client = await openPage(chrome.port)

/** 收集控制台错误与页面异常 */
const consoleErrors = []
client.on('Runtime.exceptionThrown', (p) => {
  consoleErrors.push({ type: 'exception', text: p.exceptionDetails?.text ?? 'unknown' })
})
client.on('Runtime.consoleAPICalled', (p) => {
  if (p.type !== 'error' && p.type !== 'warning') return
  const text = (p.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ')
  // React 的 hydration 警告与 Next 的 dev 提示分开归类
  consoleErrors.push({ type: p.type, text: text.slice(0, 200) })
})

const shoot = async (name) => {
  writeFileSync(join(OUT, `${name}.png`), await screenshot(client))
}

try {
  await client.send('Runtime.enable')
  await client.send('Page.enable')

  /* ── 1. 视口 × 主题 全页扫描 ───────────────────────────────── */
  for (const vp of VIEWPORTS) {
    for (const theme of ['light', 'dark']) {
      notes.viewports[`${vp.name}-${theme}`] = {}
      for (const [label, path] of PAGES) {
        await preparePage(client, { width: vp.w, height: vp.h, theme })
        await navigate(client, `${BASE}${path}`)
        await settle(client, { extraDelay: 420 })

        const m = await client.evaluate(`(() => {
          const doc = document.documentElement
          /**
           * 只找「页面级」溢出。
           *
           * 相册轨道（.md-gallery__track）、代码块、宽表格都是 overflow-x: auto 的
           * 滚动容器 —— 它们的子元素超出视口是**设计如此**，算进去就是误报。
           * 判据：向上找祖先，只要有 overflow-x 为 auto/scroll 的，就不算页面溢出。
           */
          const inScroller = (el) => {
            for (let p = el.parentElement; p; p = p.parentElement) {
              const ox = getComputedStyle(p).overflowX
              if (ox === 'auto' || ox === 'scroll') return true
            }
            return false
          }
          const overflows = []
          for (const el of document.querySelectorAll('main *')) {
            const r = el.getBoundingClientRect()
            if (r.width > 0 && r.right > window.innerWidth + 2 && !inScroller(el)) {
              overflows.push((el.className || el.tagName).toString().slice(0, 40))
            }
            if (overflows.length >= 3) break
          }
          const nav = document.querySelector('.site-nav')
          return {
            overflowX: doc.scrollWidth - window.innerWidth,
            overflowing: overflows,
            height: doc.scrollHeight,
            navMode: nav && nav.dataset.mode ? nav.dataset.mode : null,
            h1: (document.querySelector('main h1')?.textContent || '').trim().slice(0, 30),
          }
        })()`)
        notes.viewports[`${vp.name}-${theme}`][label] = m

        expect(m.overflowX <= 1, `${vp.name}/${theme}${label}: 横向溢出 ${m.overflowX}px`)
        expect(
          m.overflowing.length === 0,
          `${vp.name}/${theme}/${label}: 元素越界 ${m.overflowing.join(', ')}`,
        )
        // 每个页面都该有主标题（首页是站点名，也算 h1）
        expect(m.h1.length > 0, `${vp.name}/${theme}/${label}: 缺少 h1`)

        if (vp.name === 'wide' || vp.name === 'mobile') {
          await shoot(`${vp.name}-${theme}-${label.replace(/[/]/g, '')}`)
        }
      }
    }
  }

  /* ── 2. CLS（PerformanceObserver 实测，可复现）─────────────── */
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__cls = 0; window.__shifts = 0;
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          if (e.hadRecentInput) continue;
          window.__cls += e.value; window.__shifts++;
        }
      }).observe({ type: 'layout-shift', buffered: true })`,
  })

  for (const [label, path] of [
    ['日记详情(475图)', '/diaries/155695797663436800'],
    ['文章详情', '/articles/blog/qbittorrent'],
    ['日记列表', '/diaries'],
    ['文章列表', '/articles'],
    ['首页', '/'],
  ]) {
    await preparePage(client, { width: 1440, height: 900, theme: 'light' })
    await navigate(client, `${BASE}${path}`)
    await settle(client, { extraDelay: 2600 })
    const r = await client.evaluate(`(() => ({
      cls: Math.round(window.__cls * 10000) / 10000,
      shifts: window.__shifts,
      imgs: document.querySelectorAll('.prose img').length,
      sized: [...document.querySelectorAll('.prose img')].filter(i => i.getAttribute('width') && i.getAttribute('height')).length,
    }))()`)
    notes.cls[label] = r
    expect(r.cls <= 0.1, `${label}: CLS=${r.cls} 超过 Good 阈值 0.1`)
    await client.evaluate(`window.__cls = 0; window.__shifts = 0`)
  }

  /* ── 3. 导航交互（三态 + 菜单 + Escape + 焦点）────────────── */
  await preparePage(client, { width: 1440, height: 900, theme: 'light' })
  await navigate(client, `${BASE}/`)
  await settle(client)

  const navTop = await client.evaluate(`document.querySelector('.site-nav').dataset.mode`)
  await client.evaluate(
    `(async () => { for (let i = 1; i <= 20; i++) { window.scrollTo(0, i * 45); await new Promise(r => setTimeout(r, 16)) } })()`,
  )
  await sleep(320)
  const navHidden = await client.evaluate(`document.querySelector('.site-nav').dataset.mode`)
  await client.evaluate(
    `(async () => { const s = window.scrollY; for (let i = 1; i <= 20; i++) { window.scrollTo(0, s - i * 12); await new Promise(r => setTimeout(r, 16)) } })()`,
  )
  await sleep(380)
  const navFloating = await client.evaluate(`(() => {
    const c = document.querySelector('.nav-card')
    return { mode: document.querySelector('.site-nav').dataset.mode, width: Math.round(c.getBoundingClientRect().width) }
  })()`)
  notes.interactions.nav = { navTop, navHidden, navFloating }
  expect(navTop === 'top', `首页初始导航 ${navTop}`)
  expect(navHidden === 'hidden', `下滚后 ${navHidden}`)
  expect(navFloating.mode === 'floating', `上滚后 ${navFloating.mode}`)
  expect(navFloating.width >= 520 && navFloating.width <= 620, `Dock 宽 ${navFloating.width}`)

  // 菜单：Enter 打开 → Escape 关闭 → 焦点回按钮
  await client.evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`)
  await sleep(320)
  const pressKey = async (key, code, vk, text) => {
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      code,
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
      ...(text ? { text, unmodifiedText: text } : {}),
    })
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
    })
  }
  await client.evaluate(`document.querySelector('.nav-menu-trigger').focus()`)
  await pressKey('Enter', 'Enter', 13, '\r')
  await sleep(340)
  const menuOpen = await client.evaluate(`Boolean(document.getElementById('site-nav-menu'))`)
  await pressKey('Escape', 'Escape', 27)
  await sleep(400)
  const menuClosed = await client.evaluate(`Boolean(document.getElementById('site-nav-menu'))`)
  const focusBack = await client.evaluate(
    `document.activeElement === document.querySelector('.nav-menu-trigger')`,
  )
  notes.interactions.menu = { menuOpen, menuClosed, focusBack }
  expect(menuOpen, 'Enter 未打开菜单')
  expect(!menuClosed, 'Escape 未关闭菜单')
  expect(focusBack, 'Escape 关闭后焦点未回到菜单按钮')

  /* ── 4. TOC 与阅读进度 ─────────────────────────────────────── */
  await navigate(client, `${BASE}/articles/blog/qbittorrent`)
  await settle(client)
  const reading = await client.evaluate(`(() => {
    const toc = document.querySelector('aside a[aria-current], aside nav')
    const progress = document.querySelector('[data-reading-progress]')
    return {
      tocPresent: Boolean(toc),
      progressPresent: Boolean(progress),
      progressCount: document.querySelectorAll('[data-reading-progress]').length,
      tocLinks: document.querySelectorAll('aside a[href^="#"]').length,
    }
  })()`)
  notes.interactions.reading = reading
  expect(reading.progressCount >= 1, '阅读进度未渲染')
  expect(reading.tocLinks > 0, 'TOC 没有条目')

  /* ── 5. 页脚语言选择器 ─────────────────────────────────────── */
  const footer = await client.evaluate(`(() => {
    const btn = [...document.querySelectorAll('footer button')].find(b => /中文|English/.test(b.textContent || ''))
    return { present: Boolean(btn), label: (btn?.textContent || '').trim().slice(0, 12) }
  })()`)
  notes.interactions.footerLanguage = footer
  expect(footer.present, '页脚没有语言选择器')

  /* ── 6. 图片预览（点击正文图）──────────────────────────────── */
  await client.evaluate(
    `(() => { const i = document.querySelector('.prose img.md-image'); if (i) i.click(); })()`,
  )
  await sleep(500)
  const preview = await client.evaluate(`(() => {
    const d = document.querySelector('[role="dialog"][aria-modal="true"], .md-preview')
    return { open: Boolean(d) }
  })()`)
  await pressKey('Escape', 'Escape', 27)
  await sleep(300)
  const previewClosed = await client.evaluate(
    `!document.querySelector('[role="dialog"][aria-modal="true"], .md-preview')`,
  )
  notes.interactions.imagePreview = { ...preview, closedByEscape: previewClosed }
  expect(preview.open, '点击正文图未打开预览')
  expect(previewClosed, 'Escape 未关闭图片预览')

  /* ── 7. 移动端：Dock / Toast / 浮动工具不互相遮挡 ──────────── */
  await preparePage(client, { width: 390, height: 844, theme: 'light' })
  await navigate(client, `${BASE}/diaries/155695797663436800`)
  await settle(client, { extraDelay: 900 })
  const mobileOverlap = await client.evaluate(`(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (r.width === 0) return null
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }
    }
    const nav = rect('.site-nav')
    const toolbar = rect('.toolbar-dock')
    const hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    return {
      nav, toolbar,
      overlap: hit(nav, toolbar),
      navBottomGap: nav ? Math.round(window.innerHeight - nav.bottom) : null,
    }
  })()`)
  notes.interactions.mobileOverlap = mobileOverlap
  expect(!mobileOverlap.overlap, `移动端 Dock 与浮动工具重叠`)
  expect(
    mobileOverlap.navBottomGap >= 6 && mobileOverlap.navBottomGap <= 40,
    `移动端 Dock 离底 ${mobileOverlap.navBottomGap}px 不合理`,
  )

  /* ── 8. forced-colors ─────────────────────────────────────── */
  await preparePage(client, { width: 1440, height: 900, theme: 'light' })
  await client.send('Emulation.setEmulatedMedia', {
    media: '',
    features: [{ name: 'forced-colors', value: 'active' }],
  })
  await navigate(client, `${BASE}/diaries/155695797663436800`)
  await settle(client)
  const hc = await client.evaluate(`(() => {
    const active = matchMedia('(forced-colors: active)').matches
    const glass = document.querySelector('.nav-glass')
    const sheet = document.querySelector('.reading-sheet')
    const cs = (el) => el ? getComputedStyle(el) : null
    return {
      active,
      glassBg: cs(glass)?.backgroundColor ?? 'absent',
      glassBlur: cs(glass)?.backdropFilter ?? 'absent',
      sheetBorder: cs(sheet)?.borderTopWidth ?? 'absent',
      focusOutline: (() => {
        const a = document.querySelector('.prose a') || document.querySelector('a')
        if (!a) return 'no-link'
        a.focus()
        return getComputedStyle(a).outlineColor
      })(),
      /**
       * 证明「真的重映射了颜色」的关键证据。
       *
       * 亮色主题下导航链接是墨色（--nav-ink）；若这里读到系统 LinkText 的深蓝，
       * 说明 Chromium 确实走了 forced-colors 的强制配色，而不是只让媒体查询返回 true。
       * 我们自己的规则若没生效，这条会退回墨色 —— 两者能区分开。
       */
      linkColor: (() => {
        const l = document.querySelector('.nav-link')
        return l ? getComputedStyle(l).color : 'absent'
      })(),
      canvasText: (() => {
        const d = document.createElement('div')
        d.style.color = 'CanvasText'
        document.body.appendChild(d)
        const v = getComputedStyle(d).color
        d.remove()
        return v
      })(),
    }
  })()`)
  notes.interactions.forcedColors = hc
  expect(hc.active, 'Chromium 未进入 forced-colors 模式')
  expect(hc.glassBlur === 'none', `forced-colors 下玻璃仍未关闭模糊（${hc.glassBlur}）`)
  expect(hc.canvasText === 'rgb(0, 0, 0)', `CanvasText 未解析成系统色（${hc.canvasText}）`)
  // 墨色 → 系统 LinkText 深蓝，说明强制配色真的生效了，不是只有媒体查询为真
  expect(
    hc.linkColor !== 'rgb(22, 22, 26)' && hc.linkColor !== 'absent',
    `导航链接颜色未被系统接管（${hc.linkColor}），强制配色可能未真正生效`,
  )
  await shoot('forced-colors')
  await client.send('Emulation.setEmulatedMedia', { media: '', features: [] })

  /* ── 9. Print ─────────────────────────────────────────────── */
  await navigate(client, `${BASE}/diaries/155695797663436800`)
  await settle(client, { extraDelay: 600 })
  await client.send('Emulation.setEmulatedMedia', { media: 'print' })
  const print = await client.evaluate(`(() => {
    const d = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : 'absent' }
    const bodyBg = getComputedStyle(document.body).backgroundColor
    const img = document.querySelector('.prose img')
    return {
      nav: d('.site-nav'), spacer: d('.site-nav-spacer'), toolbar: d('.toolbar-dock'),
      aside: d('.reading-aside'), footer: d('footer'), grain: d('.paper-grain'),
      bodyBg,
      imgMaxWidth: img ? getComputedStyle(img).maxWidth : 'absent',
    }
  })()`)
  notes.interactions.print = print
  for (const k of ['nav', 'spacer', 'toolbar', 'aside', 'footer', 'grain']) {
    expect(print[k] === 'none', `打印态 ${k} 未隐藏（${print[k]}）`)
  }
  expect(print.bodyBg === 'rgb(255, 255, 255)', `打印背景不是纯白（${print.bodyBg}）`)
  await shoot('print')
  await client.send('Emulation.setEmulatedMedia', { media: '' })

  /* ── 10. reduced-motion ───────────────────────────────────── */
  await client.send('Emulation.setEmulatedMedia', {
    media: '',
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await navigate(client, `${BASE}/`)
  await settle(client)
  const rm = await client.evaluate(`(() => {
    const card = document.querySelector('.nav-card')
    const cs = card ? getComputedStyle(card) : null
    return { active: matchMedia('(prefers-reduced-motion: reduce)').matches, transition: cs?.transitionDuration ?? 'absent' }
  })()`)
  notes.interactions.reducedMotion = rm
  expect(rm.active, '未进入 reduced-motion 模式')
  // 浏览器把 `transition: none` 读成 `1e-05s`（0.01ms），不能按字符串比 `'0s'`
  const rmSeconds = Number.parseFloat(rm.transition)
  expect(
    Number.isFinite(rmSeconds) && rmSeconds < 0.001,
    `reduced-motion 下过渡仍有 ${rm.transition}（应≈0）`,
  )
  await client.send('Emulation.setEmulatedMedia', { media: '', features: [] })

  /* ── 11. Toast（触发一次站内提示）─────────────────────────── */
  // 订阅面板里的「浏览器通知」按钮会走系统通知；这里只验证 Toast 容器存在且可访问。
  // Toaster 在**空队列时 return null**（`toaster.tsx` 第 41 行），不留空 region
  // 干扰读屏。因此页面上查不到它是**预期行为**，不在这里断言存在。
  // role/aria-live 的映射由 `tests/toaster-a11y.test.tsx` 用 jsdom 覆盖
  // （空状态 / info / success / warning / error / 多条并存 共 7 例）。
  const toaster = await client.evaluate(`(() => {
    const regions = [...document.querySelectorAll('[role="region"]')]
    return { regionCount: regions.length, note: '空队列时不渲染，属预期' }
  })()`)
  notes.interactions.toaster = toaster
  // 只断言"没有多余的 live region 常驻"——这确实是空状态该有的样子
  const strayLive = await client.evaluate(`document.querySelectorAll('[aria-live]').length`)
  notes.interactions.strayLiveRegions = strayLive
  expect(strayLive === 0, `空状态残留 ${strayLive} 个 aria-live 区域（会干扰读屏）`)

  /* ── 12. 控制台错误汇总 ───────────────────────────────────── */
  const fatal = consoleErrors.filter(
    (e) =>
      e.type === 'exception' ||
      /hydrat|did not match|Warning: Text content/i.test(e.text) ||
      (e.type === 'error' && !/Failed to load resource|404/i.test(e.text)),
  )
  notes.console = { total: consoleErrors.length, fatal }
  expect(
    fatal.length === 0,
    `控制台有 ${fatal.length} 条错误/警告:\n${fatal
      .slice(0, 5)
      .map((f) => f.text)
      .join('\n')}`,
  )
} finally {
  client.close()
  await chrome.close()
}

notes.passed = problems.length === 0
notes.problems = problems
writeFileSync(join(OUT, 'report.json'), JSON.stringify(notes, null, 2))

console.log(
  JSON.stringify(
    {
      cls: notes.cls,
      nav: notes.interactions.nav,
      forcedColors: notes.interactions.forcedColors,
      print: notes.interactions.print
        ? { nav: notes.interactions.print.nav, bodyBg: notes.interactions.print.bodyBg }
        : null,
      console: { total: notes.console.total, fatal: notes.console.fatal.length },
    },
    null,
    1,
  ),
)
if (problems.length) {
  console.error(`\n失败 ${problems.length} 项:`)
  for (const p of problems.slice(0, 25)) console.error(' -', p)
  process.exitCode = 1
} else {
  console.log('\n全部通过')
}
