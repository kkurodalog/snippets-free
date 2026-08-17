import { esc, publishedCategories } from './html.mjs';
import { icon } from './icons.mjs';

/**
 * サイトヘッダー。トップとカテゴリ一覧で完全に同一。
 *
 * 構成は3つだけ — ロゴ（トップへ）／「カテゴリ ▾」／「ソースコード」。
 * 600px 以上はドロップダウン、〜599px はハンバーガー。
 * どちらの導線も同じデータから出す（手書きしない）。
 *
 * 〜599px の方式は掲載パーツ components/navigation/004_hamburger-overlay から採る。
 * 採ったのは「3本線のボタン」「右から入るドロワー」「背面の暗幕（押すと閉じる）」
 * 「ドロワーの中の独立した閉じるボタン」の4つ。
 * ⚠️ 3本線を × に変形させない。閉じる手段はドロワーの中の閉じるボタンが持っており、
 *    変形させると同じ役割の表示が2つになる。
 * ⚠️ 色・寸法は本サイトのトークンで組む（参照元の色を持ち込まない）。
 *
 * 暗幕とドロワーは <header> の中に置く。ここから出すと、
 * 開閉の判定範囲（catalog.js の scope）から外れ、ドロワーへフォーカスを移した瞬間に閉じる。
 *
 * ドロワーの中の「ソースコード」はカテゴリのリストから外し、最下部の別ブロックに置く。
 * - カテゴリとは行き先の性質が違う（外部サイト・別タブ）。同じリストの5番目に混ぜない。
 * - PC ヘッダーの「左にカテゴリ・右端にソースコード」という関係と対応する。
 * - カテゴリが8件に増えても位置が変わらない（最下部に固定される）。
 * ⚠️ DOM の順序は 閉じる → カテゴリ → ソースコード のままにする。
 *    視覚上の位置（最下部）と一致しており、フォーカスの順序も同じになる。
 */
export function header({ site, root, currentCategory = null }) {
  const cats = publishedCategories(site);

  const item = (cat, cls) => {
    const current = cat.slug === currentCategory;
    return `<li><a class="${cls}${current ? ' is-current' : ''}" href="${root}components/${cat.slug}/"${
      current ? ' aria-current="page"' : ''
    }>${esc(cat.name)}</a></li>`;
  };

  const sourceLink = (cls) =>
    `<a class="${cls}" href="${esc(site.repoUrl)}" target="_blank" rel="noopener">` +
    `<span class="c-icon" aria-hidden="true">${icon('github')}</span>` +
    `<span>ソースコード</span>` +
    `<span class="c-ext" aria-hidden="true">↗</span></a>`;

  return `    <a class="c-skip-link" href="#main">本文へスキップ</a>
    <header class="l-header">
      <div class="l-header__inner l-container">
        <a class="c-logo" href="${root}">${esc(site.siteName)}</a>

        <nav class="l-header__nav" aria-label="メインナビゲーション">
          <div class="c-dropdown" data-disclosure>
            <button type="button" class="c-dropdown__toggle" id="category-menu-toggle"
              aria-expanded="false" aria-controls="category-menu" data-disclosure-toggle>
              カテゴリ<span class="c-dropdown__glyph" aria-hidden="true"></span>
            </button>
            <ul class="c-dropdown__panel" id="category-menu" data-disclosure-panel>
${cats.map((c) => `              ${item(c, 'c-dropdown__item')}`).join('\n')}
            </ul>
          </div>
          ${sourceLink('c-nav-link')}
        </nav>

        <button type="button" class="c-nav-toggle" id="nav-menu-toggle"
          aria-expanded="false" aria-controls="nav-menu"
          data-disclosure-toggle data-disclosure-overlay="nav-overlay">
          <span class="c-nav-toggle__bar" aria-hidden="true"></span>
          <span class="c-nav-toggle__bar" aria-hidden="true"></span>
          <span class="c-nav-toggle__bar" aria-hidden="true"></span>
          <span class="u-sr-only">メニュー</span>
        </button>
      </div>

      <div class="c-nav-overlay" id="nav-overlay" aria-hidden="true"></div>

      <nav class="c-nav-drawer" id="nav-menu" aria-label="メインナビゲーション" tabindex="-1">
        <button type="button" class="c-nav-drawer__close" data-disclosure-close>
          <span aria-hidden="true">✕</span>
          <span class="u-sr-only">メニューを閉じる</span>
        </button>
        <ul class="c-nav-drawer__list">
${cats.map((c) => `          ${item(c, 'c-nav-drawer__item')}`).join('\n')}
        </ul>
        <div class="c-nav-drawer__foot">
          ${sourceLink('c-nav-drawer__item c-nav-drawer__item--external')}
        </div>
      </nav>
    </header>`;
}
