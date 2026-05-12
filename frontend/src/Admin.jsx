import { useState, useEffect, Fragment } from 'react'
import {
  adminGetUsers, adminUpdateUser, adminDeleteUser,
  adminGetTaskLogs, adminCreateUser,
  adminGetSupportTickets, adminGetSupportTicket,
  adminReplySupportTicket, adminUpdateSupportTicket,
  adminDeleteSupportTicket, adminGetUserDetail,
  adminSetUserSubscription,
} from './api'
import {
  ShieldCheck, Trash2, CheckCircle, ChevronDown, ChevronRight,
  ListChecks, ScrollText, XCircle, UserPlus, Send, Layers,
  ExternalLink, User, Globe, MessageSquare, Crown, ShieldOff,
  Shield, BadgeCheck, CalendarPlus, CalendarX, RefreshCw,
  Clock, AlertTriangle, CheckCheck, Lock
} from 'lucide-react'

// ─── helpers ────────────────────────────────────────────────────────────────

const ACTION_LABELS = {
  react_post:     'Реакция на пост',
  comment_post:   'Комментарий к посту',
  reply_comment:  'Ответ на комментарий',
  react_comment:  'Реакция на комментарий',
  like:           'Лайк',
  comment:        'Комментарий',
  repost:         'Репост',
  subscribe:      'Подписка',
  reaction:       'Реакция',
}

const REACTION_EMOJI = {
  LIKE: '👍', LOVE: '❤️', HAHA: '😂', WOW: '😮', SAD: '😢', ANGRY: '😡',
}

function statusBadge(status) {
  const map = {
    running:   'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    completed: 'bg-green-500/10 text-green-400 border-green-500/20',
    failed:    'bg-red-500/10 text-red-400 border-red-500/20',
    error:     'bg-red-500/10 text-red-400 border-red-500/20',
    stopped:   'bg-gray-500/10 text-gray-400 border-gray-500/20',
    pending:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
  }
  return `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${map[status] || 'bg-gray-500/10 text-gray-400'}`
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── Task Logs Panel ─────────────────────────────────────────────────────────

function TaskLogsPanel({ taskId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminGetTaskLogs(taskId).then(setLogs).catch(() => {}).finally(() => setLoading(false))
  }, [taskId])

  if (loading) return <div className="p-4 text-[10px] text-gray-500 animate-pulse">Загрузка логов...</div>

  return (
    <div className="mt-2 bg-black/40 border border-white/5 rounded-lg overflow-hidden">
      <div className="bg-white/5 px-3 py-1.5 flex items-center justify-between">
        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Логи выполнения</span>
        <span className="text-[9px] text-gray-600">{logs.length} записей</span>
      </div>
      <div className="max-h-52 overflow-y-auto p-2 space-y-0.5 font-mono">
        {logs.length === 0
          ? <p className="text-[10px] text-gray-700 p-2">Логов пока нет</p>
          : logs.map(l => (
            <div key={l.id} className="text-[10px] flex gap-2 items-start py-0.5 border-b border-white/[0.02]">
              <span className={`shrink-0 font-bold ${l.success ? 'text-green-500' : 'text-red-500'}`}>
                {l.success ? '✓' : '✗'}
              </span>
              <span className="text-gray-600 shrink-0">[{l.action}]</span>
              <span className="text-gray-500 shrink-0">{l.account_name}</span>
              <span className="text-gray-300">{l.message}</span>
              <span className="text-gray-700 shrink-0 ml-auto">{fmtDate(l.created_at)}</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ─── User Detail Panel ────────────────────────────────────────────────────────

function UserDetailPanel({ userId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('accounts')
  const [expandedId, setExpandedId] = useState(null)

  const load = () => {
    setLoading(true)
    setError('')
    adminGetUserDetail(userId)
      .then(res => {
        if (typeof res === 'string' && res.includes('<!DOCTYPE')) {
          throw new Error('Сервер вернул HTML — проверь путь к API')
        }
        setData(res)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [userId])

  if (loading) return (
    <div className="p-10 text-center text-cyan-500 text-xs animate-pulse">
      Загрузка данных пользователя...
    </div>
  )
  if (error) return (
    <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-xl">
      <p className="text-red-400 text-xs font-mono mb-2">Ошибка:</p>
      <p className="text-red-500 text-[10px] bg-black/30 p-2 rounded font-mono">{error}</p>
      <div className="flex gap-2 mt-4">
        <button onClick={load} className="text-[10px] text-cyan-500 underline flex items-center gap-1"><RefreshCw size={10} /> Повторить</button>
        <button onClick={onClose} className="text-[10px] text-gray-500 underline">Закрыть</button>
      </div>
    </div>
  )

  const tabs = [
    { id: 'accounts',  label: 'Аккаунты',  icon: User,       count: data?.accounts?.length  || 0 },
    { id: 'proxies',   label: 'Прокси',    icon: Globe,      count: data?.proxies?.length   || 0 },
    { id: 'templates', label: 'Шаблоны',   icon: Layers,     count: data?.templates?.length || 0 },
    { id: 'tasks',     label: 'Задачи',    icon: ListChecks, count: data?.tasks?.length     || 0 },
  ]

  return (
    <div className="bg-[#05070a] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
      {/* Tabs */}
      <div className="flex items-center bg-white/5 border-b border-white/5 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setExpandedId(null) }}
            className={`px-5 py-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all
              ${activeTab === tab.id ? 'bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-500' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <tab.icon size={12} /> {tab.label}
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black
              ${activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-600'}`}>
              {tab.count}
            </span>
          </button>
        ))}
        <button onClick={onClose} className="ml-auto px-4 text-gray-600 hover:text-red-500 transition-colors">
          <XCircle size={16} />
        </button>
      </div>

      <div className="p-4">

        {/* ── АККАУНТЫ ── */}
        {activeTab === 'accounts' && (
          data?.accounts?.length === 0
            ? <Empty text="Нет аккаунтов" />
            : <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.accounts.map(acc => (
                  <div key={acc.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between items-center gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{acc.name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Прокси: <span className="text-gray-400">{acc.proxy_name}</span>
                      </p>
                      {acc.last_check && (
                        <p className="text-[9px] text-gray-600">Проверен: {fmtDate(acc.last_check)}</p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {acc.is_valid === null
                        ? <span className="text-[9px] font-black text-gray-500">НЕ ПРОВЕРЕН</span>
                        : acc.is_valid
                          ? <span className="text-[9px] font-black text-green-500">✓ VALID</span>
                          : <span className="text-[9px] font-black text-red-500">✗ ERROR</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
        )}

        {/* ── ПРОКСИ ── */}
        {activeTab === 'proxies' && (
          data?.proxies?.length === 0
            ? <Empty text="Нет прокси" />
            : <div className="space-y-2">
                {data.proxies.map(p => (
                  <div key={p.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-4">
                    <Globe size={16} className="text-gray-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white">{p.name}</p>
                      <p className="text-[10px] font-mono text-gray-400">{p.ip}:{p.port}</p>
                      {p.login && <p className="text-[9px] text-gray-600">Логин: {p.login}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {p.rotate_url
                        ? <p className="text-[9px] text-cyan-500">Ротация: {p.rotate_delay}с</p>
                        : <p className="text-[9px] text-gray-600">Без ротации</p>
                      }
                    </div>
                  </div>
                ))}
              </div>
        )}

        {/* ── ШАБЛОНЫ ── */}
        {activeTab === 'templates' && (
          data?.templates?.length === 0
            ? <Empty text="Нет шаблонов" />
            : <div className="space-y-2">
                {data.templates.map(tpl => (
                  <div key={tpl.id} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedId(expandedId === tpl.id ? null : tpl.id)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Layers size={14} className="text-cyan-500 shrink-0" />
                        <span className="text-xs font-bold text-white">{tpl.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] text-gray-500">{tpl.actions?.length || 0} действий</span>
                        <span className="text-[10px] text-gray-600">{fmtDate(tpl.created_at)}</span>
                        {expandedId === tpl.id ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                      </div>
                    </button>

                    {expandedId === tpl.id && (
                      <div className="px-4 pb-4 pt-3 border-t border-white/5 bg-black/20 space-y-4">
                        {/* Параметры шаблона */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <InfoBlock label="Тип реакции" value={
                            tpl.reaction_type
                              ? <span>{REACTION_EMOJI[tpl.reaction_type] || ''} {tpl.reaction_type}</span>
                              : <span className="text-gray-600">Нет</span>
                          } />
                          <InfoBlock label="Задержка" value={`${tpl.delay_min}–${tpl.delay_max} сек`} />
                          <InfoBlock label="Аккаунтов" value={tpl.accounts?.length || 0} />
                          <InfoBlock label="Действий" value={tpl.actions?.length || 0} />
                        </div>

                        {/* Тексты */}
                        {tpl.comment_text && (
                          <div>
                            <p className="text-[9px] text-gray-600 uppercase font-bold mb-1">Текст комментария:</p>
                            <div className="p-2 bg-black/40 rounded text-[11px] text-gray-300 italic">"{tpl.comment_text}"</div>
                          </div>
                        )}
                        {tpl.reply_text && (
                          <div>
                            <p className="text-[9px] text-gray-600 uppercase font-bold mb-1">Текст ответа:</p>
                            <div className="p-2 bg-black/40 rounded text-[11px] text-gray-300 italic">"{tpl.reply_text}"</div>
                          </div>
                        )}

                        {/* Очередь действий */}
                        {tpl.actions?.length > 0 && (
                          <div>
                            <p className="text-[9px] text-gray-600 uppercase font-bold mb-2">Очередь действий:</p>
                            <div className="space-y-1.5">
                              {tpl.actions.map((act, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-2 bg-black/30 rounded-lg border border-white/5">
                                  <span className="text-[9px] font-black text-gray-600 shrink-0 w-5 text-center">{act.order}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[10px] font-bold text-cyan-400">
                                        {ACTION_LABELS[act.action_type] || act.action_type}
                                      </span>
                                      {act.reaction_type && (
                                        <span className="text-[10px] text-purple-400">
                                          {REACTION_EMOJI[act.reaction_type]} {act.reaction_type}
                                        </span>
                                      )}
                                      {act.account_name && (
                                        <span className="text-[9px] text-gray-500">акк: <span className="text-gray-400">{act.account_name}</span></span>
                                      )}
                                      <span className="text-[9px] text-gray-600 ml-auto">⏱ {act.delay}с</span>
                                    </div>
                                    {act.text && (
                                      <p className="text-[10px] text-gray-400 mt-0.5 italic truncate">"{act.text}"</p>
                                    )}
                                    {act.target_comment && (
                                      <p className="text-[9px] text-gray-600 mt-0.5">Таргет: {act.target_comment}</p>
                                    )}
                                    {act.image_path && (
                                      <p className="text-[9px] text-gray-600 mt-0.5">📎 {act.image_path}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
        )}

        {/* ── ЗАДАЧИ ── */}
        {activeTab === 'tasks' && (
          data?.tasks?.length === 0
            ? <Empty text="Нет задач" />
            : <div className="space-y-3">
                {data.tasks.map(task => (
                  <div key={task.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                    {/* Шапка задачи */}
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">
                            {task.template_name || <span className="text-gray-600 italic">Шаблон удалён</span>}
                          </span>
                          <span className={statusBadge(task.status)}>{task.status}</span>
                          <span className="text-[9px] text-gray-600">#{task.id}</span>
                        </div>
                        <p className="text-[9px] text-gray-600 mt-1">
                          Создана: {fmtDate(task.created_at)}
                          {task.finished_at && <> · Завершена: {fmtDate(task.finished_at)}</>}
                        </p>
                        {task.error_message && (
                          <p className="text-[10px] text-red-400 mt-1 bg-red-500/5 px-2 py-1 rounded">
                            ⚠ {task.error_message}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[9px] text-gray-600">Прогресс</p>
                        <p className="text-sm font-mono font-black text-cyan-400">
                          {task.progress_current}<span className="text-gray-600">/{task.progress_total}</span>
                        </p>
                      </div>
                    </div>

                    {/* Ссылки на посты */}
                    {task.post_urls?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[9px] text-gray-600 uppercase font-bold mb-1.5">
                          Целевые ссылки ({task.post_urls.length}):
                        </p>
                        <div className="space-y-1">
                          {task.post_urls.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 text-[10px] text-cyan-500 hover:text-cyan-300 bg-cyan-500/5 border border-cyan-500/10 px-2 py-1 rounded transition-colors"
                            >
                              <ExternalLink size={10} className="shrink-0" />
                              <span className="truncate">{url}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Прогресс бар */}
                    {task.progress_total > 0 && (
                      <div className="mb-3 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (task.progress_current / task.progress_total) * 100)}%` }}
                        />
                      </div>
                    )}

                    {/* Кнопка логов */}
                    <button
                      onClick={() => setExpandedId(expandedId === `task-${task.id}` ? null : `task-${task.id}`)}
                      className="text-[10px] font-bold text-gray-500 hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                      <ScrollText size={12} />
                      {expandedId === `task-${task.id}` ? 'Скрыть логи' : 'Показать логи'}
                    </button>
                    {expandedId === `task-${task.id}` && <TaskLogsPanel taskId={task.id} />}
                  </div>
                ))}
              </div>
        )}

      </div>
    </div>
  )
}

// ─── User Row Actions Modal ──────────────────────────────────────────────────

function UserActionsModal({ user, onClose, onRefresh }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [subDays, setSubDays] = useState(30)

  const act = async (fn, label) => {
    setLoading(true); setMsg(''); setErr('')
    try {
      await fn()
      setMsg(`✓ ${label}`)
      onRefresh()
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-white">{user.email || user.username}</p>
            <p className="text-[9px] text-gray-600 font-mono">UID: {user.id}</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white"><XCircle size={18} /></button>
        </div>

        <div className="p-5 space-y-3">

          {/* Статус сообщения */}
          {msg && <p className="text-[11px] text-green-400 bg-green-500/5 border border-green-500/10 px-3 py-2 rounded-lg">{msg}</p>}
          {err && <p className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/10 px-3 py-2 rounded-lg">⚠ {err}</p>}

          {/* Права администратора */}
          <Section label="Права администратора">
            {user.is_admin
              ? <ActionBtn icon={<ShieldOff size={13} />} label="Снять права админа" color="red"
                  disabled={loading}
                  onClick={() => act(() => adminUpdateUser(user.id, { is_admin: false }), 'Права сняты')} />
              : <ActionBtn icon={<Shield size={13} />} label="Выдать права админа" color="purple"
                  disabled={loading}
                  onClick={() => act(() => adminUpdateUser(user.id, { is_admin: true }), 'Права выданы')} />
            }
          </Section>

          {/* Верификация email */}
          <Section label="Email верификация">
            {user.is_email_verified
              ? <ActionBtn icon={<XCircle size={13} />} label="Снять верификацию" color="gray"
                  disabled={loading}
                  onClick={() => act(() => adminUpdateUser(user.id, { is_email_verified: false }), 'Верификация снята')} />
              : <ActionBtn icon={<BadgeCheck size={13} />} label="Верифицировать email" color="green"
                  disabled={loading}
                  onClick={() => act(() => adminUpdateUser(user.id, { is_email_verified: true }), 'Email верифицирован')} />
            }
          </Section>

          {/* Подписка */}
          <Section label="Управление подпиской">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-gray-400">Дней:</span>
              <input
                type="number"
                min={1}
                max={3650}
                value={subDays}
                onChange={e => setSubDays(Number(e.target.value))}
                className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-[11px] text-white text-center focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex gap-2">
              <ActionBtn icon={<CalendarPlus size={13} />} label={`Выдать PRO на ${subDays}д`} color="amber"
                disabled={loading}
                onClick={() => act(
                  () => adminSetUserSubscription(user.id, 'pro', null, subDays),
                  `PRO выдан на ${subDays} дней`
                )} />
              {user.subscription === 'pro' &&
                <ActionBtn icon={<CalendarX size={13} />} label="Забрать подписку" color="red"
                  disabled={loading}
                  onClick={() => act(() => adminSetUserSubscription(user.id, 'free'), 'Подписка снята')} />
              }
            </div>
          </Section>

          {/* Опасная зона */}
          <Section label="Опасная зона">
            <ActionBtn icon={<Trash2 size={13} />} label="Удалить пользователя" color="red"
              disabled={loading}
              onClick={() => act(async () => {
                if (!window.confirm(`Удалить ${user.email || user.username}? Это необратимо.`)) throw new Error('Отменено')
                await adminDeleteUser(user.id)
                onClose()
              }, 'Удалён')} />
          </Section>

        </div>
      </div>
    </div>
  )
}

// ─── Support Panel ────────────────────────────────────────────────────────────

function SupportPanel() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)

  const loadTickets = () => {
    setLoading(true)
    adminGetSupportTickets().then(setTickets).finally(() => setLoading(false))
  }

  useEffect(loadTickets, [])

  const openTicket = (id) => {
    setSelected(id)
    setDetail(null)
    adminGetSupportTicket(id).then(setDetail)
  }

  const sendReply = async () => {
    if (!replyText.trim() || !selected) return
    setSending(true)
    try {
      await adminReplySupportTicket(selected, replyText.trim())
      setReplyText('')
      const updated = await adminGetSupportTicket(selected)
      setDetail(updated)
      loadTickets()
    } finally {
      setSending(false)
    }
  }

  const toggleStatus = async (id, currentStatus) => {
    await adminUpdateSupportTicket(id, currentStatus === 'open' ? 'closed' : 'open')
    loadTickets()
    if (selected === id) {
      const updated = await adminGetSupportTicket(id)
      setDetail(updated)
    }
  }

  const deleteTicket = async (id) => {
    if (!window.confirm('Удалить обращение?')) return
    await adminDeleteSupportTicket(id)
    if (selected === id) setSelected(null)
    loadTickets()
  }

  if (loading) return <div className="p-20 text-center text-cyan-500 text-xs animate-pulse">Загрузка обращений...</div>

  return (
    <div className="flex gap-4 h-[600px]">
      {/* Список тикетов */}
      <div className="w-72 shrink-0 bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Обращения</span>
          <span className="text-[9px] text-gray-600">{tickets.length}</span>
        </div>
        <div className="overflow-y-auto flex-1">
          {tickets.length === 0
            ? <p className="text-[11px] text-gray-600 p-6 text-center">Нет обращений</p>
            : tickets.map(t => (
              <button
                key={t.id}
                onClick={() => openTicket(t.id)}
                className={`w-full text-left px-4 py-3 border-b border-white/[0.03] hover:bg-white/5 transition-colors
                  ${selected === t.id ? 'bg-cyan-500/5 border-l-2 border-l-cyan-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-bold text-white truncate">{t.subject}</p>
                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded shrink-0
                    ${t.status === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-500'}`}>
                    {t.status === 'open' ? 'ОТКРЫТ' : 'ЗАКРЫТ'}
                  </span>
                </div>
                <p className="text-[9px] text-gray-600 mt-0.5">{t.user_email || t.user_username}</p>
                <p className="text-[9px] text-gray-700 mt-0.5">{fmtDate(t.updated_at)} · {t.message_count} сообщ.</p>
              </button>
            ))
          }
        </div>
      </div>

      {/* Детали тикета */}
      <div className="flex-1 bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-600 text-xs">
            Выберите обращение
          </div>
        ) : !detail ? (
          <div className="flex-1 flex items-center justify-center text-cyan-500 text-xs animate-pulse">
            Загрузка...
          </div>
        ) : (
          <>
            {/* Шапка тикета */}
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{detail.subject}</p>
                <p className="text-[10px] text-gray-500">{detail.user_email || detail.user_username} · {fmtDate(detail.created_at)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleStatus(detail.id, detail.status)}
                  className={`text-[9px] font-black px-3 py-1.5 rounded-lg transition-all
                    ${detail.status === 'open'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                      : 'bg-gray-500/10 text-gray-400 border border-gray-500/20 hover:bg-gray-500/20'}`}
                >
                  {detail.status === 'open' ? 'ЗАКРЫТЬ' : 'ОТКРЫТЬ'}
                </button>
                <button onClick={() => deleteTicket(detail.id)} className="p-1.5 text-gray-600 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Сообщения */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {detail.messages?.map(m => (
                <div key={m.id} className={`flex ${m.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-[11px]
                    ${m.sender_type === 'admin'
                      ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-100'
                      : 'bg-white/5 border border-white/5 text-gray-300'}`}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    <p className={`text-[9px] mt-1 ${m.sender_type === 'admin' ? 'text-cyan-700' : 'text-gray-600'}`}>
                      {m.sender_type === 'admin' ? 'Админ' : 'Пользователь'} · {fmtDate(m.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Поле ответа */}
            {detail.status === 'open' && (
              <div className="px-4 py-3 border-t border-white/5 flex gap-3">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) sendReply() }}
                  placeholder="Ответ... (Ctrl+Enter для отправки)"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 resize-none"
                  rows={2}
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !replyText.trim()}
                  className="px-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-white rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
                >
                  <Send size={14} /> Отправить
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Small helpers ───────────────────────────────────────────────────────────

function Empty({ text }) {
  return <p className="text-center text-gray-600 text-xs py-10">{text}</p>
}

function InfoBlock({ label, value }) {
  return (
    <div>
      <p className="text-[9px] text-gray-600 uppercase font-bold mb-1">{label}</p>
      <p className="text-[11px] text-white">{value}</p>
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <p className="text-[9px] text-gray-600 uppercase font-bold tracking-widest mb-2">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function ActionBtn({ icon, label, color, onClick, disabled }) {
  const colors = {
    red:    'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20',
    green:  'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20',
    amber:  'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20',
    gray:   'bg-gray-500/10 border-gray-500/20 text-gray-400 hover:bg-gray-500/20',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all disabled:opacity-40 ${colors[color]}`}
    >
      {icon} {label}
    </button>
  )
}

// ─── Create User Modal ────────────────────────────────────────────────────────

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ email: '', password: '', username: '', is_email_verified: false })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setLoading(true); setErr('')
    try {
      await adminCreateUser(form)
      onCreated()
      onClose()
    } catch (e) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-black text-white">Создать пользователя</span>
          <button onClick={onClose} className="text-gray-600 hover:text-white"><XCircle size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          {err && <p className="text-[11px] text-red-400 bg-red-500/5 border border-red-500/10 px-3 py-2 rounded-lg">⚠ {err}</p>}
          <Field label="Email" type="email" value={form.email} onChange={v => setForm(p => ({...p, email: v}))} />
          <Field label="Пароль" type="password" value={form.password} onChange={v => setForm(p => ({...p, password: v}))} />
          <Field label="Username (опционально)" value={form.username} onChange={v => setForm(p => ({...p, username: v}))} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_email_verified} onChange={e => setForm(p => ({...p, is_email_verified: e.target.checked}))}
              className="accent-cyan-500" />
            <span className="text-[11px] text-gray-400">Email уже верифицирован</span>
          </label>
          <button onClick={submit} disabled={loading || !form.email || !form.password}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-white text-xs font-black py-3 rounded-xl transition-all">
            {loading ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, type = 'text', value, onChange }) {
  return (
    <div>
      <p className="text-[9px] text-gray-600 uppercase font-bold mb-1">{label}</p>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
      />
    </div>
  )
}

// ─── MAIN ADMIN ───────────────────────────────────────────────────────────────

export default function Admin() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('users')
  const [expandedUser, setExpandedUser] = useState(null)
  const [actionsUser, setActionsUser] = useState(null)
  const [createModal, setCreateModal] = useState(false)

  const load = () => {
    setLoading(true)
    adminGetUsers().then(setUsers).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openCount = tickets => tickets?.filter(t => t.status === 'open').length || 0

  return (
    <div className="min-h-screen bg-[#020408] text-gray-300 p-6 font-sans">
      {/* Шапка */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black text-white flex items-center gap-3">
          <ShieldCheck className="text-cyan-500" size={32} /> ADMIN PANEL
        </h1>
        <div className="flex bg-[#0d1117] p-1.5 rounded-2xl border border-white/5">
          <button onClick={() => setActiveTab('users')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'users' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-gray-500 hover:text-white'}`}>
            ПОЛЬЗОВАТЕЛИ
          </button>
          <button onClick={() => setActiveTab('support')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'support' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-500 hover:text-white'}`}>
            ПОДДЕРЖКА
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">

        {/* ── ПОЛЬЗОВАТЕЛИ ── */}
        {activeTab === 'users' && (
          <div className="bg-[#0d1117] border border-white/5 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
              <div>
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500">База пользователей</h2>
                <p className="text-[10px] text-gray-700 mt-0.5">{users.length} пользователей</p>
              </div>
              <button onClick={() => setCreateModal(true)}
                className="bg-cyan-500 hover:bg-cyan-400 text-white text-[10px] font-black px-6 py-3 rounded-xl transition-all shadow-lg shadow-cyan-500/10 flex items-center gap-2">
                <UserPlus size={14} /> ДОБАВИТЬ ЮЗЕРА
              </button>
            </div>

            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-gray-600 uppercase font-black border-b border-white/5">
                  <th className="px-8 py-4 text-left">Пользователь</th>
                  <th className="px-4 py-4 text-left">Роль</th>
                  <th className="px-4 py-4 text-left">Подписка</th>
                  <th className="px-4 py-4 text-left hidden md:table-cell">Ресурсы</th>
                  <th className="px-8 py-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <Fragment key={user.id}>
                    <tr className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${expandedUser === user.id ? 'bg-cyan-500/[0.03]' : ''}`}>
                      <td className="px-8 py-4">
                        <div>
                          <span className="text-white font-bold text-sm">{user.email || user.username}</span>
                          {user.email && user.username !== user.email && (
                            <span className="text-gray-600 text-[10px] ml-2">@{user.username}</span>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-mono text-gray-700">#{user.id}</span>
                            <span className="text-[9px] text-gray-700">{fmtDate(user.created_at)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] px-2 py-0.5 rounded font-black
                            ${user.is_admin ? 'bg-purple-500/20 text-purple-400 border border-purple-500/20' : 'bg-gray-500/10 text-gray-500'}`}>
                            {user.is_admin ? '⚡ ADMIN' : 'USER'}
                          </span>
                          {user.is_email_verified
                            ? <CheckCircle size={12} className="text-green-500" title="Email верифицирован" />
                            : <AlertTriangle size={12} className="text-yellow-600" title="Email не верифицирован" />
                          }
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg
                            ${user.subscription === 'pro'
                              ? 'text-amber-500 bg-amber-500/10 border border-amber-500/10'
                              : 'text-gray-600 bg-gray-500/5'}`}>
                            {user.subscription === 'pro' ? '👑 PRO' : 'FREE'}
                          </span>
                          {user.subscription_expires_at && (
                            <p className="text-[9px] text-gray-600 mt-0.5">до {fmtDate(user.subscription_expires_at)}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden md:table-cell">
                        <div className="flex gap-3 text-[9px] text-gray-600">
                          <span title="Аккаунты">👤 {user.accounts_count}</span>
                          <span title="Прокси">🌐 {user.proxies_count}</span>
                          <span title="Шаблоны">📋 {user.templates_count}</span>
                          <span title="Задачи">⚙ {user.tasks_count}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4">
                        <div className="flex justify-end gap-2">
                          {/* Управление */}
                          <button
                            onClick={() => setActionsUser(user)}
                            className="p-2.5 bg-white/5 rounded-xl text-gray-500 hover:text-purple-400 hover:bg-purple-500/10 transition-all"
                            title="Управление пользователем"
                          >
                            <Lock size={16} />
                          </button>
                          {/* Детальный просмотр */}
                          <button
                            onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                            className={`p-2.5 rounded-xl transition-all ${expandedUser === user.id ? 'bg-cyan-500 text-white shadow-lg' : 'bg-white/5 text-gray-500 hover:text-cyan-400'}`}
                            title="Детальный просмотр"
                          >
                            <Layers size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedUser === user.id && (
                      <tr className="bg-black/40">
                        <td colSpan={5} className="px-8 py-6">
                          <UserDetailPanel userId={user.id} onClose={() => setExpandedUser(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>

            {loading && (
              <div className="p-20 text-center text-cyan-500 text-xs font-bold animate-pulse tracking-widest">
                ЗАГРУЗКА...
              </div>
            )}
          </div>
        )}

        {/* ── ПОДДЕРЖКА ── */}
        {activeTab === 'support' && <SupportPanel />}
      </div>

      {/* Модалки */}
      {actionsUser && (
        <UserActionsModal
          user={actionsUser}
          onClose={() => setActionsUser(null)}
          onRefresh={load}
        />
      )}
      {createModal && (
        <CreateUserModal
          onClose={() => setCreateModal(false)}
          onCreated={load}
        />
      )}
    </div>
  )
}
