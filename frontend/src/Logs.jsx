import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getLogs, clearAllLogs } from './api'

const STATUS_MAP = {
  true: {
    label: 'УСПЕШНО',
    cls: 'bg-teal-400/15 border border-teal-500/40 text-teal-400',
  },
  false: {
    label: 'ОШИБКА',
    cls: 'bg-red-400/15 border border-red-500/40 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.2)]',
  },
}

const ACTION_ABBR = (action = '') => {
  const map = {
    react_post: 'REACT_POST',
    comment_post: 'COMMENT_POST',
    reply_comment: 'REPLY_CMT',
    react_comment: 'REACT_CMT',
    check: 'AUTH_CHECK',
    rotate: 'IP_ROTATE',
  }
  return map[action] || action.toUpperCase().replace(/\s/g, '_').slice(0, 20)
}

const PAGE_SIZE = 25

export default function Logs() {
  const [searchParams] = useSearchParams()
  const taskId = searchParams.get('task_id')
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [live, setLive] = useState(true)

  const loadLogs = () => {
    setLoading(true)
    getLogs(taskId ? Number(taskId) : null, 500)
      .then(setList)
      .catch(() => setError('Ошибка загрузки логов'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadLogs()
    // eslint-disable-next-line
  }, [taskId])

  useEffect(() => {
    if (!live) return
    const t = setInterval(loadLogs, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line
  }, [live, taskId])

  const handleClearLogs = async () => {
    if (!window.confirm('Очистить все логи?')) return
    setError('')
    setSuccess('')
    try {
      await clearAllLogs()
      setSuccess('Все логи удалены')
      loadLogs()
    } catch (e) {
      setError(e.message || 'Ошибка очистки логов')
    }
  }

  const filtered = list.filter((l) => {
    if (filter === 'success' && !l.success) return false
    if (filter === 'critical' && l.success) return false
    if (search && !`${l.account_name} ${l.action} ${l.message}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const getInitials = (name = '') =>
    name ? name.slice(0, 2).toUpperCase() : '??'

  const idColors = ['#0e7490', '#7c3aed', '#065f46', '#b45309', '#be123c']
  const colorFor = (id) => idColors[id % idColors.length]

  return (
    <div className="pb-14">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Журнал активности</h1>
          <p className="text-base font-semibold text-gray-400 mt-1">
            {taskId
              ? `Фильтр по задаче #${taskId}`
              : 'Мониторинг событий в реальном времени.'}
          </p>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-red-600 to-rose-500 text-white text-[11px] font-black tracking-[0.15em] uppercase hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:scale-105 transition-all"
          >
            <span className="text-red-200">●</span> ОЧИСТИТЬ ЛОГИ
          </button>
        </div>
      </div>

      {/* ── Notifications ── */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-3 bg-teal-500/10 border border-teal-500/30 rounded-2xl text-teal-400 text-sm">
          {success}
        </div>
      )}

      {/* ── Filter tabs + search ── */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {[
          { key: 'all', label: 'ВСЕ СОБЫТИЯ', dot: null },
          { key: 'success', label: 'УСПЕШНО', dot: 'bg-teal-400' },
          { key: 'critical', label: 'КРИТИЧНО', dot: 'bg-red-400' },
        ].map(({ key, label, dot }) => (
          <button
            key={key}
            onClick={() => { setFilter(key === 'critical' ? 'critical' : key === 'success' ? 'success' : 'all'); setPage(1) }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[11px] font-bold tracking-[0.1em] uppercase transition-all ${
              (filter === key || (key === 'all' && filter === 'all'))
                ? 'bg-teal-500/20 border border-teal-500/40 text-teal-400 shadow-[0_0_14px_rgba(6,182,212,0.25)]'
                : 'bg-[#0d1117] border border-[#1c2333] text-gray-500 hover:text-gray-300 hover:border-[#2a3547]'
            }`}
          >
            {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
            {label}
          </button>
        ))}
        <div className="ml-auto relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Поиск по логам..."
            className="pl-9 pr-4 py-1.5 bg-[#080c12] border border-[#1c2333] rounded-full text-white text-xs placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_0_3px_rgba(6,182,212,0.12)] transition-all w-64"
          />
        </div>
      </div>

      {/* ── Logs table ── */}
      <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.04)] mb-5">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1c2333]">
                {['Временная метка', 'Задача / Аккаунт', 'Тип действия', 'Статус', 'Сообщение'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3.5 text-left text-[9px] font-bold text-cyan-600/80 uppercase tracking-[0.2em]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-600 text-xs tracking-widest uppercase">
                    Загрузка...
                  </td>
                </tr>
              ) : pageData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-gray-700 text-xs tracking-widest uppercase">
                    Логи не найдены
                  </td>
                </tr>
              ) : (
                pageData.map((l, i) => {
                  const st = STATUS_MAP[l.success ? 'true' : 'false']
                  const dt = new Date(l.created_at)
                  const dateStr = dt.toLocaleDateString('en-CA')
                  const timeStr = dt.toLocaleTimeString('en-GB')
                  const bg = colorFor(l.id ?? i)

                  return (
                    <tr
                      key={l.id}
                      className="border-b border-teal-900/20 hover:bg-teal-950/20 transition-colors group"
                    >
                      {/* Timestamp */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <p className="text-[11px] text-gray-500 font-mono">{dateStr}</p>
                        <p className="text-[11px] text-gray-600 font-mono">{timeStr}</p>
                      </td>
                      {/* Task / Identity */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black text-white flex-shrink-0"
                            style={{ backgroundColor: bg }}
                          >
                            {getInitials(l.account_name)}
                          </div>
                          <span className="text-xs font-bold text-white tracking-wide">
                            {l.account_name?.toUpperCase().replace(/\s/g, '_') || 'UNKNOWN'}
                          </span>
                        </div>
                      </td>
                      {/* Action Type */}
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] font-mono text-gray-400 tracking-wide">
                          {ACTION_ABBR(l.action)}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-[0.1em] uppercase ${st.cls}`}>
                          {st.label}
                        </span>
                      </td>
                      {/* Payload */}
                      <td className="px-5 py-3.5 max-w-xs">
                        <p className="text-[11px] text-gray-500 truncate font-mono">
                          {l.message || '—'}
                        </p>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-[#1c2333]/60">
            <span className="text-[10px] text-gray-600 font-mono">
              Показано{' '}
              <span className="text-cyan-500 font-bold">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}
              </span>{' '}
              из {filtered.length.toLocaleString()} записей
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 rounded-lg bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40 disabled:opacity-30 text-xs transition-all"
              >
                ‹
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = i + 1
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-all ${
                      page === p
                        ? 'bg-teal-500/20 border border-teal-500/40 text-teal-400'
                        : 'bg-[#151b27] border border-[#1c2333] text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
              {totalPages > 5 && <span className="text-gray-700 text-xs px-1">…</span>}
              {totalPages > 5 && (
                <button
                  onClick={() => setPage(totalPages)}
                  className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-all ${
                    page === totalPages
                      ? 'bg-teal-500/20 border border-teal-500/40 text-teal-400'
                      : 'bg-[#151b27] border border-[#1c2333] text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40'
                  }`}
                >
                  {totalPages}
                </button>
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 rounded-lg bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40 disabled:opacity-30 text-xs transition-all"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom system bar ── */}
      <div className="fixed bottom-0 left-0 right-0 h-10 bg-[#080b10]/90 backdrop-blur border-t border-[#1c2333]/60 flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-6">
          {[
            { label: 'ЗАГРУЗКА ПРОЦЕССОРА', value: '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-600 uppercase tracking-widest">{label}:</span>
              <span className="text-[11px] font-bold text-cyan-400">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
