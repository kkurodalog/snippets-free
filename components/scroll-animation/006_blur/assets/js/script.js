/**
 * 006_blur
 * 画面に固定した背景画像が、スクロール量に連動して徐々にぼけていく実装。
 *
 * このファイルは独立した 2 つのブロックを持つ。
 *   (A) 背景ぼかし（掲載範囲）— animation-timeline 非対応環境のフォールバック
 *   (B) 第2セクションのフェードイン（掲載範囲の外・デモページ側）
 * 両者は別系統のため、互いに独立して動く。
 *
 * 設計方針（A: 背景ぼかし）:
 * - 第一実装は CSS の animation-timeline: scroll()。対応ブラウザでは
 *   この JavaScript は何もしない（CSS だけでぼかしが連動する）。
 * - フォールバックは、先頭ビューポートのスクロール進捗（0〜1）を計算し、
 *   CSS カスタムプロパティ --blur-amount（px）へ書き込む。CSS 側がそれを
 *   backdrop-filter: blur() に反映する。CSS の animation-range: 0 100vh と
 *   対応させ、先頭の 1 画面分をスクロールし切った時点で 1（ぼかし最大）に
 *   なるようにしている。
 * - ぼかしの最大強度はパーツのルート要素の --blur-max から読む。
 *   読み取れない／不正な場合は 20px を使う。CSS 側に書いてある既定値と
 *   同じ数である。片方を変えたらもう片方も見直す。
 *
 * 二重駆動の防止（A）:
 * - CSS.supports('animation-timeline', 'scroll()') が true の環境では、
 *   CSS がぼかしを担うため scroll リスナーを一切張らない。
 *   判定キーは CSS の @supports と完全に一致させる。
 * - CSS.supports 自体が無い極めて古い環境では JS フォールバックへ進む。
 *
 * アクセシビリティ（A）:
 * - prefers-reduced-motion: reduce のときはぼかしを完全に無効化する。
 *   ぼかしは装飾的な演出で画面酔いを誘発しやすいため、追従を止めて背景を
 *   シャープなまま固定する。JS 経路ではリスナーを張らず、--blur-amount も
 *   0 のままにする（CSS 側でも blur(0) に固定して二重に止める）。
 *
 * パフォーマンス（A）:
 * - scroll イベントは高頻度で発火するため、毎回計算せず
 *   requestAnimationFrame でフレーム同期に間引きする（rAF スロットル）。
 *   ticking フラグで多重 rAF 予約を防ぎ、1 フレームに 1 回だけ更新する。
 * - scroll / resize リスナーは passive: true で、スクロールをブロック
 *   しないことを明示する。
 * - 初期表示時にも一度反映する。resize ではビューポート高とトークン値が
 *   変わり得るため、最大ぼかしを読み直してから再計算する。
 *
 * プログレッシブエンハンスメント:
 * - ぼかしは純粋な装飾。対応・非対応・JavaScript 無効のいずれでも背景は
 *   表示され、ぼかしが効かない場合はシャープなまま見えるだけである。
 * - フェードイン(B) も、IntersectionObserver 非対応・JavaScript 無効では
 *   見出しが最初から表示される。
 */

/* snippet:start */
(function () {
  "use strict";

  const overlay = document.querySelector("[data-scroll-blur]");
  if (!overlay) return;

  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const cssDriven =
    typeof window.CSS !== "undefined" &&
    typeof window.CSS.supports === "function" &&
    window.CSS.supports("animation-timeline", "scroll()");
  if (cssDriven) return;

  const root = document.documentElement;

  function readMaxBlur() {
    const raw = getComputedStyle(overlay).getPropertyValue("--blur-max").trim();
    const value = parseFloat(raw);
    return Number.isFinite(value) && value >= 0 ? value : 20;
  }

  let maxBlur = readMaxBlur();

  let ticking = false;

  function getProgress() {
    const scrollTop = window.scrollY || root.scrollTop || 0;
    const viewportH = window.innerHeight || root.clientHeight || 0;

    if (viewportH <= 0) return 0;

    const ratio = scrollTop / viewportH;
    if (ratio < 0) return 0;
    if (ratio > 1) return 1;
    return ratio;
  }

  function update() {
    const amount = getProgress() * maxBlur;
    overlay.style.setProperty("--blur-amount", amount.toFixed(2) + "px");
    ticking = false;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  function onResize() {
    maxBlur = readMaxBlur();
    onScroll();
  }

  update();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
})();
/* snippet:end */

/* (B) 第2セクションのフェードイン（掲載範囲の外・デモページ側）。
   ビューポート進入で一度だけ表示し、表示したら unobserve する。 */
(function () {
  "use strict";

  const targets = document.querySelectorAll("[data-fade-in]");
  if (targets.length === 0) return;

  function reveal(el) {
    el.classList.add("is-visible");
  }

  if (!("IntersectionObserver" in window)) {
    targets.forEach(function (el) {
      reveal(el);
    });
    return;
  }

  const observer = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        reveal(entry.target);

        obs.unobserve(entry.target);
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -10% 0px",
    }
  );

  targets.forEach(function (el) {
    observer.observe(el);
  });
})();
