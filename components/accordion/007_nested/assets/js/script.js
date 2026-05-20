/**
 * 007_nested
 * バニラJS + ARIA対応アコーディオン（入れ子・ネスト対応）
 *
 * 設計方針（共通実装を継承）:
 * - ルート要素 .c-accordion[data-accordion] に対してイベント委譲する。
 *   親アコーディオンと子アコーディオンはそれぞれ独立した root として
 *   取得し、bindAccordion を個別に仕掛ける（イベント委譲をネストごとに分離）。
 * - 開閉状態は aria-expanded 属性を真実の源（single source of truth）とし、
 *   CSSは [aria-expanded="true"] セレクタで見た目を切り替える。
 *   余分な is-open クラスは付与しない。
 * - 本文の表示/非表示は HTML の hidden 属性で制御する（JS が落ちた場合の
 *   フォールバックとして閉状態が HTML 単体で読み取れる）。
 * - setItemState(header, open) を経由して aria-expanded と hidden を
 *   同時更新するため、状態が必ず一致する（共通シグネチャ）。
 *
 * 本実装の核（入れ子対策）:
 * - bindAccordion 内のクリックハンドラに
 *   `header.closest(".c-accordion") !== root` のスコープガードを入れて、
 *   親ハンドラが子の header を拾って二重発火することを防ぐ。
 *   `root.contains(header)` では親が子の header を true で拾うため、
 *   `closest` で「ヘッダーが直属する root」を厳密に判定する必要がある。
 * - collectHeaders(root) でも同様に `header.closest(".c-accordion") === root`
 *   のガードを入れ、root 直下のヘッダーだけに絞り込む。
 * - 親項目を閉じた時に子の aria-expanded はリセットしない
 *   （親を再度開いた時に子の前回状態が復元される設計）。
 *
 * 親と子の data-accordion 属性は値なしの共通属性として扱う
 * （closest(".c-accordion") ベースのスコープガードが機能するため、
 *  親子で属性値を分ける必要はない）。
 */

(function () {
  "use strict";

  // 親 / 子に関わらず .c-accordion[data-accordion] を全て取得し、
  // 各 root に対して bindAccordion を仕掛ける。
  // 親の root と子の root は別物として扱われるため、それぞれのハンドラが
  // 独立した root を持つ（同一 click イベントが両方で発火しないよう
  // bindAccordion 内でスコープガードを入れる）。
  const accordionRoots = document.querySelectorAll(".c-accordion[data-accordion]");

  if (accordionRoots.length === 0) return;

  /**
   * 1つのヘッダーボタンの開閉状態を「指定の状態」に揃える。
   * 共通シグネチャ（後続も維持）。
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
   * （root.querySelectorAll だけだと子アコーディオンのヘッダーまで拾うため、
   *  closest(".c-accordion") === root のガードで自分の root に直属する
   *  ヘッダーだけに絞り込む。）
   *
   * @param {HTMLElement} root - .c-accordion[data-accordion] 要素
   * @returns {HTMLButtonElement[]}
   */
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

  /**
   * ルート要素1つに対してイベント委譲を仕掛ける。
   * 親 root と子 root の両方で呼ばれ、それぞれが独立したハンドラを持つ。
   *
   * @param {HTMLElement} root - .c-accordion[data-accordion] 要素
   */
  function bindAccordion(root) {
    root.addEventListener("click", function (event) {
      const header = event.target.closest(".c-accordion__header");
      if (!header) return;

      // 入れ子対策のスコープガード（親と子の二重発火防止）:
      // ヘッダーから最も近い .c-accordion が「自分自身（root）」でない場合は
      // 子アコーディオンのヘッダーなので処理しない。
      // 子 root のハンドラは別途登録されているため、子のクリックは
      // 子のハンドラだけで処理される。
      if (header.closest(".c-accordion") !== root) return;

      toggleItem(header);
    });
  }

  // collectHeaders は本実装の click 処理では直接呼ばれないが、
  // 後続の拡張（一括操作・排他制御）と API を揃えるためエクスポートに準じた
  // 形で定義しておく（共通シグネチャの維持）。
  void collectHeaders;

  // 全ての root（親も子も）に対して個別にバインドする
  accordionRoots.forEach(bindAccordion);
})();
