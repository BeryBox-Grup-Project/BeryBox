import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { CaretLeft, PaperPlaneTilt } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { inboxApi } from '../api';
import { apiMessage } from '../api/http';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EmptyState, Skeleton } from '../components/ui/Feedback';
import { Avatar } from '../components/ui/Avatar';
import { useSocket } from '../context/SocketContext';
import { useUi } from '../context/UiContext';
import { useLiveReload } from '../hooks/useLiveReload';
import { markNotificationsRead } from '../store/notificationsSlice';

function TypingDots() {
  return (
    <span className="typing-dots" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function isMine(message, meId) {
  return Number(message.senderId) === Number(meId);
}

function isParticipant(conversation, meId) {
  const id = Number(meId);
  return Number(conversation?.userAId) === id || Number(conversation?.userBId) === id;
}

function formatChatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function InboxPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const me = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const socket = useSocket();
  const { toast } = useUi();

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const listRef = useRef(null);
  const activeIdRef = useRef(conversationId);
  const typingTimeoutRef = useRef(null);
  activeIdRef.current = conversationId;

  const loadConversations = useCallback(async () => {
    if (!me?.id) return;
    try {
      const data = await inboxApi.list();
      const mine = (Array.isArray(data) ? data : []).filter((row) => isParticipant(row, me.id));
      setConversations(mine);

      const activeId = activeIdRef.current;
      const ownsActive = mine.some((row) => String(row.id) === String(activeId));
      if (activeId && !ownsActive) {
        navigate('/inbox', { replace: true });
        setMessages([]);
      }
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  }, [me?.id, navigate, toast]);

  useEffect(() => {
    setConversations([]);
    setMessages([]);
    setDraft('');
    setPeerTyping(false);
    setLoading(true);
    loadConversations();
    dispatch(markNotificationsRead('inbox')).catch(() => {});
  }, [loadConversations, dispatch]);

  useLiveReload(() => {
    loadConversations();
    dispatch(markNotificationsRead('inbox')).catch(() => {});
  }, 5000);

  const ownsActiveConversation = conversations.some(
    (row) => String(row.id) === String(conversationId) && isParticipant(row, me?.id),
  );

  useEffect(() => {
    setPeerTyping(false);
    if (!conversationId || !me?.id) {
      setMessages([]);
      return undefined;
    }
    const active = conversations.find((row) => String(row.id) === String(conversationId));
    if (!active || !isParticipant(active, me.id)) {
      return undefined;
    }
    const peerId = Number(active.otherUser?.id);

    let cancelled = false;
    inboxApi
      .messages(conversationId)
      .then((data) => {
        if (!cancelled) setMessages(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        setMessages([]);
        if (error.response?.status === 403) {
          navigate('/inbox', { replace: true });
        } else {
          toast(apiMessage(error), 'error');
        }
      });

    socket?.joinConversation(Number(conversationId));
    const offMessage = socket?.onMessage((message) => {
      if (String(message.conversationId) !== String(conversationId)) return;
      if (Number(message.senderId) !== Number(me.id) && Number(message.senderId) !== peerId) {
        return;
      }
      setMessages((rows) => (rows.some((row) => row.id === message.id) ? rows : [...rows, message]));
      if (Number(message.senderId) !== Number(me.id)) setPeerTyping(false);
      loadConversations();
    });
    const offTyping = socket?.onTyping((payload) => {
      if (String(payload.conversationId) !== String(conversationId)) return;
      if (Number(payload.userId) === Number(me.id)) return;
      setPeerTyping(true);
    });
    const offStop = socket?.onStopTyping((payload) => {
      if (String(payload.conversationId) !== String(conversationId)) return;
      setPeerTyping(false);
    });

    return () => {
      cancelled = true;
      offMessage?.();
      offTyping?.();
      offStop?.();
      socket?.emitStopTyping(Number(conversationId));
    };
  }, [conversationId, ownsActiveConversation, socket, toast, loadConversations, me?.id, navigate]);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, peerTyping, conversationId]);

  function handleDraftChange(value) {
    setDraft(value);
    if (!conversationId || !socket) return;
    socket.emitTyping(Number(conversationId));
    window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      socket.emitStopTyping(Number(conversationId));
    }, 900);
  }

  async function send(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !conversationId) return;
    setSending(true);
    socket?.emitStopTyping(Number(conversationId));
    window.clearTimeout(typingTimeoutRef.current);
    try {
      const message = await inboxApi.send(conversationId, body);
      setMessages((rows) => (rows.some((row) => row.id === message.id) ? rows : [...rows, message]));
      setDraft('');
      loadConversations();
      requestAnimationFrame(() => {
        const node = listRef.current;
        if (node) node.scrollTop = node.scrollHeight;
      });
    } catch (error) {
      toast(apiMessage(error), 'error');
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Skeleton className="m-6 h-96 w-auto" />;

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-margin-mobile py-10 md:px-margin-desktop">
        <EmptyState
          title="Belum ada percakapan"
          description="Chat dimulai dari halaman detail barang. Klaim atau tawar dulu, lalu lanjut di sini."
          action={<Button as={Link} to="/home">Cari barang</Button>}
        />
      </div>
    );
  }

  const active = conversations.find((row) => String(row.id) === String(conversationId));
  const otherName = active?.otherUser?.username || 'Lawan chat';
  const showThread = Boolean(conversationId && active);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-surface-container-low">
      <aside
        className={`${showThread ? 'hidden lg:flex' : 'flex'} min-h-0 w-full shrink-0 flex-col border-outline-variant/50 bg-surface-container-lowest lg:w-[300px] lg:border-r`}
      >
        <div className="px-5 py-4">
          <h1 className="font-headline text-lg text-on-surface">Pesan</h1>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {conversations.map((row) => {
            const activeRow = String(row.id) === String(conversationId);
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => navigate(`/inbox/${row.id}`)}
                className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                  activeRow ? 'bg-primary/10' : 'hover:bg-surface-container'
                }`}
              >
                <Avatar
                  src={row.otherUser?.photoUrl}
                  name={row.otherUser?.username}
                  size="lg"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${activeRow ? 'font-label text-primary' : 'font-label text-on-surface'}`}>
                      {row.otherUser?.username}
                    </span>
                    <span className="shrink-0 text-[11px] text-on-surface-variant">
                      {formatChatTime(row.lastMessage?.createdAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-1 text-xs text-on-surface-variant">
                    {row.lastMessage?.body || 'Belum ada pesan'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className={`${showThread ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background`}>
        {showThread ? (
          <>
            <header className="flex items-center gap-3 border-b border-outline-variant/50 px-4 py-3">
              <button
                type="button"
                onClick={() => navigate('/inbox')}
                className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface lg:hidden"
                aria-label="Kembali ke daftar pesan"
              >
                <CaretLeft size={22} />
              </button>
              <Avatar src={active?.otherUser?.photoUrl} name={otherName} size="md" />
              <div className="min-w-0">
                <p className="font-headline truncate text-sm text-on-surface">{otherName}</p>
                <p className="text-xs text-on-surface-variant">
                  {peerTyping ? 'Sedang mengetik...' : socket?.connected ? 'Online' : 'Menghubungkan'}
                </p>
              </div>
            </header>

            <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto px-4 py-5">
              {messages.map((message) => {
                const mine = isMine(message, me?.id);
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex max-w-[78%] flex-col overflow-hidden ${mine ? 'items-end' : 'items-start'}`}>
                      <span
                        className={`inline-block overflow-hidden break-words px-3.5 py-2 text-sm leading-relaxed ${
                          mine
                            ? 'rounded-2xl rounded-br-md bg-primary text-on-primary'
                            : 'rounded-2xl rounded-bl-md bg-surface-container-lowest text-on-surface'
                        }`}
                      >
                        {message.body}
                      </span>
                      <span className="mt-1 px-1 text-[10px] text-on-surface-variant">
                        {formatChatTime(message.createdAt)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}

              {peerTyping && (
                <div className="flex justify-start">
                  <span className="inline-flex items-center rounded-2xl rounded-bl-md bg-surface-container-lowest px-3.5 py-2.5 text-on-surface-variant">
                    <TypingDots />
                  </span>
                </div>
              )}
            </div>

            <form onSubmit={send} className="flex items-center gap-2 border-t border-outline-variant/50 px-4 py-3">
              <Input
                value={draft}
                onChange={(event) => handleDraftChange(event.target.value)}
                placeholder="Tulis pesan..."
                maxLength={2000}
                className="flex-1 rounded-full bg-surface-container-low"
              />
              <Button type="submit" loading={sending} disabled={!conversationId || !active} size="icon" className="shrink-0" aria-label="Kirim">
                <PaperPlaneTilt size={20} weight="fill" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="max-w-xs text-center text-sm text-on-surface-variant">
              Pilih percakapan di kiri untuk mulai chat.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
