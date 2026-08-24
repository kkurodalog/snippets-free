/**
 * 001_js-toggle — JS で開閉する基本形
 *
 * 掲載範囲（snippet:start 〜 snippet:end）だけを貼れば動く。
 * 解説はこのファイルの冒頭に置き、範囲の中には書かない（貼った先にコメントを持ち込まないため）。
 *
 * 設計
 * - HTML は「見出しと本文がそのまま読める」状態で書き、開閉のボタンは JS が組み立てる。
 *   JS が動かない環境では本文がすべて読め、押しても何も起きないボタンも残らない。
 * - ルート要素 .c-accordion[data-accordion] にイベントを委譲する。項目が増えてもリスナーは増えない。
 * - 開閉状態は aria-expanded を唯一の源にし、見た目は CSS の [aria-expanded="true"] で切り替える。
 *   is-open のような別クラスを足さない。
 * - 本文の表示・非表示は hidden 属性で持つ。ボタンを組み立てた直後に JS が付ける。
 * - 仕掛け終えたルート要素に data-accordion-ready を付ける。CSS はこれが付くまでの間だけ
 *   本文を隠し、閉じた初期状態のちらつきを防ぐ（.js スコープ）。
 * - aria-controls の参照先は本文の id である。id の無い項目は組み立てを飛ばす。
 * - キーボード操作は <button> のネイティブ挙動に任せる（Enter / Space の処理を自前で書かない）。
 * - header.closest(".c-accordion") !== root は入れ子への備え。
 *   root.contains(header) では親が子のヘッダーまで拾い、親子で二重に発火する。
 */

/* snippet:start */
(function () {
  "use strict";

  const accordionRoots = document.querySelectorAll(".c-accordion[data-accordion]");

  if (accordionRoots.length === 0) return;

  function buildHeader(item) {
    const heading = item.querySelector(":scope > .c-accordion__heading");
    const panel = item.querySelector(":scope > .c-accordion__body");

    if (!heading || !panel || !panel.id) return;
    if (heading.querySelector(".c-accordion__header")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "c-accordion__header";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", panel.id);

    while (heading.firstChild) {
      button.appendChild(heading.firstChild);
    }

    const icon = document.createElement("span");
    icon.className = "c-accordion__icon";
    icon.setAttribute("aria-hidden", "true");
    button.appendChild(icon);

    heading.appendChild(button);
    panel.setAttribute("hidden", "");
  }

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
    root.querySelectorAll(":scope > .c-accordion__item").forEach(buildHeader);

    root.addEventListener("click", function (event) {
      const header = event.target.closest(".c-accordion__header");
      if (!header) return;

      if (header.closest(".c-accordion") !== root) return;

      toggleItem(header);
    });

    root.setAttribute("data-accordion-ready", "");
  }

  accordionRoots.forEach(bindAccordion);
})();
/* snippet:end */
