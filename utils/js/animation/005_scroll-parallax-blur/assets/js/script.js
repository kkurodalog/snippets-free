// スクロールに応じてブラーフィルターを表示
const blurFilter = document.querySelector(".first-section__blur-filter");

window.addEventListener("scroll", () => {
  // スクロール量を取得
  const scrollY = window.scrollY;

  // ビューポート高さを取得
  const viewportHeight = window.innerHeight;

  // スクロール進行度を計算（0〜1の範囲）
  const scrollProgress = Math.min(scrollY / viewportHeight, 1);

  // ブラーの強度を計算（0px〜15px）
  const blurAmount = scrollProgress * 15;

  // スタイルを適用
  blurFilter.style.backdropFilter = `blur(${blurAmount}px)`;
});

// フェードイン（下から）
const intersectionObserver = new IntersectionObserver(
  function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("fade-in-up");
      } else {
        // entry.target.classList.remove("fade-in-up");
      }
    });
  },
  {
    rootMargin: "-45% 0px",
  }
);
const inViewItems = document.querySelectorAll(".js-in-view");
inViewItems.forEach(function (inViewItems) {
  intersectionObserver.observe(inViewItems);
});
