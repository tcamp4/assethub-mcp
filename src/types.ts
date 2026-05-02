export type AssetType = "sound" | "music" | "sprite" | "tileset" | "ui" | "font" | "texture" | "model" | "animation";
export type LicenseId = "CC0-1.0" | "CC-BY-4.0" | "UNKNOWN";

export interface AssetRecord {
  id: string;
  title: string;
  type: AssetType;
  secondaryTypes?: AssetType[];
  description?: string;
  tags?: string[];
  source: {
    name: string;
    author: string;
    pageUrl: string;
    downloadUrl: string;
  };
  license: {
    id: LicenseId;
    name: string;
    url: string;
    commercialUse: boolean;
    attributionRequired: boolean;
    redistributionAllowed: boolean;
    notes?: string;
  };
  fileCount?: number;
  formats?: string[];
  bestFor?: string[];
  minimumPlan?: "free" | "indie" | "pro";
  qualityTier?: "starter" | "production" | "studio";
}

export interface SearchFilters {
  type?: AssetType;
  query?: string;
  gameContext?: string;
  gameGenre?: string;
  mood?: string;
  visualStyle?: string;
  intendedUse?: string;
  prefer?: string[];
  avoid?: string[];
  tags?: string[];
  licenses?: LicenseId[];
  formats?: string[];
  sources?: string[];
  commercialUseOnly?: boolean;
  limit?: number;
}

export interface FileSearchFilters extends SearchFilters {
  assetIds?: string[];
  maxAssets?: number;
  includePreviews?: boolean;
}

export interface GameRecommendationInput extends SearchFilters {
  gameDescription?: string;
  requestedKit?: string;
  maxCategories?: number;
  maxResultsPerCategory?: number;
  includeFiles?: boolean;
}

export interface HostedFileResult {
  asset?: {
    id?: string;
    title?: string;
    type?: AssetType;
    source?: unknown;
    license?: unknown;
    minimumPlan?: string;
    qualityTier?: string;
  };
  file?: {
    assetId?: string;
    entryPath?: string;
    fileName?: string;
    extension?: string;
    size?: number;
    isPreview?: boolean;
  };
  score?: number;
  matched?: string[];
  audioProfile?: unknown;
}
