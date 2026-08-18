/**
 * 002_hamburger-slidein-top
 * ヘッダーの背面からナビゲーションが降りてくる形。
 *
 * 動き
 * - ボタンに is-active、ナビに is-open を付け外しして状態を持つ
 * - aria-expanded と aria-hidden、ボタンの読み上げ名を同時に更新する
 * - ナビの外をクリック、または Escape で閉じ、フォーカスをボタンへ戻す
 * - フォーカストラップの範囲はハンバーガーボタンとナビの中
 * - matchMedia でブレークポイント（768px）をまたいだときに状態を戻す
 *
 * 数値の対応
 * - 開いた直後にフォーカスを移すまでの 300ms は、CSS の --slidedown-transition
 *   （0.3s）と同じ値である。CSS 側を変えたらこの値も変える
 *
 * スクロールロック
 * - ヘッダーの背面から降りてくるだけで画面全体を覆わないため掛けない
 *   （背面のコンテンツを読めるほうが自然である）
 */

/* snippet:start */
(function () {
  "use strict";

  const hamburger = document.querySelector(".c-hamburger");
  const slidedownNav = document.querySelector(".c-slidedown-nav");

  if (!hamburger || !slidedownNav) return;

  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function openMenu() {
    hamburger.classList.add("is-active");
    slidedownNav.classList.add("is-open");

    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "メニューを閉じる");
    slidedownNav.setAttribute("aria-hidden", "false");

    const firstFocusable = slidedownNav.querySelectorAll(FOCUSABLE_SELECTOR)[0];
    if (firstFocusable) {
      setTimeout(function () {
        firstFocusable.focus();
      }, 300);
    }
  }

  function closeMenu() {
    hamburger.classList.remove("is-active");
    slidedownNav.classList.remove("is-open");

    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "メニューを開く");
    slidedownNav.setAttribute("aria-hidden", "true");
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
    if (!slidedownNav.classList.contains("is-open")) return;

    const navFocusable = Array.from(slidedownNav.querySelectorAll(FOCUSABLE_SELECTOR));
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

  document.addEventListener("click", function (e) {
    const isOpen = slidedownNav.classList.contains("is-open");
    if (!isOpen) return;

    const isOutside =
      !hamburger.contains(e.target) && !slidedownNav.contains(e.target);
    if (isOutside) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && slidedownNav.classList.contains("is-open")) {
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
      if (slidedownNav.classList.contains("is-open")) {
        closeMenu();
      }
      slidedownNav.removeAttribute("aria-hidden");
    } else {
      slidedownNav.setAttribute("aria-hidden", "true");
    }
  });
})();
/* snippet:end */
