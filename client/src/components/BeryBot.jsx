import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'motion/react';
import { Robot, X } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { aiApi } from '../api';
import { apiMessage } from '../api/http';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { useGeolocation } from '../hooks/useGeolocation';
import { useUi } from '../context/UiContext';

export function BeryBot() {
  const token = useSelector((state) => state.auth.token);
  const userId = useSelector((state) => state.auth.user?.id);
  const { coords } = useGeolocation();
  const { botOpen, setBotOpen } = useUi();
  const [messages, setMessages] = useState([
    { role: 'bot', reply: 'Halo! Aku BeryBot. Mau donasi ke mana atau cari barang apa hari ini?', suggestions: [] },
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    setMessages([
      { role: 'bot', reply: 'Halo! Aku BeryBot. Mau donasi ke mana atau cari barang apa hari ini?', suggestions: [] },
    ]);
    setDraft('');
  }, [userId]);

  useEffect(() => {
    if (!botOpen) return;
    const node = listRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [botOpen, messages, loading]);

  if (!token) return null;

  async function send(event) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || loading) return;
    setDraft('');
    setMessages((rows) => [...rows, { role: 'me', reply: message, suggestions: [] }]);
    setLoading(true);
    try {
      const data = await aiApi.chat(message, coords);
      setMessages((rows) => [...rows, { role: 'bot', reply: data.reply, suggestions: data.suggestions || [] }]);
    } catch (error) {
      setMessages((rows) => [...rows, { role: 'bot', reply: apiMessage(error, 'AI sedang sibuk'), suggestions: [] }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setBotOpen(!botOpen)}
        aria-label="Tanya BeryBot"
        className="fixed bottom-28 right-5 z-[40] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-2xl transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
      >
        <Robot size={26} weight="fill" />
      </button>

      <AnimatePresence>
        {botOpen && (
          <motion.aside
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="glass-panel fixed bottom-48 right-5 z-[40] flex h-[min(560px,72vh)] w-[min(400px,calc(100vw-40px))] flex-col overflow-hidden rounded-3xl border border-outline-variant shadow-2xl md:bottom-28 md:right-8"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-outline-variant/50 px-4 py-3">
              <div>
                <p className="font-headline text-sm text-on-surface">BeryBot</p>
                <p className="text-xs text-on-surface-variant">Pemandu komunitas</p>
              </div>
              <button type="button" onClick={() => setBotOpen(false)} className="text-on-surface-variant" aria-label="Tutup">
                <X size={18} />
              </button>
            </header>

            <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto p-4 text-sm">
              {messages.map((row, index) => (
                <div key={index} className={row.role === 'me' ? 'text-right' : ''}>
                  <p className="font-label mb-1 text-[11px] text-on-surface-variant">
                    {row.role === 'me' ? 'You' : 'BeryBot'}
                  </p>
                  <p
                    className={`inline-block max-w-[85%] overflow-hidden break-words rounded-2xl px-3 py-2 ${
                      row.role === 'me' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface'
                    }`}
                  >
                    {row.reply}
                  </p>
                  {row.suggestions?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {row.suggestions.map((s) => (
                        <li key={`${s.kind}-${s.id}`}>
                          <Link
                            to={s.kind === 'organization' ? `/organizations/${s.id}` : `/items/${s.id}`}
                            className="font-label text-xs text-primary underline"
                          >
                            {s.name || s.title}{s.distanceKm != null ? ` · ${s.distanceKm} km` : ''}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {loading && (
                <div>
                  <p className="font-label mb-1 text-[11px] text-on-surface-variant">BeryBot</p>
                  <p className="inline-flex items-center rounded-2xl bg-surface-container px-3 py-2 text-on-surface-variant">
                    <span className="typing-dots" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  </p>
                </div>
              )}
            </div>

            <form onSubmit={send} className="flex shrink-0 gap-2 border-t border-outline-variant/50 p-3">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Tanya soal BeryBox..."
                className="py-2 text-sm"
              />
              <Button type="submit" size="sm" loading={loading}>
                Kirim
              </Button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
