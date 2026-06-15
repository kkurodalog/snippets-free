# scroll-animation 軽量 coding-rules

scroll-animation シリーズ（001 fade-in / 002 stagger / 003 以降）共通の実装規範。
レビュー（Reid）で確立した規約を後続パターンへ引き継ぐための内部運用素材。

## CSS 詳細度

- **【重要】方向の子孫セレクタを使う場合、最終状態 `.is-visible` の詳細度を必ず方向ルールと同点以上に保つ。** 方向値を親・子両対応にするため `.js [dir] [data-fade-in]`（詳細度 0,3,0）へ拡張したら、最終状態も要素フックを残して `.js [data-fade-in].is-visible`（0,3,0）にし、ソース順で方向ルールより後方に置く。`.js .is-visible`（0,2,0）に下げると方向ルールが `transform`／`will-change` を上書きし、reveal 後も最終位置に戻らない・`will-change` が解除されない（002 c-1/m-1 の地雷。セレクタを子孫化する全パターンで再発する）。`!important` で逃げず詳細度設計で解決する。
- **【重要】要素自身に方向を付けるセレクタは出現対象でガードする（`.js [data-fade-in][dir]`）。** 素の `.js [dir]` のままだと、方向を「親コンテナ」に付けたとき親自身にもマッチして transform が当たる。親は `.is-visible` が付かない（JS は子の `data-fade-in` にしか付与しない）ため translate が戻らず、コンテナごと約 24px 固定でずれる。`[data-fade-in]` を AND して「自身が出現対象のときだけ」効かせれば親はマッチせず、子は自身指定・親指定（子孫セレクタ側）の両方で従来どおり効く（002 c-2 の地雷。none の transition 余計付与も同根）。

## フック属性の設計

- **親フック / 子フックの分離を許可。** グループ監視は親 `data-{機能}`（例 `data-stagger`）、出現対象は子 `data-fade-in` を再利用する。
- **方向値の親・子両対応は2段セレクタ。** `.js [data-fade-in][dir]`（自身が出現対象のとき）と `.js [dir] [data-fade-in]`（親に付けたとき子へ）を併記し、親・子どちらに付けても効くようにする（上の詳細度ルール・c-2 ガードとセットで運用）。

## JS / フォールバック

- **IO 非対応フォールバックは遅延を付けず一括表示**（stagger 文脈）。順次遅延の無理な再現はしない。
- **数値属性の検証は `Number.isFinite(x) && x >= 0`。** `Number()||0` より厳密。NaN・負値は既定へフォールバック、空文字は 0 として許容。

## scroll-driven CSS（animation-timeline）系（003 から）

- **【重要】scroll-driven CSS（animation-timeline）と JS フォールバックの二重駆動防止は、`@supports`／`@supports not` の対称分岐＋JS側 `CSS.supports('animation-timeline','scroll()')` 判定（真なら早期 return）で行う。** CSS で動く環境では JS はリスナーを張らないことで、CSS と JS が同時にバーを動かす二重駆動を構造的に排除する。判定キー（`animation-timeline: scroll()`）を CSS の `@supports` と JS の `CSS.supports` で完全一致させること（003 で確立）。
- **情報提示UI（progress-bar 等）の reduced-motion は「即時最終状態」を踏襲しない。** 出現演出（001/002）は reduce 時に最終状態固定でよいが、読了率バーを満タン固定/非表示にすると誤情報になる。スクロール操作に直結する追従は維持し、補間 transition だけを切る（003 で確立）。

## 共通の前提（001 から踏襲）

- 初期隠蔽は `.js` スコープ限定（PE）。`no-js`→`js` は head 内インラインで先行書換（FOUC 防止）。
- `prefers-reduced-motion: reduce` で即時最終状態表示（opacity:1 / transform:none / transition:none / pointer-events:auto / will-change:auto）。**ただし情報提示UI（progress-bar 等）は上記「scroll-driven CSS 系」の例外規定に従う。**
- 不可視中は `pointer-events: none`、reveal 後 `.is-visible` で `auto` に戻す。
- 状態は `.is-visible` を単一の真実の源とし、見た目切替は CSS に集約する。

## 実挙動検証（視覚効果系は Reid 後に Playwright 実測を必須とする）

- **【重要】スクロール連動・アニメーション等の視覚効果系 snippet は、Reid の静的規範照合だけでは実挙動の不具合を捉えきれない。Reid レビュー後に Playwright/Chromium で実挙動を実測検証することを必須工程とする。** 静的にコードが規範どおりでも、ブラウザの実挙動（スクロールコンテナの解決・タイムラインの fill 挙動・合成/再描画）でしか露見しない不具合が出る。
- **実例（いずれも静的レビューを通過したが実測で初めて発覚）**:
  - 004 parallax: `.c-parallax` の `overflow: hidden` が view() の最近接スクロールポートを自身にしてしまい進捗固定化 → `overflow: clip` で解決。
  - 006 blur: `animation-timeline` 駆動で `animation-fill-mode` 未指定（ショートハンドで none）のため、`animation-range`（先頭ビューポート）超過後に `backdrop-filter` が基底値 blur(0) へ復帰 → `animation-fill-mode: forwards` で最終状態保持。
- **検証観点（最低限）**: (1) アニメ/エフェクトがスクロール等に連動して意図どおり駆動・保持されるか（範囲端・超過後の挙動含む）、(2) `prefers-reduced-motion: reduce` で意図どおり無効化/最終状態になるか、(3) PE（JS 無効・機能非対応）で情報欠落・レイアウト破壊がないか。
- **手順**: `playwright-core`（chromium headless）を一時ディレクトリに用意し、`getComputedStyle` 等で実値を計測。**ローカル file と公開 URL（GitHub Pages 反映後）の両方**で確認する。検証用一時ディレクトリは確認後に削除する。
