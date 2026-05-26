# scroll-animation 軽量 coding-rules

scroll-animation シリーズ（001 fade-in / 002 stagger / 003 以降）共通の実装規範。
レビュー（Reid）で確立した規約を後続パターンへ引き継ぐための内部運用素材。

## CSS 詳細度

- **【重要】方向の子孫セレクタを使う場合、最終状態 `.is-visible` の詳細度を必ず方向ルールと同点以上に保つ。** 方向値を親・子両対応にするため `.js [dir] [data-fade-in]`（詳細度 0,3,0）へ拡張したら、最終状態も要素フックを残して `.js [data-fade-in].is-visible`（0,3,0）にし、ソース順で方向ルールより後方に置く。`.js .is-visible`（0,2,0）に下げると方向ルールが `transform`／`will-change` を上書きし、reveal 後も最終位置に戻らない・`will-change` が解除されない（002 c-1/m-1 の地雷。セレクタを子孫化する全パターンで再発する）。`!important` で逃げず詳細度設計で解決する。

## フック属性の設計

- **親フック / 子フックの分離を許可。** グループ監視は親 `data-{機能}`（例 `data-stagger`）、出現対象は子 `data-fade-in` を再利用する。
- **方向値の親・子両対応は2段セレクタ。** `.js [dir]` と `.js [dir] [data-fade-in]` を併記し、親・子どちらに付けても効くようにする（上の詳細度ルールとセットで運用）。

## JS / フォールバック

- **IO 非対応フォールバックは遅延を付けず一括表示**（stagger 文脈）。順次遅延の無理な再現はしない。
- **数値属性の検証は `Number.isFinite(x) && x >= 0`。** `Number()||0` より厳密。NaN・負値は既定へフォールバック、空文字は 0 として許容。

## 共通の前提（001 から踏襲）

- 初期隠蔽は `.js` スコープ限定（PE）。`no-js`→`js` は head 内インラインで先行書換（FOUC 防止）。
- `prefers-reduced-motion: reduce` で即時最終状態表示（opacity:1 / transform:none / transition:none / pointer-events:auto / will-change:auto）。
- 不可視中は `pointer-events: none`、reveal 後 `.is-visible` で `auto` に戻す。
- 状態は `.is-visible` を単一の真実の源とし、見た目切替は CSS に集約する。
