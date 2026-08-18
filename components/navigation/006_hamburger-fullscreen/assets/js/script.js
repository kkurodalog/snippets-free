/**
 * 006_hamburger-fullscreen
 * 画面全体を覆うメニュー。項目が順番に現れる。
 *
 * 動き
 * - ボタンに is-active、ナビに is-open を付け外しして状態を持つ
 * - ヘッダーにも is-menu-open を付け、覆っている間の配色を切り替える
 * - aria-expanded と aria-hidden、ボタンの読み上げ名を同時に更新する
 * - Escape で閉じ、フォーカスをハンバーガーボタンへ戻す
 * - フォーカストラップの範囲はハンバーガーボタンとナビの中
 *   （ボタンはメニューの上に出るため、範囲に含める）
 * - matchMedia でブレークポイント（768px）をまたいだときに状態を戻す
 *
 * 数値の対応
 * - 開いた直後にフォーカスを移すまでの 400ms は、CSS の --fullscreen-transition
 *   （0.4s）と同じ値である。CSS 側を変えたらこの値も変える
 *
 * スクロールロック
 * - 画面全体を覆うため、開いている間は body のスクロールを止める
 */

/* snippet:start */
(function () {
  "use strict";

  const header = document.querySelector(".c-header");
  const hamburger = document.querySelector(".c-hamburger");
  const fullscreenNav = document.querySelector(".c-fullscreen-nav");

  if (!header || !hamburger || !fullscreenNav) return;

  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function openMenu() {
    hamburger.classList.add("is-active");
    fullscreenNav.classList.add("is-open");
    header.classList.add("is-menu-open");

    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "メニューを閉じる");
    fullscreenNav.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";

    const firstFocusable = fullscreenNav.querySelectorAll(FOCUSABLE_SELECTOR)[0];
    if (firstFocusable) {
      setTimeout(function () {
        firstFocusable.focus();
      }, 400);
    }
  }

  function closeMenu() {
    hamburger.classList.remove("is-active");
    fullscreenNav.classList.remove("is-open");
    header.classList.remove("is-menu-open");

    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "メニューを開く");
    fullscreenNav.setAttribute("aria-hidden", "true");

    document.body.style.overflow = "";
  }

  function toggleMenu() {
    const isOpen = hamburger.classList.contains("is-active");
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function trapFocus(e) {
    if (e.key !== "Tab") return;
    if (!fullscreenNav.classList.contains("is-open")) return;

    const navFocusable = Array.from(fullscreenNav.querySelectorAll(FOCUSABLE_SELECTOR));
    const focusableElements = [hamburger, ...navFocusable];
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }

  hamburger.addEventListener("click", toggleMenu);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && fullscreenNav.classList.contains("is-open")) {
      closeMenu();
      hamburger.focus();
      return;
    }
    if (e.key === "Tab") {
      trapFocus(e);
    }
  });

  const mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", function (e) {
    if (e.matches) {
      if (fullscreenNav.classList.contains("is-open")) {
        closeMenu();
      }
      fullscreenNav.removeAttribute("aria-hidden");
    } else {
      fullscreenNav.setAttribute("aria-hidden", "true");
    }
  });
})();
/* snippet:end */
