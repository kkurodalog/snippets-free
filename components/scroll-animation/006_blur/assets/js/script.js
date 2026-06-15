/**
 * 006_blur
 * 画面に固定した背景画像が、スクロール量に連動して徐々にぼけていく実装。
 * 加えて、続く第2セクションの見出しを Intersection Observer でフェードインさせる。
 *
 * この JS は独立した 2 つの責務を持つ:
 *   (A) 背景ぼかしのフォールバック（animation-timeline 非対応環境のみ）
 *   (B) 第2セクションのフェードイン（IO によるワンショット表示）
 * 両者は別系統のため、互いに独立して動く。
 *
 * 設計方針（A: 背景ぼかし）:
 * - 第一実装は CSS の animation-timeline: scroll()。対応ブラウザでは
 *   この JS は (A) について何もしない（CSS だけでぼかしが連動する）。
 * - フォールバックは、先頭ビューポートのスクロール進捗（0〜1）を計算し、
 *   CSS カスタムプロパティ --blur-amount（px）へ書き込む。CSS 側がそれを
 *   backdrop-filter: blur() に反映する。
 *
 * 二重駆動の防止（A）:
 * - CSS.supports('animation-timeline', 'scroll()') が true の環境では、
 *   CSS がぼかしを担うため scroll リスナーを一切張らない。
 *   こうして「CSS と JS が同時にぼかしを動かす」二重駆動を防ぐ。
 *   判定キー（animation-timeline: scroll()）は CSS の @supports と完全一致。
 *
 * アクセシビリティ（A）:
 * - prefers-reduced-motion: reduce のときはぼかしを完全に無効化する。
 *   ぼかしは装飾的な演出で画面酔いを誘発しやすいため、追従を止めて背景を
 *   シャープなまま固定する。JS 経路ではリスナーを張らず、--blur-amount も
 *   0 のままにする（CSS 側でも backdrop-filter: blur(0) に固定して二重に止める）。
 *
 * パフォーマンス（A）:
 * - scroll イベントは高頻度で発火するため、毎回計算せず
 *   requestAnimationFrame でフレーム同期に間引きする（rAF スロットル）。
 *   ticking フラグで多重 rAF 予約を防ぎ、1 フレームに 1 回だけ更新する。
 * - scroll / resize リスナーは passive: true で、スクロールをブロック
 *   しないことを明示する。
 *
 * プログレッシブエンハンスメント:
 * - ぼかしは純粋な装飾。対応・非対応・JS 無効のいずれでも背景は表示され、
 *   ぼかしが効かない場合はシャープなまま見えるだけ（情報欠落なし）。
 * - フェードイン(B)も、IO 非対応・JS 無効では見出しが最初から表示される。
 */

(function () {
  "use strict";

  /* =========================================================
     (A) 背景ぼかしのフォールバック
     ========================================================= */
  (function setupBlurFallback() {
    const overlay = document.querySelector("[data-scroll-blur]");
    if (!overlay) return;

    // ぼかしは装飾。OS の「動きを減らす」設定が有効なら、ぼかしを完全に
    // 無効化しリスナーを張らない（背景は CSS 側で blur(0) に固定される）。
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    // CSS の animation-timeline: scroll() が使える環境では CSS に任せ、
    // JS は何もしない（二重駆動の防止）。判定キーは CSS の @supports と一致。
    // CSS.supports 自体が無い極めて古い環境では JS フォールバックへ進む。
    const cssDriven =
      typeof window.CSS !== "undefined" &&
      typeof window.CSS.supports === "function" &&
      window.CSS.supports("animation-timeline", "scroll()");
    if (cssDriven) return;

    // ---- ここから JS フォールバック（animation-timeline 非対応環境）----

    const root = document.documentElement;

    // ぼかしの最大強度（px）。:root の --blur-max から読み取り、CSS の
    // scroll() 経路と同じ振れ幅にする。取れない／不正なら 20px。
    function readMaxBlur() {
      const raw = getComputedStyle(root).getPropertyValue("--blur-max").trim();
      const value = parseFloat(raw);
      return Number.isFinite(value) && value >= 0 ? value : 20;
    }

    let maxBlur = readMaxBlur();

    // 多重 rAF 予約を防ぐフラグ。scroll が連続発火しても、
    // 1 フレームにつき更新は 1 回だけにする。
    let ticking = false;

    /**
     * 先頭ビューポートのスクロール進捗（0〜1）を計算する。
     * 進捗 = scrollTop / viewportHeight をクランプ。
     * 先頭の 1 画面分をスクロールし切った時点で 1（＝ぼかし最大）になる。
     * CSS の animation-range: 0 100vh と対応させる。
     * @returns {number} 0〜1 にクランプした進捗
     */
    function getProgress() {
      const scrollTop = window.scrollY || root.scrollTop || 0;
      const viewportH = window.innerHeight || root.clientHeight || 0;

      // 0 除算ガード: ビューポート高が取れない場合は進捗 0。
      if (viewportH <= 0) return 0;

      const ratio = scrollTop / viewportH;
      if (ratio < 0) return 0;
      if (ratio > 1) return 1;
      return ratio;
    }

    /**
     * 進捗からぼかし量を求め、--blur-amount（px）へ反映する。
     * 見た目（backdrop-filter）の適用は CSS 側（--blur-amount を読む）に委ねる。
     */
    function update() {
      const amount = getProgress() * maxBlur;
      overlay.style.setProperty("--blur-amount", amount.toFixed(2) + "px");
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

    // resize ではビューポート高とトークン値が変わり得るため、最大ぼかしを
    // 読み直してから再計算する。
    function onResize() {
      maxBlur = readMaxBlur();
      onScroll();
    }

    // 初期表示時にも一度反映しておく（リロード時にスクロール位置が
    // 途中だった場合に、最初から正しいぼかし量を見せる）。
    update();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
  })();

  /* =========================================================
     (B) 第2セクションのフェードイン（IO ワンショット）
     ビューポート進入で一度だけ表示する。一度表示したら unobserve する。
     ========================================================= */
  (function setupFadeIn() {
    const targets = document.querySelectorAll("[data-fade-in]");
    if (targets.length === 0) return;

    /**
     * 1要素を最終状態（表示）にする。
     * @param {HTMLElement} el - 対象要素
     */
    function reveal(el) {
      el.classList.add("is-visible");
    }

    // IntersectionObserver 非対応環境のフォールバック:
    // 監視せず、全要素を即時に表示状態にする（隠れたまま残るのを防ぐ）。
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

          // ワンショット表示: 一度表示したら監視を解除する。
          // 再交差時の多重発火を防ぎ、不要な監視も止める。
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
})();
