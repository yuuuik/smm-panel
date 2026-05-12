import { useState, useEffect, Fragment } from 'react'
import { 
  adminGetUsers, adminUpdateUser, adminDeleteUser, 
  adminGetTaskLogs, adminCreateUser, adminGetSupportTickets, 
  adminGetSupportTicket, adminReplySupportTicket, adminUpdateSupportTicket, 
  adminDeleteSupportTicket, adminGetUserDetail 
} from './api'
import { 
  ShieldCheck, Trash2, AlertCircle, CheckCircle, 
  ChevronDown, ChevronRight, ListChecks, ScrollText, 
  XCircle, UserPlus, Send, Layers, ExternalLink, User, Globe, MessageSquare, Info
} from 'lucide-react'

// --- Маппинг типов действий ---
const ACTION_LABELS = {
  like: 'Лайк',
  comment: 'Комментарий',
  repost: 'Репост',
  subscribe: 'Подписка',
  view: 'Просмотр',
  reaction: 'Реакция'
}

// --- Хелпер статусов ---
function statusBadge(status) {
  const map = {
    running:   'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    completed: 'bg-green-500/10 text-green-400 border-green-500/20',
    failed:    'bg-red-500/10 text-red-400 border-red-500/20',
    stopped:   'bg-gray-500/10 text-gray-400 border-gray-500/20',
    pending:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
  }
  return `inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${map[status] || 'bg-gray-500/10 text-gray-400'}`
}

// --- Панель Логов ---
function TaskLogsPanel({ taskId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminGetTaskLogs(taskId).then(setLogs).catch(() => {}).finally(() => setLoading(false))
  }, [taskId])

  if (loading) return <div className="p-4 text-[10px] text-gray-500 animate-pulse">Загрузка логов...</div>

  return (
    <div className="mt-2 bg-black/40 border border-white/5 rounded-lg overflow-hidden">
      <div className="bg-white/5 px-3 py-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Сырые логи выполнения</div>
      <div className="max-h-40 overflow-y-auto p-2 space-y-1 font-mono">
        {logs.length === 0 ? <p className="text-[10px] text-gray-700">Логов пока нет</p> : logs.map(l => (
          <div key={l.id} className="text-[10px] flex gap-2">
            <span className={l.success ? "text-cyan-500" : "text-red-500"}>[{l.success ? 'OK' : 'ERR'}]</span>
            <span className="text-gray-500">[{l.action}]</span>
            <span className="text-gray-300">{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- ГЛАВНАЯ ПАНЕЛЬ ДЕТАЛЕЙ (ТУТ ВСЁ МАКСИМАЛЬНО ДЕТАЛЬНО) ---
function UserDetailPanel({ userId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('accounts')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    setLoading(true)
    adminGetUserDetail(userId)
      .then(res => {
        // Проверка на корректность данных
        if (typeof res === 'string' && res.includes('<!DOCTYPE')) {
          throw new Error("Ошибка API: Сервер вернул HTML вместо данных. Проверьте путь к API.")
        }
        setData(res)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="p-10 text-center text-cyan-500 text-xs animate-pulse">Получение глубоких данных пользователя...</div>
  if (error) return (
    <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-xl">
      <p className="text-red-400 text-xs font-mono mb-2">Критическая ошибка данных:</p>
      <p className="text-red-500 text-[10px] bg-black/30 p-2 rounded">{error}</p>
      <button onClick={onClose} className="mt-4 text-[10px] text-gray-500 underline">Закрыть панель</button>
    </div>
  )

  const tabs = [
    { id: 'accounts', label: 'Аккаунты', icon: User, count: data?.accounts?.length || 0 },
    { id: 'proxies', label: 'Прокси', icon: Globe, count: data?.proxies?.length || 0 },
    { id: 'templates', label: 'Шаблоны', icon: Layers, count: data?.templates?.length || 0 },
    { id: 'tasks', label: 'Задачи', icon: ListChecks, count: data?.tasks?.length || 0 },
  ]

  return (
    <div className="bg-[#05070a] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
      {/* Навигация */}
      <div className="flex items-center gap-0 bg-white/5 border-b border-white/5">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-5 py-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-500' : 'text-gray-500 hover:text-gray-300'}`}>
            <tab.icon size={12} /> {tab.label} <span className="opacity-30">[{tab.count}]</span>
          </button>
        ))}
        <button onClick={onClose} className="ml-auto px-4 text-gray-600 hover:text-red-500"><XCircle size={16} /></button>
      </div>

      <div className="p-4">
        {/* АККАУНТЫ */}
        {activeTab === 'accounts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.accounts?.map(acc => (
              <div key={acc.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-white">{acc.name}</p>
                  <p className="text-[10px] text-gray-500">Прокси: {acc.proxy_name || 'Прямое соед.'}</p>
                </div>
                <span className={`text-[9px] font-black ${acc.is_valid ? 'text-green-500' : 'text-red-500'}`}>{acc.is_valid ? 'VALID' : 'ERROR'}</span>
              </div>
            ))}
          </div>
        )}

        {/* ШАБЛОНЫ (ДЕТАЛЬНО) */}
        {activeTab === 'templates' && (
          <div className="space-y-2">
            {data.templates?.map(tpl => (
              <div key={tpl.id} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedId(expandedId === tpl.id ? null : tpl.id)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                   <div className="flex items-center gap-3">
                     <Layers size={14} className="text-cyan-500" />
                     <span className="text-xs font-bold text-white">{tpl.name}</span>
                   </div>
                   <div className="flex items-center gap-4">
                     <span className="text-[10px] text-gray-500">{tpl.actions?.length || 0} действий</span>
                     {expandedId === tpl.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                   </div>
                </button>
                {expandedId === tpl.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-white/5 bg-black/20 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[9px] text-gray-600 uppercase font-bold mb-1">Текст комментария/поста:</p>
                        <div className="p-2 bg-black/40 rounded text-[11px] text-gray-300 italic">"{tpl.comment_text || 'Текст не задан'}"</div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] text-gray-600 uppercase font-bold mb-1">Параметры:</p>
                        <p className="text-[10px] text-gray-400">Задержка: <span className="text-white">{tpl.delay_min}-{tpl.delay_max} сек.</span></p>
                        <p className="text-[10px] text-gray-400">Тип реакции: <span className="text-purple-400">{tpl.reaction_type || 'Нет'}</span></p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-600 uppercase font-bold mb-2">Очередь действий:</p>
                      <div className="flex flex-wrap gap-2">
                        {tpl.actions?.map((act, idx) => (
                          <div key={idx} className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded text-[10px] text-cyan-400">
                            {idx+1}. {ACTION_LABELS[act.action_type] || act.action_type} ({act.delay}с)
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ЗАДАЧИ (ДЕТАЛЬНО) */}
        {activeTab === 'tasks' && (
          <div className="space-y-3">
            {data.tasks?.map(task => (
              <div key={task.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{task.template_name}</span>
                      <span className={statusBadge(task.status)}>{task.status}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">Создана: {new Date(task.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500">Прогресс:</p>
                    <p className="text-xs font-mono text-cyan-400">{task.progress_current} / {task.progress_total}</p>
                  </div>
                </div>
                
                {/* ССЫЛКА НА ПОСТ (ТО ЧТО ВЫ ПРОСИЛИ) */}
                <div className="mb-3">
                  <p className="text-[9px] text-gray-600 uppercase font-bold mb-1">Целевые ссылки:</p>
                  {task.post_urls?.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[10px] text-cyan-500 hover:text-cyan-400 truncate bg-cyan-500/5 p-1 rounded mb-1">
                      <ExternalLink size={10} /> {url}
                    </a>
                  ))}
                </div>

                <button onClick={() => setExpandedId(expandedId === `task-${task.id}` ? null : `task-${task.id}`)} className="text-[10px] font-bold text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
                  <ScrollText size={12} /> {expandedId === `task-${task.id}` ? 'Скрыть логи выполнения' : 'Посмотреть детальные логи'}
                </button>
                {expandedId === `task-${task.id}` && <TaskLogsPanel taskId={task.id} />}
              </div>
            ))}
          </div>
        )}
        
        {/* ПРОКСИ */}
        {activeTab === 'proxies' && (
          <div className="grid grid-cols-1 gap-2">
            {data.proxies?.map(p => (
              <div key={p.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-4">
                <Globe size={16} className="text-gray-600" />
                <div className="flex-1">
                   <p className="text-xs font-mono text-white">{p.ip}:{p.port}</p>
                   <p className="text-[9px] text-gray-500 font-bold uppercase">{p.name} | {p.type || 'SOCKS5'}</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] text-gray-400">Ротация: {p.rotate_delay}с</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- ОСНОВНОЙ КОМПОНЕНТ АДМИНКИ ---
export default function Admin() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('users')
  const [expandedUser, setExpandedUser] = useState(null)
  const [createModal, setCreateModal] = useState(false)

  const load = () => {
    setLoading(true)
    adminGetUsers().then(setUsers).finally(() => setLoading(false))
  }

  useEffect(load, [])

  return (
    <div className="min-h-screen bg-[#020408] text-gray-300 p-6 font-sans">
      {/* Шапка */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black text-white flex items-center gap-3">
          <ShieldCheck className="text-cyan-500" size={32} /> АДМИН-ЦЕНТР
        </h1>
        <div className="flex bg-[#0d1117] p-1.5 rounded-2xl border border-white/5">
          <button onClick={() => setActiveTab('users')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'users' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-gray-500 hover:text-white'}`}>ПОЛЬЗОВАТЕЛИ</button>
          <button onClick={() => setActiveTab('support')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'support' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-gray-500 hover:text-white'}`}>ПОДДЕРЖКА</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {activeTab === 'users' ? (
          <div className="bg-[#0d1117] border border-white/5 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-gray-500">Управление базой</h2>
              <button onClick={() => setCreateModal(true)} className="bg-cyan-500 hover:bg-cyan-400 text-white text-[10px] font-black px-6 py-3 rounded-xl transition-all shadow-lg shadow-cyan-500/10">ДОБАВИТЬ ЮЗЕРА</button>
            </div>

            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-gray-600 uppercase font-black border-b border-white/5">
                  <th className="px-8 py-5 text-left">Пользователь</th>
                  <th className="px-8 py-5 text-left">Роль / Почта</th>
                  <th className="px-8 py-5 text-left">План</th>
                  <th className="px-8 py-5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <Fragment key={user.id}>
                    <tr className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${expandedUser === user.id ? 'bg-cyan-500/[0.03]' : ''}`}>
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="text-white font-bold text-sm">{user.email || user.username}</span>
                          <span className="text-[9px] text-gray-600 font-mono">UID: {user.id}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-2 py-0.5 rounded font-black ${user.is_admin ? 'bg-purple-500/20 text-purple-400 border border-purple-500/20' : 'bg-gray-500/10 text-gray-500'}`}>{user.is_admin ? 'ADMIN' : 'USER'}</span>
                          {user.is_email_verified && <CheckCircle size={14} className="text-green-500" />}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                         <span className={`text-[10px] font-black px-3 py-1 rounded-lg ${user.subscription === 'pro' ? 'text-amber-500 bg-amber-500/10 border border-amber-500/10' : 'text-gray-600 bg-gray-500/5'}`}>{user.subscription?.toUpperCase() || 'FREE'}</span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)} className={`p-2.5 rounded-xl transition-all ${expandedUser === user.id ? 'bg-cyan-500 text-white shadow-lg' : 'bg-white/5 text-gray-500 hover:text-cyan-400'}`}>
                            <Layers size={18} />
                          </button>
                          <button onClick={async () => { await adminDeleteUser(user.id); load() }} className="p-2.5 bg-white/5 rounded-xl text-gray-500 hover:text-red-500 transition-all"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                    {expandedUser === user.id && (
                      <tr className="bg-black/40">
                        <td colSpan={4} className="px-8 py-6">
                           <UserDetailPanel userId={user.id} onClose={() => setExpandedUser(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {loading && <div className="p-20 text-center text-cyan-500 text-xs font-bold animate-pulse tracking-widest">СИНХРОНИЗАЦИЯ БАЗЫ...</div>}
          </div>
        ) : (
          <div className="p-20 text-center text-gray-600 border-2 border-dashed border-white/5 rounded-3xl uppercase font-black tracking-widest text-xs">Раздел поддержки в разработке</div>
        )}
      </div>
    </div>
  )
}
