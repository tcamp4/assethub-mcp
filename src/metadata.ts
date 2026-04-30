import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetRecord } from "./types.js";

export interface ProjectAssetInstall {
  asset: AssetRecord;
  installedFiles: string[];
  targetDir: string;
  sourceEntryPaths?: string[];
}

export async function writeProjectMetadata(projectRoot: string, installs: ProjectAssetInstall[]): Promise<{ lockPath: string; creditsPath: string }> {
  const lockPath = path.join(projectRoot, "asset-hub.lock.json");
  const creditsPath = path.join(projectRoot, "CREDITS.md");
  const existing = await readExistingLock(lockPath);
  const byId = new Map<string, unknown>(existing.assets.map((asset) => [String((asset as { id?: string }).id), asset]));

  for (const install of installs) {
    byId.set(install.asset.id, {
      id: install.asset.id,
      title: install.asset.title,
      source: install.asset.source,
      license: install.asset.license,
      installedFiles: install.installedFiles.map((filePath) => path.relative(projectRoot, filePath)),
      targetDir: path.relative(projectRoot, install.targetDir),
      sourceEntryPaths: install.sourceEntryPaths ?? [],
      installedAt: new Date().toISOString(),
    });
  }

  const lock = {
    schemaVersion: 1,
    generatedBy: "assethub-mcp",
    assets: [...byId.values()],
  };
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
  await writeFile(creditsPath, renderCredits(lock.assets as Array<{ title?: string; source?: AssetRecord["source"]; license?: AssetRecord["license"] }>));
  return { lockPath, creditsPath };
}

async function readExistingLock(lockPath: string): Promise<{ assets: unknown[] }> {
  try {
    const parsed = JSON.parse(await readFile(lockPath, "utf8")) as { assets?: unknown[] };
    return { assets: Array.isArray(parsed.assets) ? parsed.assets : [] };
  } catch {
    return { assets: [] };
  }
}

function renderCredits(assets: Array<{ title?: string; source?: AssetRecord["source"]; license?: AssetRecord["license"] }>): string {
  const lines = ["# Credits", ""];
  for (const asset of assets) {
    lines.push(`- ${asset.title ?? "Unknown asset"} by ${asset.source?.author ?? asset.source?.name ?? "Unknown"} (${asset.license?.id ?? "UNKNOWN"})`);
    if (asset.source?.pageUrl) {
      lines.push(`  Source: ${asset.source.pageUrl}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}
