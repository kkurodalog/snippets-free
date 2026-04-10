/**
 * 006_hamburger-expand-corner
 * 右下から2段階展開型ハンバーガーメニュー
 *
 * 機能:
 * - 右下のFABボタンクリックで2段階アニメーション展開
 *   第1段階: ボタン位置から円形に広がるダーク背景
 *   第2段階: ナビゲーションリンクがスタッガードアニメーションでフェードイン
 * - 閉じるときは逆順で収納（リンクフェードアウト → 背景縮小）
 * - ボタンに is-active、背景に is-expanding、ナビに is-open クラスを付与/除去
 * - aria-expanded / aria-hidden 属性を連動更新（アクセシビリティ対応）
 * - Escape キーで閉じる（フォーカスをFABボタンに戻す）
 * - スクロールロック（メニュー開放中は body のスクロールを止める）
 * - フォーカストラップ（FABボタン + 展開ナビ内にフォーカスを閉じ込める）
 * - matchMedia でリサイズ時に状態をリセット（PCナビ非表示設定の場合）
 */

(function () {
  "use strict";

  // 要素取得
  const fab = document.querySelector(".c-fab");
  const expandBg = document.querySelector(".c-expand-bg");
  const expandNav = document.querySelector(".c-expand-nav");

  // 要素が存在しない場合は処理しない
  if (!fab || !expandBg || !expandNav) return;

  // フォーカス可能な要素のセレクター
  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  // 2段階展開のタイミング定数
  // CSS カスタムプロパティ --expand-transition-bg（0.5s）に合わせる
  // CSS 側の値を変更した場合はここも合わせて変更する
  const PHASE1_DURATION = 400; // 第1段階（背景展開）の待機時間
  const PHASE2_FOCUS_DELAY = 500; // 第2段階完了後のフォーカス移動タイミング

  // 閉じるときのタイミング定数
  // CSS カスタムプロパティ --expand-transition-nav（0.4s）に合わせる
  const CLOSE_NAV_DURATION = 300; // ナビフェードアウト待機時間

  // 閉じるときの背景縮小アニメーション待機時間
  // CSS カスタムプロパティ --expand-transition-bg: 0.5s に対応
  const CLOSE_BG_DURATION = 500;

  // 展開状態管理
  let isAnimating = false;

  /**
   * メニューを開く（2段階展開）
   */
  function openMenu() {
    if (isAnimating) return;
    isAnimating = true;

    // FABボタンの×変形
    fab.classList.add("is-active");

    // aria 属性更新
    fab.setAttribute("aria-expanded", "true");
    fab.setAttribute("aria-label", "メニューを閉じる");

    // スクロールロック
    document.body.style.overflow = "hidden";

    // === 第1段階: 円形背景アニメーション ===
    expandBg.classList.remove("is-closing");
    expandBg.classList.add("is-expanding");

    // === 第2段階: ナビリンクのフェードイン（第1段階の途中から開始） ===
    setTimeout(function () {
      expandNav.classList.add("is-open");
      expandNav.setAttribute("aria-hidden", "false");

      // ナビ内の最初のフォーカス可能要素にフォーカス移動
      const firstFocusable = expandNav.querySelectorAll(FOCUSABLE_SELECTOR)[0];
      if (firstFocusable) {
        setTimeout(function () {
          firstFocusable.focus();
        }, PHASE2_FOCUS_DELAY);
      }

      isAnimating = false;
    }, PHASE1_DURATION);
  }

  /**
   * メニューを閉じる（逆順で収納）
   */
  function closeMenu() {
    if (isAnimating) return;
    isAnimating = true;

    // === 逆順 第1段階: ナビリンクのフェードアウト ===
    expandNav.classList.remove("is-open");
    expandNav.setAttribute("aria-hidden", "true");

    // === 逆順 第2段階: 円形背景の縮小（ナビ消失後に開始） ===
    setTimeout(function () {
      expandBg.classList.remove("is-expanding");
      expandBg.classList.add("is-closing");

      // FABボタンの3本線復帰
      fab.classList.remove("is-active");

      // aria 属性更新
      fab.setAttribute("aria-expanded", "false");
      fab.setAttribute("aria-label", "メニューを開く");

      // スクロールロック解除
      document.body.style.overflow = "";

      // 閉じアニメーション完了後にクラスをクリーンアップ
      setTimeout(function () {
        expandBg.classList.remove("is-closing");
        expandNav.style.visibility = "";
        isAnimating = false;
      }, CLOSE_BG_DURATION);
    }, CLOSE_NAV_DURATION);
  }

  /**
   * メニューのトグル
   */
  function toggleMenu() {
    const isOpen = fab.classList.contains("is-active");
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  /**
   * フォーカストラップ
   * FABボタン + 展開ナビ内のフォーカス可能要素の間でフォーカスをループさせる
   * @param {KeyboardEvent} e
   */
  function trapFocus(e) {
    if (e.key !== "Tab") return;
    if (!expandNav.classList.contains("is-open")) return;

    // FABボタン + 展開ナビ内のフォーカス可能要素を結合
    const navFocusable = Array.from(expandNav.querySelectorAll(FOCUSABLE_SELECTOR));
    const focusableElements = [fab].concat(navFocusable);
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

  // FABボタンのクリックイベント
  fab.addEventListener("click", toggleMenu);

  // キーボード操作（Escape / Tab）を1つのリスナーで統合管理
  document.addEventListener("keydown", function (e) {
    // Escape: メニューを閉じてフォーカスを戻す
    if (e.key === "Escape" && expandNav.classList.contains("is-open")) {
      closeMenu();
      // 閉じアニメーション完了後にFABボタンにフォーカスを戻す
      setTimeout(function () {
        fab.focus();
      }, CLOSE_NAV_DURATION + CLOSE_BG_DURATION);
      return;
    }
    // Tab: フォーカストラップ
    if (e.key === "Tab") {
      trapFocus(e);
    }
  });

  // 画面幅が768px以上になったらメニューを閉じる（縦横回転・リサイズ対応）
  // ※ このスニペットはポートフォリオ向けのためPC/SP両方で動作する設計だが、
  //    PCでFABを非表示にするカスタマイズ時のためにリサイズ対応を残す
  const mediaQuery = window.matchMedia("(min-width: 768px)");
  mediaQuery.addEventListener("change", function (e) {
    if (e.matches) {
      // PCサイズ: メニューが開いていたら閉じる
      if (expandNav.classList.contains("is-open")) {
        // アニメーションをスキップして即座に閉じる
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
      // SPサイズに戻ったとき: ナビは非表示状態なので aria-hidden を付与
      expandNav.setAttribute("aria-hidden", "true");
    }
  });
})();
