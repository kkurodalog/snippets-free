import { esc } from './html.mjs';

/**
 * プレビュー窓（カードの上半分 / トップのショーケース）。
 *
 * 方式はカテゴリ単位で1つに揃える（パーツ単位で混ぜない）。
 *   dom   … デモの index.html を iframe でそのまま再生する
 *   video … デモを収録した WebM を poster つきで置く
 *
 * ⚠️ 窓の面色は白のまま落とさない。緩衝は窓の外側（マット帯 8px ＋ 罫線）で作る。
 * ⚠️ 高さは CSS の aspect-ratio で先に確定させる。読み込みの前後で高さが跳ねない。
 *
 * ★素材が入る前のフォールバック
 *   収録素材（media/**）は後続工程で作る。まだ無いあいだは `<video>` を出さず、
 *   同じ枠のまま「準備中」のチップを1つ置く。理由は3つ。
 *   - 死んだ src / poster を書かない（リンク検査が素材の到着前に赤くならない）
 *   - 枠（マット帯 ＋ 罫線 ＋ 縦横比）が先に立つので、素材が入ってもレイアウトが動かない
 *   - 「まだ無い」ことが画面から分かる（空白のまま黙って置かない）
 *   素材を置けば、生成し直すだけで `<video>` に切り替わる（データもテンプレートも変えない）。
 */

/** 実DOM再生（iframe）。 */
function domWindow({ href, title }) {
  return (
    `<iframe class="c-preview__window" src="${esc(href)}" title="${esc(title)}"` +
    ` loading="lazy"></iframe>`
  );
}

/**
 * 動画。
 * ⚠️ `autoplay` を付けない。再生はビューポートに入ったときだけ行う（外殻JS が制御する）。
 * ⚠️ `preload="none"` にする。初期表示で動画を1本も読み込ませない。
 * ⚠️ JS 無効・動きを減らす設定では poster が静止画として出るだけで、壊れない。
 */
function videoWindow({ video, poster, label }) {
  return (
    `<video class="c-preview__window" muted loop playsinline preload="none"` +
    ` poster="${esc(poster)}" aria-label="${esc(label)}" data-preview-video>` +
    `<source src="${esc(video)}" type="video/webm">` +
    `</video>`
  );
}

/** 素材がまだ無いときの窓。窓の白地の上に載るため、チップは暗い面で描く。 */
function pendingWindow() {
  return (
    `<div class="c-preview__window c-preview__window--pending">` +
    `<span class="c-preview__note">プレビューは準備中</span>` +
    `</div>`
  );
}

/**
 * @param {object} o
 * @param {'dom'|'video'} o.mode          方式（カテゴリ単位）
 * @param {'wide'|'tall'|'top'} o.aspect  枠の縦横比
 * @param {string} [o.href]               dom のとき: デモへの相対パス
 * @param {string} [o.video]              video のとき: WebM への相対パス（素材が無いときは省略）
 * @param {string} [o.poster]             video のとき: poster への相対パス
 * @param {string} o.label                iframe の title / video の aria-label
 */
export function preview({ mode, aspect, href, video, poster, label }) {
  let inner;
  if (mode === 'dom') inner = domWindow({ href, title: label });
  else if (video && poster) inner = videoWindow({ video, poster, label });
  else inner = pendingWindow();

  return (
    `<div class="c-preview c-preview--${aspect}">` +
    `<div class="c-preview__frame">${inner}</div>` +
    `</div>`
  );
}
