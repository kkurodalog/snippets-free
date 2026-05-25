/**
 * 001_fade-in
 * Intersection Observer でスクロール出現演出（フェード/スライドイン）を行う基本実装。
 *
 * 設計方針:
 * - 監視対象は data-fade-in 属性を持つ要素。HTML 側で属性を付けるだけで
 *   対象を増やせるため、後続のスクロールアニメーション系スニペット
 *   （stagger / count-up 等）も同じフック属性・同じ観測パターンで拡張できる。
 * - 状態は .is-visible クラスを真実の源（single source of truth）とし、
 *   CSS が .is-visible セレクタで見た目（opacity / transform）を切り替える。
 * - ワンショット表示: 一度可視になった要素は unobserve して監視を解除する。
 *   これにより上下スクロールでの再アニメーションと多重発火を防ぐ。
 *
 * プログレッシブエンハンスメント / フォールバック:
 * - 初期状態の「隠す」スタイルは CSS 側で html.js のときだけ適用される。
 *   このスクリプトは末尾で対象要素に .is-visible を付け得るが、
 *   そもそも IO 非対応・JS 無効環境では html が no-js のままになり、
 *   要素は最初から表示される（コンテンツが消えない）。
 * - IntersectionObserver 非対応ブラウザでは、全要素を即時に表示状態にする。
 */

(function () {
  "use strict";

  // 監視対象を取得（同一ページ内に複数あっても動作する）
  const targets = document.querySelectorAll("[data-fade-in]");

  if (targets.length === 0) return;

  /**
   * 1要素を最終状態（表示）にする
   * @param {HTMLElement} el - 対象要素
   */
  function reveal(el) {
    // data-fade-delay（ms）が指定されていれば、その分だけ表示開始を遅らせる。
    // 値が無い・数値でない場合は遅延 0 として扱う。
    const delay = Number(el.dataset.fadeDelay) || 0;

    if (delay > 0) {
      window.setTimeout(function () {
        el.classList.add("is-visible");
      }, delay);
    } else {
      el.classList.add("is-visible");
    }
  }

  // IntersectionObserver 非対応環境のフォールバック:
  // 監視せず、全要素を即時に表示状態にする（隠れたまま残るのを防ぐ）。
  if (!("IntersectionObserver" in window)) {
    targets.forEach(function (el) {
      el.classList.add("is-visible");
    });
    return;
  }

  /**
   * 観測オプション
   * - threshold: 0.15
   *     要素の 15% がビューポートに入った時点で発火する。
   *     0（1px でも入れば発火）だと、画面下端にかすめた瞬間に出てしまい
   *     演出として認識されにくい。逆に高すぎると大きい要素が
   *     画面に収まらず発火しないため、視認と確実な発火のバランスで 0.15 とする。
   * - rootMargin: "0px 0px -10% 0px"
   *     ビューポート下端を 10% 内側に詰めて判定する。要素が画面の
   *     やや上に入ってから出現させることで、スクロールに対して
   *     自然なタイミングになる（下端ギリギリでの発火を避ける）。
   */
  const observer = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        reveal(entry.target);

        // ワンショット表示: 一度表示したら監視を解除する。
        // これにより再交差時の多重発火を防ぎ、不要な監視も止める。
        obs.unobserve(entry.target);
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -10% 0px",
    }
  );

  // 全対象を監視に登録
  targets.forEach(function (el) {
    observer.observe(el);
  });
})();
