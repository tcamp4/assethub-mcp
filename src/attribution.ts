import type { AssetRecord } from "./types.js";

export function buildAttribution(assets: AssetRecord[]): {
  text: string;
  assets: Array<{
    id: string;
    title: string;
    author: string;
    source: string;
    license: string;
    attributionRequired: boolean;
  }>;
} {
  const records = assets.map((asset) => ({
    id: asset.id,
    title: asset.title,
    author: asset.source.author,
    source: asset.source.pageUrl,
    license: asset.license.id,
    attributionRequired: asset.license.attributionRequired,
  }));

  return {
    text: records.map((asset) => `${asset.title} by ${asset.author} (${asset.license}) - ${asset.source}`).join("\n"),
    assets: records,
  };
}
