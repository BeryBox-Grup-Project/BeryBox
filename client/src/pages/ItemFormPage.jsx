import { ArrowsClockwise, Gift, ImageSquare } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { itemsApi } from '../api';
import { apiMessage } from '../api/http';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input, Select, Textarea } from '../components/ui/Input';
import { LocationPicker } from '../components/LocationPicker';
import { useSyncedMapPosition } from '../hooks/useGeolocation';
import { useImageKitUpload } from '../hooks/useImageKitUpload';
import { useUi } from '../context/UiContext';
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  ITEM_CATEGORIES,
  ITEM_CONDITIONS,
} from '../lib/labels';

const USER_TYPE_OPTIONS = [
  { value: 'public', label: 'Donasi', Icon: Gift, hint: 'Gratis untuk siapa pun yang klaim' },
  { value: 'barter', label: 'Barter', Icon: ArrowsClockwise, hint: 'Ditukar dengan barang lain' },
];

const EMPTY_FORM = {
  type: 'public',
  title: '',
  description: '',
  condition: 'good',
  category: 'other',
  creditValue: 0,
  imageUrl: '',
  wantedTitle: '',
  wantedDescription: '',
  wantedImageUrl: '',
  wantedCategory: 'other',
};

function ImageDrop({ label, hint, url, onFile, uploading, configured }) {
  return (
    <Field label={label} hint={hint}>
      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low p-6 transition-colors hover:bg-surface-container">
        {url ? (
          <img src={url} alt="Pratinjau" className="max-h-48 rounded-xl object-contain" />
        ) : (
          <>
            <ImageSquare size={40} className="text-primary" weight="duotone" />
            <span className="mt-2 text-center text-sm text-on-surface-variant">
              {uploading ? 'Mengunggah...' : 'Klik untuk mengunggah foto'}
            </span>
          </>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={!configured || uploading} />
      </label>
    </Field>
  );
}

export default function ItemFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const me = useSelector((state) => state.auth.user);
  const isOrgAccount = me?.role === 'organization';
  const { position, setPosition, replacePosition } = useSyncedMapPosition();
  const { toast } = useUi();
  const { upload, uploading, configured } = useImageKitUpload();

  const [form, setForm] = useState({
    ...EMPTY_FORM,
    type: isOrgAccount ? 'organization' : 'public',
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit || !isOrgAccount) return;
    setForm((prev) => (prev.type === 'organization' ? prev : { ...prev, type: 'organization' }));
  }, [isEdit, isOrgAccount]);

  useEffect(() => {
    if (!isEdit) return undefined;
    let active = true;
    itemsApi
      .detail(id)
      .then((data) => {
        if (!active) return;
        setForm({
          type: data.type,
          title: data.title,
          description: data.description,
          condition: data.condition,
          category: data.category,
          creditValue: data.creditValue,
          imageUrl: data.imageUrl || '',
          wantedTitle: data.wantedTitle || '',
          wantedDescription: data.wantedDescription || '',
          wantedImageUrl: data.wantedImageUrl || '',
          wantedCategory: data.wantedCategory || 'other',
        });
        if (data.latitude && data.longitude) replacePosition({ latitude: data.latitude, longitude: data.longitude });
      })
      .catch((error) => toast(apiMessage(error), 'error'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, isEdit, toast, replacePosition]);

  async function pickImage(event, field) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const url = await upload(file);
      setForm((prev) => ({ ...prev, [field]: url }));
      toast('Foto terunggah.', 'success');
    } catch (error) {
      toast(error.message || 'Gagal mengunggah gambar', 'error');
    }
  }

  const isBarter = form.type === 'barter';
  const isNeed = form.type === 'organization' || isOrgAccount;
  const canSubmit = Boolean(form.imageUrl && (!isBarter || (form.wantedImageUrl && form.wantedTitle.trim())));

  async function submit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    const creditValue = isOrgAccount ? 0 : (Number.parseInt(form.creditValue, 10) || 0);
    const payload = {
      title: form.title,
      description: form.description,
      condition: form.condition,
      category: form.category,
      creditValue,
      imageUrl: form.imageUrl,
      latitude: Number(position.latitude),
      longitude: Number(position.longitude),
    };
    if (!isEdit) payload.type = isOrgAccount ? 'organization' : form.type;
    if (isBarter) {
      payload.wantedTitle = form.wantedTitle.trim();
      payload.wantedDescription = form.wantedDescription || null;
      payload.wantedImageUrl = form.wantedImageUrl;
      payload.wantedCategory = form.wantedCategory || null;
    }
    try {
      if (isEdit) {
        await itemsApi.update(id, payload);
        toast('Barang diperbarui.', 'success');
        navigate(`/items/${id}`);
      } else {
        const created = await itemsApi.create(payload);
        toast(isOrgAccount ? 'Kebutuhan tayang di beranda.' : 'Barang tayang di beranda.', 'success');
        navigate(`/items/${created.id}`);
      }
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-on-surface-variant">Memuat...</p>;

  const imageHint = configured
    ? 'Maksimal 5MB, JPG/PNG'
    : 'Isi VITE_IMAGEKIT_PUBLIC_KEY dan VITE_IMAGEKIT_URL_ENDPOINT (URL https) di .env, lalu restart Vite';

  return (
    <div className="mx-auto max-w-[800px]">
      <div className="py-stack-lg text-center">
        <h1 className="font-display text-3xl font-extrabold text-primary">
          {isOrgAccount ? 'Unggah barang yang dibutuhkan.' : 'Kasih kesempatan kedua untuk barangmu.'}
        </h1>
        <p className="mt-2 text-on-surface-variant">
          {isOrgAccount
            ? 'Tulis kebutuhan panti atau komunitas. Warga bisa menawarkan donasi yang cocok.'
            : 'Bagikan dengan mendonasikan atau menukar barang yang sudah tidak kamu pakai.'}
        </p>
      </div>

      <Card className="p-6 md:p-8">
        <form onSubmit={submit} className="space-y-stack-lg">
          {!isOrgAccount && (
          <Field label="Jenis transaksi">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {USER_TYPE_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  disabled={isEdit}
                  onClick={() => setForm((prev) => ({ ...prev, type: option.value }))}
                  className={`rounded-2xl border-2 p-4 text-center transition-all ${
                    form.type === option.value
                      ? 'border-primary bg-surface-container'
                      : 'border-outline-variant hover:bg-surface-container-low'
                  } ${isEdit ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <span className="mb-2 flex justify-center text-primary">
                    <option.Icon size={32} weight="duotone" />
                  </span>
                  <span className="font-label block text-sm text-on-surface">{option.label}</span>
                  <span className="mt-1 block text-xs text-on-surface-variant">{option.hint}</span>
                </button>
              ))}
            </div>
          </Field>
          )}

          {isBarter ? (
            <div className="grid gap-4 md:grid-cols-2">
              <ImageDrop
                label="Foto barang yang kamu punya"
                hint={imageHint}
                url={form.imageUrl}
                onFile={(event) => pickImage(event, 'imageUrl')}
                uploading={uploading}
                configured={configured}
              />
              <ImageDrop
                label="Foto barang yang kamu cari"
                hint="Wajib untuk barter, harus URL ImageKit"
                url={form.wantedImageUrl}
                onFile={(event) => pickImage(event, 'wantedImageUrl')}
                uploading={uploading}
                configured={configured}
              />
            </div>
          ) : (
            <ImageDrop
              label={isNeed ? 'Foto contoh barang yang dibutuhkan' : 'Foto barang'}
              hint={imageHint}
              url={form.imageUrl}
              onFile={(event) => pickImage(event, 'imageUrl')}
              uploading={uploading}
              configured={configured}
            />
          )}

          <Field label="Judul">
            <Input
              required
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder={isNeed ? 'Contoh: Butuh meja belajar anak SD' : 'Contoh: Sepeda lipat anak'}
            />
          </Field>

          {isBarter && (
            <>
              <Field label="Barang yang kamu cari">
                <Input
                  required
                  value={form.wantedTitle}
                  onChange={(event) => setForm((prev) => ({ ...prev, wantedTitle: event.target.value }))}
                  placeholder="Contoh: Rak buku kayu"
                />
              </Field>
              <Field label="Deskripsi barang yang dicari" hint="Opsional">
                <Textarea
                  value={form.wantedDescription}
                  onChange={(event) => setForm((prev) => ({ ...prev, wantedDescription: event.target.value }))}
                  placeholder="Ukuran, kondisi, atau merek yang kamu inginkan..."
                />
              </Field>
              <Field label="Kategori barang yang dicari">
                <Select
                  value={form.wantedCategory}
                  onChange={(event) => setForm((prev) => ({ ...prev, wantedCategory: event.target.value }))}
                >
                  {ITEM_CATEGORIES.map((row) => (
                    <option key={row} value={row}>{CATEGORY_LABELS[row]}</option>
                  ))}
                </Select>
              </Field>
            </>
          )}

          <Field label="Deskripsi" hint="Jelaskan kondisi apa adanya">
            <Textarea
              required
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder={isNeed ? 'Jelaskan jumlah, ukuran, atau kondisi yang dibutuhkan...' : 'Ceritakan sedikit tentang barang ini...'}
            />
          </Field>

          <div className="grid grid-cols-1 gap-stack-md md:grid-cols-3">
            <Field label="Kondisi">
              <Select value={form.condition} onChange={(event) => setForm((prev) => ({ ...prev, condition: event.target.value }))}>
                {ITEM_CONDITIONS.map((row) => (
                  <option key={row} value={row}>{CONDITION_LABELS[row]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Kategori">
              <Select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}>
                {ITEM_CATEGORIES.map((row) => (
                  <option key={row} value={row}>{CATEGORY_LABELS[row]}</option>
                ))}
              </Select>
            </Field>
            {!isNeed && (
            <Field label="Nilai kredit" hint="Dipakai saat barter">
              <Input
                type="number"
                min={0}
                step={1}
                value={form.creditValue}
                onChange={(event) => setForm((prev) => ({ ...prev, creditValue: event.target.value }))}
              />
            </Field>
            )}
          </div>

          <Field label="Lokasi pengambilan" hint="Klik peta untuk menyesuaikan titik">
            <LocationPicker value={position} onChange={setPosition} />
          </Field>

          {!isNeed && (
          <div className="flex items-center justify-between rounded-2xl border border-outline-variant/50 bg-surface-container-high p-4">
            <div>
              <span className="font-label block text-sm text-on-surface">Estimasi nilai kredit</span>
              <span className="block text-xs text-on-surface-variant">Kredit dipakai menyeimbangkan barter.</span>
            </div>
            <span className="font-headline text-2xl text-primary">{Number.parseInt(form.creditValue, 10) || 0}</span>
          </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" size="lg" className="flex-1" loading={saving} disabled={!canSubmit}>
              {isEdit ? 'Simpan perubahan' : (isNeed ? 'Terbitkan kebutuhan' : 'Terbitkan barang')}
            </Button>
            <Button type="button" variant="secondary" size="lg" onClick={() => navigate(-1)}>Batal</Button>
          </div>
          {!canSubmit && (
            <p className="text-center text-xs text-on-surface-variant">
              {isBarter
                ? 'Foto barang punya, foto barang yang dicari, dan judul barang yang dicari wajib diisi.'
                : 'Foto wajib diunggah lewat ImageKit sebelum menerbitkan.'}
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
