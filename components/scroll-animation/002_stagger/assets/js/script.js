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
 * - 対象はグループの「直接の子」に限る。入れ子のグループが将来できても、
 *   別グループの子まで巻き込まない。
 * - 状態は .is-visible クラスを真実の源（single source of truth）とし、
 *   CSS が .is-visible セレクタで見た目（opacity / transform）を切り替える。
 *   遅延は「いつ .is-visible を付けるか」のタイミング制御に閉じる。
 * - ワンショット表示: グループは一度可視になったら unobserve して監視を解除する。
 *
 * 属性:
 * - data-stagger        順次表示グループであることを示す親のフック属性。
 * - data-stagger-step   子と子の間の遅延差（ms）。省略・不正なら既定 120ms。
 *                       例 100 なら 1番目 0ms / 2番目 100ms / 3番目 200ms…。
 * - data-fade-in        出現対象であることを示す子のフック属性。
 * - data-fade-direction 出現方向（up / down / left / right / none）。省略時は up。
 *                       親（data-stagger）に付けると配下の子へ既定方向として効く。
 *
 * 既定ステップ 120ms は、順次表示として「順番に出ている」と認識でき、
 * かつ待たされすぎない値として選んでいる。
 *
 * 観測オプション:
 * - threshold 0.15 は、グループの 15% が画面に入った時点で発火する値である。
 *   0 だと画面下端にかすめた瞬間に出てしまい、高すぎると縦に長いグループが
 *   画面に収まらず発火しない。
 * - rootMargin "0px 0px -10% 0px" は画面下端を 10% 内側に詰めて判定する。
 *
 * プログレッシブエンハンスメント / フォールバック:
 * - 初期状態の「隠す」スタイルは CSS 側で html.js のときだけ適用される。
 *   JavaScript 無効環境では js クラスが付かないため、要素は最初から
 *   表示される（コンテンツが消えない）。
 * - IntersectionObserver 非対応ブラウザでは、全グループの全子要素を
 *   即時に表示状態にする（順次の遅延は付けず一括表示）。
 */

/* snippet:start */
(function () {
  "use strict";

  const DEFAULT_STEP = 120;

  const groups = document.querySelectorAll("[data-stagger]");

  if (groups.length === 0) return;

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

  function revealGroup(group) {
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

  if (!("IntersectionObserver" in window)) {
    groups.forEach(function (group) {
      getStaggerTargets(group).forEach(function (el) {
        el.classList.add("is-visible");
      });
    });
    return;
  }

  const observer = new IntersectionObserver(
    function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        revealGroup(entry.target);

        obs.unobserve(entry.target);
      });
    },
    {
      threshold: 0.15,
      rootMargin: "0px 0px -10% 0px",
    }
  );

  groups.forEach(function (group) {
    observer.observe(group);
  });
})();
/* snippet:end */
