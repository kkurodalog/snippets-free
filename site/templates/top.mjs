import { esc } from '../partials/html.mjs';
import { page } from '../partials/page.mjs';
import { preview } from '../partials/preview.mjs';

/**
 * トップページ。
 *
 * ファーストビューに置くのは H1 の1本だけ。空きを埋めるために文章や装飾を足さない。
 * その下に「どんな種類のパーツがあるか」を絵で見せるショーケースを並べる。
 *
 * ⚠️ トップに個別パーツを並べない。判断を2階層で繰り返させないため。
 * ⚠️ カテゴリカードに件数を出さない（更新漏れを招き、古いことが画面から分からない）。
 * ⚠️ ショーケースのプレビューは**全カテゴリ動画**に統一する（3:2）。トップに iframe を置かない。
 *    枠の見え方が方式で割れず、初期表示で読み込むものも減る。
 */
export function topPage({ site, categories, root, pagePath, topMediaFor }) {
  const cards = categories
    .map((category) => {
      const media = topMediaFor(category);
      return `            <li class="c-showcase">
              <a class="c-showcase__link" href="${root}components/${esc(category.slug)}/">
                ${preview({
                  mode: 'video',
                  aspect: 'top',
                  video: media.video,
                  poster: media.poster,
                  label: `${category.name}のプレビュー`,
                })}
                <h2 class="c-showcase__name">${esc(category.name)}<span class="c-showcase__arrow" aria-hidden="true">→</span></h2>
              </a>
            </li>`;
    })
    .join('\n');

  const main = `    <main class="l-main" id="main" tabindex="-1">
      <div class="l-container">
        <div class="p-hero">
          <h1 class="p-hero__title">${esc(site.top.title)}</h1>
        </div>

        <section class="p-showcase">
          <ul class="l-grid l-grid--showcase">
${cards}
          </ul>
        </section>
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
