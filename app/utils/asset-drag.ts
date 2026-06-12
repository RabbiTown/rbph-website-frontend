export interface RbAssetDragData {
  url: string;
  mimeType?: string;
  originalName?: string;
  assetId?: number;
  groupId?: number;
  objectKey?: string;
  kind?: 'file' | 'group';
  files?: {
    relativePath: string;
    mimeType?: string;
    size?: number;
  }[];
}

const assetDragMime = 'application/x-rbph-asset+json';

export function hasRbAssetDragData(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes(assetDragMime);
}

export function setRbAssetDragData(event: DragEvent, data: RbAssetDragData) {
  const transfer = event.dataTransfer;
  if (!transfer) return;

  transfer.effectAllowed = 'copy';
  transfer.setData(assetDragMime, JSON.stringify(data));
  transfer.setData('text/uri-list', data.url);
  transfer.setData('text/plain', data.url);
}

export function getRbAssetDragData(event: DragEvent): RbAssetDragData | undefined {
  const transfer = event.dataTransfer;
  if (!transfer) return undefined;

  const raw = transfer.getData(assetDragMime);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as RbAssetDragData;
      if (typeof parsed.url === 'string' && parsed.url.length) return parsed;
    } catch {
      /* ignored */
    }
  }

  const url = transfer.getData('text/uri-list') || transfer.getData('text/plain');
  if (!url) return undefined;

  return { url };
}
