/**
 * 001_js-toggle — JS で開閉する基本形
 *
 * 掲載範囲（snippet:start 〜 snippet:end）だけを貼れば動く。
 * 解説はこのファイルの冒頭に置き、範囲の中には書かない（貼った先にコメントを持ち込まないため）。
 *
 * 設計
 * - ルート要素 .c-accordion[data-accordion] にイベントを委譲する。項目が増えてもリスナーは増えない。
 * - 開閉状態は aria-expanded を唯一の源にし、見た目は CSS の [aria-expanded="true"] で切り替える。
 *   is-open のような別クラスを足さない。
 * - 本文の表示・非表示は HTML の hidden 属性で持つ。JS が落ちても閉じた状態として読み取れる。
 * - キーボード操作は <button> のネイティブ挙動に任せる（Enter / Space の処理を自前で書かない）。
 * - header.closest(".c-accordion") !== root は入れ子への備え。
 *   root.contains(header) では親が子のヘッダーまで拾い、親子で二重に発火する。
 */

/* snippet:start */
(function () {
  "use strict";

  const accordionRoots = document.querySelectorAll(".c-accordion[data-accordion]");

  if (accordionRoots.length === 0) return;

  function toggleItem(header) {
    const isExpanded = header.getAttribute("aria-expanded") === "true";
    const panelId = header.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;

    if (!panel) return;

    if (isExpanded) {
      header.setAttribute("aria-expanded", "false");
      panel.setAttribute("hidden", "");
    } else {
      header.setAttribute("aria-expanded", "true");
      panel.removeAttribute("hidden");
    }
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
