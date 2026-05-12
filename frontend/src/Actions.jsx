import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Play, Square, RotateCcw, Trash2, Plus, ExternalLink, Copy, Pencil } from 'lucide-react'
import { getTasks, createTask, updateTask, deleteTask, startTask, stopTask, getTemplates } from './api'


const inputCls =
  'w-full px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_0_3px_rgba(6,182,212,0.15)] transition-all'
const labelCls = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5'

const STATUS = {
  running: {
    label: 'АКТИВНА',
    badge: 'bg-teal-400/15 border border-teal-500/40 text-teal-400',
    dot: 'bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.8)]',
    bar: 'from-cyan-500 to-teal-400',
    card: '',
  },
  pending: {
    label: 'ОЖИДАНИЕ',
    badge: 'bg-gray-500/15 border border-gray-500/40 text-gray-400',
    dot: 'bg-gray-500',
    bar: 'from-gray-600 to-gray-500',
    card: '',
  },
  completed: {
    label: 'ЗАВЕРШЕНА',
    badge: 'bg-emerald-400/15 border border-emerald-500/40 text-emerald-400',
    dot: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]',
    bar: 'from-emerald-500 to-teal-400',
    card: '',
  },
  stopped: {
    label: 'ОСТАНОВЛЕНА',
    badge: 'bg-gray-500/15 border border-gray-500/40 text-gray-400',
    dot: 'bg-gray-500',
    bar: 'from-gray-600 to-gray-500',
    card: '',
  },
  error: {
    label: 'ОШИБКА',
    badge: 'bg-red-400/15 border border-red-500/40 text-red-400',
    dot: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]',
    bar: 'from-red-500 to-rose-500',
    card: 'border-red-900/40',
  },
}

function getStatus(s) {
  return STATUS[s] ?? STATUS.pending
}

export default function Actions() {
  const [tasks, setTasks] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [limitResetAt, setLimitResetAt] = useState(null)
  const [countdown, setCountdown] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingTask, setEditingTask] = useState(null) // task being edited
  const [activeTab, setActiveTab] = useState('all')
  const [expandedUrls, setExpandedUrls] = useState({})
  const toggleUrls = useCallback((id) => setExpandedUrls((prev) => ({ ...prev, [id]: !prev[id] })), [])
  const [form, setForm] = useState({
    template_id: '',
    postUrls: [''],
    max_comments: 10,
  })

  useEffect(() => {
    if (!limitResetAt) { setCountdown(''); return }
    const tick = () => {
      const diff = new Date(limitResetAt) - Date.now()
      if (diff <= 0) { setCountdown(''); setLimitResetAt(null); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [limitResetAt])

  const load = () => {
    setLoading(true)
    Promise.all([getTasks(), getTemplates()])
      .then(([t, tpl]) => {
        setTasks(t)
        setTemplates(tpl)
      })
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!form.template_id) { setError('Выберите шаблон'); return }
    const tpl = templates.find((t) => t.id === Number(form.template_id))
    if (tpl && !(tpl.action_count || tpl.actions?.length || tpl.account_ids?.length)) {
      setError('Шаблон не содержит действий'); return
    }
    const filteredUrls = form.postUrls.filter((u) => u.trim())
    if (!filteredUrls.length) { setError('Добавьте хотя бы один URL поста'); return }
    const invalidUrls = filteredUrls.filter((u) => !u.startsWith('https://'))
    if (invalidUrls.length) { setError('Все URL постов должны начинаться с https://'); return }
    const payload = {
      template_id: Number(form.template_id),
      post_urls: filteredUrls,
      max_comments: Number(form.max_comments) || 10,
      rotate_proxy_mode: 'before_account',
      show_browser: false,
    }
    try {
      if (editingTask) {
        await updateTask(editingTask.id, payload)
        setSuccess('Задача обновлена')
        setEditingTask(null)
      } else {
        await createTask(payload)
        setSuccess('Задача создана')
      }
      setShowCreate(false)
      setForm({ template_id: '', postUrls: [''], max_comments: 10 })
      load()
    } catch (err) {
      if (err.resetAt) setLimitResetAt(err.resetAt)
      setError(err.message)
    }
  }

  const handleStart = async (id) => {
    setError('')
    try { await startTask(id); setSuccess('Задача запущена'); load() }
    catch (err) { setError(err.message) }
  }

  const handleStop = async (id) => {
    setError('')
    try { await stopTask(id); setSuccess('Остановка запрошена'); load() }
    catch (err) { setError(err.message) }
  }

  const handleEdit = (t) => {
    setEditingTask(t)
    setForm({
      template_id: String(t.template_id || ''),
      postUrls: (t.post_urls && t.post_urls.length) ? t.post_urls : [''],
      max_comments: t.max_comments ?? 10,
    })
    setShowCreate(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDuplicate = async (t) => {
    setError('')
    try {
      await createTask({
        template_id: t.template_id,
        post_urls: t.post_urls || [],
        max_comments: t.max_comments,
        rotate_proxy_mode: 'before_account',
        show_browser: false,
      })
      setSuccess('Задача дублирована')
      load()
    } catch (err) {
      if (err.resetAt) setLimitResetAt(err.resetAt)
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Удалить эту задачу?')) return
    try { await deleteTask(id); load() }
    catch (err) { setError(err.message) }
  }

  useEffect(() => {
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [])

  const runningCount = tasks.filter((t) => t.status === 'running').length
  const failedCount = tasks.filter((t) => t.status === 'error').length

  const filteredTasks = tasks.filter((t) => {
    if (activeTab === 'running') return t.status === 'running'
    if (activeTab === 'failed') return t.status === 'error'
    return true
  })

  const hasErrors = tasks.some((t) => t.status === 'error')

  return (
    <div className="pb-16">
      {/* ── Page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Мониторинг задач</h1>
        </div>
      </div>

      {/* ── Notifications ── */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm">
          <p className="font-bold">{error}</p>
          {countdown && (
            <p className="mt-1.5 text-xs text-red-300">Лимит сбросится через: <span className="font-mono font-bold text-red-200">{countdown}</span></p>
          )}
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400 text-sm">
          {success}
        </div>
      )}

      {/* ── Create form (slide-in) ── */}
      {showCreate && (
        <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            <h2 className="text-xs font-bold text-cyan-400 tracking-[0.2em] uppercase">
              {editingTask
                ? (editingTask.status === 'completed' || editingTask.status === 'stopped')
                  ? `Просмотр задачи #${String(editingTask.id).padStart(2, '0')}`
                  : `Редактирование #${String(editingTask.id).padStart(2, '0')}`
                : 'Инициализация задачи'}
            </h2>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelCls}>Шаблон</label>
                <select
                  value={form.template_id}
                  onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
                  className={inputCls}
                  required
                >
                  <option value="">Выберите шаблон</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.action_count || t.actions?.length || 0} действий)
                    </option>
                  ))}
                </select>
                {form.template_id && (
                  <p className="mt-1.5 text-[10px] text-gray-600 break-all">
                    {templates.find((t) => t.id === Number(form.template_id))?.action_count ?? 0} действий
                  </p>
                )}
              </div>
              {/* Post URLs list */}
              <div className="md:col-span-2">
                <label className={labelCls}>URL постов <span className="text-cyan-600 normal-case font-normal">(обязательно https://)</span></label>
                <div className="space-y-2">
                  {form.postUrls.map((url, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={url}
                        onChange={(e) => {
                          const next = [...form.postUrls]
                          next[i] = e.target.value
                          setForm((f) => ({ ...f, postUrls: next }))
                        }}
                        className={`${inputCls} ${url && !url.startsWith('https://') ? 'border-red-500/50 focus:border-red-500' : ''}`}
                        placeholder="https://facebook.com/post/..."
                      />
                      {form.postUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, postUrls: f.postUrls.filter((_, idx) => idx !== i) }))}
                          className="w-10 h-10 flex-shrink-0 rounded-xl border border-[#1c2333] flex items-center justify-center text-gray-500 hover:text-red-400 hover:border-red-500/40 transition-all"
                        >
                          <Plus size={13} className="rotate-45" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, postUrls: [...f.postUrls, ''] }))}
                    className="mt-1 px-3 py-1.5 rounded-full border border-cyan-500/30 text-cyan-400 text-[10px] font-bold tracking-wider uppercase hover:bg-cyan-500/10 transition-all"
                  >
                    + Добавить URL
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 to-teal-500 text-white text-xs font-black tracking-[0.15em] uppercase hover:shadow-[0_0_24px_rgba(6,182,212,0.5)] hover:scale-105 transition-all"
              >
                {editingTask ? 'Сохранить' : 'Запустить'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setEditingTask(null) }}
                className="px-5 py-2.5 rounded-full border border-[#1c2333] text-gray-500 text-xs font-semibold tracking-wider uppercase hover:border-red-500/40 hover:text-red-400 transition-all"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Filter tabs ── */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { key: 'all', label: 'ВСЕ' },
          { key: 'running', label: `АКТИВНЫЕ`, count: runningCount },
          { key: 'failed', label: 'ОШИБКИ', count: failedCount },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-bold tracking-[0.12em] uppercase transition-all ${
              activeTab === key
                ? key === 'failed'
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400 shadow-[0_0_16px_rgba(239,68,68,0.25)]'
                  : 'bg-teal-500/20 border border-teal-500/40 text-teal-400 shadow-[0_0_16px_rgba(6,182,212,0.3)]'
                : 'bg-[#0d1117] border border-[#1c2333] text-gray-500 hover:text-gray-300 hover:border-[#2a3547]'
            }`}
          >
            {label}{count !== undefined ? ` (${count})` : ''}
          </button>
        ))}
      </div>

      {/* ── Task grid ── */}
      {loading && tasks.length === 0 ? (
        <div className="text-center py-16 text-gray-600 text-xs tracking-widest uppercase">Загрузка...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* CREATE TASK card — always first */}
          {activeTab === 'all' && (
            <button
              onClick={() => { setForm({ template_id: '', postUrls: [''], max_comments: 10 }); setEditingTask(null); setShowCreate(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              className="border-2 border-dashed border-[#1c2333] rounded-2xl p-4 flex flex-col items-center justify-center gap-3 min-h-[180px] hover:border-cyan-500/40 hover:bg-cyan-500/[0.02] hover:scale-[1.02] hover:shadow-[0_0_24px_rgba(6,182,212,0.08)] transition-all group"
            >
              <div className="w-10 h-10 rounded-full border-2 border-dashed border-[#1c2333] group-hover:border-cyan-500/50 flex items-center justify-center text-gray-700 group-hover:text-cyan-500 transition-all">
                <Plus size={20} />
              </div>
              <span className="text-[10px] font-bold text-gray-700 group-hover:text-cyan-500 tracking-[0.2em] uppercase transition-all">
                Создать задачу
              </span>
            </button>
          )}

          {filteredTasks.map((t) => {
            const st = getStatus(t.status)
            const total = t.progress_total || 0
            const current = t.progress_current || 0
            const pct = total > 0 ? Math.round((current / total) * 100) : 0

            return (
              <div
                key={t.id}
                className={`bg-[#0d1117] border rounded-2xl p-4 flex flex-col gap-3 hover:bg-[#0f1520] transition-all ${
                  st.card || 'border-[#1c2333]'
                } ${t.status === 'running' ? 'shadow-[0_0_20px_rgba(6,182,212,0.07)]' : ''}`}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white leading-tight truncate">
                      {t.template_name ?? `Task #${t.id}`}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5 truncate">
                      Шаблон: {t.template_name?.toUpperCase().replace(/\s/g, '_') ?? `ID_${t.id}`}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black tracking-[0.1em] flex-shrink-0 ${st.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                    {st.label}
                  </span>
                </div>

                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] text-gray-600 uppercase tracking-widest">
                      {t.status === 'error' ? 'ПЕРЕПОЛНЕНИЕ БУФЕРА' : 'ПРОГРЕСС'}
                    </span>
                    <span className={`text-[11px] font-bold ${
                      t.status === 'error' ? 'text-red-400' :
                      t.status === 'completed' ? 'text-emerald-400' : 'text-cyan-400'
                    }`}>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-[#151b27] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${st.bar} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {total > 0 && (
                      <p className="text-[9px] text-gray-700 mt-1">{current} / {total} действий</p>
                  )}
                </div>

                {/* Post URLs */}
                {t.post_urls && t.post_urls.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleUrls(t.id)}
                      className="flex items-center gap-1.5 text-[9px] font-bold text-gray-600 hover:text-gray-400 tracking-widest uppercase transition-colors"
                    >
                      <span className={`transition-transform ${expandedUrls[t.id] ? 'rotate-90' : ''}`}>▶</span>
                      {t.post_urls.length} {t.post_urls.length === 1 ? 'пост' : t.post_urls.length < 5 ? 'поста' : 'постов'}
                    </button>
                    {expandedUrls[t.id] && (
                      <div className="mt-1.5 space-y-1">
                        {t.post_urls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[10px] text-cyan-500/70 hover:text-cyan-400 truncate transition-colors"
                            title={url}
                          >
                            <ExternalLink size={9} className="flex-shrink-0" />
                            <span className="truncate">{url}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    {(t.status !== 'running' && t.status !== 'completed') && (
                      <button
                        onClick={() => handleStart(t.id)}
                        title="Start"
                        className="w-8 h-8 rounded-xl bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-500 hover:text-teal-400 hover:border-teal-500/40 hover:shadow-[0_0_12px_rgba(6,182,212,0.2)] transition-all"
                      >
                        <Play size={13} />
                      </button>
                    )}
                    {t.status !== 'running' && (
                      <button
                        onClick={() => handleEdit(t)}
                        title={t.status === 'completed' || t.status === 'stopped' ? 'Просмотр / Редактировать' : 'Редактировать'}
                        className="w-8 h-8 rounded-xl bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-500 hover:text-yellow-400 hover:border-yellow-500/40 transition-all"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                    {t.status === 'running' && (
                      <button
                        onClick={() => handleStop(t.id)}
                        title="Stop"
                        className="w-8 h-8 rounded-xl bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-500 hover:text-amber-400 hover:border-amber-500/40 transition-all"
                      >
                        <Square size={13} />
                      </button>
                    )}
                    <Link
                      to={`/logs?task_id=${t.id}`}
                      title="Logs"
                      className="w-8 h-8 rounded-xl bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40 transition-all"
                    >
                      <ExternalLink size={13} />
                    </Link>
                    <button
                      onClick={() => handleDuplicate(t)}
                      title="Duplicate"
                      className="w-8 h-8 rounded-xl bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-500 hover:text-purple-400 hover:border-purple-500/40 transition-all"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      title="Delete"
                      className="w-8 h-8 rounded-xl bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-500 hover:text-red-400 hover:border-red-500/40 transition-all"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <span className="text-[10px] text-gray-700 font-mono">#{String(t.id).padStart(2, '0')}</span>
                </div>
              </div>
            )
          })}

          {filteredTasks.length === 0 && activeTab !== 'all' && (
            <div className="col-span-full py-12 text-center text-gray-700 text-xs tracking-widest uppercase">
              Нет {activeTab === 'running' ? 'активных' : 'завершившихся с ошибкой'} задач
            </div>
          )}
        </div>
      )}


    </div>
  )
}
