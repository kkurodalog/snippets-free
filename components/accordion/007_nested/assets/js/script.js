/**
 * 007_nested — 入れ子にする
 *
 * 掲載範囲（snippet:start 〜 snippet:end）だけを貼れば動く。
 * 解説はこのファイルの冒頭に置き、範囲の中には書かない（貼った先にコメントを持ち込まないため）。
 *
 * 設計
 * - 親と子はそれぞれ独立した root として取得し、bindAccordion を個別に仕掛ける。
 * - 二重発火の防止は header.closest(".c-accordion") !== root のガードで行う。
 *   root.contains(header) では親が子のヘッダーを true で拾ってしまう。
 * - 親を閉じても子の aria-expanded は戻さない。親を開き直すと子の前の状態が復元される。
 * - 親子とも data-accordion は値なしで置く。スコープの判定は closest で行うため値を分ける必要がない。
 */

/* snippet:start */
(function () {
  "use strict";

  const accordionRoots = document.querySelectorAll(".c-accordion[data-accordion]");

  if (accordionRoots.length === 0) return;

  function setItemState(header, open) {
    const panelId = header.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;

    if (!panel) return;

    if (open) {
      header.setAttribute("aria-expanded", "true");
      panel.removeAttribute("hidden");
    } else {
      header.setAttribute("aria-expanded", "false");
      panel.setAttribute("hidden", "");
    }
  }

  function toggleItem(header) {
    const isExpanded = header.getAttribute("aria-expanded") === "true";
    setItemState(header, !isExpanded);
  }

  function bindAccordion(root) {
    root.addEventListener("click", function (event) {
      const header = event.target.closest(".c-accordion__header");
      if (!header) return;

      if (header.closest(".c-accordion") !== root) return;

      toggleItem(header);
    });
  }

  accordionRoots.forEach(bindAccordion);
})();
/* snippet:end */
