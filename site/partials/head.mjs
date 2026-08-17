import { esc } from './html.mjs';

/**
 * `<head>` の定型。全ページがこの1枚を通る。
 * ここに列挙した項目が1つでも欠けると生成が止まる（tools/build.mjs の checkHead）。
 *
 * 必須項目: charset / viewport / title / description / canonical / OGP / favicon / 本体CSS
 *
 * canonical と og:url だけは絶対 URL を書く（仕様上そうするしかない）。
 * それ以外のサイト内リンクは root 起点の相対パスで書く。
 *
 * インラインの2行について
 *
 * 1行目 — 360px 以下で表示幅を 360px に固定する。
 * - 実機の最小幅を下回ったときに、文字とボタンが潰れる代わりに縮小表示へ逃がす。
 * - ⚠️ `<head>` で先に走らせる。外殻JS（module / 遅延実行）に相乗りさせると、
 *   最初の描画が一度 `width=device-width` で組まれてから切り替わり、崩れが目に見える。
 * - `resize` で追従させる（縦横の回転・ウィンドウ幅の変更で条件が変わる）。
 * - ⚠️ `resize` の発火時点で `window.outerWidth` が更新前の値を返すことがある
 *   （360px 以下から広げた1回で実測した。`innerWidth` は新しい値、`outerWidth` は古い値）。
 *   そのまま1回だけ判定すると `width=360` のまま貼り付いて戻らないため、
 *   次のフレームでもう一度判定する。判定は現在値との比較付きなので、無駄な書き換えは起きない。
 *   ⚠️ `innerWidth` へ替えて解決しない — 固定中は `innerWidth` が 360 に張り付き、
 *   条件が二度と反転しなくなる。
 * - ⚠️ JS 無効時は `content` が既定値のまま残るだけであり、レイアウトは崩れない。
 *   固定は格上げであって前提ではない。
 *
 * 2行目 — `no-js` → `js` の書き換え。
 * - 書き換えを先に済ませ、開閉する面のちらつき（FOUC）を出さない。
 * - ⚠️ 書き換えたきり戻さないと、外殻JS の取得・解析に失敗したときに
 *   「見えているのに押しても何も起きない」操作要素が残る。JS 無効時は守れていても、
 *   JS が読めなかったときは守れていない状態になる。
 * - そこで、読み込み完了時点で外殻JS が付ける `js-ready` が無ければ `no-js` へ戻す。
 *   `load` は遅延実行のモジュールがすべて走り終えた後に発火するため、時間で見張る必要がない。
 *   失敗時だけ表示が変わるので、正常時にちらつきは起きない。
 *
 * ⚠️ `twitter:card` は `summary`。`og:image` を持つまで `summary_large_image` にしない
 *    （画像のない大判カードは表示が退行する）。OGP 画像はプレビューの poster を流用する予定。
 */
export function head({ site, title, description, root, pagePath }) {
  const pageTitle = title === site.siteName ? title : `${title} | ${site.siteName}`;
  const absUrl = site.siteOrigin + pagePath;
  return `  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>(function(){var m=document.querySelector('meta[name="viewport"]');if(!m)return;function s(){var v=window.outerWidth>360?'width=device-width, initial-scale=1':'width=360';if(m.getAttribute('content')!==v)m.setAttribute('content',v);}addEventListener('resize',function(){s();requestAnimationFrame(s);});s();})();</script>
  <script>(function(){var e=document.documentElement;e.classList.replace('no-js','js');addEventListener('load',function(){if(!e.classList.contains('js-ready'))e.classList.replace('js','no-js');});})();</script>
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(absUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(site.siteName)}">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(absUrl)}">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="${root}assets/css/style.css">
  <script src="${root}assets/js/catalog.js" type="module"></script>`;
}
