/**
 * 003_progress-bar
 * ページの読了率（スクロール進捗 0%→100%）に連動して、最上部に固定した
 * バーを左から右へ伸ばすスクロール進捗バー。
 *
 * 設計方針:
 * - 第一実装は CSS の animation-timeline: scroll()。対応ブラウザでは
 *   この JavaScript は何もしない（CSS だけでスクロールに連動する）。
 * - この JavaScript は animation-timeline 非対応ブラウザ（Safari / Firefox 等）
 *   向けの「フォールバック」専任である。読了率を計算し、CSS カスタム
 *   プロパティ --progress-value（0〜1）へ書き込む。CSS 側がそれを
 *   scaleX に反映する。
 *
 * 二重駆動の防止:
 * - CSS.supports('animation-timeline', 'scroll()') が true の環境では、
 *   CSS が進捗を担うため scroll リスナーを一切張らない。
 *   判定キーは CSS の @supports と完全に一致させる。片方だけ変えると
 *   CSS と JavaScript が同時にバーを動かす二重駆動が起きる。
 * - CSS.supports 自体が無い極めて古い環境では JS フォールバックへ進む。
 *
 * 計算:
 * - 進捗率 = scrollTop / (scrollHeight - clientHeight)。
 *   分母が 0 以下（ページがビューポートに収まりスクロール不要）の場合は
 *   0 除算を避けて 0 を返す。端での丸め誤差やバウンススクロールを考慮し、
 *   0〜1 にクランプする。
 * - 初期表示時にも一度反映する（リロード時にスクロール位置が途中だった
 *   場合に、最初から正しい進捗を見せるため）。
 * - ビューポートの高さやコンテンツ量が変わると分母が変わるため、
 *   resize でも再計算する。
 *
 * パフォーマンス:
 * - scroll イベントは高頻度で発火するため、毎回計算せず
 *   requestAnimationFrame でフレーム同期に間引きする（rAF スロットル）。
 *   ticking フラグで多重 rAF 予約を防ぎ、1 フレームに 1 回だけ更新する。
 * - passive: true で、リスナーがスクロールをブロックしないことを明示する。
 *
 * プログレッシブエンハンスメント / 性質の違い:
 * - 出現演出（フェードイン等）は「JavaScript が表示状態にしないと隠れたまま」
 *   になるため、no-js / js での厳密な切り分けが必須だった。
 * - 一方この進捗バーは、CSS だけで動く対応ブラウザでは JavaScript 不要である。
 *   JavaScript 無効 ＋ 非対応ブラウザの組み合わせでは進捗連動だけが効かなく
 *   なるが、バーは scaleX(0) の細い帯として残るだけでレイアウトは壊れず、
 *   本文コンテンツも一切消えない。
 *
 * アクセシビリティ:
 * - prefers-reduced-motion: reduce のときは、CSS 側で補間 transition を切る。
 *   JavaScript は読了率の値を更新するだけである（追従はユーザー操作に直結
 *   する動きのため維持し、滑走するような余計な補間だけを止める）。
 * - aria-valuenow の更新は、この JS フォールバック経路でのみ行う。
 */

/* snippet:start */
(function () {
  "use strict";

  const progress = document.querySelector("[data-scroll-progress]");
  if (!progress) return;

  const cssDriven =
    typeof window.CSS !== "undefined" &&
    typeof window.CSS.supports === "function" &&
    window.CSS.supports("animation-timeline", "scroll()");

  if (cssDriven) return;

  const root = document.documentElement;

  let ticking = false;

  function getProgress() {
    const scrollTop = window.scrollY || root.scrollTop || 0;
    const scrollable = root.scrollHeight - root.clientHeight;

    if (scrollable <= 0) return 0;

    const ratio = scrollTop / scrollable;

    if (ratio < 0) return 0;
    if (ratio > 1) return 1;
    return ratio;
  }

  function update() {
    const ratio = getProgress();
    progress.style.setProperty("--progress-value", String(ratio));
    progress.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
    ticking = false;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  update();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
})();
/* snippet:end */
