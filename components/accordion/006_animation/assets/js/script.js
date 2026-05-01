/**
 * 006_animation
 * バニラJS + ARIA対応アコーディオン（高さアニメーション付き）
 *
 * 設計方針（snippet 001 / 004 / 005 を継承）:
 * - ルート要素 .c-accordion[data-accordion] に対してイベント委譲する。
 * - 開閉状態は aria-expanded 属性を真実の源（single source of truth）とし、
 *   CSSは [aria-expanded="true"] セレクタで見た目を切り替える。
 *   余分な is-open クラスは付与しない。
 * - 本文の表示/非表示は HTML の hidden 属性で制御する（JS が落ちた場合の
 *   フォールバックとして閉状態が HTML 単体で読み取れる）。
 * - setItemState(header, open) を経由して aria-expanded と hidden を
 *   同時更新するため、状態が必ず一致する（snippet 004 / 005 と同一シグネチャ）。
 *
 * 006 ならではの実装:
 * - 高さアニメーションは CSS 側で grid-template-rows: 0fr → 1fr で実現する。
 *   __body をグリッドコンテナ、__content を min-height:0 + overflow:hidden の
 *   グリッド子要素にすることで、コンテンツの実寸を計測せずに高さ 0 ⇄ auto を遷移できる。
 * - 開く時と閉じる時で hidden / aria-expanded の操作順序が異なる
 *   （coding-rules.md v1.1 §6-5「open 即時 / close 遅延」確定ルール）:
 *   - 開く: hidden 除去 → aria-expanded="true"（即時）→ 高さアニメーション開始
 *   - 閉じる: aria-expanded="false"（即時）→ 高さアニメーション → 完了後に hidden 付与
 * - 閉じる時の hidden 付与は transitionend を grid-template-rows のみに絞って
 *   待機する（複数プロパティで多重発火するのを防ぐ）。
 * - prefers-reduced-motion または duration 0 の環境では transitionend が発火しないため、
 *   即時 hidden 付与パスへフォールバックする。
 *
 * 個別開閉の挙動は snippet 001 と同等（複数同時に開ける）。
 */

(function () {
  "use strict";

  // ルート要素を全て取得（同一ページ内に複数のアコーディオンがあっても動作する）
  const accordionRoots = document.querySelectorAll(".c-accordion[data-accordion]");

  if (accordionRoots.length === 0) return;

  /**
   * 1つのヘッダーボタンの開閉状態を「指定の状態」に揃える。
   * snippet 004 / 005 と同一シグネチャ（後続 snippet も維持する）。
   *
   * 開く時: hidden 除去（即時）→ aria-expanded="true"（即時）→ CSS の transition が
   *   grid-template-rows 0fr → 1fr を 200ms で再生する。
   *
   * 閉じる時: aria-expanded="false"（即時）→ CSS の transition が
   *   grid-template-rows 1fr → 0fr を 200ms で再生する → 完了後に hidden を付与する。
   *   transitionend は grid-template-rows プロパティのみで捕捉して多重発火を防ぐ。
   *   prefers-reduced-motion 等で transitionend が発火しない環境では
   *   即時 hidden 付与パスへフォールバックする。
   *
   * @param {HTMLButtonElement} header - 対象のヘッダーボタン
   * @param {boolean} open - true で開く、false で閉じる
   */
  function setItemState(header, open) {
    const panelId = header.getAttribute("aria-controls");
    const panel = panelId ? document.getElementById(panelId) : null;

    if (!panel) return;

    if (open) {
      // 開く: hidden を先に外して描画対象に戻し、その直後に aria-expanded を切替えて
      // CSS の高さアニメーションを開始する（hidden が付いたままだと
      // grid-template-rows のトランジションが走らない）。
      panel.removeAttribute("hidden");
      header.setAttribute("aria-expanded", "true");
    } else {
      // 閉じる: aria-expanded を先に false に切替えて支援技術へ即時通知し、
      // CSS が grid-template-rows 1fr → 0fr のアニメーションを再生する。
      // hidden の付与はアニメーション完了を待ってから行う。
      header.setAttribute("aria-expanded", "false");

      // motion 設定や duration 0 で transitionend が発火しない環境を考慮して
      // CSS の実効 transition-duration を読み取り、ゼロなら即時付与する。
      const effectiveDurationMs = readTransitionDurationMs(panel);

      if (effectiveDurationMs <= 0) {
        panel.setAttribute("hidden", "");
        return;
      }

      // grid-template-rows プロパティのみで transitionend を待機する
      // （他プロパティと多重発火しないようガードを入れる）。
      const onTransitionEnd = function (event) {
        if (event.target !== panel) return;
        if (event.propertyName !== "grid-template-rows") return;
        panel.removeEventListener("transitionend", onTransitionEnd);

        // アニメ中に再度開かれていた場合は hidden を付けない（状態の取り違え防止）。
        if (header.getAttribute("aria-expanded") === "true") return;
        panel.setAttribute("hidden", "");
      };
      panel.addEventListener("transitionend", onTransitionEnd);
    }
  }

  /**
   * パネルの transition-duration を ms 単位で取得する。
   * grid-template-rows のトランジションが無効化されている（reduced-motion 等）
   * 場合に 0 を返し、setItemState の即時 hidden 付与パスを走らせる。
   *
   * @param {HTMLElement} panel - .c-accordion__body 要素
   * @returns {number} 実効 transition-duration（ms）
   */
  function readTransitionDurationMs(panel) {
    const cs = window.getComputedStyle(panel);
    const value = cs.transitionDuration || "0s";
    // "0.2s, 0.2s" のように複数指定される場合があるため、最初の値だけ見る。
    const first = value.split(",")[0].trim();
    if (first.endsWith("ms")) return parseFloat(first);
    if (first.endsWith("s")) return parseFloat(first) * 1000;
    return 0;
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
   * snippet 004 / 005 と同一実装。
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
   * ルート要素1つに対してイベント委譲を仕掛ける。
   *
   * @param {HTMLElement} root - .c-accordion[data-accordion] 要素
   */
  function bindAccordion(root) {
    root.addEventListener("click", function (event) {
      const header = event.target.closest(".c-accordion__header");
      if (!header) return;

      // 入れ子アコーディオン対策（snippet 001 / 004 / 005 と同等）:
      // ヘッダーから最も近い .c-accordion が「自分自身（root）」でない場合は
      // 子アコーディオンのヘッダーなので処理しない。
      if (header.closest(".c-accordion") !== root) return;

      toggleItem(header);
    });
  }

  // 全てのルート要素に対してバインド
  accordionRoots.forEach(bindAccordion);
})();
