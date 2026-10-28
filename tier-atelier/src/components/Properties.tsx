import { useEffect, useState, type FormEvent } from 'react';
import type { Item, Project, Tier } from '../data/types';
import { useEditor } from '../stores/editorStore';
import { itemIdsAt, itemLocation } from '../features/editor/commands';
import { t } from '../app/messages';
import { Icon } from './Icon';
import { Field } from './Fields';
import { Dialog } from './Dialog';
import { useDraft } from '../features/editor/useDraft';
import { storageText as s } from '../app/storageMessages';
import { d } from '../app/designMessages';
import { DesignPanel } from './DesignPanel';
import { CropEditor } from './CropEditor';
import { LabelWidthFields, type LabelSizing } from './LabelWidthFields';
import { resolveStyle } from '../features/design/settings';
import { MIN_LABEL_WIDTH, MAX_LABEL_WIDTH } from '../features/design/labelWidth';

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={label}>{(id) => <div className="color-value">
    <input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(event) => onChange(event.target.value)} />
    <input className="hex-code" aria-label={t.colorCode(label)} value={value} maxLength={7} pattern="#[0-9a-fA-F]{6}" required onChange={(event) => onChange(event.target.value)} />
  </div>}</Field>;
}

export function Feedback() {
  const error = useEditor((state) => state.error);
  const announcement = useEditor((state) => state.announcement);
  return <>{error && <p className="form-error" role="alert">{error}</p>}<p className="form-feedback" role="status">{!error && announcement}</p></>;
}

function ConfirmDelete({ kind, id, name, onClose }: { kind: 'tier' | 'item'; id: string; name: string; onClose: () => void }) {
  const dispatch = useEditor((state) => state.dispatch);
  return <Dialog title={kind === 'tier' ? t.deleteTierTitle : t.deleteItemTitle} onClose={onClose}>
    <p className="delete-name">{name}</p>
    <p>{kind === 'tier' ? t.deleteTierMessage : t.deleteItemMessage}</p>
    {kind === 'tier' && <p className="muted">{t.deleteTierUndo}</p>}
    <div className="dialog-actions"><button className="button secondary" onClick={onClose}>{t.cancel}</button>
      <button className="button danger" onClick={() => { if (dispatch({ type: kind === 'tier' ? 'tier.delete' : 'item.delete', id }, t.deleted)) onClose(); }}>{t.confirmDelete}</button></div>
    <Feedback />
  </Dialog>;
}

function TierProperties({ tier, project }: { tier: Tier; project: Project }) {
  const dispatch = useEditor((state) => state.dispatch);
  const [name, setName] = useState(tier.name);
  const [background, setBackground] = useState(tier.background);
  const [foreground, setForeground] = useState(tier.foreground);
  const [minHeight, setMinHeight] = useState(tier.minHeight ?? 104);
  const [labelWidth, setLabelWidth] = useState(tier.labelWidth?.toString() ?? '');
  const [labelSizing, setLabelSizing] = useState<LabelSizing>(() => resolveStyle(project.style));
  const [deleting, setDeleting] = useState(false);
  const index = project.tiers.findIndex((entry) => entry.id === tier.id);
  const sizingChanged = labelSizing.labelWidth !== project.style.labelWidth || labelSizing.labelWidthMode !== (project.style.labelWidthMode ?? 'manual');
  useDraft(name !== tier.name || background !== tier.background || foreground !== tier.foreground || minHeight !== (tier.minHeight ?? 104) || labelWidth !== (tier.labelWidth?.toString() ?? '') || sizingChanged);
  useEffect(() => setLabelSizing(resolveStyle(project.style)), [project.style]);
  useEffect(() => {
    setName(tier.name);
    setBackground(tier.background);
    setForeground(tier.foreground);
    setMinHeight(tier.minHeight ?? 104); setLabelWidth(tier.labelWidth?.toString() ?? '');
  }, [tier.name, tier.background, tier.foreground, tier.minHeight, tier.labelWidth]);
  function submit(event: FormEvent) {
    event.preventDefault();
    dispatch({ type: 'tier.update', id: tier.id, name, background, foreground, minHeight, labelWidth: labelWidth ? Number(labelWidth) : null, ...(sizingChanged ? { labelSizing } : {}) });
  }
  return <>
    <div className="property-kind"><span>{t.tierSettings}</span><span className="count">{t.itemCount(tier.itemIds.length)}</span></div>
    <form onSubmit={submit}>
      <fieldset disabled={tier.locked}>
        <Field label={t.tierName}>{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />}</Field>
        <h3 className="section-label">{t.palette}</h3>
        <div className="color-fields">
          <ColorField label={t.background} value={background} onChange={setBackground} />
          <ColorField label={t.foreground} value={foreground} onChange={setForeground} />
        </div>
        <div className="label-preview" aria-label={t.preview} style={{ backgroundColor: background, color: foreground }}><span>{name || t.label}</span></div>
        <Field label={d.minHeight} hint="64〜400">{(id) => <input id={id} type="number" required min={64} max={400} value={Number.isFinite(minHeight) ? minHeight : ''} onChange={(e) => setMinHeight(e.target.valueAsNumber)} />}</Field>
        <LabelWidthFields value={labelSizing} onChange={setLabelSizing} />
        <Field label={d.tierWidth} hint={labelSizing.labelWidthMode === 'auto' ? d.autoIndividualWidthHint : d.inherit}>{(id) => <input id={id} type="number" min={MIN_LABEL_WIDTH} max={MAX_LABEL_WIDTH} disabled={labelSizing.labelWidthMode === 'auto'} value={labelWidth} onChange={(e) => setLabelWidth(e.target.value)} />}</Field>
        <p className="field-hint">{d.responsive}</p>
        <button className="button primary full" type="submit"><Icon name="check" />{t.apply}</button>
      </fieldset>
    </form>
    <div className="property-section"><h3 className="section-label">{t.order}</h3><div className="button-pair">
      <button className="button secondary" disabled={tier.locked || index === 0} onClick={() => dispatch({ type: 'tier.move', id: tier.id, index: index - 1 }, t.moved)}><Icon name="up" />{t.up}</button>
      <button className="button secondary" disabled={tier.locked || index === project.tiers.length - 1} onClick={() => dispatch({ type: 'tier.move', id: tier.id, index: index + 1 }, t.moved)}><Icon name="down" />{t.down}</button>
    </div></div>
    <div className="property-section"><label className="toggle-label"><input type="checkbox" checked={!!tier.locked} onChange={(e) => dispatch({ type: 'tier.lock', id: tier.id, locked: e.target.checked })} />{t.lock}<Icon name="lock" /></label><p className="field-hint">{t.lockHint}</p></div>
    <div className="property-section action-list">
      <button className="button text-button" onClick={() => dispatch({ type: 'tier.add', afterId: tier.id }, t.added)}><Icon name="plus" />{t.addAfter}</button>
      <button className="button text-button" onClick={() => dispatch({ type: 'tier.duplicate', id: tier.id }, t.duplicateDone)}><Icon name="copy" />{t.duplicateTier}</button>
      <button className="button text-button destructive" disabled={tier.locked} onClick={() => setDeleting(true)}><Icon name="trash" />{t.deleteTier}</button>
    </div>
    {deleting && <ConfirmDelete kind="tier" id={tier.id} name={tier.name} onClose={() => setDeleting(false)} />}
  </>;
}

export function ItemForm({ item, onDone }: { item?: Item; onDone?: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [tags, setTags] = useState(item?.tags.join(', ') ?? '');
  const dispatch = useEditor((state) => state.dispatch);
  useEffect(() => {
    setName(item?.name ?? '');
    setDescription(item?.description ?? '');
    setTags(item?.tags.join(', ') ?? '');
  }, [item?.name, item?.description, item?.tags]);
  useDraft(name !== (item?.name ?? '') || description !== (item?.description ?? '') || tags !== (item?.tags.join(', ') ?? ''));
  function submit(event: FormEvent) {
    event.preventDefault();
    const values = { name, description, tags: tags.split(/[,、]/).map((tag) => tag.trim()).filter(Boolean) };
    const success = dispatch(item ? { type: 'item.update', id: item.id, ...values } : { type: 'item.add', ...values }, item ? t.applied : t.added);
    if (success) onDone?.();
  }
  return <form onSubmit={submit}>
    <Field label={t.itemName}>{(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder={t.namePlaceholder} />}</Field>
    <Field label={t.description}>{(id) => <textarea id={id} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder={t.descriptionPlaceholder} />}</Field>
    <Field label={t.tags} hint={t.tagsHint}>{(id) => <input id={id} value={tags} onChange={(e) => setTags(e.target.value)} maxLength={640} />}</Field>
    <button className="button primary full" type="submit"><Icon name={item ? 'check' : 'plus'} />{item ? t.apply : t.add}</button>
  </form>;
}

function ItemProperties({ item, project }: { item: Item; project: Project }) {
  const tierId = itemLocation(project, item.id);
  const [destination, setDestination] = useState(tierId ?? 'unranked');
  useEffect(() => { setDestination(tierId ?? 'unranked'); }, [tierId]);
  const [deleting, setDeleting] = useState(false);
  const dispatch = useEditor((state) => state.dispatch);
  const ids = itemIdsAt(project, tierId);
  const index = ids.indexOf(item.id);
  const locked = project.tiers.find((tier) => tier.id === tierId)?.locked;
  return <>
    <div className="property-kind"><span>{t.itemSettings}</span><Icon name="text" /></div>
    {locked && <p className="notice-inline">{t.errors.locked}</p>}
    <fieldset disabled={locked}><ItemForm item={item} />
      {item.assetId && <CropEditor item={item} />}
      <div className="property-section">
        <Field label={t.destination}>{(id) => <select id={id} value={destination} onChange={(e) => setDestination(e.target.value)}>
          <option value="unranked">{t.unranked}</option>
          {project.tiers.map((tier) => <option key={tier.id} value={tier.id} disabled={tier.locked}>{tier.name}{tier.locked ? ` (${t.locked})` : ''}</option>)}
        </select>}</Field>
        <button className="button secondary full" disabled={destination === (tierId ?? 'unranked')} onClick={() => dispatch({ type: 'item.move', id: item.id, tierId: destination === 'unranked' ? null : destination }, t.moved)}>{t.move}<Icon name="arrow" /></button>
      </div>
      <div className="property-section"><h3 className="section-label">{t.order}</h3><div className="button-pair">
        <button className="button secondary" disabled={index <= 0} onClick={() => dispatch({ type: 'item.move', id: item.id, tierId, index: index - 1 }, t.moved)}><Icon name="up" />{t.before}</button>
        <button className="button secondary" disabled={index >= ids.length - 1} onClick={() => dispatch({ type: 'item.move', id: item.id, tierId, index: index + 1 }, t.moved)}><Icon name="down" />{t.after}</button>
      </div></div>
      <div className="property-section"><button className="button text-button destructive" onClick={() => setDeleting(true)}><Icon name="trash" />{t.deleteItem}</button></div>
      <button className="button text-button" onClick={() => dispatch({ type: 'item.duplicate', id: item.id }, s.itemDuplicated)}><Icon name="copy" />{s.duplicateItem}</button>
    </fieldset>
    {deleting && <ConfirmDelete kind="item" id={item.id} name={item.name} onClose={() => setDeleting(false)} />}
  </>;
}

function ProjectProperties({ project }: { project: Project }) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const dispatch = useEditor((state) => state.dispatch);
  useEffect(() => { setTitle(project.title); setDescription(project.description); }, [project.title, project.description]);
  useDraft(title !== project.title || description !== project.description);
  return <><div className="property-kind"><span>{t.projectSettings}</span><Icon name="settings" /></div>
    <form onSubmit={(event) => { event.preventDefault(); dispatch({ type: 'project.update', title, description }); }}>
      <Field label={t.projectTitle}>{(id) => <input id={id} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />}</Field>
      <Field label={t.projectDescription}>{(id) => <textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={4} />}</Field>
      <button type="submit" className="button primary full"><Icon name="check" />{t.apply}</button>
    </form><div className="property-section"><p className="muted">{t.chooseHint}</p></div>
  </>;
}

export function Properties() {
  const project = useEditor((state) => state.project);
  const selection = useEditor((state) => state.selection);
  const tier = selection.kind === 'tier' ? project.tiers.find((entry) => entry.id === selection.id) : undefined;
  const item = selection.kind === 'item' ? project.items[selection.id] : undefined;
  return <div className="properties-content">
    {selection.kind === 'design' ? <DesignPanel key={project.id} /> : tier ? <TierProperties key={tier.id} tier={tier} project={project} />
      : item ? <ItemProperties key={item.id} item={item} project={project} />
        : <ProjectProperties key={project.id} project={project} />}
    <Feedback />
  </div>;
}
