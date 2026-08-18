/**
 * 003_hamburger-slidein-right
 * 右側からナビゲーションが滑り込み、画面全体を覆う形。
 *
 * 動き
 * - ボタンに is-active、ナビに is-open を付け外しして状態を持つ
 * - aria-expanded と aria-hidden、ボタンの読み上げ名を同時に更新する
 * - ナビの外をクリック、または Escape で閉じ、フォーカスをボタンへ戻す
 * - フォーカストラップの範囲はヘッダーのロゴ、ハンバーガーボタン、ナビの中
 *   （覆っている間もロゴが見えるため、範囲に含める）
 * - matchMedia でブレークポイント（768px）をまたいだときに状態を戻す
 *
 * 数値の対応
 * - 開いた直後にフォーカスを移すまでの 300ms は、CSS の --slidein-transition
 *   （0.3s）と同じ値である。CSS 側を変えたらこの値も変える
 *
 * スクロールロック
 * - 画面全体を覆うため、開いている間は body のスクロールを止める
 */

/* snippet:start */
(function () {
  "use strict";

  const hamburger = document.querySelector(".c-hamburger");
  const slideinNav = document.querySelector(".c-slidein-nav");
  const headerLogo = document.querySelector(".c-header__logo");

  if (!hamburger || !slideinNav) return;

  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function lockScroll() {
    document.body.style.overflow = "hidden";
  }

  function unlockScroll() {
    document.body.style.overflow = "";
  }

  function openMenu() {
    hamburger.classList.add("is-active");
    slideinNav.classList.add("is-open");

    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "メニューを閉じる");
    slideinNav.setAttribute("aria-hidden", "false");

    lockScroll();

    const firstFocusable = slideinNav.querySelectorAll(FOCUSABLE_SELECTOR)[0];
    if (firstFocusable) {
      setTimeout(function () {
        firstFocusable.focus();
      }, 300);
    }
  }

  function closeMenu() {
    hamburger.classList.remove("is-active");
    slideinNav.classList.remove("is-open");

    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "メニューを開く");
    slideinNav.setAttribute("aria-hidden", "true");

    unlockScroll();
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
    if (!slideinNav.classList.contains("is-open")) return;

    const navFocusable = Array.from(slideinNav.querySelectorAll(FOCUSABLE_SELECTOR));
    const focusableElements = headerLogo
      ? [headerLogo, hamburger, ...navFocusable]
      : [hamburger, ...navFocusable];
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
    const isOpen = slideinNav.classList.contains("is-open");
    if (!isOpen) return;

    const isOutside =
      !hamburger.contains(e.target) && !slideinNav.contains(e.target);
    if (isOutside) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && slideinNav.classList.contains("is-open")) {
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
      if (slideinNav.classList.contains("is-open")) {
        closeMenu();
      }
      slideinNav.removeAttribute("aria-hidden");
    } else {
      slideinNav.setAttribute("aria-hidden", "true");
    }
  });
})();
/* snippet:end */
