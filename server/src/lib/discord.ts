// Discordへの通知はDISCORD_WEBHOOK_URLが設定されている場合のみ行う(未設定なら何もしない)。
// 失敗してもレポート生成自体は成功させたいので、呼び出し側でtry/catchすること。
export async function sendDailyReportToDiscord(params: {
  accountName: string;
  accountHandle: string;
  reportDate: Date;
  reviewText: string;
  improvementsText: string;
  nextActionsText: string;
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const dateLabel = params.reportDate.toISOString().slice(0, 10);
  const body = {
    embeds: [
      {
        title: `📊 デイリーレポート — ${params.accountName}`,
        description: `${params.accountHandle} / ${dateLabel}`,
        color: 0xcba24e,
        fields: [
          { name: "直近の振り返り", value: params.reviewText.slice(0, 1024) || "-" },
          { name: "改善点", value: params.improvementsText.slice(0, 1024) || "-" },
          { name: "ネクストアクション", value: params.nextActionsText.slice(0, 1024) || "-" },
        ],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`);
  }
}
