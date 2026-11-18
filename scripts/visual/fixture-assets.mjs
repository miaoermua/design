/**
 * 视觉测试素材（唯一来源）
 *
 * 为什么放在脚本侧而不是 public/：这五张 SVG 只服务于 `/visual-tests/markdown`
 * 样张页，既不是站点内容也不是品牌资源，长期躺在 public/ 里会随生产构建一起
 * 发布出去。现在改由视觉测试在运行时释放到系统临时目录，再用 CDP 拦截
 * `/visual-tests/*.svg` 请求把它们喂给浏览器——生产构建里不再有这些文件。
 *
 * 三条约束：
 *   1. 内容与尺寸必须与原文件一致（同样的 viewBox、同样的 1200×900 / 1600×900），
 *      否则 Gallery / Carousel / figure 的排版观感就变了，基线不可比。
 *   2. 不依赖网络：全部是内联 SVG，没有远程地址。
 *   3. 只被 `scripts/visual/*.mjs` 引用，不进入 `src/`——服务端渲染时不会读到它。
 */

export const VISUAL_FIXTURES = [
  {
    /** Markdown 里写的绝对路径，同时也是拦截时匹配的键 */
    route: '/visual-tests/gallery-01.svg',
    name: 'gallery-01.svg',
    width: 1200,
    height: 900,
    /** 原 SVG 内容的 sha256 前 16 位（用于确认素材没有被改写） */
    sha256: '691bed671a3a96e4',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-label="Folio visual fixture 01 warm">
  <rect width="1200" height="900" fill="#f2e7d8"/>
  <circle cx="420" cy="380" r="240" fill="#b4552f" opacity="0.9"/>
  <rect x="640" y="220" width="380" height="380" fill="#c9a227" opacity="0.75"/>
  <text x="64" y="820" font-family="ui-monospace, monospace" font-size="34" fill="#5b4a3a">FIXTURE 01 · WARM</text>
</svg>
`,
  },
  {
    /** Markdown 里写的绝对路径，同时也是拦截时匹配的键 */
    route: '/visual-tests/gallery-02.svg',
    name: 'gallery-02.svg',
    width: 1200,
    height: 900,
    /** 原 SVG 内容的 sha256 前 16 位（用于确认素材没有被改写） */
    sha256: '8ba253acf8407c88',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-label="Folio visual fixture 02 cool">
  <rect width="1200" height="900" fill="#e4ebee"/>
  <circle cx="760" cy="400" r="250" fill="#2f5d6b" opacity="0.85"/>
  <rect x="180" y="240" width="360" height="360" fill="#6f93a8" opacity="0.8"/>
  <text x="64" y="820" font-family="ui-monospace, monospace" font-size="34" fill="#2b3f47">FIXTURE 02 · COOL</text>
</svg>
`,
  },
  {
    /** Markdown 里写的绝对路径，同时也是拦截时匹配的键 */
    route: '/visual-tests/gallery-03.svg',
    name: 'gallery-03.svg',
    width: 1200,
    height: 900,
    /** 原 SVG 内容的 sha256 前 16 位（用于确认素材没有被改写） */
    sha256: '9beac786198fa754',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-label="Folio visual fixture 03 neutral">
  <rect width="1200" height="900" fill="#eceae4"/>
  <rect x="140" y="200" width="300" height="500" fill="#9a9488"/>
  <rect x="500" y="320" width="300" height="380" fill="#6f6a60"/>
  <rect x="860" y="150" width="200" height="550" fill="#b8b2a4"/>
  <text x="64" y="820" font-family="ui-monospace, monospace" font-size="34" fill="#4a463e">FIXTURE 03 · NEUTRAL</text>
</svg>
`,
  },
  {
    /** Markdown 里写的绝对路径，同时也是拦截时匹配的键 */
    route: '/visual-tests/gallery-04.svg',
    name: 'gallery-04.svg',
    width: 1200,
    height: 900,
    /** 原 SVG 内容的 sha256 前 16 位（用于确认素材没有被改写） */
    sha256: '055e03f7a1bc5cca',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img" aria-label="Folio visual fixture 04 dark">
  <rect width="1200" height="900" fill="#1b1e20"/>
  <circle cx="600" cy="420" r="260" fill="#8f4a2c" opacity="0.85"/>
  <circle cx="600" cy="420" r="150" fill="#d8cbb2" opacity="0.55"/>
  <text x="64" y="820" font-family="ui-monospace, monospace" font-size="34" fill="#cfc7b6">FIXTURE 04 · DARK</text>
</svg>
`,
  },
  {
    /** Markdown 里写的绝对路径，同时也是拦截时匹配的键 */
    route: '/visual-tests/figure-wide.svg',
    name: 'figure-wide.svg',
    width: 1600,
    height: 900,
    /** 原 SVG 内容的 sha256 前 16 位（用于确认素材没有被改写） */
    sha256: '6db9cf90a7303906',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-label="Folio visual fixture wide">
  <rect width="1600" height="900" fill="#efe9dc"/>
  <rect x="64" y="64" width="1472" height="772" fill="none" stroke="#c8bda6" stroke-width="2"/>
  <circle cx="1180" cy="330" r="210" fill="#b4552f" opacity="0.92"/>
  <rect x="220" y="470" width="520" height="220" fill="#2f4a52"/>
  <path d="M220 800 L740 800 L480 620 Z" fill="#7d8a6f"/>
  <text x="96" y="140" font-family="Georgia, serif" font-size="44" fill="#2a2721">FOLIO</text>
  <text x="96" y="192" font-family="Georgia, serif" font-size="26" fill="#6b6355">VISUAL FIXTURE · 16:9 · 1600×900</text>
  <text x="96" y="838" font-family="ui-monospace, monospace" font-size="20" fill="#8a8272">/visual-tests/figure-wide.svg</text>
</svg>
`,
  },
]

/** 按文件名索引，便于断言「五张都在」 */
export const FIXTURE_BY_NAME = new Map(VISUAL_FIXTURES.map((item) => [item.name, item]))
