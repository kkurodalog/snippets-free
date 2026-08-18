import { esc } from './html.mjs';
import { preview } from './preview.mjs';
import { PART_FILES, PART_FILE_LABELS } from './parts.mjs';

/**
 * カテゴリ一覧のカード（本サイトの中心部品）。
 *
 * 構成は3段
 *   1. プレビュー（リンクにしない。<a> の中に <button> は置けないため、枠ごとリンクにしない）
 *   2. パーツ名（1行）
 *   3. ボタン行 … 左「デモ」＝別画面へ ／ 右 [HTML][CSS][JS] ＝その場でコードを見る
 *
 * ⚠️ 「デモ」と「コード」の区別を色に依存させない。区別は4つの手段で作る。
 *      塗りの有無（枠線だけ / 塗りあり）・書体（和文 / 等幅）・記号（↗ / なし）・
 *      まとまり方（単独 / 3つを連結したセグメント）。加えて群と群の間に縦罫を1本入れる。
 *
 * ⚠️ パーツ名に `white-space: nowrap` を持ち込まない。3列グリッドの狭い幅で溢れる。
 *    収まらない名前は名前のほうを短くする（CSS で1行に押し込めない）。
 *
 * ★コードボタンは「そのファイルへのリンク」として出す。
 *   後続工程でモーダルへ格上げするが、格上げの前後で行き先が同じファイルであるため、
 *   今の時点でも押せば中身に到達できる。押しても何も起きないボタンを画面に置かない。
 *   ⚠️ したがってこのボタンは JS を必要としない。`.no-js` で隠す対象ではない。
 */
export function card({ category, part, media }) {
  const dir = `./${part.slug}/`;
  const actionsId = `${part.slug}-actions`;
  const isDom = category.preview === 'dom';

  // 実DOM再生のカードだけ、プレビュー内のフォーカス可能要素を飛ばす出口を置く。
  // 動画のカードは中にフォーカスできる要素が無いため置かない。
  //
  // ⚠️ 飛び先の .c-card__actions には tabindex="-1" を付ける（下の組み立てを参照）。
  //    付けないと「連続フォーカスナビゲーションの起点」が移るだけで、要素自身は
  //    フォーカスを受け取らない。Chromium は起点の移動で結果的に飛べるが、
  //    Safari はフラグメント遷移で起点を移さない実装が長くあり、そこでは
  //    次の Tab がページ先頭へ戻る。同じページの #main / #other-categories は
  //    どちらも tabindex="-1" を持っており、作法をそちらへ揃える。
  const skip = isDom
    ? `<a class="c-skip-link c-skip-link--card" href="#${esc(actionsId)}">このデモのプレビューを飛ばす</a>`
    : '';

  const previewHtml = preview({
    mode: category.preview,
    aspect: category.previewAspect,
    href: dir,
    video: media.video,
    poster: media.poster,
    label: `${category.name}のデモ: ${part.name}`,
  });

  const codeButtons = part.files
    .map(
      (kind) =>
        `<a class="c-codes__item" href="${esc(dir + PART_FILES[kind])}"` +
        ` data-code-kind="${esc(kind)}" data-part="${esc(part.slug)}"` +
        ` aria-label="${esc(`${PART_FILE_LABELS[kind]} を表示: ${part.name}`)}">` +
        `${esc(PART_FILE_LABELS[kind])}</a>`
    )
    .join('');

  // ⚠️ 区切りは読点ではなくカンマ。タグ名に空白を含むものがあるため、空白区切りにすると割れる。
  const tags = part.tags.join(',');

  return `          <li class="c-card" data-tags="${esc(tags)}">
            ${skip}
            ${previewHtml}
            <div class="c-card__body">
              <h2 class="c-card__title">${esc(part.name)}</h2>
              <div class="c-card__actions" id="${esc(actionsId)}" tabindex="-1">
                <a class="c-btn-demo" href="${esc(dir)}" target="_blank" rel="noopener"
                  aria-label="${esc(`デモを別タブで開く: ${part.name}`)}">デモ<span class="c-ext" aria-hidden="true">↗</span></a>
                <span class="c-card__divider" aria-hidden="true"></span>
                <div class="c-codes">${codeButtons}</div>
              </div>
            </div>
          </li>`;
}
