import { copyObject, deleteObject } from "./s3.js";
import { prisma } from "./prisma.js";

// 過去にdrafts/へアップロードされた画像のうち、現在テンプレートだけが参照していて
// 下書き側では一切使われていないものを、templates/へ移動する(URLはDB側も書き換える)。
// 下書きとテンプレートで同じ画像を共有している場合は、下書き側が壊れないよう移動しない。
export async function migrateTemplateOnlyImagesToTemplatesFolder() {
  const publicBase = process.env.S3_PUBLIC_BASE_URL;
  if (!publicBase) throw new Error("S3_PUBLIC_BASE_URL is not configured");
  const base = publicBase.replace(/\/$/, "");

  const [templates, drafts] = await Promise.all([
    prisma.template.findMany({ select: { id: true, mediaUrls: true } }),
    prisma.draft.findMany({ select: { mediaUrls: true } }),
  ]);

  const draftUrls = new Set(drafts.flatMap((d) => d.mediaUrls));

  // 移動候補のURL → それを参照しているテンプレートID一覧
  const candidateUrls = new Map<string, string[]>();
  for (const t of templates) {
    for (const url of t.mediaUrls) {
      if (!url.startsWith(`${base}/drafts/`)) continue; // 既にtemplates/等は対象外
      if (draftUrls.has(url)) continue; // 下書き側でも使われている画像は移動しない
      const list = candidateUrls.get(url) ?? [];
      list.push(t.id);
      candidateUrls.set(url, list);
    }
  }

  const moved: { from: string; to: string; templateIds: string[] }[] = [];
  const skipped: { url: string; reason: string }[] = [];

  for (const [oldUrl, templateIds] of candidateUrls) {
    const oldKey = oldUrl.slice(base.length + 1); // "drafts/xxx.ext"
    const newKey = oldKey.replace(/^drafts\//, "templates/");
    const newUrl = `${base}/${newKey}`;

    try {
      await copyObject(oldKey, newKey);

      // DB側のURLを新しいものに置き換える(該当テンプレートすべて)
      await prisma.$transaction(
        templateIds.map((id) => {
          const t = templates.find((tt) => tt.id === id)!;
          const updatedMediaUrls = t.mediaUrls.map((u) => (u === oldUrl ? newUrl : u));
          return prisma.template.update({ where: { id }, data: { mediaUrls: updatedMediaUrls } });
        }),
      );

      // DB更新が成功した後にのみ、元のオブジェクトを削除する
      await deleteObject(oldKey);
      moved.push({ from: oldUrl, to: newUrl, templateIds });
    } catch (e) {
      skipped.push({ url: oldUrl, reason: (e as Error).message });
    }
  }

  return { movedCount: moved.length, moved, skippedCount: skipped.length, skipped };
}
