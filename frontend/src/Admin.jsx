import { useState, useEffect, useRef, Fragment } from 'react'
import { adminGetUsers, adminUpdateUser, adminDeleteUser, adminGetUserTasks, adminGetTaskLogs, adminCreateUser, adminGetSupportTickets, adminGetSupportTicket, adminReplySupportTicket, adminUpdateSupportTicket, adminDeleteSupportTicket, adminSetUserSubscription } from './api'
import { Users, ShieldCheck, Trash2, KeyRound, AlertCircle, CheckCircle, ShieldOff, ChevronDown, ChevronRight, ListChecks, ScrollText, XCircle, UserPlus, MailCheck, Mail, MessageCircle, Send, Lock, Crown } from 'lucide-react'

function statusBadge(status) {
  const map = {
    running:   'bg-[rgba(6,182,212,0.12)] text-cyan-400 border-cyan-500/40',
    completed: 'bg-[rgba(34,197,94,0.12)] text-green-400 border-green-500/40',
    failed:    'bg-[rgba(239,68,68,0.12)] text-red-400 border-red-500/40',
    stopped:   'bg-[rgba(156,163,175,0.12)] text-gray-400 border-gray-500/40',
    pending:   'bg-[rgba(168,85,247,0.12)] text-purple-400 border-purple-500/40',
    error:     'bg-[rgba(239,68,68,0.12)] text-red-400 border-red-500/40',
  }
  return `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${map[status] || map.pending}`
}

function TaskLogsPanel({ taskId, onClose }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminGetTaskLogs(taskId)
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [taskId])

  return (
    <div className="mt-2 bg-[#080c12] border border-[#1c2333] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1c2333]">
        <span className="text-[10px] font-bold text-[#4b6080] uppercase tracking-widest">Логи задачи #{taskId}</span>
        <button onClick={onClose} className="text-gray-600 hover:text-red-400 transition-colors"><XCircle size={14} /></button>
      </div>
      {loading ? (
        <p className="px-4 py-3 text-[#4b6080] text-xs">Загрузка...</p>
      ) : logs.length === 0 ? (
        <p className="px-4 py-3 text-[#3d4f6a] text-xs">Логов нет</p>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          {logs.map((l) => (
            <div key={l.id} className={`flex items-start gap-3 px-4 py-2 border-b border-[#1c2333]/40 last:border-0 ${!l.success ? 'bg-[rgba(239,68,68,0.04)]' : ''}`}>
              <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${l.success ? 'bg-cyan-400' : 'bg-red-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">{l.action}</span>
                  <span className="text-[10px] text-[#4b6080]">{l.account_name}</span>
                  <span className="text-[9px] text-[#3d4f6a] ml-auto">{l.created_at ? new Date(l.created_at).toLocaleTimeString() : ''}</span>
                </div>
                <p className={`text-xs mt-0.5 break-all ${l.success ? 'text-gray-400' : 'text-red-400'}`}>{l.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function UserTasksPanel({ userId }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [openLogsFor, setOpenLogsFor] = useState(null)

  useEffect(() => {
    adminGetUserTasks(userId)
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <tr><td colSpan={9} className="px-8 pb-3 text-[#4b6080] text-xs">Загрузка задач...</td></tr>
  if (tasks.length === 0) return <tr><td colSpan={9} className="px-8 pb-3 text-[#3d4f6a] text-xs">Задач нет</td></tr>

  return (
    <>
      {tasks.map((t) => (
        <>
          <tr key={t.id} className="border-b border-[#1c2333]/30 bg-[#080c12]">
            <td className="pl-14 pr-3 py-2" colSpan={2}>
              <div className="flex items-center gap-2">
                <ListChecks size={11} className="text-[#4b6080] flex-shrink-0" />
                <span className="text-[11px] text-gray-400">#{t.id}</span>
                <span className="text-[11px] text-gray-500 truncate max-w-[160px]">{t.template_name || '—'}</span>
              </div>
              <p className="text-[10px] text-[#3d4f6a] mt-0.5 truncate max-w-xs pl-4">{t.post_url || ''}</p>
            </td>
            <td className="px-3 py-2 text-center" colSpan={4}>
              <span className={statusBadge(t.status)}>{t.status}</span>
              {t.error_message && (
                <p className="text-[10px] text-red-400 mt-1 max-w-[240px] truncate">{t.error_message}</p>
              )}
            </td>
            <td className="px-3 py-2 text-[10px] text-[#3d4f6a]">
              {t.progress_current}/{t.progress_total}
            </td>
            <td className="px-3 py-2 text-[10px] text-[#3d4f6a]">
              {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
            </td>
            <td className="px-3 py-2">
              <button
                onClick={() => setOpenLogsFor(openLogsFor === t.id ? null : t.id)}
                className="flex items-center gap-1 text-[10px] text-[#4b6080] hover:text-cyan-400 transition-colors"
              >
                <ScrollText size={11} />
                Логи
                {openLogsFor === t.id ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
            </td>
          </tr>
          {openLogsFor === t.id && (
            <tr key={`logs-${t.id}`} className="bg-[#080c12]">
              <td colSpan={9} className="px-14 pb-3">
                <TaskLogsPanel taskId={t.id} onClose={() => setOpenLogsFor(null)} />
              </td>
            </tr>
          )}
        </>
      ))}
    </>
  )
}

// ── Admin support panel ───────────────────────────────────────────────────────

function formatDateSupport(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function SupportTicketThread({ ticketId, onClose }) {
  const [ticket, setTicket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const bottomRef = useRef(null)

  const load = async () => {
    try {
      const t = await adminGetSupportTicket(ticketId)
      setTicket(t)
    } catch { setErr('Ошибка загрузки') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [ticketId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [ticket?.messages?.length])

  const handleReply = async (e) => {
    e.preventDefault()
    if (!reply.trim()) return
    setSending(true); setErr('')
    try {
      await adminReplySupportTicket(ticketId, reply.trim())
      setReply('')
      await load()
    } catch (ex) { setErr(ex.message || 'Ошибка') }
    finally { setSending(false) }
  }

  const handleStatus = async (status) => {
    try { await adminUpdateSupportTicket(ticketId, status); await load() }
    catch (ex) { setErr(ex.message || 'Ошибка') }
  }

  if (loading) return <p className="p-4 text-xs text-[#4b6080]">Загрузка...</p>

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 bg-[#151b27] border border-[#1c2333] transition-colors">← Назад</button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{ticket?.subject}</p>
          <p className="text-[10px] text-[#4b6080] mt-0.5">{ticket?.user_email || ticket?.user_username} · {formatDateSupport(ticket?.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          {ticket?.status === 'open'
            ? <button onClick={() => handleStatus('closed')} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[rgba(239,68,68,0.10)] border border-red-500/40 text-red-400 hover:bg-[rgba(239,68,68,0.18)] transition-colors"><Lock size={10} className="inline mr-1" />Закрыть</button>
            : <button onClick={() => handleStatus('open')} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[rgba(6,182,212,0.10)] border border-cyan-500/40 text-cyan-400 hover:bg-[rgba(6,182,212,0.18)] transition-colors">Открыть</button>
          }
          <span className={ticket?.status === 'open'
            ? 'text-[10px] px-2 py-0.5 rounded-full bg-cyan-400/15 border border-cyan-500/40 text-cyan-400 font-bold'
            : 'text-[10px] px-2 py-0.5 rounded-full bg-gray-500/20 border border-gray-600/40 text-gray-400 font-bold'
          }>{ticket?.status === 'open' ? 'ОТКРЫТ' : 'ЗАКРЫТ'}</span>
        </div>
      </div>

      {err && <p className="mb-2 text-xs text-red-400">{err}</p>}

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-4" style={{ maxHeight: '380px' }}>
        {ticket?.messages?.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_type === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
              msg.sender_type === 'user'
                ? 'bg-[#151b27] border border-[#1c2333] text-white'
                : 'bg-purple-500/15 border border-purple-500/30 text-white'
            }`}>
              <div className={`text-[10px] font-bold mb-1 uppercase ${msg.sender_type === 'user' ? 'text-cyan-400' : 'text-purple-400'}`}>
                {msg.sender_type === 'user' ? (ticket?.user_email || 'Пользователь') : 'Администратор'}
              </div>
              <p className="whitespace-pre-wrap leading-relaxed text-xs">{msg.text}</p>
              <div className="text-[9px] text-[#3d4f6a] mt-1 text-right">{formatDateSupport(msg.created_at)}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleReply} className="flex gap-2">
        <textarea
          rows={2}
          className="flex-1 bg-[#080c12] border border-[#1c2333] rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60 resize-none"
          placeholder="Ответить пользователю..."
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(e) } }}
        />
        <button
          type="submit"
          disabled={sending || !reply.trim()}
          className="self-end px-3 py-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-40"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  )
}

function SupportAdminPanel() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [filter, setFilter] = useState('all')

  const load = () => {
    setLoading(true)
    adminGetSupportTickets()
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const displayed = tickets.filter(t => filter === 'all' || t.status === filter)

  if (selectedId) {
    return (
      <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl p-5" style={{ boxShadow: '0 0 32px rgba(6,182,212,0.04)' }}>
        <SupportTicketThread ticketId={selectedId} onClose={() => { setSelectedId(null); load() }} />
      </div>
    )
  }

  return (
    <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl overflow-hidden" style={{ boxShadow: '0 0 32px rgba(6,182,212,0.04)' }}>
      <div className="px-5 py-4 border-b border-[#1c2333] flex items-center gap-3">
        <MessageCircle size={15} className="text-purple-400" />
        <span className="text-white font-semibold text-sm">Обращения</span>
        <span className="ml-auto px-2.5 py-0.5 rounded-full bg-[#151b27] border border-[#1c2333] text-gray-500 text-[10px] font-semibold">{tickets.length}</span>
        <div className="flex gap-1">
          {[['all', 'Все'], ['open', 'Открытые'], ['closed', 'Закрытые']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${filter === v ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-[#151b27] border-[#1c2333] text-[#4b6080] hover:text-gray-300'}`}
            >{l}</button>
          ))}
        </div>
      </div>
      {loading ? (
        <p className="p-6 text-[#4b6080] text-sm">Загрузка...</p>
      ) : displayed.length === 0 ? (
        <p className="p-6 text-[#3d4f6a] text-sm">Обращений нет</p>
      ) : (
        <div className="divide-y divide-[#1c2333]/60">
          {displayed.map(t => (
            <div key={t.id} className="flex items-center hover:bg-[#0f1520] transition-colors group">
              <button
                onClick={() => setSelectedId(t.id)}
                className="flex-1 text-left px-5 py-3.5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] text-[#4b6080] font-mono">#{t.id}</span>
                      <span className="text-sm font-medium text-white group-hover:text-cyan-300 transition-colors truncate">{t.subject}</span>
                    </div>
                    <p className="text-[10px] text-[#4b6080]">{t.user_email || t.user_username} · {formatDateSupport(t.updated_at)} · {t.message_count} сообщ.</p>
                  </div>
                  <span className={t.status === 'open'
                    ? 'text-[10px] px-2 py-0.5 rounded-full bg-cyan-400/15 border border-cyan-500/40 text-cyan-400 font-bold flex-shrink-0'
                    : 'text-[10px] px-2 py-0.5 rounded-full bg-gray-500/20 border border-gray-600/40 text-gray-400 font-bold flex-shrink-0'
                  }>{t.status === 'open' ? 'ОТКРЫТ' : 'ЗАКРЫТ'}</span>
                </div>
              </button>
              <button
                onClick={async () => {
                  if (!confirm(`Удалить обращение "${t.subject}"?`)) return
                  try { await adminDeleteSupportTicket(t.id); load() } catch {}
                }}
                className="px-4 py-3.5 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                title="Удалить"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Admin() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [passwordModal, setPasswordModal] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [expandedUser, setExpandedUser] = useState(null)
  const [createModal, setCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', password: '', username: '', is_email_verified: false })
  const [createLoading, setCreateLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('users')

  const load = () => {
    setLoading(true)
    adminGetUsers()
      .then(setList)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleDelete = async (user) => {
    if (!confirm(`Удалить пользователя ${user.email || user.username}? Это действие необратимо.`)) return
    setActionLoading(user.id)
    setError(''); setSuccess('')
    try {
      await adminDeleteUser(user.id)
      setSuccess('Пользователь удалён')
      load()
    } catch (e) { setError(e.message) }
    finally { setActionLoading(null) }
  }

  const handleToggleAdmin = async (user) => {
    setActionLoading(user.id)
    setError(''); setSuccess('')
    try {
      await adminUpdateUser(user.id, { is_admin: !user.is_admin })
      setSuccess(user.is_admin ? 'Права администратора сняты' : 'Права администратора выданы')
      load()
    } catch (e) { setError(e.message) }
    finally { setActionLoading(null) }
  }

  const handleVerifyEmail = async (user) => {
    setActionLoading(user.id)
    setError(''); setSuccess('')
    try {
      await adminUpdateUser(user.id, { is_email_verified: !user.is_email_verified })
      setSuccess(user.is_email_verified ? 'Email помечен как неподтверждённый' : `Email для ${user.email || user.username} подтверждён`)
      load()
    } catch (e) { setError(e.message) }
    finally { setActionLoading(null) }
  }

  const handleToggleSubscription = async (user) => {
    setActionLoading(user.id)
    setError(''); setSuccess('')
    const newSub = (user.subscription || 'free') === 'pro' ? 'free' : 'pro'
    try {
      await adminSetUserSubscription(user.id, newSub)
      setSuccess(newSub === 'pro' ? `Подписка Pro выдана для ${user.email || user.username}` : `Подписка Pro снята`)
      load()
    } catch (e) { setError(e.message) }
    finally { setActionLoading(null) }
  }

  const handleSetPassword = async () => {
    if (!newPassword.trim()) return
    setActionLoading(passwordModal.userId)
    setError(''); setSuccess('')
    try {
      await adminUpdateUser(passwordModal.userId, { new_password: newPassword })
      setSuccess(`Пароль для ${passwordModal.username} изменён`)
      setPasswordModal(null)
      setNewPassword('')
    } catch (e) { setError(e.message) }
    finally { setActionLoading(null) }
  }

  const handleCreateUser = async () => {
    if (!createForm.email.trim() || !createForm.password.trim()) return
    setCreateLoading(true)
    setError(''); setSuccess('')
    try {
      await adminCreateUser({
        email: createForm.email.trim(),
        password: createForm.password,
        username: createForm.username.trim() || undefined,
        is_email_verified: createForm.is_email_verified,
      })
      setSuccess(`Пользователь ${createForm.email} создан`)
      setCreateModal(false)
      setCreateForm({ email: '', password: '', username: '', is_email_verified: false })
      load()
    } catch (e) { setError(e.message) }
    finally { setCreateLoading(false) }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Администрирование</h1>
          <p className="text-base font-semibold text-gray-400 mt-1">Управление пользователями системы</p>
        </div>
        {activeTab === 'users' && (
          <button
            onClick={() => { setCreateModal(true); setError('') }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 to-teal-500 text-white text-xs font-black tracking-widest uppercase hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all"
          >
            <UserPlus size={14} /> Добавить
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-[#1c2333] pb-0">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-widest uppercase border-b-2 transition-colors ${activeTab === 'users' ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-[#4b6080] hover:text-gray-300'}`}
        >
          <Users size={13} /> Пользователи
        </button>
        <button
          onClick={() => setActiveTab('support')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-widest uppercase border-b-2 transition-colors ${activeTab === 'support' ? 'border-purple-400 text-purple-400' : 'border-transparent text-[#4b6080] hover:text-gray-300'}`}
        >
          <MessageCircle size={13} /> Обращения
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-[rgba(239,68,68,0.08)] border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-[rgba(6,182,212,0.08)] border border-cyan-500/30 text-cyan-400 text-sm">
          <CheckCircle size={15} /> {success}
        </div>
      )}

      {/* Create user modal */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2"><UserPlus size={16} className="text-cyan-400" /> Новый пользователь</h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#4b6080] mb-1 block">Email *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                  placeholder="user@example.com"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#4b6080] mb-1 block">Пароль *</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                  placeholder="Минимум 6 символов"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#4b6080] mb-1 block">Имя пользователя (необязательно)</label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm(f => ({ ...f, username: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                  placeholder="Автоматически из email"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setCreateForm(f => ({ ...f, is_email_verified: !f.is_email_verified }))}
                  className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${createForm.is_email_verified ? 'bg-cyan-500' : 'bg-[#1c2333]'}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${createForm.is_email_verified ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
                <span className="text-sm text-gray-400">Email подтверждён</span>
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={handleCreateUser}
                disabled={createLoading || !createForm.email || !createForm.password}
                className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 to-teal-500 text-white text-xs font-black tracking-widest uppercase hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all disabled:opacity-40"
              >
                {createLoading ? 'Создание...' : 'Создать'}
              </button>
              <button
                onClick={() => { setCreateModal(false); setCreateForm({ email: '', password: '', username: '', is_email_verified: false }) }}
                className="px-4 py-2.5 rounded-full border border-[#1c2333] text-gray-500 text-xs font-semibold hover:border-red-500/40 hover:text-red-400 transition-all"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password modal */}
      {passwordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-bold mb-1">Новый пароль</h3>
            <p className="text-xs text-gray-500 mb-4">Пользователь: <span className="text-cyan-400">{passwordModal.username}</span></p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSetPassword()}
              className="w-full px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500 mb-4"
              placeholder="Минимум 6 символов"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSetPassword}
                disabled={actionLoading === passwordModal.userId}
                className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 to-teal-500 text-white text-xs font-black tracking-widest uppercase hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all disabled:opacity-40"
              >
                Сохранить
              </button>
              <button
                onClick={() => { setPasswordModal(null); setNewPassword('') }}
                className="px-4 py-2.5 rounded-full border border-[#1c2333] text-gray-500 text-xs font-semibold hover:border-red-500/40 hover:text-red-400 transition-all"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'support' ? (
        <SupportAdminPanel />
      ) : (
      <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl overflow-hidden" style={{ boxShadow: '0 0 32px rgba(6,182,212,0.04)' }}>
        <div className="px-5 py-4 border-b border-[#1c2333] flex items-center gap-2">
          <Users size={15} className="text-cyan-400" />
          <span className="text-white font-semibold text-sm">Пользователи</span>
          <span className="ml-auto px-2.5 py-0.5 rounded-full bg-[#151b27] border border-[#1c2333] text-gray-500 text-[10px] font-semibold">{list.length}</span>
        </div>

        {loading ? (
          <p className="p-6 text-[#4b6080] text-sm">Загрузка...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-[#1c2333]">
                  <th className="px-3 py-3 text-[10px] font-semibold tracking-widest uppercase text-[#3d4f6a] w-10" />
                  {['Пользователь', 'Email'].map((h) => (
                    <th key={h} className="px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-[#3d4f6a]">{h}</th>
                  ))}
                  {['Аккаунты', 'Прокси', 'Шаблоны', 'Задачи'].map((h) => (
                    <th key={h} className="px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-[#3d4f6a] text-center">{h}</th>
                  ))}
                  {['Статус', 'Действия'].map((h) => (
                    <th key={h} className="px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-[#3d4f6a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <Fragment key={u.id}>
                    <tr className={`border-b border-[#1c2333]/60 transition-colors ${expandedUser === u.id ? 'bg-[#0f1520]' : 'hover:bg-[#0f1520]'}`}>
                      {/* Expand toggle */}
                      <td className="pl-3 py-3">
                        <button
                          onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                          title="Задачи пользователя"
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${expandedUser === u.id ? 'bg-[rgba(6,182,212,0.15)] border-cyan-500/50 text-cyan-400' : 'bg-[#151b27] border-[#1c2333] text-[#4b6080] hover:text-cyan-400 hover:border-cyan-500/40'}`}
                        >
                          {expandedUser === u.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center border ${u.is_admin ? 'bg-[rgba(168,85,247,0.15)] border-purple-500/40' : 'bg-[#1c2333] border-[#2a3a50]'}`}>
                            <Users size={12} className={u.is_admin ? 'text-purple-400' : 'text-cyan-400/70'} />
                          </div>
                          <span className="text-white font-medium">{u.username}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[#4b6080] text-xs">{u.email || '—'}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-cyan-400 font-bold text-xs">{u.accounts_count}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-cyan-400 font-bold text-xs">{u.proxies_count}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-purple-400 font-bold text-xs">{u.templates_count}</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                          className={`font-bold text-xs transition-colors ${expandedUser === u.id ? 'text-cyan-400' : 'text-pink-400 hover:text-cyan-400'}`}
                          title="Показать задачи"
                        >
                          {u.tasks_count}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1">
                          {u.is_admin && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[rgba(168,85,247,0.12)] text-purple-400 border border-purple-500/40">
                              <ShieldCheck size={10} /> Админ
                            </span>
                          )}
                          {(u.subscription || 'free') === 'pro' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/40">
                              <Crown size={10} /> Pro
                            </span>
                          )}
                          <button
                            onClick={() => handleVerifyEmail(u)}
                            disabled={actionLoading === u.id}
                            title={u.is_email_verified ? 'Снять подтверждение email' : 'Подтвердить email'}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all disabled:opacity-40 ${u.is_email_verified ? 'bg-[rgba(6,182,212,0.10)] text-cyan-400 border-cyan-500/30 hover:bg-[rgba(239,68,68,0.08)] hover:text-red-400 hover:border-red-500/30' : 'bg-[rgba(239,68,68,0.10)] text-red-400 border-red-500/30 hover:bg-[rgba(6,182,212,0.08)] hover:text-cyan-400 hover:border-cyan-500/30'}`}
                          >
                            {u.is_email_verified ? <><MailCheck size={10} /> Email ✓</> : <><Mail size={10} /> Email ✗</>}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setPasswordModal({ userId: u.id, username: u.email || u.username }); setNewPassword('') }}
                            disabled={actionLoading === u.id}
                            title="Сменить пароль"
                            className="w-7 h-7 rounded-lg bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-600 hover:text-cyan-400 hover:border-cyan-500/40 transition-all disabled:opacity-40"
                          >
                            <KeyRound size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleSubscription(u)}
                            disabled={actionLoading === u.id}
                            title={(u.subscription || 'free') === 'pro' ? 'Снять Pro подписку' : 'Выдать Pro подписку'}
                            className={`w-7 h-7 rounded-lg bg-[#151b27] border border-[#1c2333] flex items-center justify-center transition-all disabled:opacity-40 ${(u.subscription || 'free') === 'pro' ? 'text-yellow-400 hover:text-red-400 hover:border-red-500/40' : 'text-gray-600 hover:text-yellow-400 hover:border-yellow-500/40'}`}
                          >
                            <Crown size={13} />
                          </button>
                          <button
                            onClick={() => handleToggleAdmin(u)}
                            disabled={actionLoading === u.id}
                            title={u.is_admin ? 'Снять права администратора' : 'Выдать права администратора'}
                            className={`w-7 h-7 rounded-lg bg-[#151b27] border border-[#1c2333] flex items-center justify-center transition-all disabled:opacity-40 ${u.is_admin ? 'text-purple-400 hover:text-red-400 hover:border-red-500/40' : 'text-gray-600 hover:text-purple-400 hover:border-purple-500/40'}`}
                          >
                            {u.is_admin ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                          </button>
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={actionLoading === u.id}
                            title="Удалить пользователя"
                            className="w-7 h-7 rounded-lg bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-600 hover:text-red-400 hover:border-red-500/40 transition-all disabled:opacity-40"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedUser === u.id && (
                      <UserTasksPanel userId={u.id} />
                    )}
                  </Fragment>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-[#3d4f6a] text-sm">Нет пользователей</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
