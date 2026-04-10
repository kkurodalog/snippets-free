/**
 * 002_hamburger-overlay
 * ドロワー型ハンバーガーメニュー（オーバーレイ付き）
 *
 * 機能:
 * - ハンバーガーボタンクリックで右からドロワーをスライドイン
 * - 背景にオーバーレイ（半透明の暗幕）を表示
 * - ボタンに is-active、ドロワーに is-open、オーバーレイに is-visible クラスを付与/除去
 * - aria-expanded / aria-hidden 属性を連動更新（アクセシビリティ対応）
 * - オーバーレイクリックでドロワーを閉じる
 * - ドロワー内の閉じるボタンで閉じる
 * - Escape キーで閉じる（フォーカスをハンバーガーボタンに戻す）
 * - スクロールロック（メニュー開放中は body のスクロールを止める）
 * - フォーカストラップ（ドロワー内にフォーカスを閉じ込める）
 * - matchMedia でリサイズ時に状態をリセット
 */

(function () {
  "use strict";

  // 要素取得
  const hamburger = document.querySelector(".c-hamburger");
  const drawer = document.querySelector(".c-drawer");
  const drawerClose = document.querySelector(".c-drawer__close");
  const overlay = document.querySelector(".c-overlay");

  // 要素が存在しない場合は処理しない
  if (!hamburger || !drawer || !overlay) return;

  // フォーカス可能な要素のセレクター
  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /**
   * メニューを開く
   */
  function openMenu() {
    hamburger.classList.add("is-active");
    drawer.classList.add("is-open");
    overlay.classList.add("is-visible");

    // aria 属性更新
    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "メニューを閉じる");
    drawer.setAttribute("aria-hidden", "false");
    // overlay の aria-hidden はHTML側で固定（JSからは操作しない）

    // スクロールロック
    document.body.style.overflow = "hidden";

    // ドロワー内の最初のフォーカス可能要素にフォーカス移動
    const firstFocusable = drawer.querySelectorAll(FOCUSABLE_SELECTOR)[0];
    if (firstFocusable) {
      // トランジション完了後にフォーカス移動
      // 300ms = CSS カスタムプロパティ --drawer-transition（0.3s）に合わせること
      // CSS 側の値を変更した場合はここも合わせて変更する
      setTimeout(function () {
        firstFocusable.focus();
      }, 300);
    }
  }

  /**
   * メニューを閉じる
   */
  function closeMenu() {
    hamburger.classList.remove("is-active");
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-visible");

    // aria 属性更新
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "メニューを開く");
    drawer.setAttribute("aria-hidden", "true");
    // overlay の aria-hidden はHTML側で固定（JSからは操作しない）

    // スクロールロック解除
    document.body.style.overflow = "";
  }

  /**
   * メニューのトグル
   */
  function toggleMenu() {
    const isOpen = hamburger.classList.contains("is-active");
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  /**
   * フォーカストラップ
   * ドロワー内のフォーカス可能要素の間でフォーカスをループさせる
   * @param {KeyboardEvent} e
   */
  function trapFocus(e) {
    if (e.key !== "Tab") return;
    if (!drawer.classList.contains("is-open")) return;

    const focusableElements = Array.from(drawer.querySelectorAll(FOCUSABLE_SELECTOR));
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      // Shift + Tab: 最初の要素でさらに後退しようとしたら最後の要素に移動
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: 最後の要素でさらに前進しようとしたら最初の要素に移動
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  // ハンバーガーボタンのクリックイベント
  hamburger.addEventListener("click", toggleMenu);

  // ドロワー内の閉じるボタンのクリックイベント
  // drawerClose は省略可能な要素のため、存在する場合のみイベントを登録する（ガード節とは別に個別チェック）
  if (drawerClose) {
    drawerClose.addEventListener("click", function () {
      closeMenu();
      // フォーカスをハンバーガーボタンに戻す
      hamburger.focus();
    });
  }

  // オーバーレイクリックで閉じる
  overlay.addEventListener("click", function () {
    closeMenu();
    // フォーカスをハンバーガーボタンに戻す
    hamburger.focus();
  });

  // キーボード操作（Escape / Tab）を1つのリスナーで統合管理
  document.addEventListener("keydown", function (e) {
    // Escape: メニューを閉じてフォーカスを戻す
    if (e.key === "Escape" && drawer.classList.contains("is-open")) {
      closeMenu();
      hamburger.focus();
      return;
    }
    // Tab: フォーカストラップ
    if (e.key === "Tab") {
      trapFocus(e);
    }
  });

  // 画面幅が768px以上になったらドロワーを閉じる（縦横回転・リサイズ対応）
  // 初期ロード時の aria-hidden 状態は HTML 属性に依存する（リスナーは変化時のみ発火するため）
  const mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", function (e) {
    if (e.matches) {
      // PCサイズ: ドロワーを閉じてスクロールロック解除
      if (drawer.classList.contains("is-open")) {
        closeMenu();
      }
      // PCではドロワーの aria-hidden は不要なので除去
      drawer.removeAttribute("aria-hidden");
    } else {
      // SPサイズに戻ったとき: ドロワーは非表示状態なので aria-hidden を付与
      drawer.setAttribute("aria-hidden", "true");
    }
  });
})();
