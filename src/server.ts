#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buildAttribution } from "./attribution.js";
import { downloadAsset, installAssetFiles } from "./download.js";
import {
  applyArgEnv,
  assertHostedConfigured,
  getHostedConfig,
  hostedGetAsset,
  hostedGetCatalogOptions,
  hostedListLicenses,
  hostedSearchAssetFiles,
  hostedSearchAssets,
} from "./hosted-client.js";
import { writeProjectMetadata } from "./metadata.js";
import type { AssetRecord, AssetType, HostedFileResult, LicenseId } from "./types.js";

applyArgEnv();
const hostedConfig = getHostedConfig();
assertHostedConfigured(hostedConfig);

const assetTypeSchema = z.enum(["sound", "music", "sprite", "tileset", "ui", "font", "texture", "model", "animation"]);
const licenseSchema = z.enum(["CC0-1.0", "CC-BY-4.0", "UNKNOWN"]);

const searchInputSchema = {
  type: assetTypeSchema.optional().describe("Preferred asset type."),
  query: z.string().optional().describe("Natural-language need, such as 'short menu click blip'."),
  tags: z.array(z.string()).optional().describe("Explicit tags to match."),
  licenses: z.array(licenseSchema).optional().describe("Allowed licenses. Defaults to CC0-1.0 only."),
  formats: z.array(z.string()).optional().describe("Allowed file extensions, such as .wav, .ogg, .png, .svg."),
  sources: z.array(z.string()).optional().describe("Allowed source names, such as Kenney."),
  commercialUseOnly: z.boolean().optional().describe("When true, filters to commercial-use licenses. Defaults to true."),
  limit: z.number().int().min(1).max(50).optional().describe("Maximum number of results."),
};

const downloadInputSchema = {
  assetId: z.string().describe("Catalog asset id returned from search_assets."),
  projectRoot: z.string().optional().describe("Absolute project root. Defaults to the MCP server process working directory."),
  targetDir: z.string().describe("Directory where files should be extracted. Relative paths resolve under projectRoot."),
  includeExtensions: z.array(z.string()).optional().describe("Only extract matching extensions, such as .wav or .png."),
  maxFiles: z.number().int().min(1).max(5000).optional().describe("Maximum files to extract."),
  preservePaths: z.boolean().optional().describe("Preserve paths from the source archive. Defaults to true."),
  overwrite: z.boolean().optional().describe("Overwrite existing files. Defaults to false."),
  extract: z.boolean().optional().describe("When false, downloads the archive but does not extract it."),
  includePreviews: z.boolean().optional().describe("Include preview media from source archives. Defaults to false."),
  allowOutsideProject: z.boolean().optional().describe("Allow absolute targetDir outside projectRoot. Defaults to false."),
  writeMetadata: z.boolean().optional().describe("Write asset-hub.lock.json and CREDITS.md after extraction. Defaults to true."),
};

const fileSearchInputSchema = {
  ...searchInputSchema,
  assetIds: z.array(z.string()).optional().describe("Restrict file search to specific asset pack ids."),
  maxAssets: z.number().int().min(1).max(25).optional().describe("Maximum asset packs to inspect when assetIds is omitted."),
  includePreviews: z.boolean().optional().describe("Include preview media from source archives. Defaults to false."),
};

const installFilesInputSchema = {
  assetId: z.string().describe("Catalog asset id returned from search_assets or search_asset_files."),
  entryPaths: z.array(z.string()).min(1).describe("Exact zip entry paths returned from search_asset_files."),
  projectRoot: downloadInputSchema.projectRoot,
  targetDir: downloadInputSchema.targetDir,
  preservePaths: downloadInputSchema.preservePaths,
  overwrite: downloadInputSchema.overwrite,
  allowOutsideProject: downloadInputSchema.allowOutsideProject,
  writeMetadata: downloadInputSchema.writeMetadata,
};

const server = new McpServer({
  name: "assethub-mcp",
  version: "0.1.1",
});

server.registerTool(
  "search_assets",
  {
    title: "Search Assets",
    description: "Search Asset Hub's hosted, license-aware game asset catalog.",
    inputSchema: searchInputSchema,
  },
  async (input) => {
    const payload = await hostedSearchAssets(toSearchFilters(input), hostedConfig);
    return jsonResponse({ source: "hosted", ...payload });
  },
);

server.registerTool(
  "search_asset_files",
  {
    title: "Search Asset Files",
    description: "Search inside hosted asset archives and rank individual files, especially short UI sounds.",
    inputSchema: fileSearchInputSchema,
  },
  async (input) => {
    const payload = await hostedSearchAssetFiles(
      {
        ...toSearchFilters(input),
        assetIds: input.assetIds,
        maxAssets: input.maxAssets,
        includePreviews: input.includePreviews,
      },
      hostedConfig,
    );
    return jsonResponse({ source: "hosted", ...payload });
  },
);

server.registerTool(
  "download_asset",
  {
    title: "Download Asset",
    description: "Download an authorized asset archive and optionally extract selected files into a project directory.",
    inputSchema: downloadInputSchema,
  },
  async (input) => {
    const asset = await hostedGetAsset(input.assetId, hostedConfig);
    const result = await downloadAsset(asset, input);
    const metadata = await maybeWriteMetadata(input.writeMetadata, input.projectRoot, {
      asset,
      installedFiles: result.extractedFiles,
      targetDir: result.targetDir,
    });
    return jsonResponse({
      asset: assetSummary(asset),
      ...result,
      metadata,
    });
  },
);

server.registerTool(
  "install_asset_files",
  {
    title: "Install Asset Files",
    description: "Install exact files returned by search_asset_files into a project directory and write project metadata.",
    inputSchema: installFilesInputSchema,
  },
  async (input) => {
    const asset = await hostedGetAsset(input.assetId, hostedConfig);
    const result = await installAssetFiles(asset, {
      entryPaths: input.entryPaths,
      projectRoot: input.projectRoot,
      targetDir: input.targetDir,
      preservePaths: input.preservePaths,
      overwrite: input.overwrite,
      allowOutsideProject: input.allowOutsideProject,
    });
    const metadata = await maybeWriteMetadata(input.writeMetadata, input.projectRoot, {
      asset,
      installedFiles: result.extractedFiles,
      targetDir: result.targetDir,
      sourceEntryPaths: input.entryPaths,
    });
    return jsonResponse({
      asset: assetSummary(asset),
      ...result,
      metadata,
    });
  },
);

server.registerTool(
  "install_best_asset",
  {
    title: "Install Best Asset",
    description: "Search for the best matching hosted asset files and install them in one call.",
    inputSchema: {
      ...searchInputSchema,
      projectRoot: downloadInputSchema.projectRoot,
      targetDir: downloadInputSchema.targetDir,
      includeExtensions: downloadInputSchema.includeExtensions,
      maxFiles: downloadInputSchema.maxFiles,
      preservePaths: downloadInputSchema.preservePaths,
      overwrite: downloadInputSchema.overwrite,
      extract: downloadInputSchema.extract,
      includePreviews: downloadInputSchema.includePreviews,
      allowOutsideProject: downloadInputSchema.allowOutsideProject,
      writeMetadata: downloadInputSchema.writeMetadata,
    },
  },
  async (input) => {
    const searchPayload = await hostedSearchAssetFiles(
      {
        ...toSearchFilters(input),
        includePreviews: input.includePreviews,
        limit: input.maxFiles ?? 10,
      },
      hostedConfig,
    );
    const fileResults = arrayValue(searchPayload.results) as HostedFileResult[];
    const assetId = fileResults.find((result) => result.asset?.id)?.asset?.id;
    if (!assetId) {
      return jsonResponse({ installed: false, reason: "No matching asset files found under the current filters." });
    }

    const asset = await hostedGetAsset(assetId, hostedConfig);
    const entryPaths = fileResults.map((result) => result.file?.entryPath).filter((entryPath): entryPath is string => Boolean(entryPath));
    const result =
      entryPaths.length > 0 && input.extract !== false
        ? await installAssetFiles(asset, {
            entryPaths,
            projectRoot: input.projectRoot,
            targetDir: input.targetDir,
            preservePaths: input.preservePaths,
            overwrite: input.overwrite,
            allowOutsideProject: input.allowOutsideProject,
          })
        : await downloadAsset(asset, input);
    const metadata = await maybeWriteMetadata(input.writeMetadata, input.projectRoot, {
      asset,
      installedFiles: result.extractedFiles,
      targetDir: result.targetDir,
      sourceEntryPaths: entryPaths,
    });

    return jsonResponse({
      installed: true,
      match: assetSummary(asset),
      selectedFiles: fileResults.map((fileResult) => ({
        entryPath: fileResult.file?.entryPath,
        score: fileResult.score,
        matched: fileResult.matched,
        audioProfile: fileResult.audioProfile,
      })),
      ...result,
      metadata,
    });
  },
);

server.registerTool(
  "get_attribution",
  {
    title: "Get Attribution",
    description: "Generate attribution text and structured metadata for selected hosted asset ids.",
    inputSchema: {
      assetIds: z.array(z.string()).min(1).describe("Asset ids returned by search_assets or install_best_asset."),
    },
  },
  async ({ assetIds }) => {
    const results = await Promise.allSettled(assetIds.map((assetId) => hostedGetAsset(assetId, hostedConfig)));
    const assets = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    const missing = assetIds.filter((assetId) => !assets.some((asset) => asset.id === assetId));
    return jsonResponse({
      ...buildAttribution(assets),
      missing,
    });
  },
);

server.registerTool(
  "browse_catalog_options",
  {
    title: "Browse Catalog Options",
    description: "List available catalog categories, sources, use cases, and query ideas for the current Asset Hub plan.",
    inputSchema: {},
  },
  async () => jsonResponse(await hostedGetCatalogOptions(hostedConfig)),
);

server.registerTool(
  "list_licenses",
  {
    title: "List License Policies",
    description: "Show license ids understood by the hosted catalog and automation safety policy.",
    inputSchema: {},
  },
  async () => jsonResponse(await hostedListLicenses(hostedConfig)),
);

const transport = new StdioServerTransport();
await server.connect(transport);

function toSearchFilters(input: {
  type?: AssetType;
  query?: string;
  tags?: string[];
  licenses?: LicenseId[];
  formats?: string[];
  sources?: string[];
  commercialUseOnly?: boolean;
  limit?: number;
}) {
  return {
    type: input.type,
    query: input.query,
    tags: input.tags,
    licenses: input.licenses,
    formats: input.formats,
    sources: input.sources,
    commercialUseOnly: input.commercialUseOnly,
    limit: input.limit,
  };
}

async function maybeWriteMetadata(
  writeMetadata: boolean | undefined,
  projectRoot: string | undefined,
  record: Parameters<typeof writeProjectMetadata>[1][number],
) {
  if (writeMetadata === false || record.installedFiles.length === 0) {
    return undefined;
  }
  return writeProjectMetadata(projectRoot ?? process.cwd(), [record]);
}

function assetSummary(asset: AssetRecord) {
  return {
    id: asset.id,
    title: asset.title,
    license: asset.license,
    source: asset.source.pageUrl,
    minimumPlan: asset.minimumPlan,
    qualityTier: asset.qualityTier,
  };
}

function jsonResponse(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
