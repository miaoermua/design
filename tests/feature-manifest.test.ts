/**
 * Feature Manifest 契约
 *
 * `src/features/types.ts` 的注释写过「routes 与真实目录一一对应（测试会校对）」，
 * 但在本文件出现之前**并没有**这个测试。缺了它，manifest 就成了装饰品：
 *
 *   - `explore` 与 `archives` 曾各自写 `key: 'archives'`，`featureManifestByKey`
 *     用 key 建索引时后者静默覆盖前者，归档那份永远取不到；
 *   - `explore` 的 routes 里混进了 `/tags`、`/categories`（那两页的守卫是 `taxonomy`），
 *     "关掉一个模块"到底关了哪些路由，从此说不清；
 *   - `projects` / `says` 有开关、有路由、有守卫，却从来没有 manifest。
 *
 * 这四条都不会让构建失败、不会让页面报错，只会在有人真的去关模块时失效。
 * 因此这里把它们钉死。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { featureFlags } from '@/core/registry/features'
import { featureManifests, featureManifestByKey } from '@/features/registry'
import { SRC, walk } from './helpers/design-tokens'

const APP = join(SRC, 'app')

/** 路由模式 → 页面文件：`/a/[b]` → `src/app/a/[b]/page.tsx` */
function pageFile(route: string): string {
  return join(APP, route.replace(/^\//, ''), 'page.tsx')
}

function readPage(route: string): string {
  return readFileSync(pageFile(route), 'utf8')
}

/** 页面顶层声明的守卫键；没有守卫返回 null */
function guardKey(route: string): string | null {
  const source = readPage(route)
  return source.match(/requireFeature\('([a-zA-Z]+)'\)/)?.[1] ?? null
}

/** src/app 下所有「有守卫」的路由，形如 `/articles/[category]/[slug]` */
function guardedRoutes(): string[] {
  const routes: string[] = []
  for (const file of walk(APP)) {
    if (!file.endsWith('page.tsx')) continue
    const source = readFileSync(file, 'utf8')
    if (!/requireFeature\('/.test(source)) continue
    const route = file
      .slice(APP.length)
      .replace(/[\\/]page\.tsx$/, '')
      .replaceAll('\\', '/')
    // 测试样张不是产品路由
    if (route.startsWith('/visual-tests')) continue
    routes.push(route || '/')
  }
  return routes.sort()
}

describe('Feature Manifest：key 必须唯一且是真实开关', () => {
  it('manifest 的 key 互不重复', () => {
    const keys = featureManifests.map((manifest) => manifest.key)
    const dupes = keys.filter((key, index) => keys.indexOf(key) !== index)
    expect(dupes, `以下 key 被多份 manifest 重复声明:\n${dupes.join('\n')}`).toEqual([])
  })

  it('key 索引没有丢条目（重复 key 会静默覆盖）', () => {
    expect(Object.keys(featureManifestByKey).length).toBe(featureManifests.length)
  })

  it('每个 key 都在 featureFlags 里，且拼写一致', () => {
    for (const manifest of featureManifests) {
      expect(
        Object.hasOwn(featureFlags, manifest.key),
        `${manifest.key} 不是 featureFlags 的键（开关名拼错等于没有开关）`,
      ).toBe(true)
    }
  })

  it('name / description 不是占位符', () => {
    for (const manifest of featureManifests) {
      expect(manifest.name.trim().length, `${manifest.key} 的 name 为空`).toBeGreaterThan(0)
      expect(
        manifest.description.trim().length,
        `${manifest.key} 的 description 为空`,
      ).toBeGreaterThan(6)
      // TODO / 待补 / xxx 这类占位写法
      expect(manifest.description, `${manifest.key} 的 description 是占位符`).not.toMatch(
        /TODO|待补|xxx|占位/i,
      )
    }
  })
})

describe('Feature Manifest：routes 必须对应真实页面', () => {
  it('每条 route 都能找到 page.tsx', () => {
    const missing: string[] = []
    for (const manifest of featureManifests) {
      for (const route of manifest.routes) {
        try {
          readPage(route)
        } catch {
          missing.push(`${manifest.key} → ${route}`)
        }
      }
    }
    expect(missing, `以下 route 没有对应的 page.tsx:\n${missing.join('\n')}`).toEqual([])
  })

  it('每条 route 顶层的 requireFeature 与所属 manifest 的 key 一致', () => {
    const mismatched: string[] = []
    for (const manifest of featureManifests) {
      for (const route of manifest.routes) {
        const key = guardKey(route)
        if (key === null) mismatched.push(`${manifest.key} → ${route}：页面没有 requireFeature`)
        else if (key !== manifest.key) {
          mismatched.push(`${manifest.key} → ${route}：页面守的是 '${key}'`)
        }
      }
    }
    expect(mismatched, `清单与守卫不一致:\n${mismatched.join('\n')}`).toEqual([])
  })

  it('同一路由不被两份 manifest 同时声明', () => {
    const owners = new Map<string, string[]>()
    for (const manifest of featureManifests) {
      for (const route of manifest.routes) {
        owners.set(route, [...(owners.get(route) ?? []), manifest.key])
      }
    }
    const shared = [...owners.entries()]
      .filter(([, keys]) => new Set(keys).size > 1)
      .map(([route, keys]) => `${route} ← ${[...new Set(keys)].join(' + ')}`)
    expect(shared, `路由被多个模块重复声明:\n${shared.join('\n')}`).toEqual([])
  })
})

describe('Feature Manifest：endpoints 必须对应真实请求', () => {
  /**
   * 这条守的是 `search` 那种错：manifest 写 `GET /search/post`，实际
   * `requestV2('/search')`。页面照常工作，清单却一直在骗人。
   *
   * 判据：把 `GET /xxx/:id` 归一成 `/xxx`，再分别检查 requestV2 / postV2
   * 中对应的 GET / POST 路径。只查路径会让 GET 冒充 POST，因此同时锁住方法。
   */
  const apiSource = walk(join(SRC, 'lib/api'))
    .filter((file) => /\.ts$/.test(file))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')

  /** `GET /posts/:category/:slug` → `/posts`；`GET /categories?type=0` → `/categories` */
  /**
   * endpoint 归一：去掉方法前缀与 query，**每一段**动态段都换成 `:param`。
   * 例：`GET /posts/:category/:slug` → `/posts/:param/:param`
   */
  function basePath(endpoint: string): string {
    const path = endpoint.replace(/^\w+\s+/, '').split('?')[0]
    return path
      .split('/')
      .map((seg) => (seg.startsWith(':') ? ':param' : seg))
      .join('/')
  }

  /** API 层所有 GET / POST 请求里的路径字面量（去掉 query 与模板变量） */
  function requestedPaths(): Set<string> {
    const set = new Set<string>()
    // 单引号或反引号开头的路径；模板串里的 ${x} 会被后续归一掉
    for (const m of apiSource.matchAll(/\b(requestV2|postV2)(?:<[^>]*>)?\(\s*[`'"](\/[^`'"]*)/g)) {
      const method = m[1] === 'requestV2' ? 'GET' : 'POST'
      const path = m[2].replace(/\$\{[^}]*\}/g, ':param').split('?')[0]
      set.add(`${method} ${path}`)
    }
    return set
  }
  const requested = requestedPaths()

  /**
   * endpoint 是否被真实请求覆盖。
   *
   * **必须逐段相等，不能用前缀**：`/search/post` 与 `/search` 是两条不同的接口，
   * 前缀匹配会让"写错路径"这种错静默通过 —— 我第一版就是这么写的，
   * 注入 `/search/post` 后测试照样绿。教训：守护测试的注入验证不能省。
   */
  function isRequested(endpoint: string): boolean {
    const method = endpoint.slice(0, endpoint.indexOf(' '))
    const base = basePath(endpoint)
    // 逐段比较：`/pages/slug/:param` 应对上 API 层的 `` `/pages/slug/${x}` ``（同样归一为 :param）
    for (const request of requested) {
      const separator = request.indexOf(' ')
      if (request.slice(0, separator) === method && request.slice(separator + 1) === base) {
        return true
      }
    }
    return false
  }

  it('每个 endpoint 的路径都能在 API 层找到对应请求', () => {
    const missing: string[] = []
    for (const manifest of featureManifests) {
      for (const endpoint of manifest.endpoints) {
        const base = basePath(endpoint)
        if (!isRequested(endpoint)) missing.push(`${manifest.key} → ${endpoint}（归一为 ${base}）`)
      }
    }
    expect(missing, `以下 endpoint 在 API 层找不到对应请求:\n${missing.join('\n')}`).toEqual([])
  })

  it('至少真的扫到了请求路径（防止正则失效导致恒过）', () => {
    expect(requested.size).toBeGreaterThan(10)
  })

  it('endpoint 写法统一为「方法 + 路径」', () => {
    for (const manifest of featureManifests) {
      for (const endpoint of manifest.endpoints) {
        expect(endpoint, `${manifest.key} 的 ${endpoint} 缺方法前缀`).toMatch(
          /^(GET|POST|PUT|PATCH|DELETE) \//,
        )
      }
    }
  })
})

describe('Feature Manifest：覆盖率', () => {
  it('每个带守卫的路由都被某份 manifest 覆盖', () => {
    const declared = new Set(featureManifests.flatMap((manifest) => manifest.routes))
    const uncovered = guardedRoutes().filter((route) => !declared.has(route))
    expect(
      uncovered,
      `以下路由有 requireFeature 却没有登记 manifest（关模块时会被漏掉）:\n${uncovered.join('\n')}`,
    ).toEqual([])
  })

  it('routes 里的动态段写法与 Next 目录一致', () => {
    for (const manifest of featureManifests) {
      for (const route of manifest.routes) {
        // 只允许 [param] 形式；[param]x、[[...rest]] 之类本项目没有使用
        const dynamic = route.match(/\[[^\]]*\]/g) ?? []
        for (const segment of dynamic) {
          expect(segment, `${route} 的动态段 ${segment} 写法不合法`).toMatch(/^\[[a-z]+\]$/)
        }
      }
    }
  })
})
