import { useEffect, useState } from 'react';
import type { Crop, Item } from '../data/types';
import { useEditor } from '../stores/editorStore';
import { useDraft } from '../features/editor/useDraft';
import { d } from '../app/designMessages';
import { Field } from './Fields';
import { AssetImage } from './AssetImage';

const full: Crop = { x: 0, y: 0, width: 1, height: 1 };
export function CropEditor({ item }: { item: Item }) {
  const [crop, setCrop] = useState(item.crop ?? full);
  const dispatch = useEditor((state) => state.dispatch);
  useEffect(() => setCrop(item.crop ?? full), [item.crop]);
  useDraft(JSON.stringify(crop) !== JSON.stringify(item.crop ?? full));
  if (!item.assetId) return null;
  return <form className="property-section" onSubmit={(event) => { event.preventDefault(); dispatch({ type: 'item.crop', id: item.id, crop }, d.applied); }}>
    <h3 className="section-label">{d.crop}</h3><p className="field-hint">{d.cropHint}</p>
    <div className="crop-preview" role="img" aria-label={d.cropPreview}><AssetImage assetId={item.assetId} crop={crop.width > 0 && crop.height > 0 ? crop : full} fit="contain" original /></div>
    <div className="design-pair">{(['x', 'y', 'width', 'height'] as const).map((key) => <Field key={key} label={{ x: d.cropX, y: d.cropY, width: d.cropWidth, height: d.cropHeight }[key]}>{(id) => <input id={id} type="number" min={key === 'x' || key === 'y' ? 0 : 1} max={100} step={1} required value={Number.isFinite(crop[key]) ? Number((crop[key] * 100).toFixed(2)) : ''} onChange={(event) => setCrop({ ...crop, [key]: event.target.valueAsNumber / 100 })} />}</Field>)}</div>
    <button type="submit" className="button primary full">{d.cropApply}</button>
    <button type="button" className="button secondary full" onClick={() => { if (dispatch({ type: 'item.crop', id: item.id, crop: null }, d.applied)) setCrop(full); }}>{d.cropReset}</button>
  </form>;
}
