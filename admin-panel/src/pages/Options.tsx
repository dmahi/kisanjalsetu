import { useEffect, useState } from 'react';
import {
  errMsg,
  OPTION_CATEGORIES,
  OPTION_LOCALES,
  selectOptionsAdminApi,
  adminCropsApi,
  type AdminSelectOption,
  type AdminCrop,
} from '../lib/api';
import { useToast } from '../App';

interface Props {
  user: { id: string; name?: string };
}

export default function Options({ user }: Props) {
  const { show } = useToast();
  const [options, setOptions] = useState<AdminSelectOption[]>([]);
  const [crops, setCrops] = useState<AdminCrop[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [opts, crs] = await Promise.all([selectOptionsAdminApi.list(), adminCropsApi.list()]);
      setOptions(opts || []);
      setCrops(crs || []);
    } catch (e) {
      show({ kind: 'error', text: errMsg(e, 'Failed to load options') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreateOption = async (category: string, code: string, labels: Record<string, string>) => {
    try {
      const created = await selectOptionsAdminApi.create({ category, code, labels });
      setOptions((prev) => [...prev, created]);
      show({ kind: 'success', text: 'Option added' });
    } catch (e) {
      show({ kind: 'error', text: errMsg(e, 'Failed to add option') });
    }
  };

  const handleSaveOption = async (id: string, patch: Partial<AdminSelectOption>) => {
    try {
      const updated = await selectOptionsAdminApi.update(id, patch);
      setOptions((prev) => prev.map((o) => (o.id === id ? updated : o)));
      show({ kind: 'success', text: 'Option saved' });
    } catch (e) {
      show({ kind: 'error', text: errMsg(e, 'Failed to save option') });
    }
  };

  const handleDeleteOption = async (id: string) => {
    if (!window.confirm('Delete this option? Existing records keep their stored value.')) return;
    try {
      await selectOptionsAdminApi.remove(id);
      setOptions((prev) => prev.filter((o) => o.id !== id));
      show({ kind: 'success', text: 'Option deleted' });
    } catch (e) {
      show({ kind: 'error', text: errMsg(e, 'Failed to delete option') });
    }
  };

  const handleCreateCrop = async (name: string, labels: Record<string, string>) => {
    try {
      const created = await adminCropsApi.create({ name, labels });
      setCrops((prev) => [...prev, created]);
      show({ kind: 'success', text: 'Crop added' });
    } catch (e) {
      show({ kind: 'error', text: errMsg(e, 'Failed to add crop') });
    }
  };

  const handleSaveCrop = async (id: string, patch: Partial<AdminCrop>) => {
    try {
      const updated = await adminCropsApi.update(id, patch);
      setCrops((prev) => prev.map((c) => (c.id === id ? updated : c)));
      show({ kind: 'success', text: 'Crop saved' });
    } catch (e) {
      show({ kind: 'error', text: errMsg(e, 'Failed to save crop') });
    }
  };

  const handleDeleteCrop = async (id: string) => {
    if (!window.confirm('Deactivate this crop? Existing records keep their stored value.')) return;
    try {
      await adminCropsApi.remove(id);
      setCrops((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'inactive' } : c)));
      show({ kind: 'success', text: 'Crop deactivated' });
    } catch (e) {
      show({ kind: 'error', text: errMsg(e, 'Failed to deactivate crop') });
    }
  };

  if (loading && options.length === 0 && crops.length === 0) {
    return <div className="spinner" />;
  }

  return (
    <div>
      <h1 className="page-title">Dropdown Options</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        These power every select list in the farmer &amp; owner apps, in English, हिंदी and ਪੰਜਾਬੀ. Add or edit options here and they update instantly on the phone.
      </p>

      <div className="card">
        <h2 className="card-title">Crops</h2>
        <CropList
          crops={crops}
          onAdd={handleCreateCrop}
          onSave={handleSaveCrop}
          onDelete={handleDeleteCrop}
        />
      </div>

      {OPTION_CATEGORIES.map((cat) => {
        const list = options
          .filter((o) => o.category === cat.key)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <div className="card" key={cat.key} style={{ marginTop: 16 }}>
            <h2 className="card-title">{cat.label}</h2>
            <OptionList
              category={cat.key}
              options={list}
              onAdd={handleCreateOption}
              onSave={handleSaveOption}
              onDelete={handleDeleteOption}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------- Crops ----------------------------- */

function CropList({
  crops,
  onAdd,
  onSave,
  onDelete,
}: {
  crops: AdminCrop[];
  onAdd: (name: string, labels: Record<string, string>) => void;
  onSave: (id: string, patch: Partial<AdminCrop>) => void;
  onDelete: (id: string) => void;
}) {
  const active = crops.filter((c) => c.status === 'active');
  const inactive = crops.filter((c) => c.status !== 'active');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <LabelFields onAdd={(name, labels) => onAdd(name, labels)} />
      {active.map((c) => (
        <CropRow key={`${c.id}:${c.updatedAt || ''}`} crop={c} onSave={onSave} onDelete={onDelete} />
      ))}
      {inactive.length > 0 ? (
        <>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: 12 }}>Inactive</p>
          {inactive.map((c) => (
            <CropRow key={`${c.id}:${c.updatedAt || ''}`} crop={c} onSave={onSave} onDelete={onDelete} />
          ))}
        </>
      ) : null}
    </div>
  );
}

function CropRow({
  crop,
  onSave,
  onDelete,
}: {
  crop: AdminCrop;
  onSave: (id: string, patch: Partial<AdminCrop>) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(crop.name);
  const labels = crop.labels || {};
  const [en, setEn] = useState(labels.en || crop.name);
  const [hi, setHi] = useState(labels.hi || '');
  const [pa, setPa] = useState(labels.pa || '');

  const save = () => {
    if (!name.trim()) return;
    onSave(crop.id, {
      name: name.trim(),
      labels: { en: en.trim() || name.trim(), hi: hi.trim(), pa: pa.trim() },
      status: crop.status,
    });
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', opacity: crop.status === 'active' ? 1 : 0.5 }}>
      <input style={{ width: 130 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      <input style={{ width: 120 }} value={en} onChange={(e) => setEn(e.target.value)} placeholder="English" />
      <input style={{ width: 120 }} value={hi} onChange={(e) => setHi(e.target.value)} placeholder="हिंदी" />
      <input style={{ width: 120 }} value={pa} onChange={(e) => setPa(e.target.value)} placeholder="ਪੰਜਾਬੀ" />
      <button className="btn-primary" onClick={save} disabled={!name.trim()}>Save</button>
      {crop.status === 'active' ? (
        <button className="btn-ghost" onClick={() => onDelete(crop.id)}>Deactivate</button>
      ) : null}
    </div>
  );
}

/* --------------------------- Generic options --------------------------- */

function OptionList({
  category,
  options,
  onAdd,
  onSave,
  onDelete,
}: {
  category: string;
  options: AdminSelectOption[];
  onAdd: (category: string, code: string, labels: Record<string, string>) => void;
  onSave: (id: string, patch: Partial<AdminSelectOption>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <LabelFields placeholder="code e.g. cash" onAdd={(code, labels) => onAdd(category, code, labels)} />
      {options.map((o) => (
        <OptionRow key={`${o.id}:${o.updatedAt || ''}`} option={o} onSave={onSave} onDelete={onDelete} />
      ))}
      {options.length === 0 ? <p className="muted" style={{ fontSize: '0.85rem' }}>No options yet.</p> : null}
    </div>
  );
}

function OptionRow({
  option,
  onSave,
  onDelete,
}: {
  option: AdminSelectOption;
  onSave: (id: string, patch: Partial<AdminSelectOption>) => void;
  onDelete: (id: string) => void;
}) {
  const labels = option.labels || {};
  const [code, setCode] = useState(option.code);
  const [en, setEn] = useState(labels.en || '');
  const [hi, setHi] = useState(labels.hi || '');
  const [pa, setPa] = useState(labels.pa || '');
  const [active, setActive] = useState(option.active);

  const save = () => {
    if (!code.trim()) return;
    onSave(option.id, {
      code: code.trim(),
      labels: { en: en.trim() || code.trim(), hi: hi.trim(), pa: pa.trim() },
      active,
    });
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', opacity: active ? 1 : 0.5 }}>
      <input style={{ width: 130 }} value={code} onChange={(e) => setCode(e.target.value)} placeholder="code" />
      <input style={{ width: 120 }} value={en} onChange={(e) => setEn(e.target.value)} placeholder="English" />
      <input style={{ width: 120 }} value={hi} onChange={(e) => setHi(e.target.value)} placeholder="हिंदी" />
      <input style={{ width: 120 }} value={pa} onChange={(e) => setPa(e.target.value)} placeholder="ਪੰਜਾਬੀ" />
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem' }}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>
      <button className="btn-primary" onClick={save} disabled={!code.trim()}>Save</button>
      <button className="btn-ghost" onClick={() => onDelete(option.id)}>Delete</button>
    </div>
  );
}

/* ----------------------------- Add row ----------------------------- */

function LabelFields({
  placeholder = 'name e.g. Wheat',
  onAdd,
}: {
  placeholder?: string;
  onAdd: (main: string, labels: Record<string, string>) => void;
}) {
  const label = placeholder ?? 'name';
  const [main, setMain] = useState('');
  const [en, setEn] = useState('');
  const [hi, setHi] = useState('');
  const [pa, setPa] = useState('');

  const submit = () => {
    if (!main.trim()) return;
    onAdd(main.trim(), { en: en.trim() || main.trim(), hi: hi.trim(), pa: pa.trim() });
    setMain('');
    setEn('');
    setHi('');
    setPa('');
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', background: '#f6f8fb', padding: 8, borderRadius: 8 }}>
      <input style={{ width: 130 }} value={main} onChange={(e) => setMain(e.target.value)} placeholder={label} />
      <input style={{ width: 120 }} value={en} onChange={(e) => setEn(e.target.value)} placeholder="English" />
      <input style={{ width: 120 }} value={hi} onChange={(e) => setHi(e.target.value)} placeholder="हिंदी" />
      <input style={{ width: 120 }} value={pa} onChange={(e) => setPa(e.target.value)} placeholder="ਪੰਜਾਬੀ" />
      <button className="btn-primary" onClick={submit} disabled={!main.trim()}>+ Add</button>
    </div>
  );
}