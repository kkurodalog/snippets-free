/**
 * 006_animation — 高さがなめらかに動く
 *
 * 掲載範囲（snippet:start 〜 snippet:end）だけを貼れば動く。
 * 解説はこのファイルの冒頭に置き、範囲の中には書かない（貼った先にコメントを持ち込まないため）。
 *
 * 設計
 * - 高さは CSS の grid-template-rows: 0fr → 1fr で動かす。コンテンツの実寸を測らない。
 * - 開くとき: hidden を外す → aria-expanded="true" → CSS の transition が走る。
 *   hidden が付いたままだと transition が始まらないため、この順序を崩さない。
 * - 閉じるとき: aria-expanded="false" を先に反映して支援技術へ即時に伝え、
 *   高さの transition が終わってから hidden を付ける。
 * - transitionend は grid-template-rows だけで捕まえる。他のプロパティと多重に発火させない。
 * - 動きを減らす設定などで transition-duration が 0 の環境では transitionend が発火しない。
 *   実効の duration を読み、0 なら即時に hidden を付ける経路へ落とす。
 * - アニメーションの最中に開き直された場合は hidden を付けない（状態の取り違えを防ぐ）。
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
      panel.removeAttribute("hidden");
      header.setAttribute("aria-expanded", "true");
    } else {
      header.setAttribute("aria-expanded", "false");

      const effectiveDurationMs = readTransitionDurationMs(panel);

      if (effectiveDurationMs <= 0) {
        panel.setAttribute("hidden", "");
        return;
      }

      const onTransitionEnd = function (event) {
        if (event.target !== panel) return;
        if (event.propertyName !== "grid-template-rows") return;
        panel.removeEventListener("transitionend", onTransitionEnd);

        if (header.getAttribute("aria-expanded") === "true") return;
        panel.setAttribute("hidden", "");
      };
      panel.addEventListener("transitionend", onTransitionEnd);
    }
  }

  function readTransitionDurationMs(panel) {
    const cs = window.getComputedStyle(panel);
    const value = cs.transitionDuration || "0s";
    const first = value.split(",")[0].trim();
    if (first.endsWith("ms")) return parseFloat(first);
    if (first.endsWith("s")) return parseFloat(first) * 1000;
    return 0;
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
