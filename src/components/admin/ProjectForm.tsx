'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveProjectAction, savePartnerAction } from '@/app/admin/actions';
import { Toast, useToast } from './Toast';

export type PartnerOption = { id: string; name: string; kind: 'design' | 'photo'; instagram: string | null };
export type ProjectValues = {
  name: string; slug: string; category: 'residential' | 'fnb' | 'commercial'; typeLabel: string; location: string;
  year: string; service: string; inHouse: boolean; description: string; status: 'published' | 'draft' | 'hidden';
  featured: boolean; sortDate: string; designers: string[]; photographers: string[];
};

const CATEGORY_OPTIONS = [['residential', 'Residential'], ['fnb', 'F&B'], ['commercial', 'Commercial']] as const;
const SERVICES = ['Build', 'Design & Build', 'Design'];

export function ProjectForm({ id, initial, partners }: { id: string | null; initial: ProjectValues; partners: PartnerOption[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [options, setOptions] = useState(partners);
  const [pending, start] = useTransition();
  const toast = useToast();
  const set = <K extends keyof ProjectValues>(k: K, value: ProjectValues[K]) => setV((s) => ({ ...s, [k]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await saveProjectAction(id, v);
      if (!r.ok) return toast.show(r.error, true);
      toast.show(r.message ?? 'Saved');
      if (!id && r.id) router.push(`/admin/projects/${r.id}`);
      else router.refresh();
    });
  };

  const addPartner = async (kind: 'design' | 'photo', name: string, instagram: string) => {
    const r = await savePartnerAction(null, { name: name.trim(), kind, instagram, website: '' });
    if (!r.ok || !r.id) { toast.show(r.ok ? 'Could not add' : r.error, true); return false; }
    setOptions((o) => [...o, { id: r.id!, name: name.trim(), kind, instagram: instagram || null }]);
    set(kind === 'design' ? 'designers' : 'photographers', [...v[kind === 'design' ? 'designers' : 'photographers'], r.id]);
    return true;
  };

  return (
    <form className="a-form" onSubmit={submit}>
      <div className="a-row">
        <label className="a-field"><span>Name</span><input className="a-input" value={v.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} /></label>
        <label className="a-field"><span>Web address</span><input className="a-input" value={v.slug} onChange={(e) => set('slug', e.target.value)} placeholder="made from the name" maxLength={90} /></label>
      </div>
      <div className="a-row a-row--3">
        <label className="a-field"><span>Category</span>
          <select className="a-select" value={v.category} onChange={(e) => set('category', e.target.value as ProjectValues['category'])}>
            {CATEGORY_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="a-field"><span>Type (optional)</span><input className="a-input" value={v.typeLabel} onChange={(e) => set('typeLabel', e.target.value)} placeholder="Retail, Office, Clinic" maxLength={60} /></label>
        <label className="a-field"><span>Service</span>
          <select className="a-select" value={v.service} onChange={(e) => set('service', e.target.value)}>
            <option value="">Not shown</option>
            {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <div className="a-row a-row--3">
        <label className="a-field" style={{ gridColumn: 'span 2' }}><span>Location</span><input className="a-input" value={v.location} onChange={(e) => set('location', e.target.value)} maxLength={160} /></label>
        <label className="a-field"><span>Year</span><input className="a-input" value={v.year} onChange={(e) => set('year', e.target.value)} placeholder="2026 or 2024-2025" maxLength={20} /></label>
      </div>

      <PartnerPicker label="Design" kind="design" options={options} value={v.designers} onChange={(x) => set('designers', x)} onNew={(n, ig) => addPartner('design', n, ig)} />
      <label className="a-check"><input type="checkbox" checked={v.inHouse} onChange={(e) => set('inHouse', e.target.checked)} /> Designed by Kadjoe</label>
      <PartnerPicker label="Photography" kind="photo" options={options} value={v.photographers} onChange={(x) => set('photographers', x)} onNew={(n, ig) => addPartner('photo', n, ig)} />

      <label className="a-field"><span>Description (optional, a few lines)</span><textarea className="a-textarea" value={v.description} onChange={(e) => set('description', e.target.value)} maxLength={1200} /></label>

      <div className="a-row a-row--3">
        <label className="a-field"><span>Status</span>
          <select className="a-select" value={v.status} onChange={(e) => set('status', e.target.value as ProjectValues['status'])}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <label className="a-field"><span>Order date (newest first)</span><input className="a-input" type="date" value={v.sortDate} onChange={(e) => set('sortDate', e.target.value)} required /></label>
        <label className="a-check" style={{ alignSelf: 'end', height: 38 }}><input type="checkbox" checked={v.featured} onChange={(e) => set('featured', e.target.checked)} /> Selected on the home page</label>
      </div>
      <div><button className="a-btn a-btn--primary" disabled={pending}>{pending ? 'Saving' : id ? 'Save' : 'Create project'}</button></div>
      <Toast {...toast} />
    </form>
  );
}

function PartnerPicker({ label, kind, options, value, onChange, onNew }: {
  label: string; kind: 'design' | 'photo'; options: PartnerOption[]; value: string[]; onChange: (v: string[]) => void; onNew: (name: string, instagram: string) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState<{ name: string; instagram: string } | null>(null);
  const byId = new Map(options.map((o) => [o.id, o]));
  const available = options.filter((o) => o.kind === kind && !value.includes(o.id)).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <fieldset className="a-fieldset">
      <legend>{label}</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {value.map((id) => (
          <span key={id} className="a-badge a-badge--solid" style={{ gap: 6, height: 26, textTransform: 'none', fontFamily: 'var(--f-sans)', fontSize: 13, letterSpacing: 0 }}>
            {byId.get(id)?.name ?? 'Unknown'}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} aria-label={`Remove ${byId.get(id)?.name}`} style={{ border: 0, background: 'none', color: 'inherit', padding: 0 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <select className="a-select" value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])} aria-label={`Add ${label.toLowerCase()} credit`}>
          <option value="">Add…</option>
          {available.map((o) => <option key={o.id} value={o.id}>{o.name}{o.instagram ? ` (@${o.instagram})` : ''}</option>)}
        </select>
        <button type="button" className="a-btn" onClick={() => setAdding({ name: '', instagram: '' })}>New</button>
      </div>
      {adding ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
          <label className="a-field" style={{ minWidth: 220 }}><span>{kind === 'design' ? 'Studio name' : 'Photographer name'}</span>
            <input className="a-input" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} autoFocus />
          </label>
          <label className="a-field" style={{ minWidth: 180 }}><span>Instagram (optional)</span>
            <input className="a-input" value={adding.instagram} onChange={(e) => setAdding({ ...adding, instagram: e.target.value })} placeholder="handle" />
          </label>
          <button type="button" className="a-btn" disabled={!adding.name.trim()} onClick={async () => { if (await onNew(adding.name, adding.instagram)) setAdding(null); }}>Add</button>
          <button type="button" className="a-btn a-btn--ghost" onClick={() => setAdding(null)}>Cancel</button>
        </div>
      ) : null}
    </fieldset>
  );
}
