/**
 * 005_hamburger-push
 * ナビゲーションが右から出ると同時に、ページの内容が左へ押し出される形。
 *
 * 構造
 * - 押し出される側は c-push-wrapper である。ページの内容をこの中に置く
 * - ヘッダーは wrapper の外に置く。押し出しても動かない固定ヘッダーにするため
 * - c-push-cover は押し出されている間だけ前面に出る。中のリンクやボタンを
 *   誤って押さないようにし、押されたら閉じる
 *
 * 動き
 * - ボタンに is-active、ナビに is-open、ラッパーに is-pushed を付け外しする
 * - aria-expanded と aria-hidden、ボタンの読み上げ名を同時に更新する
 * - カバーのクリック、または Escape で閉じ、フォーカスをボタンへ戻す
 * - フォーカストラップの範囲はナビの中
 * - matchMedia でブレークポイント（768px）をまたいだときに状態を戻す
 *
 * 数値の対応
 * - 開いた直後にフォーカスを移すまでの 300ms は、CSS の --push-transition
 *   （0.3s）と同じ値である。CSS 側を変えたらこの値も変える
 *
 * スクロールロック
 * - 開いている間は body のスクロールを止める
 */

/* snippet:start */
(function () {
  "use strict";

  const hamburger = document.querySelector(".c-hamburger");
  const pushNav = document.querySelector(".c-push-nav");
  const pushWrapper = document.querySelector(".c-push-wrapper");
  const pushCover = document.querySelector(".c-push-cover");

  if (!hamburger || !pushNav || !pushWrapper || !pushCover) return;

  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function openMenu() {
    hamburger.classList.add("is-active");
    pushNav.classList.add("is-open");
    pushWrapper.classList.add("is-pushed");

    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "メニューを閉じる");
    pushNav.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";

    const firstFocusable = pushNav.querySelectorAll(FOCUSABLE_SELECTOR)[0];
    if (firstFocusable) {
      setTimeout(function () {
        firstFocusable.focus();
      }, 300);
    }
  }

  function closeMenu() {
    hamburger.classList.remove("is-active");
    pushNav.classList.remove("is-open");
    pushWrapper.classList.remove("is-pushed");

    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "メニューを開く");
    pushNav.setAttribute("aria-hidden", "true");

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
    if (!pushNav.classList.contains("is-open")) return;

    const focusableElements = Array.from(pushNav.querySelectorAll(FOCUSABLE_SELECTOR));
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

  pushCover.addEventListener("click", function () {
    if (!pushNav.classList.contains("is-open")) return;
    closeMenu();
    hamburger.focus();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && pushNav.classList.contains("is-open")) {
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
      if (pushNav.classList.contains("is-open")) {
        closeMenu();
      }
      pushNav.removeAttribute("aria-hidden");
    } else {
      pushNav.setAttribute("aria-hidden", "true");
    }
  });
})();
/* snippet:end */
