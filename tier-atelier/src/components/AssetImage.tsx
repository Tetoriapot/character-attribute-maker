import { useEffect, useRef } from 'react';
import type { Crop } from '../data/types';
import { useEditor } from '../stores/editorStore';
import { d } from '../app/designMessages';

function CroppedImage({ assetId, crop, fit }: { assetId: string; crop: Crop; fit: 'cover' | 'contain' }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const record = useEditor((state) => {
    const asset = state.project.assets[assetId];
    return asset ? state.records.get(asset.blobKey) : undefined;
  });
  useEffect(() => {
    let canceled = false;
    const context = canvas.current?.getContext('2d');
    if (!record || !context) return;
    // Decode the first frame with EXIF orientation, retaining the original Blob for future output.
    void createImageBitmap(record.blob).then((bitmap) => {
      try {
        if (canceled) return;
        context.clearRect(0, 0, 512, 512);
        const width = bitmap.width * crop.width, height = bitmap.height * crop.height;
        if (!(width > 0 && height > 0)) return;
        const scale = fit === 'cover' ? Math.max(512 / width, 512 / height) : Math.min(512 / width, 512 / height);
        const renderedWidth = width * scale, renderedHeight = height * scale;
        context.drawImage(bitmap, crop.x * bitmap.width, crop.y * bitmap.height, width, height, (512 - renderedWidth) / 2, (512 - renderedHeight) / 2, renderedWidth, renderedHeight);
      } finally { bitmap.close(); }
    }).catch(() => { if (!canceled) useEditor.setState({ error: d.previewError }); });
    return () => { canceled = true; };
  }, [record, crop.x, crop.y, crop.width, crop.height, fit]);
  return <canvas ref={canvas} className="item-thumbnail" width={512} height={512} data-crop={JSON.stringify(crop)} aria-hidden="true" />;
}

export function AssetImage({ assetId, crop, fit, original = false }: { assetId: string; crop?: Crop | null; fit: 'cover' | 'contain'; original?: boolean }) {
  const asset = useEditor((state) => state.project.assets[assetId]);
  const thumbnail = useEditor((state) => state.thumbnails[assetId]);
  if (!asset) return null;
  if (crop || original) return <CroppedImage assetId={assetId} crop={crop ?? { x: 0, y: 0, width: 1, height: 1 }} fit={fit} />;
  return <img className="item-thumbnail" src={thumbnail} alt="" loading="lazy" draggable={false} style={{ objectFit: fit }} />;
}
