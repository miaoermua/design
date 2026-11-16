import type { FeatureManifest } from '../types'

export const taxonomyFeature: FeatureManifest = {
  key: 'taxonomy',
  name: '分类与标签',
  description: '按分类与标签重新组织文章，不提供前端伪搜索。',
  routes: ['/tags', '/tags/[tag]', '/categories', '/categories/[slug]'],
  /**
   * 只列**真的会发出的请求**。
   *
   * 曾误写两条实际不存在的接口：
   *   - `GET /categories/:slug` —— `getCategoryBySlug()` 的注释明说「不用这个接口」
   *     （它会把该分类下全部文章一次性塞回来，且无法分页），实现是从 3 条分类列表里查表；
   *   - `GET /categories/:tag?tag=true` —— 标签页走的是扫 `/posts` 后按 `tags` 过滤。
   * 清单写错不会让页面报错，只会让"关模块时它还需要哪些接口"这个问题得到错误答案。
   */
  endpoints: ['GET /categories?type=0', 'GET /categories?type=1', 'GET /posts'],
}
