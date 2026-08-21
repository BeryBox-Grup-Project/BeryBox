import { useState } from 'react';
import { Link } from 'react-router-dom';
import { aiApi } from '../api';
import { apiMessage } from '../api/http';
import { Button } from './ui/Button';
import { Field, Input, Select } from './ui/Input';
import { CATEGORY_LABELS, ITEM_CATEGORIES } from '../lib/labels';
import { useUi } from '../context/UiContext';

export function BarterMatchForm({ onMatched }) {
  const { toast } = useUi();
  const [form, setForm] = useState({ have: '', want: '', category: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const payload = { have: form.have, want: form.want };
      if (form.category) payload.category = form.category;
      const data = await aiApi.match(payload);
      setResult(data);
      onMatched?.(data);
    } catch (error) {
      toast(apiMessage(error, 'AI service unavailable'), 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Aku punya">
          <Input
            required
            value={form.have}
            onChange={(event) => setForm({ ...form, have: event.target.value })}
            placeholder="kamera analog Canon AE-1"
          />
        </Field>
        <Field label="Aku mau">
          <Input
            required
            value={form.want}
            onChange={(event) => setForm({ ...form, want: event.target.value })}
            placeholder="tanaman hias monstera"
          />
        </Field>
        <Field label="Kategori (opsional)">
          <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            <option value="">Semua kategori</option>
            {ITEM_CATEGORIES.map((row) => (
              <option key={row} value={row}>{CATEGORY_LABELS[row]}</option>
            ))}
          </Select>
        </Field>
        <Button type="submit" className="w-full" loading={loading}>Cari kecocokan</Button>
      </form>
      {result && (
        <div className="mt-4 border-t border-outline-variant pt-4">
          <p className="text-sm text-on-surface">{result.reply}</p>
          {result.suggestions?.length > 0 && (
            <ul className="mt-3 space-y-2">
              {result.suggestions.map((row) => (
                <li key={`${row.kind}-${row.id}`}>
                  <Link
                    to={row.kind === 'organization' ? `/organizations/${row.id}` : `/items/${row.id}`}
                    className="font-label text-sm text-primary underline"
                  >
                    {row.title || row.name}
                    {row.wantedTitle && ` (mau: ${row.wantedTitle})`}
                    {row.distanceKm != null && ` · ${row.distanceKm} km`}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
