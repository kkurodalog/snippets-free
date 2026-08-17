import { esc, publishedCategories, repoFileUrl } from './html.mjs';
import { icon } from './icons.mjs';

/**
 * サイトフッター。「ロゴ左 / カテゴリ / リンク」の3ブロック ＋ 最下部にライセンスのリンク1本。
 * リンクはすべてデータから出す（手書きしない）。
 */
export function footer({ site, root }) {
  const cats = publishedCategories(site);

  const catLinks = cats
    .map(
      (c) =>
        `              <li><a class="c-footer__link" href="${root}components/${c.slug}/">${esc(c.name)}</a></li>`
    )
    .join('\n');

  const extLinks = site.externalLinks
    .map(
      (l) =>
        `              <li><a class="c-footer__link" href="${esc(l.href)}" target="_blank" rel="noopener">` +
        `<span class="c-icon" aria-hidden="true">${icon(l.icon)}</span>` +
        `<span>${esc(l.label)}</span>` +
        `<span class="c-ext" aria-hidden="true">↗</span></a></li>`
    )
    .join('\n');

  return `    <footer class="l-footer">
      <div class="l-container">
        <div class="l-footer__blocks">
          <div class="l-footer__brand">
            <a class="c-logo" href="${root}">${esc(site.siteName)}</a>
          </div>
          <div class="l-footer__block">
            <h2 class="c-footer__heading">カテゴリ</h2>
            <ul class="c-footer__list c-footer__list--wrap">
${catLinks}
            </ul>
          </div>
          <div class="l-footer__block">
            <h2 class="c-footer__heading">リンク</h2>
            <ul class="c-footer__list">
${extLinks}
            </ul>
          </div>
        </div>
        <p class="c-footer__license">
          <a class="c-footer__link" href="${esc(repoFileUrl(site, 'LICENSE'))}" target="_blank" rel="noopener">MIT ライセンス<span class="c-ext" aria-hidden="true">↗</span></a>
        </p>
      </div>
    </footer>`;
}
