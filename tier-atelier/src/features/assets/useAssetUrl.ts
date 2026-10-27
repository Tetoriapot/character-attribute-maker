import { useEffect, useState } from 'react';
import { useEditor } from '../../stores/editorStore';

export function useAssetUrl(assetId?: string | null) {
  const record = useEditor((state) => {
    const asset = assetId ? state.project.assets[assetId] : undefined;
    return asset ? state.records.get(asset.blobKey) : undefined;
  });
  const [source, setSource] = useState<{ blob: Blob; url: string }>();
  useEffect(() => {
    if (!record) return;
    const url = URL.createObjectURL(record.blob);
    setSource({ blob: record.blob, url });
    return () => URL.revokeObjectURL(url);
  }, [record]);
  return source?.blob === record?.blob ? source?.url : undefined;
}
