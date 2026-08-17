/** HTML 属性・テキストのエスケープ。 */
export function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 公開済みカテゴリだけを返す。未着手のカテゴリを画面に出さない（死にリンクを作らない）。 */
export function publishedCategories(site) {
  return site.categories.filter((c) => c.status === 'published');
}

/** リポジトリ直下のファイルへの GitHub URL。サイト内リンクではない。 */
export function repoFileUrl(site, path) {
  return `${site.repoUrl}/blob/${site.repoBranch}/${path}`;
}
