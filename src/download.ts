import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { AssetRecord } from "./types.js";

export interface DownloadOptions {
  projectRoot?: string;
  targetDir: string;
  includeExtensions?: string[];
  maxFiles?: number;
  preservePaths?: boolean;
  overwrite?: boolean;
  extract?: boolean;
  includePreviews?: boolean;
  allowOutsideProject?: boolean;
}

export interface InstallFileOptions {
  projectRoot?: string;
  targetDir: string;
  entryPaths: string[];
  overwrite?: boolean;
  preservePaths?: boolean;
  allowOutsideProject?: boolean;
}

export interface DownloadResult {
  assetId: string;
  archivePath: string;
  targetDir: string;
  extractedFiles: string[];
  skippedFiles: number;
}

export async function downloadAsset(asset: AssetRecord, options: DownloadOptions): Promise<DownloadResult> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const targetDir = resolveTargetDir(projectRoot, options.targetDir, options.allowOutsideProject === true);
  const archivePath = await ensureArchive(asset);
  if (options.extract === false) {
    return { assetId: asset.id, archivePath, targetDir, extractedFiles: [], skippedFiles: 0 };
  }

  await mkdir(targetDir, { recursive: true });
  const zip = new AdmZip(archivePath);
  const extensions = new Set((options.includeExtensions ?? []).map(normalizeExtension).filter(Boolean));
  const maxFiles = clamp(options.maxFiles ?? 200, 1, 5000);
  const preservePaths = options.preservePaths !== false;
  const includePreviews = options.includePreviews === true;
  const extractedFiles: string[] = [];
  let skippedFiles = 0;

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) {
      continue;
    }
    const ext = path.extname(entry.entryName).toLowerCase();
    if (extensions.size > 0 && !extensions.has(ext)) {
      skippedFiles += 1;
      continue;
    }
    if (!includePreviews && isPreviewFile(entry.entryName)) {
      skippedFiles += 1;
      continue;
    }
    if (extractedFiles.length >= maxFiles) {
      skippedFiles += 1;
      continue;
    }

    const relativeName = preservePaths ? sanitizeZipPath(entry.entryName) : path.basename(entry.entryName);
    if (!relativeName) {
      skippedFiles += 1;
      continue;
    }
    const destination = path.resolve(targetDir, relativeName);
    ensureInside(targetDir, destination);
    if (!options.overwrite && (await exists(destination))) {
      skippedFiles += 1;
      continue;
    }
    await mkdir(path.dirname(destination), { recursive: true });
    zip.extractEntryTo(entry, path.dirname(destination), false, options.overwrite === true, false, path.basename(destination));
    extractedFiles.push(destination);
  }

  return { assetId: asset.id, archivePath, targetDir, extractedFiles, skippedFiles };
}

export async function installAssetFiles(asset: AssetRecord, options: InstallFileOptions): Promise<DownloadResult> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const targetDir = resolveTargetDir(projectRoot, options.targetDir, options.allowOutsideProject === true);
  const archivePath = await ensureArchive(asset);
  const zip = new AdmZip(archivePath);
  const requested = new Set(options.entryPaths.map(sanitizeZipPath).filter(Boolean));
  const preservePaths = options.preservePaths !== false;
  const extractedFiles: string[] = [];
  let skippedFiles = 0;

  await mkdir(targetDir, { recursive: true });
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) {
      continue;
    }
    const entryPath = sanitizeZipPath(entry.entryName);
    if (!requested.has(entryPath)) {
      skippedFiles += 1;
      continue;
    }
    const relativeName = preservePaths ? entryPath : path.basename(entryPath);
    const destination = path.resolve(targetDir, relativeName);
    ensureInside(targetDir, destination);
    if (!options.overwrite && (await exists(destination))) {
      skippedFiles += 1;
      continue;
    }
    await mkdir(path.dirname(destination), { recursive: true });
    zip.extractEntryTo(entry, path.dirname(destination), false, options.overwrite === true, false, path.basename(destination));
    extractedFiles.push(destination);
  }

  return { assetId: asset.id, archivePath, targetDir, extractedFiles, skippedFiles };
}

async function ensureArchive(asset: AssetRecord): Promise<string> {
  const cacheDir = path.resolve(process.env.ASSET_HUB_CACHE_DIR ?? path.join(homedir(), ".cache", "assethub-mcp"));
  await mkdir(cacheDir, { recursive: true });
  const hash = createHash("sha256").update(asset.source.downloadUrl).digest("hex").slice(0, 12);
  const archivePath = path.join(cacheDir, `${asset.id}-${hash}.zip`);
  if (await exists(archivePath)) {
    return archivePath;
  }
  const response = await fetch(asset.source.downloadUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed for ${asset.id}: ${response.status} ${response.statusText}`);
  }
  await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(archivePath));
  return archivePath;
}

function resolveTargetDir(projectRoot: string, targetDir: string, allowOutsideProject: boolean): string {
  const resolved = path.isAbsolute(targetDir) ? path.resolve(targetDir) : path.resolve(projectRoot, targetDir);
  if (!allowOutsideProject) {
    ensureInside(projectRoot, resolved);
  }
  return resolved;
}

function ensureInside(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside ${root}: ${candidate}`);
  }
}

function sanitizeZipPath(entryName: string): string {
  return entryName
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join(path.sep);
}

function isPreviewFile(entryName: string): boolean {
  const baseName = path.basename(entryName).toLowerCase();
  return baseName === "preview.mp3" || baseName === "preview.ogg" || baseName === "preview.wav" || baseName.startsWith("preview-");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeExtension(value: string): string {
  const trimmed = value.trim().toLowerCase();
  return trimmed ? (trimmed.startsWith(".") ? trimmed : `.${trimmed}`) : "";
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;
}
