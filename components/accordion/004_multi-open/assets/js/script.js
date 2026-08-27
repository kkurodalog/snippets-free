/**
 * 004_multi-open — すべて開く・すべて閉じる
 *
 * 掲載範囲（snippet:start 〜 snippet:end）だけを貼れば動く。
 * 解説はこのファイルの冒頭に置き、範囲の中には書かない（貼った先にコメントを持ち込まないため）。
 *
 * 設計
 * - HTML は「見出しと本文がそのまま読める」状態で書き、開閉のボタンは JS が組み立てる。
 *   JS が動かない環境では本文がすべて読め、押しても何も起きないボタンも残らない。
 * - 一括操作のボタンは HTML に置くが、CSS の既定で非表示にしてある。
 *   JS が仕掛け終えたときだけ data-multi-open-bulk-ready を付けて表示する。
 *   これも「押しても何も起きないボタンを画面に残さない」の一部である。
 * - 個別の開閉は基本形と同じ。ルート要素へのイベント委譲・aria-expanded・hidden の3点を踏襲する。
 * - 仕掛け終えたルート要素に data-multi-open-ready を付ける。CSS はこれが付くまでの間だけ
 *   本文を隠し、閉じた初期状態のちらつきを防ぐ（.js スコープ）。
 * - 一括操作の対象は data-multi-open-bulk-controls="対象の id" で特定する。同じページに複数置いても取り違えない。
 * - 個別操作も一括操作も setItemState() を通す。aria-expanded と hidden が必ず同時に変わる。
 * - 全開・全閉では対応するボタンを disabled にする。押しても何も起きないボタンを画面に残さない。
 * - 一括操作の結果は aria-live="polite" の領域へ書いて支援技術に伝える。
 *   同じ文字列を続けて書くと変化なしと見なされるため、同一のときだけ末尾に不可視の空白（U+00A0）を足す。
 * - 状態の通知先は一括コントロールの配下から引く。複数共存時に他方の通知領域へ書き込まないため。
 * - data-multi-open-bulk-controls の値は英数字・ハイフン・アンダースコアだけを前提にする。
 *   それ以外の文字を使うなら CSS.escape() を併用する。
 */

/* snippet:start */
(function () {
  "use strict";

  const accordionRoots = document.querySelectorAll(".c-accordion[data-multi-open]");

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

  function updateBulkButtonsState(root, bulkRoot) {
    const headers = collectHeaders(root);
    if (headers.length === 0) return;

    const allOpen = headers.every(function (h) {
      return h.getAttribute("aria-expanded") === "true";
    });
    const allClosed = headers.every(function (h) {
      return h.getAttribute("aria-expanded") !== "true";
    });

    const openButton = bulkRoot.querySelector('[data-multi-open-bulk-action="open"]');
    const closeButton = bulkRoot.querySelector('[data-multi-open-bulk-action="close"]');

    if (openButton) openButton.disabled = allOpen;
    if (closeButton) closeButton.disabled = allClosed;
  }

  function announce(statusEl, message) {
    if (!statusEl) return;
    const suffix = statusEl.textContent === message ? " " : "";
    statusEl.textContent = message + suffix;
  }

  function bindAccordion(root) {
    root.querySelectorAll(":scope > .c-accordion__item").forEach(buildHeader);

    const accordionId = root.id;
    const bulkRoot = accordionId
      ? document.querySelector(
          '[data-multi-open-bulk-controls="' + accordionId + '"]'
        )
      : null;
    const statusEl = bulkRoot ? bulkRoot.querySelector("[data-multi-open-bulk-status]") : null;

    root.addEventListener("click", function (event) {
      const header = event.target.closest(".c-accordion__header");
      if (!header) return;

      if (header.closest(".c-accordion") !== root) return;

      toggleItem(header);

      if (bulkRoot) updateBulkButtonsState(root, bulkRoot);
    });

    root.setAttribute("data-multi-open-ready", "");

    if (bulkRoot) {
      bulkRoot.addEventListener("click", function (event) {
        const button = event.target.closest("[data-multi-open-bulk-action]");
        if (!button) return;
        if (button.disabled) return;

        const action = button.getAttribute("data-multi-open-bulk-action");
        const headers = collectHeaders(root);

        if (action === "open") {
          headers.forEach(function (h) {
            setItemState(h, true);
          });
          announce(statusEl, "すべての項目を開きました");
        } else if (action === "close") {
          headers.forEach(function (h) {
            setItemState(h, false);
          });
          announce(statusEl, "すべての項目を閉じました");
        }

        updateBulkButtonsState(root, bulkRoot);
      });

      updateBulkButtonsState(root, bulkRoot);
      bulkRoot.setAttribute("data-multi-open-bulk-ready", "");
    }
  }

  accordionRoots.forEach(bindAccordion);
})();
/* snippet:end */
