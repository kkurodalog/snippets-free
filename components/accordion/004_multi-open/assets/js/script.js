/**
 * 004_multi-open
 * バニラJS + ARIA対応アコーディオン（複数同時オープン許可型 + 一括操作）
 *
 * 設計方針（snippet 001 を継承）:
 * - ルート要素 .c-accordion[data-accordion] に対してイベント委譲する。
 * - 開閉状態は aria-expanded 属性を真実の源（single source of truth）とし、
 *   CSSは [aria-expanded="true"] セレクタで見た目を切り替える。
 *   余分な is-open クラスは付与しない。
 * - 本文の表示/非表示は HTML の hidden 属性で制御する。
 *
 * 004 で追加した機能:
 * - 「すべて開く / すべて閉じる」一括コントロール
 *   data-bulk-controls="<対象 c-accordion の id>" で対象を特定するため、
 *   同一ページに複数アコーディオンが共存しても破綻しない。
 * - 個別操作・一括操作のいずれでも setItemState() を経由して
 *   aria-expanded と hidden を同時更新するため、状態が必ず一致する。
 * - 全項目の状態に応じて一括ボタン自体を disabled 化（全閉時は「すべて閉じる」、
 *   全開時は「すべて開く」を無効化）。
 * - 一括操作後は aria-live="polite" 領域へテキストを差し込み、
 *   スクリーンリーダーへ「すべて開きました/閉じました」を通知する。
 */

(function () {
  "use strict";

  // ルート要素を全て取得（同一ページ内に複数のアコーディオンがあっても動作する）
  const accordionRoots = document.querySelectorAll(".c-accordion[data-accordion]");

  if (accordionRoots.length === 0) return;

  /**
   * 1つのヘッダーボタンの開閉状態を「指定の状態」に揃える。
   * トグルではなく明示的な値を取るため、一括操作で活用する。
   *
   * @param {HTMLButtonElement} header - 対象のヘッダーボタン
   * @param {boolean} open - true で開く、false で閉じる
   */
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

  /**
   * 1つのヘッダーボタンの開閉状態をトグルする（個別クリック用）。
   *
   * @param {HTMLButtonElement} header - クリックされたヘッダーボタン
   */
  function toggleItem(header) {
    const isExpanded = header.getAttribute("aria-expanded") === "true";
    setItemState(header, !isExpanded);
  }

  /**
   * 指定 root 内の全ヘッダーを取得する。
   * 入れ子アコーディオン対策で、対象 root 直下のヘッダーのみを返す。
   *
   * @param {HTMLElement} root - .c-accordion[data-accordion] 要素
   * @returns {HTMLButtonElement[]}
   */
  function collectHeaders(root) {
    const candidates = root.querySelectorAll(".c-accordion__header");
    const result = [];
    candidates.forEach(function (header) {
      // header から最も近い .c-accordion が root と一致する場合のみ採用
      // （入れ子アコーディオン時に子の header を拾わないため）
      if (header.closest(".c-accordion") === root) {
        result.push(header);
      }
    });
    return result;
  }

  /**
   * 一括操作ボタンの disabled 状態を、現在の開閉状況に応じて更新する。
   * - 全項目が開いている → 「すべて開く」を disabled
   * - 全項目が閉じている → 「すべて閉じる」を disabled
   *
   * @param {HTMLElement} root - .c-accordion[data-accordion] 要素
   * @param {HTMLElement} bulkRoot - [data-bulk-controls] 要素
   */
  function updateBulkButtonsState(root, bulkRoot) {
    const headers = collectHeaders(root);
    if (headers.length === 0) return;

    const allOpen = headers.every(function (h) {
      return h.getAttribute("aria-expanded") === "true";
    });
    const allClosed = headers.every(function (h) {
      return h.getAttribute("aria-expanded") !== "true";
    });

    const openButton = bulkRoot.querySelector('[data-bulk-action="open"]');
    const closeButton = bulkRoot.querySelector('[data-bulk-action="close"]');

    if (openButton) openButton.disabled = allOpen;
    if (closeButton) closeButton.disabled = allClosed;
  }

  /**
   * スクリーンリーダーへ一括操作の結果を通知する。
   * aria-live="polite" 領域へテキストを差し込むだけで支援技術が読み上げる。
   * 同じテキストを連続書き込みすると変化なしと見なされ通知されない場合があるため、
   * 既に同じ内容が入っている場合のみ末尾に不可視文字（NBSP, U+00A0）を付けて
   * テキストの変化を明示する。
   *
   * @param {HTMLElement} statusEl - data-bulk-status 要素
   * @param {string} message - 通知するメッセージ
   */
  function announce(statusEl, message) {
    if (!statusEl) return;
    // 同一テキスト連続書き込み時に aria-live が変化として検出するよう、
    // 既に同じ内容が入っている場合のみ末尾に不可視のNBSPを付ける
    const suffix = statusEl.textContent === message ? " " : "";
    statusEl.textContent = message + suffix;
  }

  /**
   * ルート要素1つに対してイベント委譲を仕掛ける。
   *
   * @param {HTMLElement} root - .c-accordion[data-accordion] 要素
   */
  function bindAccordion(root) {
    // 対応する一括コントロールを id 経由で特定する
    const accordionId = root.id;
    // 注: data-bulk-controls の値（= 対象 c-accordion の id）は
    // 英数字・ハイフン・アンダースコアのみで構成する前提。
    // CSS3 識別子規則を超える文字を使う場合は CSS.escape() を併用すること。
    const bulkRoot = accordionId
      ? document.querySelector(
          '[data-bulk-controls="' + accordionId + '"]'
        )
      : null;
    // statusEl は bulkRoot 配下から取得し、複数アコーディオン共存時に
    // 他アコーディオン用の sr-status へ書き込むことを防ぐ。
    const statusEl = bulkRoot ? bulkRoot.querySelector("[data-bulk-status]") : null;

    // 個別ヘッダーの開閉（snippet 001 と同等のイベント委譲）
    root.addEventListener("click", function (event) {
      const header = event.target.closest(".c-accordion__header");
      if (!header) return;

      // 入れ子アコーディオン対策: ヘッダーから最も近い .c-accordion が
      // 自分自身（root）でない場合は処理しない。
      if (header.closest(".c-accordion") !== root) return;

      toggleItem(header);

      // 個別操作後も一括ボタンの disabled を同期する
      if (bulkRoot) updateBulkButtonsState(root, bulkRoot);
    });

    // 一括操作ボタンのバインド
    if (bulkRoot) {
      bulkRoot.addEventListener("click", function (event) {
        const button = event.target.closest("[data-bulk-action]");
        if (!button) return;
        if (button.disabled) return;

        const action = button.getAttribute("data-bulk-action");
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

      // 初期状態の disabled を反映（HTMLの初期値が全閉なら「すべて閉じる」を即無効）
      updateBulkButtonsState(root, bulkRoot);
    }
  }

  // 全てのルート要素に対してバインド
  accordionRoots.forEach(bindAccordion);
})();
