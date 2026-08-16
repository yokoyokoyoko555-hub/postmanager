// テンプレート本文中の{日付}を、実際に投稿する瞬間の日本時間の日付に置き換える。
// {商品名}{URL}は商品ごとに変わり自動では決められないため対象外(手入力の目印として残す)。
function jstDateLabel(offsetDays = 0): string {
  const shifted = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000);
  const weekday = ["日", "月", "火", "水", "木", "金", "土"][shifted.getUTCDay()];
  return `${shifted.getUTCMonth() + 1}/${shifted.getUTCDate()}(${weekday})`;
}

export function substitutePlaceholders(text: string): string {
  return text.replaceAll("{日付}", jstDateLabel(0));
}
