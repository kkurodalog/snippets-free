/**
 * 003_hamburger-fullscreen
 * フルスクリーン型ハンバーガーメニュー
 *
 * 機能:
 * - ハンバーガーボタンクリックで画面全体を覆うフルスクリーンメニューを表示
 * - ボタンに is-active、フルスクリーンナビに is-open クラスを付与/除去
 * - aria-expanded / aria-hidden 属性を連動更新（アクセシビリティ対応）
 * - Escape キーで閉じる（フォーカスをハンバーガーボタンに戻す）
 * - スクロールロック（メニュー開放中は body のスクロールを止める）
 * - フォーカストラップ（フルスクリーンナビ内にフォーカスを閉じ込める）
 * - matchMedia でリサイズ時に状態をリセット
 */

(function () {
  "use strict";

  // 要素取得
  const header = document.querySelector(".c-header");
  const hamburger = document.querySelector(".c-hamburger");
  const fullscreenNav = document.querySelector(".c-fullscreen-nav");

  // 要素が存在しない場合は処理しない
  if (!header || !hamburger || !fullscreenNav) return;

  // フォーカス可能な要素のセレクター
  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /**
   * メニューを開く
   */
  function openMenu() {
    hamburger.classList.add("is-active");
    fullscreenNav.classList.add("is-open");
    header.classList.add("is-menu-open");

    // aria 属性更新
    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "メニューを閉じる");
    fullscreenNav.setAttribute("aria-hidden", "false");

    // スクロールロック
    document.body.style.overflow = "hidden";

    // フルスクリーンナビ内の最初のフォーカス可能要素にフォーカス移動
    const firstFocusable = fullscreenNav.querySelectorAll(FOCUSABLE_SELECTOR)[0];
    if (firstFocusable) {
      // トランジション完了後にフォーカス移動
      // 400ms = CSS カスタムプロパティ --fullscreen-transition（0.4s）に合わせること
      // CSS 側の値を変更した場合はここも合わせて変更する
      setTimeout(function () {
        firstFocusable.focus();
      }, 400);
    }
  }

  /**
   * メニューを閉じる
   */
  function closeMenu() {
    hamburger.classList.remove("is-active");
    fullscreenNav.classList.remove("is-open");
    header.classList.remove("is-menu-open");

    // aria 属性更新
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "メニューを開く");
    fullscreenNav.setAttribute("aria-hidden", "true");

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
   * フルスクリーンナビ内のフォーカス可能要素の間でフォーカスをループさせる
   * ハンバーガーボタンもトラップ範囲に含める（フルスクリーン上に表示されるため）
   * @param {KeyboardEvent} e
   */
  function trapFocus(e) {
    if (e.key !== "Tab") return;
    if (!fullscreenNav.classList.contains("is-open")) return;

    // ハンバーガーボタン + フルスクリーンナビ内のフォーカス可能要素を結合
    const navFocusable = Array.from(fullscreenNav.querySelectorAll(FOCUSABLE_SELECTOR));
    const focusableElements = [hamburger, ...navFocusable];
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

  // キーボード操作（Escape / Tab）を1つのリスナーで統合管理
  document.addEventListener("keydown", function (e) {
    // Escape: メニューを閉じてフォーカスを戻す
    if (e.key === "Escape" && fullscreenNav.classList.contains("is-open")) {
      closeMenu();
      hamburger.focus();
      return;
    }
    // Tab: フォーカストラップ
    if (e.key === "Tab") {
      trapFocus(e);
    }
  });

  // 画面幅が768px以上になったらメニューを閉じる（縦横回転・リサイズ対応）
  // 初期ロード時の aria-hidden 状態は HTML 属性に依存する（リスナーは変化時のみ発火するため）
  const mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", function (e) {
    if (e.matches) {
      // PCサイズ: フルスクリーンナビを閉じてスクロールロック解除
      if (fullscreenNav.classList.contains("is-open")) {
        closeMenu();
      }
      // PCではフルスクリーンナビの aria-hidden は不要なので除去
      fullscreenNav.removeAttribute("aria-hidden");
    } else {
      // SPサイズに戻ったとき: フルスクリーンナビは非表示状態なので aria-hidden を付与
      fullscreenNav.setAttribute("aria-hidden", "true");
    }
  });
})();
