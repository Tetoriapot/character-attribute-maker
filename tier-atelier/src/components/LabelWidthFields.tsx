import type { TierStyle } from '../data/types';
import { d } from '../app/designMessages';
import { MIN_LABEL_WIDTH, MAX_LABEL_WIDTH } from '../features/design/labelWidth';
import { Field } from './Fields';

export type LabelSizing = Pick<Required<TierStyle>, 'labelWidth' | 'labelWidthMode'>;

export function LabelWidthFields({ value, onChange }: { value: LabelSizing; onChange: (value: LabelSizing) => void }) {
  return <>
    <Field label={d.labelWidthMode}>{(id) => <select id={id} value={value.labelWidthMode} onChange={(e) => onChange({ ...value, labelWidthMode: e.target.value as LabelSizing['labelWidthMode'] })}>
      <option value="auto">{d.autoLabelWidth}</option><option value="manual">{d.manualLabelWidth}</option>
    </select>}</Field>
    <Field label={d.labelWidth} hint={`${MIN_LABEL_WIDTH}〜${MAX_LABEL_WIDTH}`}>{(id) => <input id={id} type="number" min={MIN_LABEL_WIDTH} max={MAX_LABEL_WIDTH} step={1} required disabled={value.labelWidthMode === 'auto'} value={Number.isFinite(value.labelWidth) ? value.labelWidth : ''} onChange={(e) => onChange({ ...value, labelWidth: e.target.valueAsNumber })} />}</Field>
    <p className="field-hint">{d.labelWidthHint}</p>
  </>;
}
