import { useEffect, useState } from 'react';
import type { TierStyle } from '../data/types';
import { useEditor } from '../stores/editorStore';
import { confirmDrafts, useDraft } from '../features/editor/useDraft';
import { addBackground } from '../features/storage/session';
import { resolveStyle, type ThemeScope } from '../features/design/settings';
import { themes, rankPresets } from '../features/design/templates';
import { d } from '../app/designMessages';
import { Field } from './Fields';
import { LabelWidthFields } from './LabelWidthFields';

type Style = Required<TierStyle>;
export function DesignPanel() {
  const project = useEditor((state) => state.project);
  const dispatch = useEditor((state) => state.dispatch);
  const busy = useEditor((state) => state.busy);
  const [style, setStyle] = useState(() => resolveStyle(project.style));
  const [themeId, setThemeId] = useState(themes[0]!.id);
  const [rankId, setRankId] = useState(rankPresets[0]!.id);
  const [scope, setScope] = useState<ThemeScope>('all');
  useEffect(() => setStyle(resolveStyle(project.style)), [project.style]);
  useDraft(JSON.stringify(style) !== JSON.stringify(resolveStyle(project.style)));
  function update<K extends keyof Style>(key: K, value: Style[K]) { setStyle((current) => ({ ...current, [key]: value })); }
  function number(key: keyof Style, label: string, min: number, max: number) {
    return <Field label={label} hint={`${min}〜${max}`}>{(id) => <input id={id} type="number" min={min} max={max} step={1} required value={Number.isFinite(style[key]) ? Number(style[key]) : ''} onChange={(e) => update(key, e.target.valueAsNumber)} />}</Field>;
  }
  function color(key: keyof Style, label: string) {
    return <Field label={label}>{(id) => <div className="color-value"><input type="color" id={id} value={/^#[0-9a-f]{6}$/i.test(String(style[key])) ? String(style[key]) : '#000000'} onChange={(e) => update(key, e.target.value)} /><input aria-label={`${label}のカラーコード`} className="hex-code" value={String(style[key])} maxLength={7} pattern="#[0-9a-fA-F]{6}" required onChange={(e) => update(key, e.target.value)} /></div>}</Field>;
  }
  function select<K extends keyof Style>(key: K, label: string, choices: Record<string, string>) {
    return <Field label={label}>{(id) => <select id={id} value={String(style[key])} onChange={(e) => update(key, e.target.value as Style[K])}>
      {!Object.hasOwn(choices, String(style[key])) && <option value={String(style[key])}>{String(style[key])}</option>}
      {Object.entries(choices).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
    </select>}</Field>;
  }
  function toggle(key: 'showTitle' | 'showItemNames', label: string) { return <label className="toggle-label design-toggle"><input type="checkbox" checked={style[key]} onChange={(e) => update(key, e.target.checked)} />{label}</label>; }
  return <div className="design-panel">
    <div className="property-kind"><span>{d.title}</span></div>
    <details open className="design-section"><summary>{d.templates}</summary>
      <div className="theme-grid" role="group" aria-label={d.templates}>{themes.map((theme) => <button key={theme.id} type="button" className="theme-option" aria-pressed={themeId === theme.id} onClick={() => setThemeId(theme.id)}>
        <span className="theme-sample" aria-hidden="true" style={{ background: theme.style.background }}>{theme.colors.slice(0, 3).map((color, index) => <span key={index} style={{ borderColor: color }}><i style={{ background: theme.style.cardBackground, borderRadius: theme.style.radius }} /><i style={{ background: theme.style.cardBackground, borderRadius: theme.style.radius }} /></span>)}</span><span>{theme.name}</span>
      </button>)}</div>
      <Field label={d.scope}>{(id) => <select id={id} value={scope} onChange={(e) => setScope(e.target.value as ThemeScope)}><option value="all">{d.all}</option><option value="ranks">{d.ranks}</option><option value="cards">{d.cards}</option></select>}</Field>
      <button className="button secondary full" onClick={() => { if (confirmDrafts() && dispatch({ type: 'design.theme', id: themeId, scope }, d.applied)) setStyle(resolveStyle(useEditor.getState().project.style)); }}>{d.applyTheme}</button>
      <p className="field-hint">{d.templateHint}</p>
      <Field label={d.rankPresets}>{(id) => <select id={id} value={rankId} onChange={(e) => setRankId(e.target.value)}>{rankPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select>}</Field>
      <button className="button secondary full" onClick={() => { if (confirmDrafts() && dispatch({ type: 'design.ranks', id: rankId }, d.applied)) setStyle(resolveStyle(useEditor.getState().project.style)); }}>{d.applyRanks}</button>
    </details>
    <form onInvalid={(event) => { const details = event.target instanceof Element ? event.target.closest('details') : null; if (details) details.open = true; }} onSubmit={(event) => { event.preventDefault(); dispatch({ type: 'design.update', style }, d.applied); }}>
      <details open className="design-section"><summary>{d.background}</summary>
        {select('backgroundMode', d.mode, { solid: d.solid, gradient: d.gradient, pattern: d.pattern, image: d.image })}
        {color('background', d.baseColor)}
        {(style.backgroundMode === 'gradient' || style.backgroundMode === 'pattern') && color('backgroundSecondary', d.secondColor)}
        {style.backgroundMode === 'gradient' && number('gradientAngle', d.angle, 0, 360)}
        {style.backgroundMode === 'pattern' && select('pattern', d.pattern, { dots: d.dots, grid: d.grid, stripes: d.stripes })}
      </details>
      <details className="design-section"><summary>{d.typography}</summary>
        {select('fontFamily', d.font, d.fonts)}{color('textColor', d.textColor)}
        {number('fontSize', d.fontSize, 10, 32)}{number('labelFontSize', d.labelFontSize, 12, 64)}
        {number('titleSize', d.titleSize, 16, 64)}{select('titleAlign', d.titleAlign, { left: d.left, center: d.center, right: d.right })}
        {select('titleDecoration', d.titleDecoration, { none: d.none, line: d.line, band: d.band })}{toggle('showTitle', d.showTitle)}
      </details>
      <details className="design-section"><summary>{d.layout}</summary>
        <LabelWidthFields value={style} onChange={(sizing) => setStyle((current) => ({ ...current, ...sizing }))} />{number('itemSize', d.itemSize, 40, 200)}
        {number('gap', d.gap, 0, 40)}{number('padding', d.padding, 0, 48)}{number('rowGap', d.rowGap, 0, 32)}
        <p className="field-hint">{d.responsive}</p>
      </details>
      <details className="design-section"><summary>{d.card}</summary>
        {select('imageFit', d.fit, { contain: d.contain, cover: d.cover })}{toggle('showItemNames', d.showNames)}
        <label className="toggle-label design-toggle"><input type="checkbox" checked={!style.showImageNames} onChange={(e) => update('showImageNames', !e.target.checked)} />{d.hideImageNames}</label>
        <p className="field-hint">{d.imageNamesHint}</p>
        {number('radius', d.radius, 0, 40)}{color('cardBackground', d.cardBackground)}{color('cardTextColor', d.cardTextColor)}
        {color('borderColor', d.borderColor)}{number('borderWidth', d.borderWidth, 0, 8)}
        {select('borderStyle', d.borderStyle, { solid: d.solid, dashed: d.dashed, double: d.double })}{select('shadow', d.shadow, { none: d.none, soft: d.soft, hard: d.hard })}
      </details>
      <button type="submit" className="button primary full design-save">{d.apply}</button>
    </form>
    <div className="property-section">
      <Field label={d.backgroundFile} hint={d.backgroundHint}>{(id) => <input id={id} type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={(e) => {
        const file = e.target.files?.[0]; e.target.value = '';
        if (file && confirmDrafts()) void addBackground(file);
      }} />}</Field>
      {project.style.backgroundAssetId && <><p className="field-hint">{project.assets[project.style.backgroundAssetId]?.originalName}</p><button className="button secondary full" onClick={() => { if (confirmDrafts()) dispatch({ type: 'design.background', asset: null }, d.applied); }}>{d.removeBackground}</button></>}
    </div>
  </div>;
}
