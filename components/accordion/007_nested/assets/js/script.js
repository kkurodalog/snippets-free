/**
 * 007_nested — 入れ子にする
 *
 * 掲載範囲（snippet:start 〜 snippet:end）だけを貼れば動く。
 * 解説はこのファイルの冒頭に置き、範囲の中には書かない（貼った先にコメントを持ち込まないため）。
 *
 * 設計
 * - HTML は「見出しと本文がそのまま読める」状態で書き、開閉のボタンは JS が組み立てる。
 *   JS が動かない環境では親も子も本文がすべて読め、押しても何も起きないボタンも残らない。
 * - 親と子はそれぞれ独立した root として取得し、bindAccordion を個別に仕掛ける。
 *   ボタンの組み立ても :scope > で直下の項目だけを対象にするため、親が子の見出しを巻き込まない。
 * - 仕掛け終えたルート要素に data-accordion-ready を付ける。CSS はこれが付くまでの間だけ
 *   本文を隠し、閉じた初期状態のちらつきを防ぐ（.js スコープ）。
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
