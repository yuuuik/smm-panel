import { useState, useEffect, useContext } from 'react'
import { getAccounts, createAccount, deleteAccount, checkAccount, getProxies, getOpenBrowsers, openAccountBrowser, closeAccountBrowser, updateAccount, importAccountsBulk, exportAccountsCode, importAccountsFromCode } from './api'
import { Zap, RefreshCw, User, AlertCircle, CheckCircle, Pencil, X, Eye, EyeOff, Upload, Download, KeyRound } from 'lucide-react'
import { AuthContext } from './App'

export default function Accounts() {
  const { isAdmin } = useContext(AuthContext)
  const [list, setList] = useState([])
  const [proxies, setProxies] = useState([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(null)
  const [recheckingAll, setRecheckingAll] = useState(false)
  const [showBrowserOnCheck, setShowBrowserOnCheck] = useState(true)
  const [openBrowsers, setOpenBrowsers] = useState(new Set())
  const [browserLoading, setBrowserLoading] = useState(new Set())
  const [form, setForm] = useState({ name: '', cookies: '', user_agent: '', proxy_id: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingAccount, setEditingAccount] = useState(null)  // account object being edited
  const [editForm, setEditForm] = useState({ name: '', user_agent: '', proxy_id: '', cookies: '' })
  const [cookiesVisible, setCookiesVisible] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  // Import from TXT (AdsPower)
  const [showImport, setShowImport] = useState(false)
  const [importTxt, setImportTxt] = useState('')
  const [importProxyId, setImportProxyId] = useState('')
  const [importParsed, setImportParsed] = useState(null)   // parsed preview
  const [importLoading, setImportLoading] = useState(false)

  // Export code
  const [showExport, setShowExport] = useState(false)
  const [exportCode, setExportCode] = useState('')
  const [exportCount, setExportCount] = useState(0)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportCopied, setExportCopied] = useState(false)

  // Import from code
  const [showImportCode, setShowImportCode] = useState(false)
  const [importCode, setImportCode] = useState('')
  const [importCodeProxyId, setImportCodeProxyId] = useState('')
  const [importCodeLoading, setImportCodeLoading] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([getAccounts(), getProxies(), getOpenBrowsers().catch(() => ({ open: [] }))])
      .then(([acc, pr, ob]) => { setList(acc); setProxies(pr); setOpenBrowsers(new Set(ob.open)) })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    try {
      await createAccount({
        name: form.name,
        cookies: form.cookies,
        user_agent: form.user_agent || null,
        proxy_id: form.proxy_id ? Number(form.proxy_id) : null,
      })
      setSuccess('Аккаунт добавлен')
      setForm({ name: '', cookies: '', user_agent: '', proxy_id: '' })
      load()
    } catch (err) { setError(err.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Удалить аккаунт?')) return
    try { await deleteAccount(id); setSuccess('Удалено'); load() }
    catch (err) { setError(err.message) }
  }

  const handleEditOpen = (a) => {
    setEditingAccount(a)
    setEditForm({ name: a.name, user_agent: a.user_agent || '', proxy_id: a.proxy_id ? String(a.proxy_id) : '', cookies: a.cookies || '' })
    setCookiesVisible(false)
  }

  const handleEditSave = async () => {
    setEditSaving(true)
    try {
      await updateAccount(editingAccount.id, {
        name: editForm.name,
        user_agent: editForm.user_agent || null,
        proxy_id: editForm.proxy_id ? Number(editForm.proxy_id) : null,
        cookies: editForm.cookies,
      })
      setSuccess('Аккаунт обновлён')
      setEditingAccount(null)
      load()
    } catch (err) { setError(err.message) }
    finally { setEditSaving(false) }
  }

  const handleCheck = async (id) => {
    setChecking(id); setError(''); setSuccess('')
    try {
      const res = await checkAccount(id, { show_browser: showBrowserOnCheck })
      setSuccess(res.is_authorized ? 'Аккаунт авторизован' : res.message || 'Проверка завершена')
    } catch (err) { setError(err.message) }
    finally { setChecking(null) }
  }

  const handleRecheckAll = async () => {
    setRecheckingAll(true); setError(''); setSuccess('')
    try {
      for (const a of list) await checkAccount(a.id, { show_browser: showBrowserOnCheck }).catch(() => {})
      setSuccess('Все аккаунты проверены')
      load()
    } finally { setRecheckingAll(false) }
  }

  // ── AdsPower TXT parser ──
  function parseAdsPowerTxt(text) {
    const blocks = text.split(/\n\s*\n/).filter(b => b.trim())
    return blocks.map(block => {
      const obj = {}
      for (const line of block.trim().split('\n')) {
        const idx = line.indexOf('=')
        if (idx > -1) {
          obj[line.substring(0, idx).trim()] = line.substring(idx + 1).trim()
        }
      }
      return { name: obj.name || obj.id || '', cookies: obj.cookie || '', user_agent: obj.ua || '' }
    }).filter(a => a.name && a.cookies)
  }

  const handleImportParse = () => {
    const parsed = parseAdsPowerTxt(importTxt)
    setImportParsed(parsed)
  }

  const handleImportSubmit = async () => {
    if (!importParsed || importParsed.length === 0) return
    setImportLoading(true)
    try {
      await importAccountsBulk({ accounts: importParsed, proxy_id: importProxyId ? Number(importProxyId) : null })
      setSuccess(`Импортировано ${importParsed.length} аккаунтов`)
      setShowImport(false)
      setImportTxt(''); setImportParsed(null); setImportProxyId('')
      load()
    } catch (err) { setError(err.message) }
    finally { setImportLoading(false) }
  }

  const handleExportOpen = async () => {
    setShowExport(true)
    setExportCode(''); setExportCopied(false)
    setExportLoading(true)
    try {
      const res = await exportAccountsCode()
      setExportCode(res.code)
      setExportCount(res.count)
    } catch (err) { setError(err.message); setShowExport(false) }
    finally { setExportLoading(false) }
  }

  const handleExportCopy = () => {
    navigator.clipboard.writeText(exportCode).then(() => {
      setExportCopied(true)
      setTimeout(() => setExportCopied(false), 2000)
    })
  }

  const handleImportFromCode = async () => {
    if (!importCode.trim()) return
    setImportCodeLoading(true)
    try {
      const res = await importAccountsFromCode(importCode.trim(), importCodeProxyId ? Number(importCodeProxyId) : null)
      setSuccess(`Импортировано ${res.length} аккаунтов`)
      setShowImportCode(false)
      setImportCode(''); setImportCodeProxyId('')
      load()
    } catch (err) { setError(err.message) }
    finally { setImportCodeLoading(false) }
  }

  const inputCls = 'w-full px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl text-white text-sm placeholder-[#3d4f6a] focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors'

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Аккаунты</h1>
        <p className="text-base font-semibold text-gray-400 mt-1">Управляйте аккаунтами, прокси и сессиями.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">

        {/* ── LEFT: Add form ── */}
        <div
          className="bg-[#0d1117] border border-[#1c2333] rounded-2xl p-5"
          style={{ boxShadow: '0 0 32px rgba(6,182,212,0.04)' }}
        >
          <div className="flex items-center gap-2 mb-5">
            <User size={16} className="text-cyan-400" />
            <h2 className="text-white font-semibold">Добавить аккаунт</h2>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#4b6080] mb-1.5">Имя аккаунта</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputCls}
                placeholder="Ivan Petrov"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#4b6080] mb-1.5">JSON Cookies</label>
              <textarea
                value={form.cookies}
                onChange={(e) => setForm((f) => ({ ...f, cookies: e.target.value }))}
                className={`${inputCls} font-mono resize-none`}
                rows={4}
                placeholder={`[{ 'name': 'auth', ... }]`}
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#4b6080] mb-1.5">User Agent</label>
              <input
                value={form.user_agent}
                onChange={(e) => setForm((f) => ({ ...f, user_agent: e.target.value }))}
                className={inputCls}
                placeholder="Mozilla/5.0..."
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#4b6080] mb-1.5">Прокси</label>
              <select
                value={form.proxy_id}
                onChange={(e) => setForm((f) => ({ ...f, proxy_id: e.target.value }))}
                className={inputCls}
              >
                <option value="">Выбрать прокси...</option>
                {proxies.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>



            {/* Submit */}
            <button
              type="submit"
              className="w-full mt-1 flex items-center justify-center gap-2 py-3 rounded-full font-bold text-sm uppercase tracking-widest text-black bg-gradient-to-r from-cyan-400 to-teal-500 hover:shadow-[0_0_28px_rgba(6,182,212,0.55)] hover:scale-[1.02] transition-all"
            >
              <Zap size={15} />
              Добавить аккаунт
            </button>
          </form>
        </div>

        {/* ── RIGHT: Table ── */}
        <div
          className="bg-[#0d1117] border border-[#1c2333] rounded-2xl overflow-hidden flex flex-col"
          style={{ boxShadow: '0 0 32px rgba(6,182,212,0.04)' }}
        >
          {/* Table header */}
          <div className="px-5 py-4 border-b border-[#1c2333] flex items-center gap-3 flex-wrap justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleRecheckAll}
                disabled={recheckingAll || list.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-cyan-400 border border-cyan-500/40 rounded-full hover:bg-cyan-500/10 transition-colors disabled:opacity-40"
              >
                <RefreshCw size={12} className={recheckingAll ? 'animate-spin' : ''} />
                Проверить все
              </button>
              <button
                type="button"
                onClick={() => { setShowImport(true); setImportParsed(null); setImportTxt('') }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 border border-emerald-500/40 rounded-full hover:bg-emerald-500/10 transition-colors"
              >
                <Upload size={12} />
                Импорт TXT
              </button>
              <button
                type="button"
                onClick={() => { setShowImportCode(true); setImportCode('') }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-violet-400 border border-violet-500/40 rounded-full hover:bg-violet-500/10 transition-colors"
              >
                <KeyRound size={12} />
                По коду
              </button>
              <button
                type="button"
                onClick={handleExportOpen}
                disabled={list.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-orange-400 border border-orange-500/40 rounded-full hover:bg-orange-500/10 transition-colors disabled:opacity-40"
              >
                <Download size={12} />
                Экспорт кода
              </button>
            </div>
            <span className="text-xs font-mono text-[#4b6080]">
              Всего: <span className="text-cyan-400 font-bold">{list.length}</span>
            </span>
          </div>

          {loading ? (
            <p className="p-6 text-[#4b6080] text-sm">Загрузка...</p>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-[#1c2333]">
                    {['Имя', 'Прокси', 'Последняя проверка', 'Статус', 'Действия'].map((h) => (
                      <th key={h} className="px-5 py-3 text-[10px] font-semibold tracking-widest uppercase text-[#3d4f6a]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => {
                    const proxyName = proxies.find((p) => p.id === a.proxy_id)?.name ?? '—'
                    return (
                      <tr key={a.id} className="border-b border-[#1c2333]/60 hover:bg-[#0f1520] transition-colors group">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#1c2333] border border-[#2a3a50] flex items-center justify-center">
                              <User size={13} className="text-cyan-400/70" />
                            </div>
                            <span className="text-white font-medium">{a.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[#4b6080] text-xs">{proxyName}</span>
                        </td>
                        <td className="px-5 py-3 text-[#4b6080] text-xs">
                          {a.last_check ? new Date(a.last_check).toLocaleString() : '—'}
                        </td>
                        <td className="px-5 py-3">
                          {a.is_valid === true && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[rgba(6,182,212,0.12)] text-cyan-400 border border-cyan-500/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" /> Активен
                            </span>
                          )}
                          {a.is_valid === false && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[rgba(239,68,68,0.12)] text-red-400 border border-red-500/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> Ошибка
                            </span>
                          )}
                          {a.is_valid == null && <span className="text-[#3d4f6a] text-xs">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleCheck(a.id)}
                              disabled={checking === a.id}
                              className="text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-40 transition-colors"
                            >
                              {checking === a.id ? 'Проверка...' : 'Проверить'}
                            </button>
                            <button
                              onClick={() => handleEditOpen(a)}
                              className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                            >
                              Изменить
                            </button>
                            <button
                              onClick={() => handleDelete(a.id)}
                              className="text-xs text-[#4b6080] hover:text-red-400 transition-colors"
                            >
                              Удалить
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-[#3d4f6a] text-sm">Нет аккаунтов</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer tip */}
          {list.length > 0 && (
            <div className="px-5 py-3 border-t border-[#1c2333] flex items-start gap-3 bg-[rgba(6,182,212,0.04)]">
              <div className="w-7 h-7 flex-shrink-0 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mt-0.5">
                <span className="text-cyan-400 text-xs font-bold">i</span>
              </div>
              <p className="text-xs text-[#6b7f96] leading-relaxed">
                Проверяйте аккаунты регулярно. Статус <span className="text-cyan-400 font-semibold">OK</span> означает успешную авторизацию.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Import TXT modal ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-[#0d1117] border border-[#1c2333] rounded-2xl p-6 shadow-2xl" style={{ boxShadow: '0 0 64px rgba(16,185,129,0.1)' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Upload size={15} className="text-emerald-400" />
                <h2 className="text-white font-semibold">Импорт аккаунтов (AdsPower TXT)</h2>
              </div>
              <button onClick={() => setShowImport(false)} className="text-[#4b6080] hover:text-white transition-colors"><X size={18} /></button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#4b6080] mb-1.5">Вставьте содержимое TXT файла</label>
                <textarea
                  value={importTxt}
                  onChange={e => { setImportTxt(e.target.value); setImportParsed(null) }}
                  className={`${inputCls} font-mono resize-none text-xs`}
                  rows={8}
                  placeholder={"acc_id=28858\nid=kxqtsf0\nname=serzh10\ncookie=[{...}]\nua=Mozilla/5.0...\n\nacc_id=...\n..."}
                  spellCheck={false}
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#4b6080] mb-1.5">Прокси для всех аккаунтов</label>
                <select
                  value={importProxyId}
                  onChange={e => setImportProxyId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Без прокси</option>
                  {proxies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {importParsed && (
                <div className="bg-[#080c12] border border-[#1c2333] rounded-xl p-3">
                  <p className="text-xs text-emerald-400 font-semibold mb-2">Найдено аккаунтов: {importParsed.length}</p>
                  <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
                    {importParsed.map((a, i) => (
                      <div key={i} className="text-xs text-[#6b7f96] flex items-center gap-2">
                        <span className="w-5 text-right text-[#3d4f6a]">{i + 1}.</span>
                        <span className="text-white font-medium">{a.name}</span>
                        {a.user_agent && <span className="text-[#3d4f6a] truncate max-w-[200px]">{a.user_agent.substring(0, 40)}…</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-6">
              {!importParsed ? (
                <button
                  onClick={handleImportParse}
                  disabled={!importTxt.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-bold text-sm uppercase tracking-widest text-black bg-gradient-to-r from-emerald-400 to-teal-500 hover:shadow-[0_0_24px_rgba(16,185,129,0.5)] hover:scale-[1.02] transition-all disabled:opacity-40 disabled:transform-none"
                >
                  Распознать
                </button>
              ) : (
                <button
                  onClick={handleImportSubmit}
                  disabled={importLoading || importParsed.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-bold text-sm uppercase tracking-widest text-black bg-gradient-to-r from-emerald-400 to-teal-500 hover:shadow-[0_0_24px_rgba(16,185,129,0.5)] hover:scale-[1.02] transition-all disabled:opacity-40 disabled:transform-none"
                >
                  {importLoading ? 'Импорт...' : `Импортировать ${importParsed.length} аккаунтов`}
                </button>
              )}
              <button
                onClick={() => setShowImport(false)}
                className="px-5 py-2.5 rounded-full text-sm font-semibold text-[#4b6080] border border-[#1c2333] hover:text-white hover:border-[#2a3a50] transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export code modal ── */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0d1117] border border-[#1c2333] rounded-2xl p-6 shadow-2xl" style={{ boxShadow: '0 0 64px rgba(251,146,60,0.1)' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Download size={15} className="text-orange-400" />
                <h2 className="text-white font-semibold">Экспорт аккаунтов — код</h2>
              </div>
              <button onClick={() => setShowExport(false)} className="text-[#4b6080] hover:text-white transition-colors"><X size={18} /></button>
            </div>

            {exportLoading ? (
              <p className="text-[#4b6080] text-sm py-4 text-center">Генерация кода...</p>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-[#6b7f96]">Код содержит <span className="text-orange-400 font-bold">{exportCount}</span> аккаунтов (куки + UA). Передайте его другому пользователю для импорта.</p>
                <div>
                  <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#4b6080] mb-1.5">Код экспорта</label>
                  <textarea
                    readOnly
                    value={exportCode}
                    className={`${inputCls} font-mono resize-none text-xs`}
                    rows={5}
                    onClick={e => e.target.select()}
                  />
                </div>
                <button
                  onClick={handleExportCopy}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full font-bold text-sm uppercase tracking-widest text-black bg-gradient-to-r from-orange-400 to-amber-500 hover:shadow-[0_0_24px_rgba(251,146,60,0.5)] hover:scale-[1.02] transition-all"
                >
                  {exportCopied ? '✓ Скопировано!' : 'Копировать код'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Import from code modal ── */}
      {showImportCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0d1117] border border-[#1c2333] rounded-2xl p-6 shadow-2xl" style={{ boxShadow: '0 0 64px rgba(139,92,246,0.1)' }}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <KeyRound size={15} className="text-violet-400" />
                <h2 className="text-white font-semibold">Импорт по коду</h2>
              </div>
              <button onClick={() => setShowImportCode(false)} className="text-[#4b6080] hover:text-white transition-colors"><X size={18} /></button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#4b6080] mb-1.5">Код экспорта</label>
                <textarea
                  value={importCode}
                  onChange={e => setImportCode(e.target.value)}
                  className={`${inputCls} font-mono resize-none text-xs`}
                  rows={5}
                  placeholder="Вставьте код экспорта..."
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#4b6080] mb-1.5">Прокси для всех аккаунтов</label>
                <select
                  value={importCodeProxyId}
                  onChange={e => setImportCodeProxyId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Без прокси</option>
                  {proxies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleImportFromCode}
                disabled={importCodeLoading || !importCode.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-bold text-sm uppercase tracking-widest text-black bg-gradient-to-r from-violet-400 to-purple-500 hover:shadow-[0_0_24px_rgba(139,92,246,0.5)] hover:scale-[1.02] transition-all disabled:opacity-40 disabled:transform-none"
              >
                {importCodeLoading ? 'Импорт...' : 'Импортировать'}
              </button>
              <button
                onClick={() => setShowImportCode(false)}
                className="px-5 py-2.5 rounded-full text-sm font-semibold text-[#4b6080] border border-[#1c2333] hover:text-white hover:border-[#2a3a50] transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit account modal ── */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-lg bg-[#0d1117] border border-[#1c2333] rounded-2xl p-6 shadow-2xl"
            style={{ boxShadow: '0 0 64px rgba(6,182,212,0.1)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Pencil size={15} className="text-yellow-400" />
                <h2 className="text-white font-semibold">Редактировать аккаунт</h2>
              </div>
              <button onClick={() => setEditingAccount(null)} className="text-[#4b6080] hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Name */}
              <div>
                <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#4b6080] mb-1.5">Имя аккаунта</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                  placeholder="Ivan Petrov"
                />
              </div>

              {/* Proxy */}
              <div>
                <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#4b6080] mb-1.5">Прокси</label>
                <select
                  value={editForm.proxy_id}
                  onChange={(e) => setEditForm(f => ({ ...f, proxy_id: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Без прокси</option>
                  {proxies.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* User Agent */}
              <div>
                <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#4b6080] mb-1.5">User Agent</label>
                <input
                  value={editForm.user_agent}
                  onChange={(e) => setEditForm(f => ({ ...f, user_agent: e.target.value }))}
                  className={inputCls}
                  placeholder="Mozilla/5.0..."
                />
              </div>

              {/* Cookies */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#4b6080]">JSON Cookies</label>
                  <button
                    type="button"
                    onClick={() => setCookiesVisible(v => !v)}
                    className="flex items-center gap-1 text-[10px] text-[#4b6080] hover:text-cyan-400 transition-colors"
                  >
                    {cookiesVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                    {cookiesVisible ? 'Скрыть' : 'Показать'}
                  </button>
                </div>
                {cookiesVisible ? (
                  <textarea
                    value={editForm.cookies}
                    onChange={(e) => setEditForm(f => ({ ...f, cookies: e.target.value }))}
                    className={`${inputCls} font-mono resize-none text-xs`}
                    rows={6}
                    spellCheck={false}
                  />
                ) : (
                  <div
                    className="w-full px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl text-[#3d4f6a] text-sm cursor-pointer hover:border-[#2a3a50] transition-colors"
                    onClick={() => setCookiesVisible(true)}
                  >
                    ••••••••••••••••••••  (нажмите чтобы показать)
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleEditSave}
                disabled={editSaving || !editForm.name.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full font-bold text-sm uppercase tracking-widest text-black bg-gradient-to-r from-cyan-400 to-teal-500 hover:shadow-[0_0_24px_rgba(6,182,212,0.5)] hover:scale-[1.02] transition-all disabled:opacity-40 disabled:transform-none"
              >
                {editSaving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                onClick={() => setEditingAccount(null)}
                className="px-5 py-2.5 rounded-full text-sm font-semibold text-[#4b6080] border border-[#1c2333] hover:text-white hover:border-[#2a3a50] transition-colors"
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
