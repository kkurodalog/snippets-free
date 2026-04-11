/**
 * 005_hamburger-push
 * プッシュ型ハンバーガーメニュー（コンテンツ左から押し込み型）
 *
 * 機能:
 * - ハンバーガーボタンクリックで右からナビパネルをスライドイン
 * - 同時にページコンテンツ全体（header + main）を左に押し出す
 * - オーバーレイ（背景暗転）なし — 押し出されたコンテンツ自体がナビの外側として見える
 * - ボタンに is-active、ナビに is-open、ラッパーに is-pushed クラスを付与/除去
 * - aria-expanded / aria-hidden 属性を連動更新（アクセシビリティ対応）
 * - 押し出されたコンテンツ部分（c-push-cover）のクリックで閉じる
 * - Escape キーで閉じる（フォーカスをハンバーガーボタンに戻す）
 * - スクロールロック（メニュー開放中は body のスクロールを止める）
 * - フォーカストラップ（ナビ内にフォーカスを閉じ込める）
 * - matchMedia でリサイズ時に状態をリセット
 */

(function () {
  "use strict";

  // 要素取得
  const hamburger = document.querySelector(".c-hamburger");
  const pushNav = document.querySelector(".c-push-nav");
  const pushWrapper = document.querySelector(".c-push-wrapper");
  const pushCover = document.querySelector(".c-push-cover");

  // 要素が存在しない場合は処理しない
  if (!hamburger || !pushNav || !pushWrapper || !pushCover) return;

  // フォーカス可能な要素のセレクター
  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /**
   * メニューを開く
   */
  function openMenu() {
    hamburger.classList.add("is-active");
    pushNav.classList.add("is-open");
    pushWrapper.classList.add("is-pushed");

    // aria 属性更新
    hamburger.setAttribute("aria-expanded", "true");
    hamburger.setAttribute("aria-label", "メニューを閉じる");
    pushNav.setAttribute("aria-hidden", "false");

    // スクロールロック
    document.body.style.overflow = "hidden";

    // ナビ内の最初のフォーカス可能要素にフォーカス移動
    const firstFocusable = pushNav.querySelectorAll(FOCUSABLE_SELECTOR)[0];
    if (firstFocusable) {
      // トランジション完了後にフォーカス移動
      // 300ms = CSS カスタムプロパティ --push-transition（0.3s）に合わせること
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
    pushNav.classList.remove("is-open");
    pushWrapper.classList.remove("is-pushed");

    // aria 属性更新
    hamburger.setAttribute("aria-expanded", "false");
    hamburger.setAttribute("aria-label", "メニューを開く");
    pushNav.setAttribute("aria-hidden", "true");

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
   * ナビ内のフォーカス可能要素の間でフォーカスをループさせる
   * @param {KeyboardEvent} e
   */
  function trapFocus(e) {
    if (e.key !== "Tab") return;
    if (!pushNav.classList.contains("is-open")) return;

    const focusableElements = Array.from(pushNav.querySelectorAll(FOCUSABLE_SELECTOR));
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

  // 押し出されたコンテンツ部分（カバー要素）をクリックで閉じる
  // wrapper 全体ではなく専用カバー要素にリスナーを張ることで、
  // wrapper 内のインタラクティブ要素との誤動作を回避する
  pushCover.addEventListener("click", function () {
    if (!pushNav.classList.contains("is-open")) return;
    closeMenu();
    hamburger.focus();
  });

  // キーボード操作（Escape / Tab）を1つのリスナーで統合管理
  document.addEventListener("keydown", function (e) {
    // Escape: メニューを閉じてフォーカスを戻す
    if (e.key === "Escape" && pushNav.classList.contains("is-open")) {
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
      // PCサイズ: メニューを閉じてスクロールロック解除
      if (pushNav.classList.contains("is-open")) {
        closeMenu();
      }
      // PCではプッシュナビの aria-hidden は不要なので除去
      pushNav.removeAttribute("aria-hidden");
    } else {
      // SPサイズに戻ったとき: プッシュナビは非表示状態なので aria-hidden を付与
      pushNav.setAttribute("aria-hidden", "true");
    }
  });
})();
