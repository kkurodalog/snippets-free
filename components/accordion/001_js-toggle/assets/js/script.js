/**
 * 001_js-toggle
 * バニラJS + ARIA対応アコーディオン（複数同時開閉許容のベース実装）
 *
 * 設計方針:
 * - ルート要素 .c-accordion[data-accordion] に対してイベント委譲する
 *   これにより、後続スニペット（004 multi-open / 005 single-open /
 *   007 nested）が同じパターンで拡張できる。
 * - 開閉状態は aria-expanded 属性を真実の源（single source of truth）とし、
 *   CSSは [aria-expanded="true"] セレクタで見た目を切り替える。
 *   余分な is-open クラスは付与しない。
 * - 本文の表示/非表示は HTML の hidden 属性で制御する。
 *   display:none と同等の振る舞いをHTML側で表現でき、
 *   JSが落ちた場合でも閉じた状態として安全にフォールバックする。
 *
 * 機能:
 * - ヘッダー（<button class="c-accordion__header">）のクリックで開閉
 * - <button> 要素を使用しているため Enter / Space キーでの操作は
 *   ブラウザがネイティブに処理する（追加のキーハンドラ不要）
 * - 各項目は独立して開閉する（複数同時に開ける）
 */

(function () {
  "use strict";

  // ルート要素を全て取得（同一ページ内に複数のアコーディオンがあっても動作する）
  const accordionRoots = document.querySelectorAll(".c-accordion[data-accordion]");

  if (accordionRoots.length === 0) return;

  /**
   * 1つのヘッダーボタンの開閉状態をトグルする
   *
   * @param {HTMLButtonElement} header - クリックされたヘッダーボタン
   */
  function toggleItem(header) {
    const isExpanded = header.getAttribute("aria-expanded") === "true";
    const panelId = header.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;

    if (!panel) return;

    if (isExpanded) {
      // 閉じる
      header.setAttribute("aria-expanded", "false");
      panel.setAttribute("hidden", "");
    } else {
      // 開く
      header.setAttribute("aria-expanded", "true");
      panel.removeAttribute("hidden");
    }
  }

  /**
   * ルート要素1つに対してイベント委譲を仕掛ける
   *
   * @param {HTMLElement} root - .c-accordion[data-accordion] 要素
   */
  function bindAccordion(root) {
    root.addEventListener("click", function (event) {
      // 拡張ポイント: 後続スニペットはここで closest の対象を変えたり、
      // 排他制御（他の項目を閉じる）処理を追加する。
      const header = event.target.closest(".c-accordion__header");
      if (!header) return;

      // 入れ子アコーディオン対策（後続 snippet 007 nested で必須）:
      // ヘッダーから最も近い .c-accordion が「自分自身（root）」でない場合は
      // 子アコーディオンのヘッダーなので処理しない。
      // root.contains(header) では親が子の header を true で拾ってしまい、
      // 親と子の二重発火が起きるため、closest で厳密にスコープを絞る。
      if (header.closest(".c-accordion") !== root) return;

      toggleItem(header);
    });
  }

  // 全てのルート要素に対してバインド
  accordionRoots.forEach(bindAccordion);
})();
