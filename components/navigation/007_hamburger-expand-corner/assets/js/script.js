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
 * 設計
 * - HTML は「ナビのリンクがそのまま読める」状態で書き、右下のボタンは JS が組み立てる。
 *   JS が動かない環境ではリンクが全部読め、押しても何も起きないボタンも残らない
 *   （このパーツは 768px 以上でもボタンを出すため、PC でも死んだボタンが残らない形にした）。
 * - 仕掛け終えたナビに data-hamburger-expand-corner-ready を付ける。閉じた見せ方（全画面への固定と
 *   visibility: hidden）は CSS 側でこの印の中だけに置いてある。
 * - 掲載範囲の先頭にあるインラインスクリプトは、開く前の状態が一瞬見えるのを防ぐためのもの。
 *
 * 画面幅と aria-hidden
 * - 768px 以上ではヘッダーのナビが常に見えているため aria-hidden を外す。
 *   起動時にも同じ関数を通し、いまの画面幅で判断する
 *   （matchMedia の change だけに任せると、最初から広い画面で開いたときに一度も外れない）。
 *
 * 動きの軽減
 * - prefers-reduced-motion: reduce のときは、待ち時間の定数を 0 にする。
 *   CSS 側で transition を切っても、JS が時間を数えている間は何も起きない時間が残るため
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
 * フォーカスの捕捉範囲
 * - 巡回の順番を DOM の並びに合わせる（ナビのリンク → 右下のボタン）。
 *   ボタンはナビの直後に置かれるため、配列の先頭に置くと「ボタンから Tab を押したとき」だけ
 *   捕捉が効かず、ヘッダーのロゴへ抜ける。ロゴは全画面ナビの下に完全に隠れており、
 *   フォーカスの輪郭が1画素も出ない停止になる。
 *
 * スクロールロック
 * - 画面全体を覆うため、開いている間は body のスクロールを止める
 */

/* snippet:start */
(function () {
  "use strict";

  const expandBg = document.querySelector(".c-expand-bg");
  const expandNav = document.querySelector(".c-expand-nav");

  if (!expandBg || !expandNav) return;

  function buildFab(controlsId) {
    const existing = document.querySelector(".c-fab");
    if (existing) return existing;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "c-fab";
    button.setAttribute("aria-label", "メニューを開く");
    button.setAttribute("aria-expanded", "false");
    if (controlsId) {
      button.setAttribute("aria-controls", controlsId);
    }

    for (let i = 0; i < 3; i += 1) {
      const line = document.createElement("span");
      line.className = "c-fab__line";
      button.appendChild(line);
    }

    expandNav.insertAdjacentElement("afterend", button);
    return button;
  }

  const fab = buildFab(expandNav.id);

  if (!fab) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function wait(ms) {
    return reducedMotion.matches ? 0 : ms;
  }

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
        }, wait(PHASE2_FOCUS_DELAY));
      }

      isAnimating = false;
    }, wait(PHASE1_DURATION));
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
      }, wait(CLOSE_BG_DURATION));
    }, wait(CLOSE_NAV_DURATION));
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
    const focusableElements = navFocusable.concat(fab);
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
      }, wait(CLOSE_NAV_DURATION + CLOSE_BG_DURATION));
      return;
    }
    if (e.key === "Tab") {
      trapFocus(e);
    }
  });

  const mediaQuery = window.matchMedia("(min-width: 768px)");

  function syncViewport() {
    if (mediaQuery.matches) {
      if (expandNav.classList.contains("is-open")) {
        isAnimating = false;
        fab.classList.remove("is-active");
        expandBg.classList.remove("is-expanding", "is-closing");
        expandNav.classList.remove("is-open");

        fab.setAttribute("aria-expanded", "false");
        fab.setAttribute("aria-label", "メニューを開く");

        document.body.style.overflow = "";
      }
      expandNav.removeAttribute("aria-hidden");
    } else if (!expandNav.classList.contains("is-open")) {
      expandNav.setAttribute("aria-hidden", "true");
    }
  }

  mediaQuery.addEventListener("change", syncViewport);

  syncViewport();
  expandNav.setAttribute("data-hamburger-expand-corner-ready", "");
})();
/* snippet:end */
