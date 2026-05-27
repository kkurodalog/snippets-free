/**
 * 004_parallax
 * 背景レイヤーと前景コンテンツにスクロール速度の差をつけて、奥行き（視差）を
 * 感じさせる実装。
 *
 * 設計方針:
 * - 第一実装は CSS の animation-timeline: view()。対応ブラウザでは
 *   この JS は何もしない（CSS だけで背景がスクロールに連動する）。
 * - この JS は animation-timeline 非対応ブラウザ（Safari / Firefox 等）
 *   向けの「フォールバック」専任。各背景レイヤーの視差量を計算し、要素ごとの
 *   CSS カスタムプロパティ --parallax-y（px）へ書き込む。CSS 側がそれを
 *   translateY に反映する。
 *
 * 二重駆動の防止:
 * - CSS.supports('animation-timeline', 'view()') が true の環境では、
 *   CSS が視差を担うため scroll リスナーを一切張らない。
 *   こうして「CSS と JS が同時に背景を動かす」二重駆動を防ぐ。
 *   判定キー（animation-timeline: view()）は CSS の @supports と完全一致。
 *
 * アクセシビリティ:
 * - prefers-reduced-motion: reduce のときは視差を完全に無効化する。
 *   視差は装飾的な演出で画面酔いを誘発しやすいため、追従を止めて背景を
 *   固定する。JS 経路ではリスナーを張らず、--parallax-y も 0 のままにする
 *   （CSS 側でも transform: none に固定して二重に止める）。
 *
 * パフォーマンス:
 * - scroll イベントは高頻度で発火するため、毎回計算せず
 *   requestAnimationFrame でフレーム同期に間引きする（rAF スロットル）。
 *   ticking フラグで多重 rAF 予約を防ぎ、1 フレームに 1 回だけ更新する。
 * - scroll / resize リスナーは passive: true で、スクロールをブロック
 *   しないことを明示する。
 *
 * プログレッシブエンハンスメント:
 * - 背景レイヤーは対応・非対応・JS 無効のいずれでも常に表示される
 *   （視差が効かないだけで、レイアウトもコンテンツも壊れない）。
 */

(function () {
  "use strict";

  const layers = document.querySelectorAll("[data-parallax]");
  if (!layers.length) return;

  // 視差は装飾。OS の「動きを減らす」設定が有効なら、視差を完全に無効化し
  // リスナーを張らない（背景は CSS 側で transform: none に固定される）。
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  // CSS の animation-timeline: view() が使える環境では CSS に任せ、
  // JS は何もしない（二重駆動の防止）。判定キーは CSS の @supports と一致。
  // CSS.supports 自体が無い極めて古い環境では JS フォールバックへ進む。
  const cssDriven =
    typeof window.CSS !== "undefined" &&
    typeof window.CSS.supports === "function" &&
    window.CSS.supports("animation-timeline", "view()");

  if (cssDriven) return;

  // ---- ここから JS フォールバック（animation-timeline 非対応環境）----

  const root = document.documentElement;

  // 視差の総移動量（px）を CSS トークン --parallax-shift から読み取り、
  // CSS 経路と振れ幅を揃える。取得できない／不正値なら既定 120px。
  function readShift() {
    const raw = getComputedStyle(root)
      .getPropertyValue("--parallax-shift")
      .trim();
    const value = parseFloat(raw);
    return Number.isFinite(value) && value >= 0 ? value : 120;
  }

  let shift = readShift();

  // 多重 rAF 予約を防ぐフラグ。scroll が連続発火しても、
  // 1 フレームにつき更新は 1 回だけにする。
  let ticking = false;

  /**
   * 各背景レイヤーの視差量を計算し、要素ごとに --parallax-y（px）を更新する。
   *
   * 各レイヤーがビューポートを通過する進捗（0〜1）を求め、それを
   * +shift（画面下から入る瞬間）→ -shift（画面上へ抜ける瞬間）へ
   * 線形にマッピングする。前景は動かないため、この背景の移動が視差になる。
   */
  function update() {
    const viewportH = window.innerHeight || root.clientHeight || 0;

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const rect = layer.getBoundingClientRect();

      // 要素がビューポートを通過する進捗 0〜1。
      // 要素の上端が画面下端にあるとき 0、要素の下端が画面上端に
      // 抜けるとき 1。分母 0 ガードつき。
      const span = viewportH + rect.height;
      const progress = span > 0 ? (viewportH - rect.top) / span : 0;

      // 0〜1 にクランプ（画面外で過剰な移動量にならないように）。
      const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;

      // 進捗 0→1 を +shift → -shift にマッピング。
      const y = shift - clamped * shift * 2;
      layer.style.setProperty("--parallax-y", y.toFixed(2) + "px");
    }

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

  // resize ではビューポート高とトークン値が変わり得るため、shift を読み直す。
  function onResize() {
    shift = readShift();
    onScroll();
  }

  // 初期表示時にも一度反映しておく（リロード時にスクロール位置が
  // 途中だった場合に、最初から正しい視差位置を見せる）。
  update();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
})();
