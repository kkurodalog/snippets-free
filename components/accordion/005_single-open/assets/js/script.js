/**
 * 005_single-open — 1つだけ開く
 *
 * 掲載範囲（snippet:start 〜 snippet:end）だけを貼れば動く。
 * 解説はこのファイルの冒頭に置き、範囲の中には書かない（貼った先にコメントを持ち込まないため）。
 *
 * 設計
 * - 個別の開閉は基本形と同じ。ルート要素へのイベント委譲・aria-expanded・hidden の3点を踏襲する。
 * - 排他制御は「対象以外を先に閉じてから、対象を1回だけトグルする」順で行う。
 *   対象自身を forEach の対象から外すため、閉じてから開き直す二重操作にならない。
 * - 開いている項目を押し直せば閉じられる（全部閉じた状態を許す）。
 *   常に1つは開いたままにする厳格な型は採らない。
 * - aria-expanded の切り替えで状態変化は伝わるため、読み上げ用の追加通知は置かない。
 * - 排他制御には details 要素の name 属性やラジオボタンを使う方法もある。
 *   ここでは他のパーツと実装を揃えるため JS の経路で書いている。
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

  function collectHeaders(root) {
    const candidates = root.querySelectorAll(".c-accordion__header");
    const result = [];
    candidates.forEach(function (header) {
      if (header.closest(".c-accordion") === root) {
        result.push(header);
      }
    });
    return result;
  }

  function toggleItem(header, root) {
    const isExpanded = header.getAttribute("aria-expanded") === "true";

    collectHeaders(root).forEach(function (h) {
      if (h !== header) setItemState(h, false);
    });

    setItemState(header, !isExpanded);
  }

  function bindAccordion(root) {
    root.addEventListener("click", function (event) {
      const header = event.target.closest(".c-accordion__header");
      if (!header) return;

      if (header.closest(".c-accordion") !== root) return;

      toggleItem(header, root);
    });
  }

  accordionRoots.forEach(bindAccordion);
})();
/* snippet:end */
