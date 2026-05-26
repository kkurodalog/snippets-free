/**
 * 003_progress-bar
 * ページの読了率（スクロール進捗 0%→100%）に連動して、最上部に固定した
 * バーを左から右へ伸ばすスクロール進捗バー。
 *
 * 設計方針:
 * - 第一実装は CSS の animation-timeline: scroll()。対応ブラウザでは
 *   この JS は何もしない（CSS だけでスクロールに連動する）。
 * - この JS は animation-timeline 非対応ブラウザ（Safari / Firefox 等）
 *   向けの「フォールバック」専任。読了率を計算し、CSS カスタムプロパティ
 *   --progress-value（0〜1）へ書き込む。CSS 側がそれを scaleX に反映する。
 *
 * 二重駆動の防止:
 * - CSS.supports('animation-timeline', 'scroll()') が true の環境では、
 *   CSS が進捗を担うため scroll リスナーを一切張らない。
 *   こうして「CSS と JS が同時にバーを動かす」二重駆動を防ぐ。
 *
 * パフォーマンス:
 * - scroll イベントは高頻度で発火するため、毎回計算せず
 *   requestAnimationFrame でフレーム同期に間引きする（rAF スロットル）。
 *   ticking フラグで多重 rAF 予約を防ぎ、1 フレームに 1 回だけ更新する。
 *
 * プログレッシブエンハンスメント / 性質の違い:
 * - 001/002 の出現演出は「JS が表示状態にしないと隠れたまま」なので
 *   no-js / js での厳密な切り分けが必須だった。
 * - 一方この進捗バーは、CSS だけで動く対応ブラウザでは JS 不要。
 *   JS 無効 + 非対応ブラウザの組み合わせでは進捗連動だけが効かなくなるが、
 *   バーは scaleX(0) の細い帯として残るだけでレイアウトは壊れず、
 *   本文コンテンツも一切消えない（情報の欠落が起きない）状態を許容する。
 *
 * アクセシビリティ:
 * - prefers-reduced-motion: reduce のときは、CSS 側で補間 transition を
 *   切る。JS は読了率の値を更新するだけ（追従はユーザー操作に直結する
 *   動きのため維持し、滑走するような余計な補間だけを止める）。
 */

(function () {
  "use strict";

  const progress = document.querySelector("[data-scroll-progress]");
  if (!progress) return;

  // CSS の animation-timeline: scroll() が使える環境では CSS に任せ、
  // JS は何もしない（二重駆動の防止）。
  // CSS.supports 自体が無い極めて古い環境では JS フォールバックへ進む。
  const cssDriven =
    typeof window.CSS !== "undefined" &&
    typeof window.CSS.supports === "function" &&
    window.CSS.supports("animation-timeline", "scroll()");

  if (cssDriven) return;

  // ---- ここから JS フォールバック（animation-timeline 非対応環境）----

  const root = document.documentElement;

  // 多重 rAF 予約を防ぐフラグ。scroll が連続発火しても、
  // 1 フレームにつき更新は 1 回だけにする。
  let ticking = false;

  /**
   * 現在の読了率（0〜1）を計算する。
   * 進捗率 = scrollTop / (scrollHeight - clientHeight)
   * 分母が 0 以下（ページがビューポートに収まりスクロール不要）の場合は
   * 0 除算を避け、進捗 0 を返す。
   * @returns {number} 0〜1 にクランプした読了率
   */
  function getProgress() {
    const scrollTop = window.scrollY || root.scrollTop || 0;
    const scrollable = root.scrollHeight - root.clientHeight;

    // 0 除算ガード: スクロールできない（分母 0 以下）なら進捗 0。
    if (scrollable <= 0) return 0;

    const ratio = scrollTop / scrollable;

    // 端での丸め誤差やバウンススクロールを考慮し 0〜1 にクランプ。
    if (ratio < 0) return 0;
    if (ratio > 1) return 1;
    return ratio;
  }

  /**
   * 読了率を CSS カスタムプロパティと ARIA 値へ反映する。
   * 見た目（scaleX）の適用は CSS 側（--progress-value を読む）に委ねる。
   */
  function update() {
    const ratio = getProgress();
    progress.style.setProperty("--progress-value", String(ratio));
    progress.setAttribute("aria-valuenow", String(Math.round(ratio * 100)));
    ticking = false;
  }

  /**
   * scroll / resize ハンドラ。計算自体は rAF に遅延させ、
   * フレーム同期で 1 回だけ update を走らせる（rAF スロットル）。
   */
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  // 初期表示時にも一度反映しておく（リロード時にスクロール位置が
  // 途中だった場合に、最初から正しい進捗を見せる）。
  update();

  // passive: true で、リスナーがスクロールをブロックしないことを明示し、
  // スクロール性能を確保する。
  window.addEventListener("scroll", onScroll, { passive: true });
  // ビューポートの高さやコンテンツ量が変わると分母が変わるため、
  // resize でも再計算する。
  window.addEventListener("resize", onScroll, { passive: true });
})();
