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

// --- Вспомогательные данные ---
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

// --- Компоненты логирования и деталей ---

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
    if (!userId) return
    setLoading(true)
    adminGetUserDetail(userId)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message || 'Ошибка загрузки'); setLoading(false) })
  }, [userId])

  if (loading) return <p className="p-8 text-center text-[#4b6080] text-xs">Загрузка данных пользователя...</p>
  if (error) return <p className="p-8 text-center text-red-400 text-xs">{error}</p>
  if (!data) return null

  const tabs = [
    { key: 'accounts',  label: 'Аккаунты',  icon: User,       count: data.accounts?.length || 0 },
    { key: 'proxies',   label: 'Прокси',    icon: Globe,      count: data.proxies?.length || 0 },
    { key: 'templates', label: 'Шаблоны',   icon: Layers,     count: data.templates?.length || 0 },
    { key: 'tasks',     label: 'Задачи',    icon: ListChecks, count: data.tasks?.length || 0 },
  ]

  return (
    <div className="bg-[#080c12] border border-[#1c2333] rounded-xl overflow-hidden shadow-2xl">
      <div className="flex gap-0 border-b border-[#1c2333] bg-[#0a0f18]">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-5 py-3 text-[10px] font-bold tracking-widest uppercase border-b-2 transition-colors ${
              tab === key ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5' : 'border-transparent text-[#4b6080] hover:text-gray-300'
            }`}
          >
            <Icon size={12} /> {label} <span className="ml-1 opacity-50">({count})</span>
          </button>
        ))}
        <button onClick={onClose} className="ml-auto px-4 text-gray-600 hover:text-red-400 transition-colors"><XCircle size={16} /></button>
      </div>

      <div className="p-2">
        {tab === 'accounts' && (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#3d4f6a] text-[9px] uppercase tracking-widest">
                <th className="px-4 py-2 text-left font-semibold">Аккаунт</th>
                <th className="px-4 py-2 text-left font-semibold">Прокси</th>
                <th className="px-4 py-2 text-left font-semibold">Статус</th>
              </tr>
            </thead>
            <tbody>
              {(data.accounts || []).map(a => (
                <tr key={a.id} className="border-t border-[#1c2333]/40">
                  <td className="px-4 py-2 text-white">{a.name}</td>
                  <td className="px-4 py-2 text-[#4b6080]">{a.proxy_name || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`text-[9px] font-bold ${a.is_valid ? 'text-green-400' : 'text-red-400'}`}>
                      {a.is_valid ? 'VALID' : 'INVALID'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'proxies' && (
          <div className="p-4 text-[#4b6080] text-xs">
            {(data.proxies || []).length === 0 ? "Прокси не найдены" : (
              <div className="grid grid-cols-1 gap-2">
                {data.proxies.map(p => (
                  <div key={p.id} className="p-2 border border-[#1c2333] rounded bg-white/[0.02]">
                    <p className="text-white font-mono">{p.ip}:{p.port}</p>
                    <p className="text-[10px]">{p.name} | {p.login || 'no auth'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'tasks' && (
          <div className="divide-y divide-[#1c2333]/40">
            {(data.tasks || []).map(t => (
              <div key={t.id} className="p-3">
                <div className="flex justify-between items-center mb-1">
                   <span className="text-white text-xs font-bold">{t.template_name || 'Задача'}</span>
                   <span className={statusBadge(t.status)}>{t.status}</span>
                </div>
                <div className="flex gap-2">
                   <button onClick={() => setOpenLogsFor(openLogsFor === t.id ? null : t.id)} className="text-[10px] text-cyan-500 hover:underline">
                     {openLogsFor === t.id ? 'Скрыть логи' : 'Показать логи'}
                   </button>
                </div>
                {openLogsFor === t.id && <TaskLogsPanel taskId={t.id} onClose={() => setOpenLogsFor(null)} />}
              </div>
            ))}
          </div>
        )}

        {tab === 'templates' && (
          <div className="p-4 text-gray-500 text-xs text-center">Шаблоны пользователя ({data.templates?.length || 0})</div>
        )}
      </div>
    </div>
  )
}

// --- Панель Поддержки ---

function SupportAdminPanel() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)

  const load = () => {
    setLoading(true)
    adminGetSupportTickets().then(setTickets).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (selectedId) return (
    <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl p-5">
      <button onClick={() => setSelectedId(null)} className="mb-4 text-xs text-cyan-400 hover:underline">← Назад к списку</button>
      <SupportTicketThread ticketId={selectedId} onClose={() => { setSelectedId(null); load() }} />
    </div>
  )

  return (
    <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1c2333] flex items-center justify-between">
        <span className="text-white font-bold">Тикеты поддержки</span>
        <button onClick={load} className="text-xs text-[#4b6080] hover:text-white">Обновить</button>
      </div>
      <div className="divide-y divide-[#1c2333]">
        {tickets.map(t => (
          <div key={t.id} onClick={() => setSelectedId(t.id)} className="p-4 hover:bg-white/[0.02] cursor-pointer flex justify-between items-center">
            <div>
              <p className="text-white text-sm font-medium">{t.subject}</p>
              <p className="text-[10px] text-gray-500">{t.user_email} • {new Date(t.updated_at).toLocaleString()}</p>
            </div>
            <span className={t.status === 'open' ? 'text-cyan-400 text-[10px] font-bold' : 'text-gray-600 text-[10px]'}>{t.status.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SupportTicketThread({ ticketId, onClose }) {
  const [ticket, setTicket] = useState(null)
  const [reply, setReply] = useState('')

  useEffect(() => {
    adminGetSupportTicket(ticketId).then(setTicket)
  }, [ticketId])

  const send = async (e) => {
    e.preventDefault()
    if (!reply.trim()) return
    await adminReplySupportTicket(ticketId, reply)
    setReply('')
    adminGetSupportTicket(ticketId).then(setTicket)
  }

  return (
    <div className="space-y-4">
      <div className="max-h-[400px] overflow-y-auto space-y-2 p-2">
        {ticket?.messages?.map(m => (
          <div key={m.id} className={`p-3 rounded-xl max-w-[80%] ${m.sender_type === 'admin' ? 'ml-auto bg-purple-500/10 border border-purple-500/20' : 'bg-[#151b27]'}`}>
            <p className="text-xs text-white">{m.text}</p>
            <p className="text-[9px] text-gray-500 mt-1">{new Date(m.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2">
        <input className="flex-1 bg-[#080c12] border border-[#1c2333] rounded-lg px-4 py-2 text-white text-sm" value={reply} onChange={e => setReply(e.target.value)} placeholder="Ответ..." />
        <button type="submit" className="bg-purple-600 px-4 py-2 rounded-lg text-white text-xs font-bold">Отправить</button>
      </form>
    </div>
  )
}

// --- Основной компонент Admin ---

export default function Admin() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedUser, setExpandedUser] = useState(null)
  const [activeTab, setActiveTab] = useState('users')
  const [createModal, setCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', password: '', username: '', is_email_verified: false })

  const load = () => {
    setLoading(true)
    adminGetUsers().then(setList).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleToggleAdmin = async (u) => {
    await adminUpdateUser(u.id, { is_admin: !u.is_admin })
    load()
  }

  const handleDelete = async (u) => {
    if (confirm('Удалить навсегда?')) {
      await adminDeleteUser(u.id)
      load()
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    try {
      await adminCreateUser(createForm)
      setCreateModal(false)
      load()
    } catch (err) { alert(err.message) }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 min-h-screen text-gray-200">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <ShieldCheck className="text-cyan-400" size={28} /> Админ-центр
        </h1>
        <div className="flex gap-2 bg-[#0d1117] p-1 rounded-xl border border-[#1c2333]">
          <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-gray-500 hover:text-gray-300'}`}>Пользователи</button>
          <button onClick={() => setActiveTab('support')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'support' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-500 hover:text-gray-300'}`}>Поддержка</button>
        </div>
      </div>

      {activeTab === 'users' ? (
        <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[#1c2333] flex justify-between items-center bg-[#151b27]/30">
            <span className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Управление базой</span>
            <button onClick={() => setCreateModal(true)} className="bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-black px-4 py-2 rounded-lg transition-all">ДОБАВИТЬ ЮЗЕРА</button>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-tighter border-b border-[#1c2333]">
                <th className="px-6 py-4 text-left font-bold">Пользователь</th>
                <th className="px-6 py-4 text-left font-bold">Роль / Почта</th>
                <th className="px-6 py-4 text-left font-bold">План</th>
                <th className="px-6 py-4 text-right font-bold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {list.map(user => (
                <Fragment key={user.id}>
                  <tr className={`border-b border-[#1c2333]/50 hover:bg-white/[0.01] transition-colors ${expandedUser === user.id ? 'bg-cyan-500/5' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-white font-bold text-sm">{user.email || user.username}</span>
                        <span className="text-[9px] text-gray-600 font-mono">UID: {user.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {user.is_admin ? <span className="text-[9px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded font-black">ADMIN</span> : <span className="text-[9px] bg-gray-500/10 text-gray-500 px-1.5 py-0.5 rounded">USER</span>}
                        {user.is_email_verified && <CheckCircle size={12} className="text-green-500" />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded ${user.subscription === 'pro' ? 'text-amber-500 bg-amber-500/10' : 'text-gray-500 bg-gray-500/10'}`}>
                        {user.subscription?.toUpperCase() || 'FREE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)} className={`p-2 rounded-lg transition-colors ${expandedUser === user.id ? 'text-cyan-400 bg-cyan-400/10' : 'text-gray-600 hover:text-cyan-400'}`}>
                          <Layers size={18} />
                        </button>
                        <button onClick={() => handleToggleAdmin(user)} className="p-2 text-gray-600 hover:text-purple-400"><ShieldCheck size={18} /></button>
                        <button onClick={() => handleDelete(user)} className="p-2 text-gray-600 hover:text-red-500"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                  {expandedUser === user.id && (
                    <tr className="bg-[#05070a]">
                      <td colSpan={4} className="p-4 border-b border-[#1c2333]">
                        <UserDetailPanel userId={user.id} onClose={() => setExpandedUser(null)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          {loading && <div className="p-10 text-center text-gray-600 text-xs animate-pulse">Загрузка списка...</div>}
        </div>
      ) : (
        <SupportAdminPanel />
      )}

      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">Новый аккаунт</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input type="email" placeholder="Email" className="w-full bg-[#080c12] border border-[#1c2333] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-cyan-500" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} required />
              <input type="password" placeholder="Пароль" className="w-full bg-[#080c12] border border-[#1c2333] rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-cyan-500" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} required />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setCreateModal(false)} className="flex-1 py-3 text-xs font-bold text-gray-500">ОТМЕНА</button>
                <button type="submit" className="flex-1 py-3 bg-cyan-600 text-white rounded-xl text-xs font-bold">СОЗДАТЬ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
