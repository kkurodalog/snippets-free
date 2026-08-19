/**
 * 001_fade-in
 * Intersection Observer でスクロール出現演出（フェード/スライドイン）を行う基本実装。
 *
 * 設計方針:
 * - 監視対象は data-fade-in 属性を持つ要素。HTML 側で属性を付けるだけで
 *   対象を増やせるため、同系統のスニペット（stagger / count-up 等）も
 *   同じフック属性・同じ観測パターンで拡張できる。
 * - 状態は .is-visible クラスを真実の源（single source of truth）とし、
 *   CSS が .is-visible セレクタで見た目（opacity / transform）を切り替える。
 * - ワンショット表示: 一度可視になった要素は unobserve して監視を解除する。
 *   これにより上下スクロールでの再アニメーションと多重発火を防ぐ。
 *
 * 属性:
 * - data-fade-in        監視対象であることを示すフック属性。
 * - data-fade-direction 出現方向（up / down / left / right / none）。省略時は up。
 *                       none は transform を使わず opacity だけの純フェード。
 * - data-fade-delay     出現の遅延（ms）。子要素を時間差で出したいときに使う。
 *                       値が無い・数値でない場合は遅延 0 として扱う。
 *
 * 観測オプション:
 * - threshold 0.15 は、要素の 15% が画面に入った時点で発火する値である。
 *   0 だと画面下端にかすめた瞬間に出てしまい演出として認識されにくく、
 *   高すぎると大きい要素が画面に収まらず発火しない。
 * - rootMargin "0px 0px -10% 0px" は画面下端を 10% 内側に詰めて判定する。
 *   要素がやや上に入ってから出現するため、スクロールに対して自然になる。
 *
 * プログレッシブエンハンスメント / フォールバック:
 * - 初期状態の「隠す」スタイルは CSS 側で html.js のときだけ適用される。
 *   JavaScript 無効環境では js クラスが付かないため、要素は最初から
 *   表示される（コンテンツが消えない）。
 * - IntersectionObserver 非対応ブラウザでは、全要素を即時に表示状態にする。
 */

/* snippet:start */
(function () {
  "use strict";

  const targets = document.querySelectorAll("[data-fade-in]");

  if (targets.length === 0) return;

  function reveal(el) {
    const delay = Number(el.dataset.fadeDelay) || 0;

    if (delay > 0) {
      window.setTimeout(function () {
        el.classList.add("is-visible");
      }, delay);
    } else {
      el.classList.add("is-visible");
    }
  }

  if (!("IntersectionObserver" in window)) {
    targets.forEach(function (el) {
      el.classList.add("is-visible");
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
/* snippet:end */
