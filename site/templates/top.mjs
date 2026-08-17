import { esc } from '../partials/html.mjs';
import { page } from '../partials/page.mjs';

/**
 * トップページ。
 * ファーストビューに置くのは H1 の1本だけ。空きを埋めるために文章や装飾を足さない。
 * カテゴリ・ショーケースは後続で足す。
 */
export function topPage({ site, root, pagePath }) {
  const main = `    <main class="l-main" id="main" tabindex="-1">
      <div class="l-container">
        <div class="p-hero">
          <h1 class="p-hero__title">${esc(site.top.title)}</h1>
        </div>
      </div>
    </main>`;

  return page({
    site,
    root,
    pagePath,
    title: site.top.title,
    description: site.top.description,
    main,
  });
}
