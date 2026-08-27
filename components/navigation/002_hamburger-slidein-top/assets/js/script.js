/**
 * 002_hamburger-slidein-top
 * ヘッダーの背面からナビゲーションが降りてくる形。
 *
 * 設計
 * - HTML は「ナビのリンクがそのまま読める」状態で書き、ハンバーガーボタンは JS が組み立てる。
 *   JS が動かない環境ではリンクが全部読め、押しても何も起きないボタンも残らない。
 * - 仕掛け終えたナビに data-hamburger-slidein-top-ready を付ける。閉じた見せ方（画面外への移動と
 *   visibility: hidden）は CSS 側でこの印の中だけに置いてある。
 * - 掲載範囲の先頭にあるインラインスクリプトは、開く前の状態が一瞬見えるのを防ぐためのもの。
 *
 * 画面幅と aria-hidden
 * - 768px 以上ではナビが常に見えているため aria-hidden を外す。
 *   起動時にも同じ関数を通し、いまの画面幅で判断する
 *   （matchMedia の change だけに任せると、最初から広い画面で開いたときに一度も外れない）。
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

  const header = document.querySelector(".c-header");
  const slidedownNav = document.querySelector(".c-slidedown-nav");

  if (!header || !slidedownNav) return;

  function buildHamburger(controlsId) {
    const inner = header.querySelector(".c-header__inner");
    if (!inner) return null;

    const existing = inner.querySelector(".c-hamburger");
    if (existing) return existing;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "c-hamburger";
    button.setAttribute("aria-label", "メニューを開く");
    button.setAttribute("aria-expanded", "false");
    if (controlsId) {
      button.setAttribute("aria-controls", controlsId);
    }

    for (let i = 0; i < 3; i += 1) {
      const line = document.createElement("span");
      line.className = "c-hamburger__line";
      button.appendChild(line);
    }

    const inlineNav = inner.querySelector(".c-nav");
    if (inlineNav) {
      inner.insertBefore(button, inlineNav);
    } else {
      inner.appendChild(button);
    }
    return button;
  }

  const hamburger = buildHamburger(slidedownNav.id);

  if (!hamburger) return;

  const mediaQuery = window.matchMedia("(min-width: 768px)");

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

  function syncViewport() {
    if (mediaQuery.matches) {
      if (slidedownNav.classList.contains("is-open")) {
        closeMenu();
      }
      slidedownNav.removeAttribute("aria-hidden");
    } else if (!slidedownNav.classList.contains("is-open")) {
      slidedownNav.setAttribute("aria-hidden", "true");
    }
  }

  mediaQuery.addEventListener("change", syncViewport);

  syncViewport();
  slidedownNav.setAttribute("data-hamburger-slidein-top-ready", "");
})();
/* snippet:end */
