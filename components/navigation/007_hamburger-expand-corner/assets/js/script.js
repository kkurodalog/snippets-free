/**
 * 007_hamburger-expand-corner
 * 右下の丸いボタンから、暗い背景が円形に広がってメニューが出る形。
 *
 * 2段階で開き、逆順で閉じる
 * - 開く: 円形の背景が広がる（is-expanding）→ 途中からリンクが現れる（is-open）
 * - 閉じる: リンクが消える → 背景が縮む（is-closing）
 * - 動作中は isAnimating で入力を受け付けない。2段階の途中で割り込まれると
 *   背景とリンクの状態が食い違うため
 *
 * 動き
 * - ボタンに is-active、背景に is-expanding / is-closing、ナビに is-open を付け外しする
 * - aria-expanded と aria-hidden、ボタンの読み上げ名を同時に更新する
 * - Escape で閉じ、閉じ切ってからフォーカスをボタンへ戻す
 * - フォーカストラップの範囲はボタンとナビの中
 * - matchMedia でブレークポイント（768px）をまたいだときに状態を戻す
 *
 * 数値の対応
 * - PHASE1_DURATION 400ms   背景が広がる途中でリンクを出すまで（背景は 0.5s かけて広がる）
 * - PHASE2_FOCUS_DELAY 500ms リンクを出してからフォーカスを移すまで
 * - CLOSE_NAV_DURATION 300ms リンクが消え始めてから背景を縮め始めるまで（リンクのフェードは 0.4s）
 * - CLOSE_BG_DURATION 500ms  背景が縮み切るまで
 * - 4つの定数は --expand-transition-bg（0.5s）・--expand-transition-nav（0.4s）と
 *   1対1では対応しない。CSS の時間を変えたら4つとも見直す
 *
 * スクロールロック
 * - 画面全体を覆うため、開いている間は body のスクロールを止める
 */

/* snippet:start */
(function () {
  "use strict";

  const fab = document.querySelector(".c-fab");
  const expandBg = document.querySelector(".c-expand-bg");
  const expandNav = document.querySelector(".c-expand-nav");

  if (!fab || !expandBg || !expandNav) return;

  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const PHASE1_DURATION = 400;
  const PHASE2_FOCUS_DELAY = 500;

  const CLOSE_NAV_DURATION = 300;

  const CLOSE_BG_DURATION = 500;

  let isAnimating = false;

  function openMenu() {
    if (isAnimating) return;
    isAnimating = true;

    fab.classList.add("is-active");

    fab.setAttribute("aria-expanded", "true");
    fab.setAttribute("aria-label", "メニューを閉じる");

    document.body.style.overflow = "hidden";

    expandBg.classList.remove("is-closing");
    expandBg.classList.add("is-expanding");

    setTimeout(function () {
      expandNav.classList.add("is-open");
      expandNav.setAttribute("aria-hidden", "false");

      const firstFocusable = expandNav.querySelectorAll(FOCUSABLE_SELECTOR)[0];
      if (firstFocusable) {
        setTimeout(function () {
          firstFocusable.focus();
        }, PHASE2_FOCUS_DELAY);
      }

      isAnimating = false;
    }, PHASE1_DURATION);
  }

  function closeMenu() {
    if (isAnimating) return;
    isAnimating = true;

    expandNav.classList.remove("is-open");
    expandNav.setAttribute("aria-hidden", "true");

    setTimeout(function () {
      expandBg.classList.remove("is-expanding");
      expandBg.classList.add("is-closing");

      fab.classList.remove("is-active");

      fab.setAttribute("aria-expanded", "false");
      fab.setAttribute("aria-label", "メニューを開く");

      document.body.style.overflow = "";

      setTimeout(function () {
        expandBg.classList.remove("is-closing");
        expandNav.style.visibility = "";
        isAnimating = false;
      }, CLOSE_BG_DURATION);
    }, CLOSE_NAV_DURATION);
  }

  function toggleMenu() {
    const isOpen = fab.classList.contains("is-active");
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function trapFocus(e) {
    if (e.key !== "Tab") return;
    if (!expandNav.classList.contains("is-open")) return;

    const navFocusable = Array.from(expandNav.querySelectorAll(FOCUSABLE_SELECTOR));
    const focusableElements = [fab].concat(navFocusable);
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

  fab.addEventListener("click", toggleMenu);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && expandNav.classList.contains("is-open")) {
      closeMenu();
      setTimeout(function () {
        fab.focus();
      }, CLOSE_NAV_DURATION + CLOSE_BG_DURATION);
      return;
    }
    if (e.key === "Tab") {
      trapFocus(e);
    }
  });

  const mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", function (e) {
    if (e.matches) {
      if (expandNav.classList.contains("is-open")) {
        isAnimating = false;
        fab.classList.remove("is-active");
        expandBg.classList.remove("is-expanding", "is-closing");
        expandNav.classList.remove("is-open");

        fab.setAttribute("aria-expanded", "false");
        fab.setAttribute("aria-label", "メニューを開く");
        expandNav.setAttribute("aria-hidden", "true");

        document.body.style.overflow = "";
      }
      expandNav.removeAttribute("aria-hidden");
    } else {
      expandNav.setAttribute("aria-hidden", "true");
    }
  });
})();
/* snippet:end */
