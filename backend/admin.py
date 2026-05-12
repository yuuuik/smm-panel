import { useState, useEffect, useRef, Fragment } from 'react'
import { 
  adminGetUsers, adminUpdateUser, adminDeleteUser, adminGetUserTasks, 
  adminGetTaskLogs, adminCreateUser, adminGetSupportTickets, 
  adminGetSupportTicket, adminReplySupportTicket, adminUpdateSupportTicket, 
  adminDeleteSupportTicket, adminSetUserSubscription, adminGetUserDetail 
} from './api'
import { 
  Users, ShieldCheck, Trash2, KeyRound, AlertCircle, CheckCircle, 
  ShieldOff, ChevronDown, ChevronRight, ListChecks, ScrollText, 
  XCircle, UserPlus, MailCheck, Mail, MessageCircle, Send, 
  Lock, Crown, Server, Database, Layers, ExternalLink, User, Globe 
} from 'lucide-react'

// Константы для отображения типов действий
const ACTION_LABELS = {
  like: 'Лайк',
  comment: 'Коммент',
  repost: 'Репост',
  subscribe: 'Подписка',
  view: 'Просмотр',
  reaction: 'Реакция'
}

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

// ── Вспомогательные панели ──────────────────────────────────────────────────

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

function UserDetailPanel({ userId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('accounts')
  const [openLogsFor, setOpenLogsFor] = useState(null)
  const [expandedTemplate, setExpandedTemplate] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    adminGetUserDetail(userId)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message || 'Ошибка загрузки'); setLoading(false) })
  }, [userId])

  const tabs = [
    { key: 'accounts',  label: 'Аккаунты',  icon: User,       count: data?.accounts?.length },
    { key: 'proxies',   label: 'Прокси',    icon: Globe,      count: data?.proxies?.length },
    { key: 'templates', label: 'Шаблоны',   icon: Layers,     count: data?.templates?.length },
    { key: 'tasks',     label: 'Задачи',    icon: ListChecks, count: data?.tasks?.length },
  ]

  return (
    <div className="mx-1 mb-4 bg-[#080c12] border border-[#1c2333] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#1c2333] bg-[#0a0f18]">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
        <span className="text-[10px] font-bold text-cyan-400 tracking-[0.2em] uppercase">Детали пользователя</span>
        <button onClick={onClose} className="ml-auto text-gray-600 hover:text-red-400 transition-colors"><XCircle size={14} /></button>
      </div>

      {loading && <p className="px-5 py-8 text-[#4b6080] text-xs text-center">Загрузка...</p>}
      {error && <p className="px-5 py-8 text-red-400 text-xs text-center">{error}</p>}

      {!loading && !error && data && (
        <>
          <div className="flex gap-0 border-b border-[#1c2333]">
            {tabs.map(({ key, label, icon: Icon, count }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-bold tracking-widest uppercase border-b-2 transition-colors ${
                  tab === key ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-[#4b6080] hover:text-gray-300'
                }`}
              >
                <Icon size={11} />
                {label}
                {count !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${tab === key ? 'bg-cyan-500/20 text-cyan-300' : 'bg-[#1c2333] text-[#4b6080]'}`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === 'accounts' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1c2333]/60">
                    {['№', 'Имя аккаунта', 'Прокси', 'Последняя проверка', 'Статус'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[9px] font-semibold uppercase tracking-widest text-[#3d4f6a]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-[#3d4f6a]">Нет аккаунтов</td></tr>
                  ) : data.accounts.map((a, i) => (
                    <tr key={a.id} className="border-b border-[#1c2333]/30 hover:bg-white/[0.01]">
                      <td className="px-4 py-2.5 text-[#3d4f6a] font-mono">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-white">{a.name}</td>
                      <td className="px-4 py-2.5 text-[#4b6080]">{a.proxy_name}</td>
                      <td className="px-4 py-2.5 text-[#4b6080]">{a.last_check ? new Date(a.last_check).toLocaleString() : '—'}</td>
                      <td className="px-4 py-2.5">
                        {a.is_valid === true && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">Активен</span>}
                        {a.is_valid === false && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-400/10 text-red-400 border border-red-400/20">Ошибка</span>}
                        {a.is_valid == null && <span className="text-[#3d4f6a]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'proxies' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#1c2333]/60">
                    {['№', 'Имя', 'IP:Порт', 'Логин', 'URL ротации', 'Задержка'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[9px] font-semibold uppercase tracking-widest text-[#3d4f6a]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.proxies.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-[#3d4f6a]">Нет прокси</td></tr>
                  ) : data.proxies.map((p, i) => (
                    <tr key={p.id} className="border-b border-[#1c2333]/30 hover:bg-white/[0.01]">
                      <td className="px-4 py-2.5 text-[#3d4f6a] font-mono">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-white">{p.name}</td>
                      <td className="px-4 py-2.5 font-mono text-gray-300">{p.ip}:{p.port}</td>
                      <td className="px-4 py-2.5 text-[#4b6080]">{p.login || '—'}</td>
                      <td className="px-4 py-2.5 text-[#4b6080] font-mono truncate max-w-[160px]">{p.rotate_url || '—'}</td>
                      <td className="px-4 py-2.5 text-[#4b6080]">{p.rotate_delay}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'templates' && (
            <div className="divide-y divide-[#1c2333]/40">
              {data.templates.length === 0 ? (
                <p className="px-5 py-6 text-center text-[#3d4f6a] text-xs">Нет шаблонов</p>
              ) : data.templates.map((t, i) => (
                <div key={t.id}>
                  <button
                    onClick={() => setExpandedTemplate(expandedTemplate === t.id ? null : t.id)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/[0.01] text-left transition-colors"
                  >
                    <span className="text-[10px] font-mono text-[#3d4f6a] w-5">{i + 1}</span>
                    <span className="font-semibold text-white text-xs flex-1">{t.name}</span>
                    <div className="flex items-center gap-2 text-[9px] text-[#4b6080]">
                      <span className="px-2 py-0.5 rounded bg-[#1c2333]">{t.actions.length} действий</span>
                      <span className="px-2 py-0.5 rounded bg-[#1c2333]">{t.accounts.length} аккаунтов</span>
                      {t.reaction_type && <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">{t.reaction_type}</span>}
                    </div>
                    {expandedTemplate === t.id ? <ChevronDown size={12} className="text-[#4b6080] flex-shrink-0" /> : <ChevronRight size={12} className="text-[#4b6080] flex-shrink-0" />}
                  </button>
                  {expandedTemplate === t.id && (
                    <div className="px-5 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#0a0f18] border border-[#1c2333] rounded-xl p-4">
                        <p className="text-[9px] font-bold text-[#3d4f6a] uppercase tracking-widest mb-3">Основные настройки</p>
                        <div className="space-y-2 text-xs">
                          {t.reaction_type && <div className="flex gap-2"><span className="text-[#4b6080] w-28">Реакция:</span><span className="text-white">{t.reaction_type}</span></div>}
                          {t.comment_text && <div className="flex gap-2"><span className="text-[#4b6080] w-28">Текст коммента:</span><span className="text-white break-all">{t.comment_text}</span></div>}
                          {t.reply_text && <div className="flex gap-2"><span className="text-[#4b6080] w-28">Текст ответа:</span><span className="text-white break-all">{t.reply_text}</span></div>}
                          <div className="flex gap-2"><span className="text-[#4b6080] w-28">Задержка:</span><span className="text-white">{t.delay_min}–{t.delay_max}с</span></div>
                        </div>
                        {t.accounts.length > 0 && (
                          <>
                            <p className="text-[9px] font-bold text-[#3d4f6a] uppercase tracking-widest mt-4 mb-2">Аккаунты ({t.accounts.length})</p>
                            <div className="flex flex-wrap gap-1.5">
                              {t.accounts.map(a => (
                                <span key={a.id} className="px-2 py-0.5 rounded-full text-[10px] bg-[#1c2333] text-gray-300 border border-[#2a3a50]">{a.name}</span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="bg-[#0a0f18] border border-[#1c2333] rounded-xl p-4">
                        <p className="text-[9px] font-bold text-[#3d4f6a] uppercase tracking-widest mb-3">Действия ({t.actions.length})</p>
                        {t.actions.length === 0 ? (
                          <p className="text-[#3d4f6a] text-xs">Нет действий</p>
                        ) : (
                          <div className="space-y-2">
                            {t.actions.map((act, ai) => (
                              <div key={ai} className="flex items-start gap-2.5 text-xs">
                                <span className="w-5 h-5 rounded flex-shrink-0 bg-[#1c2333] flex items-center justify-center text-[9px] font-bold text-[#4b6080]">{act.order}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-cyan-400 font-bold uppercase text-[9px]">{ACTION_LABELS[act.action_type] || act.action_type}</span>
                                    {act.reaction_type && <span className="text-purple-400 text-[9px]">· {act.reaction_type}</span>}
                                    {act.account_name && <span className="text-[#4b6080] text-[9px]">· {act.account_name}</span>}
                                    <span className="text-[#3d4f6a] text-[9px] ml-auto">{act.delay}с</span>
                                  </div>
                                  {act.text && <p className="text-gray-400 mt-0.5 break-all leading-relaxed">{act.text}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'tasks' && (
            <div className="divide-y divide-[#1c2333]/40">
              {data.tasks.length === 0 ? (
                <p className="px-5 py-6 text-center text-[#3d4f6a] text-xs">Нет задач</p>
              ) : data.tasks.map((t) => (
                <div key={t.id}>
                  <div className="flex items-start gap-3 px-5 py-3 hover:bg-white/[0.01] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-[10px] font-mono text-[#3d4f6a]">#{t.id}</span>
                        <span className="text-xs font-semibold text-white">{t.template_name || '—'}</span>
                        <span className={statusBadge(t.status)}>{t.status}</span>
                        <span className="text-[10px] text-[#4b6080] ml-auto">{t.created_at ? new Date(t.created_at).toLocaleString() : '—'}</span>
                      </div>
                      {(t.progress_total > 0) && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="h-1 flex-1 bg-[#1c2333] rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full"
                              style={{ width: `${Math.round((t.progress_current / t.progress_total) * 100)}%` }} />
                          </div>
                          <span className="text-[9px] text-[#4b6080] font-mono">{t.progress_current}/{t.progress_total}</span>
                        </div>
                      )}
                      {t.post_urls && t.post_urls.length > 0 && (
                        <div className="flex flex-col gap-0.5">
                          {t.post_urls.map((url, ui) => (
                            <a key={ui} href={url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[10px] text-cyan-500/70 hover:text-cyan-400 transition-colors truncate">
                              <ExternalLink size={9} className="flex-shrink-0" />
                              <span className="truncate">{url}</span>
                            </a>
                          ))}
                        </div>
                      )}
                      {t.error_message && <p className="text-[10px] text-red-400 mt-1">{t.error_message}</p>}
                    </div>
                    <button
                      onClick={() => setOpenLogsFor(openLogsFor === t.id ? null : t.id)}
                      className="flex items-center gap-1 text-[9px] text-[#4b6080] hover:text-cyan-400 flex-shrink-0 transition-colors mt-0.5"
                    >
                      <ScrollText size={11} />
                      Логи
                      {openLogsFor === t.id ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </button>
                  </div>
                  {openLogsFor === t.id && (
                    <div className="px-5 pb-3">
                      <TaskLogsPanel taskId={t.id} onClose={() => setOpenLogsFor(null)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
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

// ── Main Admin Component ─────────────────────────────────────────────────────

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

  const handleCreateUser = async (e) => {
    e.preventDefault()
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ShieldCheck className="text-cyan-400" /> Админ-панель
        </h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-[#151b27] text-gray-500 border border-[#1c2333]'}`}
          >Пользователи</button>
          <button 
            onClick={() => setActiveTab('support')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'support' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' : 'bg-[#151b27] text-gray-500 border border-[#1c2333]'}`}
          >Поддержка</button>
        </div>
      </div>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">{success}</div>}

      {activeTab === 'users' ? (
        <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[#1c2333] flex justify-between items-center">
             <span className="text-white font-semibold">Список пользователей</span>
             <button onClick={() => setCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl transition-colors">
               <UserPlus size={14} /> Создать пользователя
             </button>
          </div>
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[#151b27]/50 text-gray-500 text-[10px] uppercase tracking-widest font-bold">
                <th className="px-6 py-4">Пользователь</th>
                <th className="px-6 py-4">Статус</th>
                <th className="px-6 py-4">Подписка</th>
                <th className="px-6 py-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {list.map(user => (
                <Fragment key={user.id}>
                  <tr className={`border-t border-[#1c2333] hover:bg-white/[0.02] transition-colors ${expandedUser === user.id ? 'bg-white/[0.03]' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">{user.email || user.username}</span>
                        <span className="text-[10px] text-gray-600 font-mono">ID: {user.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {user.is_admin && <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[9px] font-bold">ADMIN</span>}
                        {user.is_email_verified ? <CheckCircle size={14} className="text-green-500" /> : <AlertCircle size={14} className="text-gray-600" />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${user.subscription === 'pro' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'}`}>
                         {user.subscription?.toUpperCase() || 'FREE'}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)} className="p-2 text-gray-500 hover:text-cyan-400 transition-colors">
                          <Layers size={16} />
                        </button>
                        <button onClick={() => handleToggleAdmin(user)} className={`p-2 transition-colors ${user.is_admin ? 'text-purple-400 hover:text-gray-400' : 'text-gray-500 hover:text-purple-400'}`}>
                          <ShieldCheck size={16} />
                        </button>
                        <button onClick={() => handleDelete(user)} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedUser === user.id && (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 bg-[#0a0f18]">
                        <UserDetailPanel userId={user.id} onClose={() => setExpandedUser(null)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <SupportAdminPanel />
      )}

      {/* Модалка создания пользователя */}
      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-6">Новый пользователь</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <input 
                type="email" placeholder="Email" required
                className="w-full bg-[#080c12] border border-[#1c2333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})}
              />
              <input 
                type="text" placeholder="Username (опционально)"
                className="w-full bg-[#080c12] border border-[#1c2333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                value={createForm.username} onChange={e => setCreateForm({...createForm, username: e.target.value})}
              />
              <input 
                type="password" placeholder="Пароль" required
                className="w-full bg-[#080c12] border border-[#1c2333] rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})}
              />
              <div className="flex items-center gap-3 px-1">
                <input 
                  type="checkbox" id="v_mail"
                  checked={createForm.is_email_verified} onChange={e => setCreateForm({...createForm, is_email_verified: e.target.checked})}
                />
                <label htmlFor="v_mail" className="text-sm text-gray-400">Email подтвержден</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setCreateModal(false)} className="flex-1 px-4 py-3 rounded-xl bg-[#1c2333] text-white font-bold text-sm">Отмена</button>
                <button type="submit" disabled={createLoading} className="flex-1 px-4 py-3 rounded-xl bg-cyan-600 text-white font-bold text-sm hover:bg-cyan-500 disabled:opacity-50">
                  {createLoading ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
