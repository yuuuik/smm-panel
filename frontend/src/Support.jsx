import { useState, useEffect, useRef } from 'react'
import {
  getSupportTickets,
  getSupportTicket,
  createSupportTicket,
  addSupportMessage,
  deleteSupportTicket,
} from './api'
import { MessageCircle, Plus, ChevronLeft, Send, Lock, Trash2 } from 'lucide-react'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ status }) {
  return status === 'open'
    ? <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-400/15 border border-cyan-500/40 text-cyan-400 font-medium">ОТКРЫТ</span>
    : <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-500/20 border border-gray-600/40 text-gray-400 font-medium">ЗАКРЫТ</span>
}

// ─── New ticket form ──────────────────────────────────────────────────────────
function NewTicketForm({ onCreated, onCancel }) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!subject.trim() || !message.trim()) { setError('Заполните все поля'); return }
    setLoading(true)
    try {
      const ticket = await createSupportTicket(subject.trim(), message.trim())
      onCreated(ticket)
    } catch (err) {
      setError(err.message || 'Ошибка создания')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#0d1117] border border-[#1c2333] rounded-xl p-6 max-w-xl w-full mx-auto">
      <h3 className="text-base font-semibold text-white mb-4">Новое обращение</h3>
      {error && <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1 font-medium">ТЕМА</label>
          <input
            className="w-full bg-[#08090e] border border-[#1c2333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/60"
            placeholder="Кратко опишите проблему..."
            value={subject}
            onChange={e => setSubject(e.target.value)}
            maxLength={256}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1 font-medium">СООБЩЕНИЕ</label>
          <textarea
            rows={5}
            className="w-full bg-[#08090e] border border-[#1c2333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 resize-none"
            placeholder="Опишите вашу проблему подробно..."
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-sm font-medium hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
          >
            <Send size={13} />
            {loading ? 'Отправка...' : 'Отправить'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-[#1c2333]/60 border border-[#1c2333] text-gray-400 text-sm hover:text-gray-200 transition-colors"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Thread view ──────────────────────────────────────────────────────────────
function TicketThread({ ticketId, onBack }) {
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  const load = async () => {
    try {
      const t = await getSupportTicket(ticketId)
      setTicket(t)
    } catch {
      setError('Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [ticketId])
  useEffect(() => {
    if (ticket) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ticket?.messages?.length])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!reply.trim()) return
    setSending(true)
    setError('')
    try {
      await addSupportMessage(ticketId, reply.trim())
      setReply('')
      await load()
    } catch (err) {
      setError(err.message || 'Ошибка отправки')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="text-gray-400 text-sm p-6">Загрузка...</div>

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[#1c2333] text-gray-400 hover:text-gray-200 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white truncate">{ticket?.subject}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{formatDate(ticket?.created_at)}</p>
        </div>
        <StatusBadge status={ticket?.status} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4" style={{ maxHeight: '420px' }}>
        {ticket?.messages?.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
              msg.sender_type === 'user'
                ? 'bg-cyan-500/20 border border-cyan-500/30 text-white'
                : 'bg-purple-500/15 border border-purple-500/30 text-white'
            }`}>
              <div className={`text-[11px] font-medium mb-1 ${msg.sender_type === 'user' ? 'text-cyan-400' : 'text-purple-400'}`}>
                {msg.sender_type === 'user' ? 'Вы' : 'Администратор'}
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              <div className="text-[10px] text-gray-500 mt-1 text-right">{formatDate(msg.created_at)}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply */}
      {ticket?.status === 'closed' ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[#1c2333]/40 border border-[#1c2333] text-gray-500 text-sm">
          <Lock size={13} />
          Обращение закрыто — ответ невозможен
        </div>
      ) : (
        <form onSubmit={handleSend} className="flex gap-2">
          {error && <div className="text-red-400 text-xs mr-2 self-center">{error}</div>}
          <textarea
            rows={2}
            className="flex-1 bg-[#08090e] border border-[#1c2333] rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/60 resize-none"
            placeholder="Ваш ответ..."
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }}
          />
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            className="self-end px-3 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 transition-colors disabled:opacity-40"
          >
            <Send size={15} />
          </button>
        </form>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Support() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('list') // 'list' | 'new' | 'thread'
  const [selectedId, setSelectedId] = useState(null)

  const load = () => {
    setLoading(true)
    getSupportTickets()
      .then(setTickets)
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreated = (ticket) => {
    setTickets(prev => [ticket, ...prev])
    setSelectedId(ticket.id)
    setView('thread')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-white text-xl font-bold">
            <MessageCircle size={20} className="text-cyan-400" />
            Поддержка
          </div>
          <p className="text-base font-semibold text-gray-400 mt-1">Обращения в службу поддержки</p>
        </div>
        {view === 'list' && (
          <button
            onClick={() => setView('new')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-sm font-medium hover:bg-cyan-500/30 transition-colors"
          >
            <Plus size={14} />
            Новое обращение
          </button>
        )}
      </div>

      {/* State: new ticket form */}
      {view === 'new' && (
        <NewTicketForm onCreated={handleCreated} onCancel={() => setView('list')} />
      )}

      {/* State: thread view */}
      {view === 'thread' && selectedId && (
        <div className="bg-[#0d1117] border border-[#1c2333] rounded-xl p-5">
          <TicketThread ticketId={selectedId} onBack={() => { setView('list'); load() }} />
        </div>
      )}

      {/* State: ticket list */}
      {view === 'list' && (
        <>
          {error && <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}
          {loading ? (
            <div className="text-gray-400 text-sm">Загрузка...</div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <MessageCircle size={36} className="mb-3 opacity-30" />
              <p className="text-sm">У вас нет обращений</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map(t => (
                <div key={t.id} className="flex items-stretch gap-2">
                  <button
                    onClick={() => { setSelectedId(t.id); setView('thread') }}
                    className="flex-1 text-left bg-[#0d1117] border border-[#1c2333] rounded-xl px-4 py-3.5 hover:border-cyan-500/30 hover:bg-[#0d1117]/80 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors truncate">{t.subject}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{formatDate(t.updated_at)} · {t.message_count} сообщ.</p>
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('Удалить обращение?')) return
                      try { await deleteSupportTicket(t.id); load() } catch {}
                    }}
                    className="px-3 rounded-xl bg-[#0d1117] border border-[#1c2333] text-gray-600 hover:text-red-400 hover:border-red-500/40 transition-colors flex-shrink-0"
                    title="Удалить обращение"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
