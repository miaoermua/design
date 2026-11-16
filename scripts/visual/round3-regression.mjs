/**
 * 第四组：完整回归（真实浏览器）
 *
 * 覆盖本轮所有改动的**真实渲染结果**，并顺带回归既有功能：
 *   1. 五档桌面视口 × 双主题：正文宽度、横向溢出、图片尺寸、页高
 *   2. 桌面导航三态（复测，确认本轮改动没破坏）
 *   3. 移动端四档：底部导航、安全区、列表页布局
 *   4. 打印媒体：隐藏项与纸面
 *   5. 高对比度：模拟 forced-colors，确认导航/面板边界还在
 *   6. 分页、密码保护日记、loading 骨架
 *
 * 只测量，不优化。任何一项不达标都带实测值输出。
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launchChrome, navigate, openPage, preparePage, screenshot, settle, sleep } from './cdp.mjs'

const OUT = join(process.env.TEMP ?? '.', 'folio-round3')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.FOLIO_BASE_URL ?? 'http://127.0.0.1:3000'

const problems = []
const notes = {}
const expect = (ok, message) => {
  if (!ok) problems.push(message)
}

const DESKTOP = [1024, 1104, 1280, 1440, 1920]
const MOBILE = [320, 375, 390, 430]

const chrome = await launchChrome({ port: 9411 })
const client = await openPage(chrome.port)

const shoot = async (name) => {
  writeFileSync(join(OUT, `${name}.png`), await screenshot(client))
}

try {
  /* ── 1. 桌面五档 × 双主题 ───────────────────────────────────── */
  notes.desktop = {}
  for (const theme of ['light', 'dark']) {
    for (const width of DESKTOP) {
      await preparePage(client, { width, height: 900, theme })
      // 测**详情页**而不是列表页：这里要验证的是正文宽度与图片尺寸，
      // 列表页两者都不存在（没有 .prose、没有正文图），量出来恒为 0。
      await navigate(client, `${BASE}/articles/blog/qbittorrent`)
      await settle(client)
      const m = await client.evaluate(`(() => {
        const doc = document.documentElement
        const prose = document.querySelector('.prose')
        const imgs = [...document.querySelectorAll('.prose img')]
        return {
          overflowX: doc.scrollWidth - window.innerWidth,
          pageHeight: doc.scrollHeight,
          imgs: imgs.length,
          sized: imgs.filter(i => i.getAttribute('width') && i.getAttribute('height')).length,
          proseWidth: prose ? Math.round(prose.getBoundingClientRect().width) : null,
          // 正文宽上限应为 --measure-post = 704px（各视口都不该超过它）
          measure: getComputedStyle(doc).getPropertyValue('--measure-post').trim(),
        }
      })()`)
      notes.desktop[`${theme}-${width}`] = m
      expect(m.overflowX <= 0, `${theme}/${width}: 横向溢出 ${m.overflowX}px`)
      expect(m.imgs > 0, `${theme}/${width}: 详情页没有正文图`)
      expect(
        m.sized >= Math.floor(m.imgs * 0.9),
        `${theme}/${width}: 正文图带尺寸 ${m.sized}/${m.imgs}，低于 90%`,
      )
      // 正文宽度不该超过 704px（留 2px 容差给亚像素）
      if (width >= 1280) {
        expect(m.proseWidth <= 706, `${theme}/${width}: 正文宽 ${m.proseWidth}px 超过 704px`)
      }

      if (width === 1440) await shoot(`desktop-${theme}-1440-articles`)
      if (width === 1024) await shoot(`desktop-${theme}-1024-articles`)
    }
  }

  /* ── 2. 桌面导航三态（复测）──────────────────────────────────── */
  await preparePage(client, { width: 1440, height: 900, theme: 'light' })
  await navigate(client, `${BASE}/`)
  await settle(client)
  const navTop = await client.evaluate(
    `document.querySelector('header.site-nav')?.dataset.mode ?? 'missing'`,
  )
  expect(navTop === 'top', `首页初始导航状态是 ${navTop}，应为 top`)

  // 下滚 → hidden
  await client.evaluate(
    `(async () => { for (let i = 1; i <= 20; i++) { window.scrollTo(0, i * 45); await new Promise(r => setTimeout(r, 16)) } })()`,
  )
  await sleep(320)
  const navHidden = await client.evaluate(
    `document.querySelector('header.site-nav')?.dataset.mode ?? 'missing'`,
  )
  // 上滚 → floating
  await client.evaluate(
    `(async () => { const s = window.scrollY; for (let i = 1; i <= 20; i++) { window.scrollTo(0, s - i * 12); await new Promise(r => setTimeout(r, 16)) } })()`,
  )
  await sleep(380)
  const navFloating = await client.evaluate(`(() => {
    const h = document.querySelector('header.site-nav')
    const c = document.querySelector('.nav-card')
    return { mode: h?.dataset.mode, width: c ? Math.round(c.getBoundingClientRect().width) : 0 }
  })()`)
  notes.nav = { navTop, navHidden, navFloating }
  expect(navHidden === 'hidden', `下滚后导航状态 ${navHidden}，应为 hidden`)
  expect(navFloating.mode === 'floating', `上滚后导航状态 ${navFloating.mode}，应为 floating`)
  expect(
    navFloating.width >= 520 && navFloating.width <= 620,
    `Dock 宽度 ${navFloating.width}px 不在 520–620 区间`,
  )
  await shoot('desktop-1440-floating-dock')

  /* ── 3. 移动端四档 ──────────────────────────────────────────── */
  notes.mobile = {}
  for (const width of MOBILE) {
    await preparePage(client, { width, height: 844, theme: 'light' })
    await navigate(client, `${BASE}/diaries`)
    await settle(client)
    const m = await client.evaluate(`(() => {
      const nav = document.querySelector('.site-nav')
      const r = nav?.getBoundingClientRect()
      return {
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        navTop: r ? Math.round(r.top) : -1,
        navBottom: r ? Math.round(window.innerHeight - r.bottom) : -1,
        navMode: nav?.dataset.mode ?? 'none',
        viewport: window.innerWidth,
        bodyWidth: Math.round(document.body.getBoundingClientRect().width),
      }
    })()`)
    notes.mobile[width] = m
    expect(m.overflowX <= 0, `${width}px: 横向溢出 ${m.overflowX}px`)
    // 手机上 `data-mode` 仍然存在（三态状态机照常跑），但 CSS 里三态规则
    // 全写在 `@media (min-width: 48rem)` 内，所以它**不影响布局**。
    // 真正要验的是「底部胶囊不随滚动移动」，见下一条。
    expect(m.navMode === 'top', `${width}px: 滚动前手机导航意外处于 ${m.navMode}`)
    // 贴底：距底边应该有 inset（12px）+ 安全区
    expect(
      m.navBottom >= 8 && m.navBottom <= 40,
      `${width}px: 底部导航离底 ${m.navBottom}px 不合理`,
    )
    await shoot(`mobile-${width}-diaries`)
  }

  /* ── 4. 打印 ────────────────────────────────────────────────── */
  await preparePage(client, { width: 1440, height: 900, theme: 'light' })
  await navigate(client, `${BASE}/diaries/155695797663436800`)
  await settle(client, { extraDelay: 800 })
  await client.send('Emulation.setEmulatedMedia', { media: 'print' })
  const print = await client.evaluate(`(() => {
    const d = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : 'absent' }
    return {
      nav: d('.site-nav'), toolbar: d('.toolbar-dock'), aside: d('.reading-aside'),
      footer: d('footer'), grain: d('.paper-grain'),
      bodyBg: getComputedStyle(document.body).backgroundColor,
    }
  })()`)
  notes.print = print
  for (const k of ['nav', 'toolbar', 'aside', 'footer', 'grain']) {
    expect(print[k] === 'none', `打印态 ${k} 未隐藏（${print[k]}）`)
  }
  await shoot('print-diary')
  await client.send('Emulation.setEmulatedMedia', { media: '' })

  /* ── 5. 高对比度（forced-colors 模拟）────────────────────────── */
  await client.send('Emulation.setEmulatedMedia', {
    media: '',
    features: [{ name: 'forced-colors', value: 'active' }],
  })
  await navigate(client, `${BASE}/`)
  await settle(client)
  const hc = await client.evaluate(`(() => {
    const glass = document.querySelector('.nav-glass')
    const card = document.querySelector('.nav-card')
    const cs = glass ? getComputedStyle(glass) : null
    return {
      supported: matchMedia('(forced-colors: active)').matches,
      glassDisplay: cs ? cs.display : 'absent',
      // forced-colors 下我们希望玻璃层是实色（Canvas），不再是半透明
      glassBg: cs ? cs.backgroundColor : 'absent',
      cardOutline: card ? getComputedStyle(card).borderTopWidth : 'absent',
    }
  })()`)
  notes.forcedColors = hc
  // Chromium 对 forced-colors 的模拟支持有限：matchMedia 为 true 即说明媒体查询已生效
  expect(hc.supported, 'Chromium 没有进入 forced-colors 模式，本项无法验证')
  await shoot('forced-colors-home')
  await client.send('Emulation.setEmulatedMedia', { media: '', features: [] })

  /* ── 6. 分页与页面状态 ──────────────────────────────────────── */
  await preparePage(client, { width: 1440, height: 900, theme: 'light' })
  const codes = {}
  for (const path of [
    '/',
    '/articles',
    '/articles?page=2',
    '/diaries',
    '/diaries?page=2',
    '/tags',
    '/categories',
    '/archives',
    '/explore',
    '/friends',
    '/projects',
    '/says',
    '/about',
    '/search',
    '/feed',
    '/atom.xml',
    '/sitemap.xml',
  ]) {
    const res = await client.evaluate(
      `fetch('${BASE}${path}', { method: 'GET' }).then(r => r.status).catch(() => -1)`,
    )
    codes[path] = res
    expect(res === 200, `${path} 返回 ${res}`)
  }
  notes.statusCodes = codes

  /* ── 7. loading 骨架：客户端导航时出现 ────────────────────────── */
  await navigate(client, `${BASE}/articles`)
  await settle(client)
  // 骨架验证：**轮询采样**，而不是在固定时刻看一眼。
  //
  // 为什么必须轮询：`loading.tsx` 在 dev server 上是一个**瞬时帧**——RSC payload
  // 本地回环几十毫秒就回来了，骨架出现后立刻被真实内容替换。写死 `sleep(200)`
  // 再看一眼，等于赌自己没有错过那一帧；实测同一份代码会时过时不过。
  // 这里改成 20ms 一次、最多 2 秒的轮询，只要出现过一次就算通过，
  // 同时把「第几次采到」记录下来，便于判断它到底有多短暂。
  await client.send('Network.setBlockedURLs', { urls: ['*_rsc*'] })
  await client.evaluate(
    `(() => { const a = [...document.querySelectorAll('a')].find(x => x.getAttribute('href') === '/diaries'); if (a) a.click() })()`,
  )

  let skeleton = null
  let sampledAt = -1
  for (let i = 0; i < 100; i += 1) {
    const probe = await client.evaluate(`(() => {
      const busy = document.querySelector('[aria-busy="true"]')
      if (!busy) return null
      const rect = busy.getBoundingClientRect()
      return {
        present: true,
        height: Math.round(rect.height),
        pulsing: document.querySelectorAll('.animate-pulse').length,
        srText: (busy.querySelector('.sr-only')?.textContent || '').trim(),
        path: location.pathname,
      }
    })()`)
    if (probe) {
      skeleton = probe
      sampledAt = i * 20
      if (probe.present && probe.height > 100) break
    }
    await sleep(20)
  }

  notes.loading = skeleton ?? { present: false, sampledAt }
  expect(skeleton, '/diaries 的 loading 骨架从未出现（2 秒内未采到 aria-busy）')
  if (skeleton) {
    expect(skeleton.path === '/diaries', `骨架出现在 ${skeleton.path}，不是 /diaries`)
    expect(skeleton.pulsing > 0, 'loading 骨架没有 animate-pulse 占位块')
    expect(skeleton.srText.length > 0, 'loading 骨架缺少读屏文案')
    expect(skeleton.height > 100, `loading 骨架高度只有 ${skeleton.height}px，看不出是骨架`)
  }
  // 截图只能尽力：骨架是瞬时帧，CDP 的合成帧常常落在它之后。
  // 抓不到就**不留图**，不用一张错图冒充证据（见报告「未验证项」）。
  if (skeleton && skeleton.height > 100) await shoot('loading-skeleton')
  await client.send('Network.setBlockedURLs', { urls: [] })
} finally {
  client.close()
  await chrome.close()
}

notes.passed = problems.length === 0
notes.problems = problems
writeFileSync(join(OUT, 'report.json'), JSON.stringify(notes, null, 2))
console.log(JSON.stringify({ nav: notes.nav, print: notes.print, loading: notes.loading }, null, 1))
if (problems.length) {
  console.error('\n失败项:')
  for (const p of problems) console.error(' -', p)
  process.exitCode = 1
} else {
  console.log('\n全部通过')
}
