/**
 * 004_parallax
 * 背景レイヤーと前景コンテンツにスクロール速度の差をつけて、奥行き（視差）を
 * 感じさせる実装。
 *
 * 設計方針:
 * - 第一実装は CSS の animation-timeline: view()。対応ブラウザでは
 *   この JavaScript は何もしない（CSS だけで背景がスクロールに連動する）。
 * - この JavaScript は animation-timeline 非対応ブラウザ（Safari / Firefox 等）
 *   向けの「フォールバック」専任である。各視差レイヤーの視差量を計算し、
 *   要素ごとの CSS カスタムプロパティ --parallax-y（px）へ書き込む。
 *   CSS 側がそれを translateY に反映する。
 *
 * レイヤーごとの速度差（多層パララックス対応）:
 * - 各レイヤーの総移動量は、その要素自身の computed style から
 *   --parallax-shift を読み取る。パーツのルート要素に置いた既定値を
 *   継承しつつ、レイヤー側の指定があればそちらが勝つ。これにより
 *   「遠景はゆっくり・近景は速く」のように別速度で動かせる。
 * - 読み取れない／不正な場合は 220px を使う。CSS 側のルート要素に
 *   書いてある既定値と同じ数である。片方を変えたらもう片方も見直す。
 *
 * 計算:
 * - 各レイヤーがビューポートを通過する進捗（0〜1）を求め、それを
 *   +shift（画面下から入る瞬間）→ -shift（画面上へ抜ける瞬間）へ
 *   線形にマッピングする。前景は動かないため、この移動が視差になる。
 * - 進捗は 0〜1 にクランプする（画面外で過剰な移動量にならないように）。
 * - 分母（ビューポート高 ＋ 要素高）が 0 のときは 0 を返す。
 *
 * 二重駆動の防止:
 * - CSS.supports('animation-timeline', 'view()') が true の環境では、
 *   CSS が視差を担うため scroll リスナーを一切張らない。
 *   判定キーは CSS の @supports と完全に一致させる。
 * - CSS.supports 自体が無い極めて古い環境では JS フォールバックへ進む。
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
 * - 初期表示時にも一度反映する（リロード時にスクロール位置が途中だった
 *   場合に、最初から正しい視差位置を見せるため）。
 * - resize ではビューポート高とトークン値が変わり得るため、既定の shift を
 *   読み直す（各レイヤー固有値は更新のたびに読むため不要）。
 *
 * プログレッシブエンハンスメント:
 * - 背景レイヤーは対応・非対応・JavaScript 無効のいずれでも常に表示される
 *   （視差が効かないだけで、レイアウトもコンテンツも壊れない）。
 */

/* snippet:start */
(function () {
  "use strict";

  const layers = document.querySelectorAll("[data-parallax]");
  if (!layers.length) return;

  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const cssDriven =
    typeof window.CSS !== "undefined" &&
    typeof window.CSS.supports === "function" &&
    window.CSS.supports("animation-timeline", "view()");

  if (cssDriven) return;

  const root = document.documentElement;

  function readRootShift() {
    const raw = getComputedStyle(root)
      .getPropertyValue("--parallax-shift")
      .trim();
    const value = parseFloat(raw);
    return Number.isFinite(value) && value >= 0 ? value : 220;
  }

  function readLayerShift(el, rootShift) {
    const raw = getComputedStyle(el).getPropertyValue("--parallax-shift").trim();
    const value = parseFloat(raw);
    return Number.isFinite(value) && value >= 0 ? value : rootShift;
  }

  let rootShift = readRootShift();

  let ticking = false;

  function update() {
    const viewportH = window.innerHeight || root.clientHeight || 0;

    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const rect = layer.getBoundingClientRect();

      const shift = readLayerShift(layer, rootShift);

      const span = viewportH + rect.height;
      const progress = span > 0 ? (viewportH - rect.top) / span : 0;

      const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;

      const y = shift - clamped * shift * 2;
      layer.style.setProperty("--parallax-y", y.toFixed(2) + "px");
    }

    ticking = false;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }

  function onResize() {
    rootShift = readRootShift();
    onScroll();
  }

  update();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
})();
/* snippet:end */
