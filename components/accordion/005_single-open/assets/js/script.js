/**
 * 005_single-open
 * バニラJS + ARIA対応アコーディオン（排他制御型・常に最大1つだけ開く）
 *
 * 設計方針（snippet 001 / 004 を継承）:
 * - ルート要素 .c-accordion[data-accordion] に対してイベント委譲する。
 * - 開閉状態は aria-expanded 属性を真実の源（single source of truth）とし、
 *   CSSは [aria-expanded="true"] セレクタで見た目を切り替える。
 *   余分な is-open クラスは付与しない。
 * - 本文の表示/非表示は HTML の hidden 属性で制御する。
 * - setItemState(header, open) を経由して aria-expanded と hidden を
 *   同時更新するため、状態が必ず一致する（snippet 004 から踏襲）。
 *
 * 005 ならではの実装:
 * - クリックされた項目以外をすべて閉じる「排他制御パターンA」を採用。
 *   常に最大1つの項目だけが開いている状態を保つ。
 * - 開いている項目を再クリックすれば閉じられる（全閉状態を許容）。
 *   「常に1つは開いた状態を維持する」厳格モードは採用しない。
 * - aria-expanded の切替で支援技術に状態変化が伝わるため、
 *   snippet 004 の aria-live ライブリージョンのような追加通知は不要。
 *   WAI-ARIA APG Accordion パターンも追加通知を要求していない。
 *
 * 不採用パターン（記事 003 で本文コラムとして言及）:
 * - パターンB: HTML 仕様の <details name="..."> による排他制御
 * - パターンC: ラジオボタン + :checked 擬似クラスの CSS のみ実装
 * - パターンD: 常に1つは開いた状態を維持する厳格モード
 * いずれも 001/004 と実装系を揃えるため、本 snippet では採用していない。
 */

(function () {
  "use strict";

  // ルート要素を全て取得（同一ページ内に複数のアコーディオンがあっても動作する）
  const accordionRoots = document.querySelectorAll(".c-accordion[data-accordion]");

  if (accordionRoots.length === 0) return;

  /**
   * 1つのヘッダーボタンの開閉状態を「指定の状態」に揃える。
   * snippet 004 と同一シグネチャ（排他制御で他項目を強制クローズする際に活用）。
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
   * 指定 root 内の全ヘッダーを取得する。
   * 入れ子アコーディオン対策で、対象 root 直下のヘッダーのみを返す。
   * snippet 004 と同一実装。
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
   * 1つのヘッダーボタンの開閉状態をトグルする（排他制御版）。
   *
   * 排他制御の手順:
   *   1. forEach で「対象以外」を全クローズ（`h !== header` ガードで対象自身は除外）。
   *   2. 対象自身は forEach から除外されているため、最後の
   *      setItemState(header, !isExpanded) で1回だけトグルされる。
   *      （元が閉じていたら開く・元が開いていたら閉じる）
   *
   * この設計により、対象を「閉じてから再度開く」ような二重操作にはならず、
   * かつ元が開いていた対象を閉じるパスでは自然に全閉状態への遷移が成立する。
   * （= 「常に1つは開いた状態を維持する」厳格モード（パターンD）にはならない）
   *
   * @param {HTMLButtonElement} header - クリックされたヘッダーボタン
   * @param {HTMLElement} root - 所属する .c-accordion[data-accordion] 要素
   */
  function toggleItem(header, root) {
    const isExpanded = header.getAttribute("aria-expanded") === "true";

    // 排他制御: 対象以外の項目を先にすべて閉じる
    // （`h !== header` ガードにより対象自身はこの forEach の処理対象外）
    collectHeaders(root).forEach(function (h) {
      if (h !== header) setItemState(h, false);
    });

    // 対象項目はここで1回だけトグルされる（forEach 側では触れていないため二重操作にならない）
    setItemState(header, !isExpanded);
  }

  /**
   * ルート要素1つに対してイベント委譲を仕掛ける。
   *
   * @param {HTMLElement} root - .c-accordion[data-accordion] 要素
   */
  function bindAccordion(root) {
    root.addEventListener("click", function (event) {
      const header = event.target.closest(".c-accordion__header");
      if (!header) return;

      // 入れ子アコーディオン対策（snippet 001 / 004 と同等）:
      // ヘッダーから最も近い .c-accordion が「自分自身（root）」でない場合は
      // 子アコーディオンのヘッダーなので処理しない。
      if (header.closest(".c-accordion") !== root) return;

      // root をクロージャから渡し、collectHeaders のスコープを限定する。
      toggleItem(header, root);
    });
  }

  // 全てのルート要素に対してバインド
  accordionRoots.forEach(bindAccordion);
})();
