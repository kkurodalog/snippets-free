/**
 * 003_progress-bar
 * ページの読了率（スクロール進捗 0%→100%）に連動して、最上部に固定した
 * バーを左から右へ伸ばすスクロール進捗バー。
 *
 * 設計方針:
 * - 見た目の第一実装は CSS の animation-timeline: scroll()。対応ブラウザでは
 *   バーの動きを CSS だけで作る（JavaScript は transform に触らない）。
 * - この JavaScript は2つの仕事を持つ。(1) animation-timeline 非対応ブラウザ
 *   （Safari / Firefox 等）向けのフォールバックとして、読了率を計算し CSS
 *   カスタムプロパティ --progress-value（0〜1）へ書き込む。CSS 側がそれを
 *   scaleX に反映する。(2) 対応・非対応にかかわらず aria-valuenow を更新する。
 *
 * 二重駆動の防止:
 * - CSS.supports('animation-timeline', 'scroll()') が true の環境では、
 *   CSS が進捗を担うため --progress-value を書き込まない。
 *   判定キーは CSS の @supports と完全に一致させる。片方だけ変えると
 *   CSS と JavaScript が同時にバーを動かす二重駆動が起きる。
 * - CSS.supports 自体が無い極めて古い環境では JS フォールバックへ進む。
 * - scroll リスナー自体は両方の環境で張る。aria-valuenow はどちらの
 *   経路でも更新しなければならないためである（下記アクセシビリティ）。
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
 * - role="progressbar" を名乗る以上、aria-valuenow は実際の読了率を返さ
 *   なければならない（WCAG 4.1.2 Name, Role, Value）。CSS だけで動く環境
 *   でも支援技術には値が要るため、aria-valuenow の更新は両方の経路で行う。
 *   見た目を動かす --progress-value だけを、CSS が担う環境では書かない。
 */

/* snippet:start */
(function () {
  "use strict";

  const progress = document.querySelector("[data-progress-bar]");
  if (!progress) return;

  const cssDriven =
    typeof window.CSS !== "undefined" &&
    typeof window.CSS.supports === "function" &&
    window.CSS.supports("animation-timeline", "scroll()");

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
    if (!cssDriven) progress.style.setProperty("--progress-value", String(ratio));
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
