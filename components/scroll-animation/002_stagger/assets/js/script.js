/**
 * 002_stagger
 * Intersection Observer による出現演出の応用。グループ単位で監視し、
 * 配下の子要素を一定の遅延差で「順番に」出現させる（順次表示 / stagger）。
 *
 * 設計方針:
 * - 監視対象は data-stagger 属性を持つ「親（グループ）」要素。グループが
 *   ビューポートに入った瞬間を 1 回検知し、配下の出現対象（data-fade-in）へ
 *   遅延を連番で配って順番に表示する。
 * - 遅延は各子に手書きせず、親の data-stagger-step（ms）から index × step で
 *   自動計算する。子の枚数が変わっても、親のステップ値だけで調整できる。
 * - 状態は .is-visible クラスを真実の源（single source of truth）とし、
 *   CSS が .is-visible セレクタで見た目（opacity / transform）を切り替える。
 *   遅延は「いつ .is-visible を付けるか」のタイミング制御に閉じる。
 * - ワンショット表示: グループは一度可視になったら unobserve して監視を解除する。
 *   これにより上下スクロールでの再アニメーションと多重発火を防ぐ。
 *
 * プログレッシブエンハンスメント / フォールバック:
 * - 初期状態の「隠す」スタイルは CSS 側で html.js のときだけ適用される。
 *   IO 非対応・JS 無効環境では html が no-js のままになり、要素は最初から
 *   表示される（コンテンツが消えない）。
 * - IntersectionObserver 非対応ブラウザでは、全グループの全子要素を
 *   即時に表示状態にする（順次の遅延は付けず一括表示）。
 */

(function () {
  "use strict";

  // 既定のステップ（子と子の間の遅延差・ms）。
  // 順次表示として「順番に出ている」と認識でき、かつ待たされすぎない
  // 値として 120ms を既定とする（親に data-stagger-step があればそれを優先）。
  const DEFAULT_STEP = 120;

  // 監視対象は「順次表示グループ」（親）
  const groups = document.querySelectorAll("[data-stagger]");

  if (groups.length === 0) return;

  /**
   * グループ配下の出現対象（直接の子に限る）を取得する。
   * 入れ子のグループが将来できても、別グループの子まで巻き込まないよう
   * 直接の子だけを対象にする。
   * @param {HTMLElement} group - data-stagger を持つ親要素
   * @returns {HTMLElement[]} 出現対象の子要素配列（DOM 順）
   */
  function getStaggerTargets(group) {
    const result = [];
    for (let i = 0; i < group.children.length; i++) {
      const child = group.children[i];
      if (child.hasAttribute("data-fade-in")) {
        result.push(child);
      }
    }
    return result;
  }

  /**
   * グループの子要素を、DOM 順に index × step の遅延で順次表示する。
   * @param {HTMLElement} group - 対象グループ
   */
  function revealGroup(group) {
    // ステップ値（ms）。数値でない・負の場合は既定値にフォールバックする。
    const parsed = Number(group.dataset.staggerStep);
    const step = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_STEP;

    const targets = getStaggerTargets(group);

    targets.forEach(function (el, index) {
      const delay = index * step;

      if (delay > 0) {
        window.setTimeout(function () {
          el.classList.add("is-visible");
        }, delay);
      } else {
        el.classList.add("is-visible");
      }
    });
  }

  // IntersectionObserver 非対応環境のフォールバック:
  // 監視せず、全グループの全子要素を即時に表示状態にする
  // （順次の遅延は付けない / 隠れたまま残るのを防ぐ）。
  if (!("IntersectionObserver" in window)) {
    groups.forEach(function (group) {
      getStaggerTargets(group).forEach(function (el) {
        el.classList.add("is-visible");
      });
    });
    return;
  }

  /**
   * 観測オプション
   * - threshold: 0.15
   *     グループの 15% がビューポートに入った時点で発火する。
   *     0 だと画面下端にかすめた瞬間に出てしまい演出として認識されにくく、
   *     高すぎると縦に長いグループが画面に収まらず発火しないため、
   *     視認と確実な発火のバランスで 0.15 とする。
   * - rootMargin: "0px 0px -10% 0px"
   *     ビューポート下端を 10% 内側に詰めて判定する。グループが画面の
   *     やや上に入ってから順次表示を始めることで、スクロールに対して
   *     自然なタイミングになる。
   */
  const observer = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        revealGroup(entry.target);

        // ワンショット表示: グループ単位で一度発火したら監視を解除する。
        // 子の表示は setTimeout に予約済みのため、ここで解除しても順次表示は続く。
        obs.unobserve(entry.target);
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -10% 0px",
    }
  );

  // 全グループを監視に登録
  groups.forEach(function (group) {
    observer.observe(group);
  });
})();
