import { useState, useEffect } from 'react'
import { Eye, EyeOff, Globe, Activity, Server, RefreshCw, Trash2, Pencil, Check, X } from 'lucide-react'
import { getProxies, createProxy, deleteProxy, checkProxy, updateProxy } from './api'

const DOT_COLORS = ['#00d4ff', '#a855f7', '#ef4444', '#00d4ff', '#a855f7']

const inputCls =
  'w-full px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_0_3px_rgba(6,182,212,0.15)] transition-all'

const labelCls = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5'

export default function Proxies() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(null)
  const [form, setForm] = useState({
    name: '',
    ip: '',
    port: '',
    login: '',
    password: '',
    rotate_url: '',
    rotate_delay: 0,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingDelay, setEditingDelay] = useState(null) // proxy id
  const [editDelayValue, setEditDelayValue] = useState(0)
  const [savingDelay, setSavingDelay] = useState(null)

  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkParsed, setBulkParsed] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  const load = () => {
    setLoading(true)
    getProxies()
      .then(setList)
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    try {
      await createProxy({
        ...form,
        port: Number(form.port) || 0,
        rotate_delay: Number(form.rotate_delay) || 0,
      })
      setSuccess('Прокси добавлен')
      setForm({ name: '', ip: '', port: '', login: '', password: '', rotate_url: '', rotate_delay: 0 })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Удалить этот прокси?')) return
    try {
      await deleteProxy(id)
      setSuccess('Удалено')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleEditDelay = (p) => {
    setEditingDelay(p.id)
    setEditDelayValue(p.rotate_delay)
  }

  const handleSaveDelay = async (id) => {
    setSavingDelay(id)
    setError('')
    try {
      await updateProxy(id, { rotate_delay: Number(editDelayValue) || 0 })
      setSuccess('Задержка обновлена')
      setEditingDelay(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingDelay(null)
    }
  }

  // Parse bulk proxy text: ip:port:login:pass{name}
  const parseBulkProxies = (text) => {
    return text.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const nameMatch = line.match(/\{([^}]+)\}/)
        const name = nameMatch ? nameMatch[1].trim() : ''
        const clean = line.replace(/\{[^}]*\}/, '').trim()
        const parts = clean.split(':')
        if (parts.length < 2) return null
        const ip = parts[0].trim()
        const port = parts[1].trim()
        const login = parts[2]?.trim() || ''
        const password = parts[3]?.trim() || ''
        if (!ip || !port) return null
        return { name: name || `${ip}:${port}`, ip, port: Number(port) || 0, login, password, rotate_url: '', rotate_delay: 0 }
      })
      .filter(Boolean)
  }

  const handleBulkParse = () => {
    const parsed = parseBulkProxies(bulkText)
    setBulkParsed(parsed)
  }

  const handleBulkSubmit = async () => {
    if (!bulkParsed || bulkParsed.length === 0) return
    setBulkLoading(true)
    setError('')
    try {
      for (const proxy of bulkParsed) {
        await createProxy(proxy)
      }
      setSuccess(`Добавлено ${bulkParsed.length} прокси`)
      setShowBulkImport(false)
      setBulkText('')
      setBulkParsed(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBulkLoading(false)
    }
  }

  const handleCheck = async (id) => {
    setChecking(id)
    setError('')
    try {
      const res = await checkProxy(id)
      setSuccess(res.success ? 'Прокси работает' : res.message || 'Проверка не удалась')
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(null)
    }
  }

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Прокси</h1>
          <p className="text-base font-semibold text-gray-400 mt-1">Управление узлами сети</p>
        </div>
        <button
          onClick={() => { setShowBulkImport(true); setBulkParsed(null); setBulkText('') }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-400 border border-emerald-500/40 rounded-full hover:bg-emerald-500/10 transition-colors"
        >
          + Массовый импорт
        </button>
      </div>

      {/* ── Notifications ── */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400 text-sm">
          {success}
        </div>
      )}

      {/* ── Deploy New Proxy card ── */}
      <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <h2 className="text-xs font-bold text-white tracking-[0.2em] uppercase">Добавить прокси</h2>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Row 1 — Name / IP / Port / Login */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className={labelCls}>Имя прокси</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
                placeholder="serzh"
                required
              />
            </div>
            <div>
              <label className={labelCls}>IP адрес</label>
              <input
                value={form.ip}
                onChange={(e) => setForm((f) => ({ ...f, ip: e.target.value }))}
                className={inputCls}
                placeholder="192.168.0.1"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Порт</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                className={inputCls}
                placeholder="8080"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Логин</label>
              <input
                value={form.login}
                onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))}
                className={inputCls}
                placeholder="operator_id"
              />
            </div>
          </div>

          {/* Row 2 — Password / Rotate URL / Delay + Deploy */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className={labelCls}>Пароль</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className={`${inputCls} pr-10`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-400 transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>URL ротации</label>
              <input
                value={form.rotate_url}
                onChange={(e) => setForm((f) => ({ ...f, rotate_url: e.target.value }))}
                className={inputCls}
                placeholder="https://api.rotation.net/v1/trigger"
              />
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className={labelCls}>Задержка (сек)</label>
                <input
                  type="number"
                  min="0"
                  value={form.rotate_delay}
                  onChange={(e) => setForm((f) => ({ ...f, rotate_delay: e.target.value }))}
                  className={inputCls}
                  placeholder="0"
                />
              </div>
              <button
                type="submit"
                className="flex-shrink-0 px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 text-white text-xs font-black tracking-[0.15em] uppercase hover:shadow-[0_0_28px_rgba(6,182,212,0.55)] hover:scale-105 transition-all whitespace-nowrap"
              >
                Добавить прокси
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Active Proxies List card ── */}
      <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c2333]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
            <h2 className="text-xs font-bold text-white tracking-[0.2em] uppercase">Список прокси</h2>
          </div>
          <button
            onClick={load}
            title="Обновить"
            className="w-8 h-8 rounded-lg bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40 transition-all"
          >
            <RefreshCw size={13} />
          </button>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-gray-600 text-sm">Загрузка...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1c2333]/60">
                  {['Имя', 'IP:Порт', 'URL ротации', 'Задержка', 'Статус', 'Действия'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((p, i) => {
                  const dot = DOT_COLORS[i % DOT_COLORS.length]
                  return (
                    <tr key={p.id} className="border-b border-[#1c2333]/40 hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: dot, boxShadow: `0 0 6px ${dot}` }}
                          />
                          <span className="font-semibold text-white text-sm">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-gray-300">
                        {p.ip}:{p.port}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs font-mono truncate max-w-[200px]">
                        {p.rotate_url ? `→ ${p.rotate_url.replace(/^https?:\/\//, '')}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {editingDelay === p.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              autoFocus
                              value={editDelayValue}
                              onChange={(e) => setEditDelayValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveDelay(p.id)
                                if (e.key === 'Escape') setEditingDelay(null)
                              }}
                              className="w-16 px-2 py-1 bg-[#080c12] border border-cyan-500/50 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                            />
                            <span className="text-gray-600 text-xs">сек</span>
                            <button
                              onClick={() => handleSaveDelay(p.id)}
                              disabled={savingDelay === p.id}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-40 transition-all"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => setEditingDelay(null)}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:bg-white/5 transition-all"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <span>{p.rotate_delay}s</span>
                            <button
                              onClick={() => handleEditDelay(p)}
                              title="Изменить задержку"
                              className="w-5 h-5 rounded flex items-center justify-center text-gray-600 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          АКТИВЕН
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCheck(p.id)}
                            disabled={checking === p.id}
                            title="Проверить"
                            className="w-8 h-8 rounded-lg bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40 disabled:opacity-40 transition-all"
                          >
                            <RefreshCw size={13} className={checking === p.id ? 'animate-spin' : ''} />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
                            title="Удалить"
                            className="w-8 h-8 rounded-lg bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-500 hover:text-red-400 hover:border-red-500/40 transition-all"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-600 text-sm">
                      Нет прокси
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {list.length > 0 && (
          <div className="px-6 py-4 border-t border-[#1c2333]/60">
              <span className="text-xs text-gray-600">Показано: {list.length} из {list.length}</span>
          </div>
        )}
      </div>
      {/* ── Bulk Import Modal ── */}
      {showBulkImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-[#0d1117] border border-[#1c2333] rounded-2xl p-6 shadow-2xl" style={{ boxShadow: '0 0 64px rgba(16,185,129,0.1)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-semibold">Массовый импорт прокси</h2>
              <button onClick={() => setShowBulkImport(false)} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">×</button>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Формат строки: <code className="text-cyan-400 bg-[#080c12] px-1.5 py-0.5 rounded">ip:порт:логин:пароль&#123;название&#125;</code><br />
              Каждый прокси с новой строки. Название в фигурных скобках необязательно.
            </p>

            <textarea
              value={bulkText}
              onChange={e => { setBulkText(e.target.value); setBulkParsed(null) }}
              className={`${inputCls} font-mono resize-none text-xs mb-4`}
              rows={8}
              placeholder={'192.168.0.1:8000:логин:пароль{серж1}\n192.168.0.1:8001:логин:пароль{серж2}\n192.168.0.1:8002:логин:пароль{серж3}'}
              spellCheck={false}
            />

            {bulkParsed && (
              <div className="bg-[#080c12] border border-[#1c2333] rounded-xl p-3 mb-4">
                <p className="text-xs text-emerald-400 font-semibold mb-2">Найдено прокси: {bulkParsed.length}</p>
                <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
                  {bulkParsed.map((p, i) => (
                    <div key={i} className="text-xs text-gray-500 flex items-center gap-2">
                      <span className="w-5 text-right text-gray-700">{i + 1}.</span>
                      <span className="text-white font-medium">{p.name}</span>
                      <span className="text-gray-600 font-mono">{p.ip}:{p.port}</span>
                      {p.login && <span className="text-gray-700">{p.login}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              {!bulkParsed ? (
                <button
                  onClick={handleBulkParse}
                  disabled={!bulkText.trim()}
                  className="flex-1 py-2.5 rounded-full font-bold text-sm uppercase tracking-widest text-black bg-gradient-to-r from-emerald-400 to-teal-500 hover:shadow-[0_0_24px_rgba(16,185,129,0.5)] hover:scale-[1.02] transition-all disabled:opacity-40 disabled:transform-none"
                >
                  Распознать
                </button>
              ) : (
                <button
                  onClick={handleBulkSubmit}
                  disabled={bulkLoading || bulkParsed.length === 0}
                  className="flex-1 py-2.5 rounded-full font-bold text-sm uppercase tracking-widest text-black bg-gradient-to-r from-emerald-400 to-teal-500 hover:shadow-[0_0_24px_rgba(16,185,129,0.5)] hover:scale-[1.02] transition-all disabled:opacity-40 disabled:transform-none"
                >
                  {bulkLoading ? 'Добавление...' : `Добавить ${bulkParsed.length} прокси`}
                </button>
              )}
              <button
                onClick={() => setShowBulkImport(false)}
                className="px-5 py-2.5 rounded-full text-sm font-semibold text-gray-500 border border-[#1c2333] hover:text-white hover:border-[#2a3a50] transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
