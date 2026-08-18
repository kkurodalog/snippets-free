import { esc, publishedCategories } from '../partials/html.mjs';
import { page } from '../partials/page.mjs';
import { card } from '../partials/card.mjs';
import { codeModal } from '../partials/modal.mjs';
import { tagOrder, VERIFICATION_ITEMS } from '../partials/parts.mjs';

/**
 * カテゴリ一覧ページ。このサイトの主戦場。
 *
 * 上から パンくず → H1（件数つき）→ タグフィルタ → カード一覧 → 他カテゴリ導線。
 *
 * ⚠️ 件数は「タグの件数」も「H1 横の件数」も**データから数える**。
 *    手で書く数字を1つも画面に出さない（古くなったことが画面から分からなくなるため）。
 *    数えられない状況が来たら、片方だけ残さず両方落とす。
 *
 * ⚠️ タグフィルタは JS が要る。JS 無効では UI ごと出さず、全件がそのまま並ぶ。
 * ⚠️ カード上のコードボタンは JS を要さない（ファイルへのリンク）。こちらは常に出す。
 */

/** パンくず。構造化データ（BreadcrumbList）もここで1回だけ出す。 */
function breadcrumb({ site, category, root, pagePath }) {
  const topUrl = site.siteOrigin;
  const selfUrl = site.siteOrigin + pagePath;
  const jsonLd = [
    '{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[',
    `{"@type":"ListItem","position":1,"name":"TOP","item": "${topUrl}"},`,
    `{"@type":"ListItem","position":2,"name":${JSON.stringify(category.name)},"item": "${selfUrl}"}`,
    ']}',
  ].join('\n');

  return `        <nav class="c-breadcrumb" aria-label="パンくず">
          <ol class="c-breadcrumb__list">
            <li class="c-breadcrumb__item"><a class="c-breadcrumb__link" href="${root}">TOP</a></li>
            <li class="c-breadcrumb__item" aria-current="page">${esc(category.name)}</li>
          </ol>
        </nav>
        <script type="application/ld+json">
${jsonLd}
        </script>`;
}

/**
 * 動画プレビューの全停止トグル。
 *
 * ★自動再生する動画には、ページ内に止める手段が要る（WCAG 2.2.2 / Level A）。
 *   ビューポート内だけ再生する方式は変えない。**止める手段だけを足す**。
 *
 * - 出すのは**動画カテゴリだけ**。実DOM再生のカテゴリには置かない（止める対象が無い）
 * - 既定は `hidden`。**外殻JS が `[data-preview-video]` の実在を確かめてから外す**。
 *   収録素材が入るまでは動画が1本も出ないため、素材の無い状態では出ない
 * - 状態は `aria-pressed`。⚠️ **白の塗りを使わない**（白の塗りはアクティブなタグと
 *   コピーボタンの2箇所限定）。状態は面と枠の明度差 ＋ ✓ で示す
 * - ラベルは **「プレビューを停止」**（★代表確定 / 2026-08-18）。⚠️ **読み上げ用の見出しと
 *   同じ文言にする**（下の `heading`）。片方だけ直すと、耳で聞く名前と見える名前がずれる
 * - JS が要る操作要素なので `.no-js` では出さない（`data-tagfilter` の内側にあり、
 *   さらに CSS 側でも明示的に列挙している）
 */
function stopToggle({ category }) {
  if (category.preview !== 'video') return '';
  return (
    `            <button type="button" class="c-stop-toggle" data-stop-videos aria-pressed="false" hidden>` +
    `<span class="c-stop-toggle__check" aria-hidden="true">✓</span>` +
    `<span>プレビューを停止</span></button>`
  );
}

/**
 * タグフィルタ。
 * - 実在するタグだけを出す（0件のタグを出さない）
 * - 状態は `aria-pressed`。単一選択
 * - アクティブは「塗りの反転 ＋ 太字 ＋ ✓」。白の塗りを使ってよい箇所の1つ
 *
 * ★並び順は「すべて」を左端に固定し、以降は**必要な要素が少ないものから左へ**並べる。
 *   順序の正本は `site/partials/parts.mjs` の `TAGS`（語彙と同じ1本）。
 *   ⚠️ カテゴリごとにデータの並び順で出すと、同じ「CSSのみ」がページによって
 *      左にも右にも現れる。**利用者は同じ場所を2度探すことになる。**
 *
 * ⚠️ 件数には読み上げ用の単位を付ける。数字だけだと「すべて 7」と読まれ、
 *    H1 横の「7件」と単位が揃わない（画面では chip の幅を詰めたいので数字だけ出す）。
 *
 * ★行の右端に動画の全停止トグルを置く。操作系を1行にまとめ、行を増やさない
 *   （行が増えるとカードまでの距離が伸びる）。
 *   ⚠️ ★例外が1つある（★代表判断 / 2026-08-18）— **1行に物理的に収まらないときだけ2行になる**。
 *      具体的には既定フォントを大きくしている利用者で、トグル1個が行より広くなる条件である。
 *      ★覆されたのは「1行を維持する」側であり、例外を認めたのは★代表判断である。
 *      行を増やしてよい条件を広げたのではない。
 *   ⚠️ この例外を落とすとページ本体に横スクロールが出る（WCAG 1.4.10 / Level AA）。
 *      「行を増やさない」を根拠に、CSS 側の `flex-wrap: wrap` を取り残しと見て外さないこと
 *      （条件と実測値は style.css の .c-tagfilter / .c-stop-toggle のコメントにある）。
 *
 * ⚠️ 読み上げ用の見出しは、**この塊に実際に入っているもの**を名乗らせる。
 *    見出しで移動する利用者には、次の見出しまでが見出しの担当範囲に読める。
 *    トグルを同じ塊に置いた以上、「タグでしぼり込む」だけだと再生の停止が
 *    絞り込みの配下にあるように読める。トグルを出すページでは見出しの側を足す。
 *    ⚠️ トグルの無いページで「再生」と名乗らせない（そのページには無い操作である）。
 */
function tagFilter({ category }) {
  const counts = new Map();
  for (const part of category.parts) {
    for (const tag of part.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  if (counts.size === 0) return '';

  const chip = (label, value, count, active) =>
    `            <li><button type="button" class="c-tag" data-tag="${esc(value)}"` +
    ` aria-pressed="${active ? 'true' : 'false'}">` +
    `<span class="c-tag__check" aria-hidden="true">✓</span>` +
    `<span class="c-tag__label">${esc(label)}</span>` +
    `<span class="c-tag__count">${count}<span class="u-sr-only">件</span></span></button></li>`;

  // ★並び順は `parts.mjs` の TAGS が持つ（ページごとに手で並べない）。
  //    データに現れた順のまま出すと、同じタグでもカテゴリごとに左右が入れ替わる。
  const ordered = [...counts].sort((a, b) => tagOrder(a[0]) - tagOrder(b[0]));
  const chips = [chip('すべて', '', category.parts.length, true)];
  for (const [tag, count] of ordered) chips.push(chip(tag, tag, count, false));

  const toggle = stopToggle({ category });
  const heading = toggle ? 'タグでしぼり込む・プレビューを停止' : 'タグでしぼり込む';

  return `        <div class="c-tagfilter" data-tagfilter>
          <h2 class="u-sr-only">${heading}</h2>
          <ul class="c-tagfilter__list">
${chips.join('\n')}
          </ul>
${toggle}
        </div>`;
}

/**
 * モーダルが使う「コードでは表せない情報」。
 *
 * ★ここに**コードは1バイトも入れない**。コードは開いたときに実ファイルから読む
 *   （カタログ側に写しを持たない = 乖離が構造的に起きない）。
 *   ここに置くのは、実ファイルからは分からない3つだけである。
 *     - article      … 解説記事の URL（無いパーツでは記事リンクを出さない。非活性にしない）
 *     - notes        … 使うときの注記（最大3項目・言い切り）
 *     - verification … 掲載基準4項目のどれを満たしたかと、その実測日
 *
 * ★パーツ名・ファイルの種類・ファイルのパス・デモの場所は**ここに書かない**。
 *   いずれもカードの DOM に既にあり、モーダルはそこから読む。同じ値を2箇所に置かない。
 *
 * ★検証行の文言（4項目のラベル）もここから配る。
 *   ラベルの正本は site/partials/parts.mjs の VERIFICATION_ITEMS で、
 *   その中身は CODING-RULES.md「1. 掲載基準（4項目）」と同じ文言である。
 *   ⚠️ 画面側で文字列を組み立てると、公開している基準と画面の表示が割れる。
 *
 * ⚠️ `</script>` と `<` を実体で書けないため、`<` を \u003c へ逃がす
 *    （JSON としては同じ文字列であり、読み手も画面も変わらない）。
 */
function partsMeta({ category }) {
  const parts = {};
  for (const part of category.parts) {
    const entry = {};
    if (part.article) entry.article = part.article;
    if (part.notes?.length) entry.notes = part.notes;
    if (part.verification) entry.verification = part.verification;
    if (part.verifiedOn) entry.verifiedOn = part.verifiedOn;
    parts[part.slug] = entry;
  }
  const json = JSON.stringify({ verificationItems: VERIFICATION_ITEMS, parts }).replace(/</g, '\\u003c');
  // 字下げは隣に置く <dialog>（4スペース）と揃える。生成物の差分を読むときのノイズになる。
  return `    <script type="application/json" data-parts-meta>${json}</script>`;
}

/** 他のカテゴリへ。カード一覧を飛ばした先でもある。 */
function otherCategories({ site, category, root }) {
  const others = publishedCategories(site).filter((c) => c.slug !== category.slug);
  if (others.length === 0) return '';
  const links = others
    .map(
      (c) =>
        `            <li><a class="c-otherlink" href="${root}components/${c.slug}/">${esc(c.name)}</a></li>`
    )
    .join('\n');
  return `        <nav class="p-others" id="other-categories" aria-labelledby="other-categories-heading" tabindex="-1">
          <h2 class="p-others__heading" id="other-categories-heading">他のカテゴリへ</h2>
          <ul class="p-others__list">
${links}
          </ul>
        </nav>`;
}

export function categoryPage({ site, category, root, pagePath, mediaFor }) {
  const count = category.parts.length;

  const list =
    count === 0
      ? `        <p class="p-empty">このカテゴリのパーツは準備中です。</p>`
      : `        <div class="c-skip-anchor"><a class="c-skip-link c-skip-link--inflow" href="#other-categories">カード一覧を飛ばす</a></div>
        <ul class="l-grid" data-cards>
${category.parts.map((part) => card({ category, part, media: mediaFor(part) })).join('\n')}
        </ul>`;

  // ⚠️ 空の分岐で改行だけを残さない（生成物に無意味な空行が1本増える）。
  //    連結する側に改行を持たせる。
  const modal = count === 0 ? '' : `\n${partsMeta({ category })}\n${codeModal()}`;

  const main = `    <main class="l-main" id="main" tabindex="-1">
      <div class="l-container">
${breadcrumb({ site, category, root, pagePath })}
        <h1 class="p-listing__title">${esc(category.name)}<span class="p-listing__count">${count}件</span></h1>
${tagFilter({ category })}
${list}
${otherCategories({ site, category, root })}
      </div>
    </main>${modal}`;

  return page({
    site,
    root,
    pagePath,
    title: category.name,
    description: category.description,
    currentCategory: category.slug,
    main,
  });
}
