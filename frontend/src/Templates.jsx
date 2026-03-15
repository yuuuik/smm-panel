import { useEffect, useMemo, useRef, useState } from 'react'
import { createTemplate, deleteTemplate, getAccounts, getTemplates, updateTemplate, uploadImage, uploadsUrl } from './api'

const inputCls =
  'w-full px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_0_3px_rgba(6,182,212,0.15)] transition-all'

const labelCls = 'block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5'

const ACTION_OPTIONS = [
  { value: 'react_post', label: 'Реакция на пост' },
  { value: 'comment_post', label: 'Комментарий на пост' },
  { value: 'reply_comment', label: 'Ответ на комментарий' },
  { value: 'react_comment', label: 'Реакция на комментарий' },
]

const REACTION_OPTIONS = [
  { value: 'LIKE', label: 'Нравится' },
  { value: 'LOVE', label: 'Супер' },
  { value: 'WOW', label: 'Ух ты' },
  { value: 'HAHA', label: 'Смешно' },
]

const TARGET_OPTIONS = [
  { value: 'random', label: 'Случайный комментарий' },
  { value: 'last_bot_comment', label: 'Последний комментарий бота' },
]

function createTemplateForm() {
  return {
    name: '',
    actions: [],
  }
}

function createDraftAction(accountId = '') {
  return {
    action_type: 'react_post',
    account_id: accountId ? String(accountId) : '',
    text: '',
    image_path: '',
    image_file: '',
    target_comment: '',
    customTarget: false,
    reaction_type: 'LIKE',
    delay: 20,
  }
}

export default function Templates() {
  const [list, setList] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [templateForm, setTemplateForm] = useState(createTemplateForm())
  const [draftAction, setDraftAction] = useState(createDraftAction())
  const [editingIndex, setEditingIndex] = useState(null)
  const [editingTemplateId, setEditingTemplateId] = useState(null)
  const [exportCode, setExportCode] = useState(null)
  const [importCode, setImportCode] = useState('')
  const [importError, setImportError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const dragIndexRef = useRef(null)

  const accountsById = useMemo(
    () => Object.fromEntries(accounts.map((account) => [account.id, account])),
    [accounts],
  )

  const load = () => {
    setLoading(true)
    Promise.all([getTemplates(), getAccounts()])
      .then(([templates, accountList]) => {
        setList(templates)
        setAccounts(accountList)
      })
      .catch(() => setError('Не удалось загрузить шаблоны'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  useEffect(() => {
    if (!accounts.length || draftAction.account_id) return
    setDraftAction((current) => ({ ...current, account_id: String(accounts[0].id) }))
  }, [accounts, draftAction.account_id])

  const actionNeedsText = draftAction.action_type === 'comment_post' || draftAction.action_type === 'reply_comment'
  const actionNeedsReaction = draftAction.action_type === 'react_post' || draftAction.action_type === 'react_comment'
  const actionNeedsTarget = draftAction.action_type === 'reply_comment' || draftAction.action_type === 'react_comment'
  const actionNeedsImage = draftAction.action_type === 'comment_post' || draftAction.action_type === 'reply_comment'

  const resetDraft = () => {
    setDraftAction(createDraftAction(accounts[0]?.id))
    setEditingIndex(null)
  }

  const resetTemplateEditor = () => {
    setTemplateForm(createTemplateForm())
    setEditingTemplateId(null)
    resetDraft()
  }

  const hydrateTemplateForm = (template, { duplicate = false } = {}) => ({
    name: duplicate ? `${template.name} copy` : template.name,
    actions: renumberActions(
      (template.actions || []).map((action) => ({
        action_order: action.action_order,
        account_id: action.account_id,
        action_type: action.action_type,
        reaction_type: action.reaction_type || null,
        text: action.text || null,
        image_path: action.image_path || null,
        target_comment: action.target_comment || null,
        delay: action.delay ?? 20,
      })),
    ),
  })

  const validateDraft = () => {
    if (!draftAction.account_id) return 'Выберите аккаунт'
    if (draftAction.action_type === 'comment_post' && !draftAction.text.trim() && !draftAction.image_path) {
      return 'Для комментария нужен текст или изображение'
    }
    if (draftAction.action_type === 'reply_comment' && !draftAction.text.trim()) {
      return 'Для ответа нужен текст'
    }
    if ((draftAction.action_type === 'react_post' || draftAction.action_type === 'react_comment') && !draftAction.reaction_type) {
      return 'Требуется реакция'
    }
    return ''
  }

  const normalizeAction = (action, actionOrder) => ({
    action_order: actionOrder,
    account_id: Number(action.account_id),
    action_type: action.action_type,
    reaction_type: actionNeedsReaction || action.action_type.startsWith('react_') ? action.reaction_type : null,
    text: action.text.trim() || null,
    image_path: (action.action_type === 'comment_post' || action.action_type === 'reply_comment') ? action.image_path || null : null,
    target_comment: action.action_type === 'reply_comment' || action.action_type === 'react_comment'
      ? (action.target_comment || 'random').trim() || 'random'
      : null,
    delay: Number(action.delay) || 0,
  })

  const handleDraftImageChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const path = await uploadImage(file)
      setDraftAction((current) => ({ ...current, image_path: path, image_file: file.name }))
      setSuccess('Изображение загружено')
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleAddAction = () => {
    setError('')
    setSuccess('')
    const validationError = validateDraft()
    if (validationError) {
      setError(validationError)
      return
    }

    if (editingIndex !== null) {
      setTemplateForm((current) => ({
        ...current,
        actions: current.actions.map((action, index) => (
          index === editingIndex ? normalizeAction(draftAction, editingIndex + 1) : action
        )),
      }))
      setSuccess('Действие обновлено')
      resetDraft()
      return
    }

    const newActions = [normalizeAction(draftAction, templateForm.actions.length + 1)]
    setTemplateForm((current) => ({
      ...current,
      actions: [...current.actions, ...newActions],
    }))
    setSuccess('Действие добавлено')
    resetDraft()
  }

  const renumberActions = (actions) => actions.map((action, index) => ({ ...action, action_order: index + 1 }))

  const handleEditAction = (index) => {
    const action = templateForm.actions[index]
    const tc = action.target_comment || ''
    const isCustom = tc !== '' && tc !== 'random' && tc !== 'last_bot_comment'
    setEditingIndex(index)
    setDraftAction({
      action_type: action.action_type,
      account_id: String(action.account_id),
      text: action.text || '',
      image_path: action.image_path || '',
      image_file: action.image_path ? action.image_path.split('/').pop() || '' : '',
      target_comment: tc,
      customTarget: isCustom,
      reaction_type: action.reaction_type || 'LIKE',
      delay: action.delay ?? 20,
    })
  }

  const handleDeleteAction = (index) => {
    setTemplateForm((current) => ({
      ...current,
      actions: renumberActions(current.actions.filter((_, actionIndex) => actionIndex !== index)),
    }))
    if (editingIndex === index) resetDraft()
  }

  const handleDragEnd = (dropIndex) => {
    const src = dragIndexRef.current
    dragIndexRef.current = null
    if (src === null || src === dropIndex) return
    setTemplateForm((current) => {
      const next = [...current.actions]
      const [moved] = next.splice(src, 1)
      next.splice(dropIndex, 0, moved)
      return { ...current, actions: renumberActions(next) }
    })
    setEditingIndex((ei) => {
      if (ei === src) return dropIndex
      if (ei === dropIndex) return src
      return ei
    })
  }

  const handleMoveAction = (index, direction) => {
    const nextIndex = index + direction
    setTemplateForm((current) => {
      if (nextIndex < 0 || nextIndex >= current.actions.length) return current
      const next = [...current.actions]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return { ...current, actions: renumberActions(next) }
    })
    setEditingIndex((ei) => {
      if (ei === index) return nextIndex
      if (ei === nextIndex) return index
      return ei
    })
  }

  const handleDuplicateAction = (index) => {
    const action = templateForm.actions[index]
    const nextActions = [...templateForm.actions]
    nextActions.splice(index + 1, 0, { ...action })
    setTemplateForm((current) => ({
      ...current,
      actions: renumberActions(nextActions),
    }))
    setSuccess('Действие дублировано')
  }

  const handleCreateTemplate = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!templateForm.name.trim()) {
      setError('Укажите название шаблона')
      return
    }
    if (!templateForm.actions.length) {
      setError('Добавьте хотя бы одно действие')
      return
    }

    try {
      const payload = {
        name: templateForm.name.trim(),
        actions: renumberActions(templateForm.actions),
      }
      if (editingTemplateId !== null) {
        await updateTemplate(editingTemplateId, payload)
        setSuccess('Шаблон обновлён')
      } else {
        await createTemplate(payload)
        setSuccess('Шаблон создан')
      }
      resetTemplateEditor()
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleEditTemplate = (template) => {
    setError('')
    setSuccess('')
    setEditingTemplateId(template.id)
    setTemplateForm(hydrateTemplateForm(template))
    resetDraft()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDuplicateTemplate = async (template) => {
    setError('')
    setSuccess('')
    try {
      const payload = hydrateTemplateForm(template, { duplicate: true })
      await createTemplate(payload)
      setSuccess('Шаблон дублирован')
      load()
    } catch (err) {
      setError('Ошибка дублирования: ' + (err.detail || err.message))
    }
  }

  const handleExportTemplate = (template) => {
    const payload = {
      name: template.name,
      actions: (template.actions || []).map((a) => ({
        action_order: a.action_order,
        action_type: a.action_type,
        reaction_type: a.reaction_type || null,
        text: a.text || null,
        image_path: a.image_path || null,
        target_comment: a.target_comment || null,
        delay: a.delay ?? 20,
      })),
    }
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    setExportCode({ code, name: template.name })
  }

  const handleImport = async () => {
    setImportError('')
    try {
      const json = decodeURIComponent(escape(atob(importCode.trim())))
      const data = JSON.parse(json)
      if (!data.name || !Array.isArray(data.actions)) throw new Error('Неверный формат')
      const payload = {
        name: data.name,
        actions: renumberActions(data.actions.map((a, i) => ({
          action_order: i + 1,
          account_id: a.account_id || (accounts[0]?.id ?? 1),
          action_type: a.action_type || 'react_post',
          reaction_type: a.reaction_type || null,
          text: a.text || null,
          image_path: a.image_path || null,
          target_comment: a.target_comment || null,
          delay: a.delay ?? 20,
        }))),
      }
      await createTemplate(payload)
      setSuccess(`Шаблон «${data.name}» импортирован`)
      setImportCode('')
      setShowImport(false)
      load()
    } catch (e) {
      setImportError('Ошибка: ' + (e.detail || e.message || 'неверный код шаблона'))
    }
  }

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Удалить этот шаблон?')) return
    setError('')
    try {
      await deleteTemplate(id)
      if (editingTemplateId === id) {
        resetTemplateEditor()
      }
      setSuccess('Шаблон удалён')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const renderActionSummary = (action) => {
    const accountName = accountsById[action.account_id]?.name || `Аккаунт #${action.account_id}`
    let actionType = ''
    switch (action.action_type) {
      case 'react_post':
        actionType = 'Реакция на пост'; break;
      case 'comment_post':
        actionType = 'Комментарий на пост'; break;
      case 'reply_comment':
        actionType = 'Ответ на комментарий'; break;
      case 'react_comment':
        actionType = 'Реакция на комментарий'; break;
      default:
        actionType = action.action_type;
    }
    const target = action.target_comment ? ` | цель: ${action.target_comment}` : ''
    const reaction = action.reaction_type ? ` | реакция: ${action.reaction_type}` : ''
    const text = action.text ? ` | текст: ${action.text}` : ''
    const image = action.image_path ? ' | изображение' : ''
    return `${accountName} → ${actionType}${reaction}${target}${text}${image}`
  }

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Конструктор шаблонов</h1>
            <p className="text-base font-semibold text-gray-400 mt-1">Создавайте сценарии автоматизации</p>
          </div>
        </div>
      </div>

      {/* ── Notifications ── */}
      {error && (
        <div className="mb-5 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-5 px-4 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400 text-sm">
          {success}
        </div>
      )}

      {/* ── Two-column builder ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[460px_1fr] gap-5 mb-8">

        {/* LEFT: CONFIGURATION + ACTION DETAILS */}
        <div className="space-y-4">

          {/* CONFIGURATION card */}
          <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <h2 className="text-xs font-bold text-cyan-400 tracking-[0.2em] uppercase">Конфигурация</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Название шаблона</label>
                <input
                  value={templateForm.name}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))}
                  className={inputCls}
                  placeholder="Лайки + комменты"
                  required
                />
              </div>
            </div>
          </div>

          {/* ACTION DETAILS card */}
          <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-cyan-400 tracking-[0.2em] uppercase">Параметры действия</h2>
                {editingIndex !== null && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[10px] font-bold uppercase tracking-wider">
                    Редактирование #{editingIndex + 1}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {/* Action Type */}
              <div>
                <label className={labelCls}>Тип действия</label>
                <select
                  value={draftAction.action_type}
                  onChange={(event) => setDraftAction((current) => ({ ...current, action_type: event.target.value }))}
                  className={inputCls}
                >
                  {ACTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {/* Account */}
              <div>
                <label className={labelCls}>Аккаунт</label>
                <select
                  value={draftAction.account_id}
                  onChange={(event) => setDraftAction((current) => ({ ...current, account_id: event.target.value }))}
                  className={inputCls}
                >
                  <option value="">Выберите аккаунт</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </div>

              {/* Reaction pill buttons (if needed) */}
              {actionNeedsReaction && (
                <div>
                  <label className={labelCls}>Реакция</label>
                  <div className="flex gap-2 flex-wrap">
                    {REACTION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDraftAction((current) => ({ ...current, reaction_type: option.value }))}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          draftAction.reaction_type === option.value
                            ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                            : 'bg-[#080c12] border-[#1c2333] text-gray-500 hover:border-cyan-500/40 hover:text-gray-300'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Target comment (if needed) */}
              {actionNeedsTarget && (
                <div>
                  <label className={labelCls}>Цель (комментарий)</label>
                  <select
                    value={draftAction.customTarget ? '__custom__' : (draftAction.target_comment || '')}
                    onChange={(event) => {
                      const val = event.target.value
                      if (val === '__custom__') {
                        setDraftAction((current) => ({ ...current, target_comment: '', customTarget: true }))
                      } else {
                        setDraftAction((current) => ({ ...current, target_comment: val, customTarget: false }))
                      }
                    }}
                    className={inputCls}
                  >
                    <option value="">Выберите комментарий...</option>
                    <option value="random">Случайный комментарий</option>
                    <option value="last_bot_comment">Последний комментарий бота</option>
                    <option value="__custom__">Свой ID / comment #N...</option>
                  </select>
                  {draftAction.customTarget && (
                    <input
                      value={draftAction.target_comment}
                      onChange={(event) => setDraftAction((current) => ({ ...current, target_comment: event.target.value }))}
                      className={`${inputCls} mt-2`}
                      placeholder="Например: comment #1 или ID комментария"
                      autoFocus
                    />
                  )}
                </div>
              )}

              {/* Text (if needed) */}
              {actionNeedsText && (
                <div>
                  <label className={labelCls}>Текст сообщения</label>
                  <textarea
                    value={draftAction.text}
                    onChange={(event) => setDraftAction((current) => ({ ...current, text: event.target.value }))}
                    className={`${inputCls} resize-none`}
                    rows={3}
                    placeholder={draftAction.action_type === 'reply_comment' ? 'Введите текст ответа...' : 'Введите текст комментария...'}
                  />
                </div>
              )}

              {/* Delay + optional image row */}
              <div className={actionNeedsImage ? 'grid grid-cols-2 gap-3' : ''}>
                <div>
                  <label className={labelCls}>Задержка (сек)</label>
                  <input
                    type="number"
                    min="0"
                    value={draftAction.delay}
                    onChange={(event) => setDraftAction((current) => ({ ...current, delay: event.target.value }))}
                    className={inputCls}
                    placeholder="20"
                  />
                </div>
                {actionNeedsImage && (
                  <div>
                    <label className={labelCls}>Вложение</label>
                    <label className="cursor-pointer flex items-center gap-2 w-full px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl hover:border-cyan-500/40 transition-all">
                      <span className="text-gray-500 text-sm">📎</span>
                      <span className="text-xs text-gray-500 truncate">{draftAction.image_file || 'Выбрать файл...'}</span>
                      <input type="file" accept="image/*" onChange={handleDraftImageChange} className="hidden" />
                    </label>
                    {uploading && <p className="text-[10px] text-gray-500 mt-1">Загрузка...</p>}
                    {draftAction.image_path && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-cyan-400 truncate">{draftAction.image_path}</span>
                        <button
                          type="button"
                          onClick={() => setDraftAction((current) => ({ ...current, image_path: '', image_file: '' }))}
                          className="text-red-400 text-xs hover:text-red-300 transition-colors"
                        >✕</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Add / Update action button */}
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={handleAddAction}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all ${
                  editingIndex !== null
                    ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/25 hover:border-cyan-500/60'
                    : 'bg-gradient-to-r from-cyan-600 to-teal-500 text-white hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:brightness-110'
                }`}
              >
                {editingIndex !== null ? 'Сохранить изменения' : '+ Добавить действие'}
              </button>
              {editingIndex !== null && (
                <button
                  type="button"
                  onClick={resetDraft}
                  className="px-4 py-2.5 rounded-xl border border-[#1c2333] text-gray-500 text-xs font-semibold hover:border-red-500/40 hover:text-red-400 transition-all"
                >
                  Отмена
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: SEQUENCE BUILDER */}
        <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl flex flex-col min-h-[560px]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c2333]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-teal-400 font-bold">⚡</span>
                <h2 className="text-sm font-black text-white tracking-[0.2em] uppercase">Конструктор</h2>
              </div>
              <p className="text-sm font-semibold text-gray-400 mt-0.5">
                {editingIndex !== null
                  ? `Редактирование действия #${editingIndex + 1} — используйте форму слева`
                  : 'Стройте последовательность автоматизации шаг за шагом'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTemplateForm((current) => ({ ...current, actions: [] }))}
              className="px-4 py-1.5 rounded-full border border-purple-500/40 text-purple-400 text-[10px] font-bold tracking-[0.15em] uppercase hover:bg-purple-500/10 hover:shadow-[0_0_16px_rgba(168,85,247,0.3)] transition-all"
            >
              Очистить цепочку
            </button>
          </div>

          <div className="flex-1 p-5 space-y-2 overflow-y-auto">
            {templateForm.actions.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-700 text-xs tracking-widest uppercase">
                Действий пока нет
              </div>
            ) : (
              templateForm.actions.map((action, index) => {
                const seqColors = ['#00d4ff', '#a855f7', '#06b6d4', '#ec4899']
                const color = seqColors[index % seqColors.length]
                const accountName = accountsById[action.account_id]?.name || `Аккаунт #${action.account_id}`
                const typeLabel = ACTION_OPTIONS.find((o) => o.value === action.action_type)?.label || action.action_type
                const detail = [
                  action.reaction_type && `реакция: ${action.reaction_type}`,
                  action.target_comment && `цель: ${action.target_comment}`,
                  action.text && `"${action.text.slice(0, 28)}${action.text.length > 28 ? '…' : ''}"`,
                ].filter(Boolean).join(' · ')

                return (
                  <div
                    key={`${action.action_order}-${index}`}
                    draggable
                    onDragStart={() => { dragIndexRef.current = index }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDragEnd(index)}
                    onDragEnd={() => { dragIndexRef.current = null }}
                  >
                    <div
                      onClick={() => handleEditAction(index)}
                      className={`flex items-center gap-3 bg-[#080c12] border rounded-xl p-3.5 transition-all cursor-pointer ${
                        editingIndex === index
                          ? 'border-cyan-500/50 shadow-[0_0_16px_rgba(6,182,212,0.15)]'
                          : 'border-[#1c2333] hover:border-cyan-500/30 hover:bg-[#0a0f1a]'
                      }`}
                    >
                      {/* Drag handle */}
                      <div className="flex flex-col gap-[3px] flex-shrink-0 opacity-40 cursor-grab active:cursor-grabbing">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="flex gap-[3px]">
                            <div className="w-[3px] h-[3px] rounded-full bg-gray-500" />
                            <div className="w-[3px] h-[3px] rounded-full bg-gray-500" />
                          </div>
                        ))}
                      </div>
                      {/* Color accent badge */}
                      <div
                        className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-[11px] font-black"
                        style={{ backgroundColor: `${color}20`, color, boxShadow: `0 0 12px ${color}30` }}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          Шаг {String(index + 1).padStart(2, '0')}: {typeLabel.toUpperCase()}
                        </p>
                        <p className="text-[10px] text-gray-600 truncate mt-0.5">
                          {accountName}{detail ? ` · ${detail}` : ''}
                        </p>
                      </div>
                      {/* Delay */}
                      <span className="text-[10px] text-gray-700 flex-shrink-0">{action.delay}s</span>
                      {/* Action icons */}
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveAction(index, -1)}
                          disabled={index === 0}
                          title="Переместить вверх"
                          className="w-7 h-7 rounded-lg bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-600 hover:text-cyan-400 hover:border-cyan-500/40 disabled:opacity-20 transition-all text-xs"
                        >↑</button>
                        <button
                          type="button"
                          onClick={() => handleMoveAction(index, 1)}
                          disabled={index === templateForm.actions.length - 1}
                          title="Переместить вниз"
                          className="w-7 h-7 rounded-lg bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-600 hover:text-cyan-400 hover:border-cyan-500/40 disabled:opacity-20 transition-all text-xs"
                        >↓</button>
                        <button
                          type="button"
                          onClick={() => handleEditAction(index)}
                          title="Редактировать"
                          className="w-7 h-7 rounded-lg bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-600 hover:text-cyan-400 hover:border-cyan-500/40 transition-all text-xs"
                        >✎</button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateAction(index)}
                          title="Дублировать"
                          className="w-7 h-7 rounded-lg bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-600 hover:text-purple-400 hover:border-purple-500/40 transition-all text-xs"
                        >⊕</button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAction(index)}
                          title="Удалить"
                          className="w-7 h-7 rounded-lg bg-[#151b27] border border-[#1c2333] flex items-center justify-center text-gray-600 hover:text-red-400 hover:border-red-500/40 transition-all text-xs"
                        >✕</button>
                      </div>
                    </div>
                    {/* Connector line */}
                    {index < templateForm.actions.length - 1 && (
                      <div className="flex justify-center py-1">
                        <div className="w-px h-4 bg-gradient-to-b from-gray-700/50 to-transparent" />
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* Inject New Action Node */}
            <button
              type="button"
              onClick={handleAddAction}
              className="w-full py-4 border-2 border-dashed border-[#1c2333] rounded-xl text-gray-600 text-xs font-bold tracking-[0.2em] uppercase hover:border-cyan-500/40 hover:text-cyan-500 hover:bg-cyan-500/[0.03] transition-all flex items-center justify-center gap-2 mt-2"
            >
              <span className="text-base leading-none">+</span>
              <span>Добавить новое действие</span>
            </button>
          </div>

          {/* Bottom bar */}
          <div className="px-6 py-4 border-t border-[#1c2333] flex items-center justify-between gap-3">
            <div />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetTemplateEditor}
                className="px-4 py-2 rounded-full border border-[#1c2333] text-gray-500 text-xs font-bold tracking-wider uppercase hover:border-red-500/40 hover:text-red-400 transition-all"
              >
                Сбросить
              </button>
              <button
                type="button"
                onClick={handleCreateTemplate}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-cyan-600 to-teal-500 text-white text-xs font-black tracking-[0.15em] uppercase hover:shadow-[0_0_24px_rgba(6,182,212,0.5)] hover:scale-105 transition-all"
              >
                {editingTemplateId !== null ? 'Обновить сборку' : 'Сохранить сборку'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Export Modal ── */}
      {exportCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setExportCode(null)}>
          <div className="relative bg-[#0d1117] border border-[#1c2333] rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setExportCode(null)} className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-[#1c2333] flex items-center justify-center text-gray-500 hover:text-white transition-colors text-xs">✕</button>
            <p className="text-xs font-bold text-cyan-400 tracking-widest uppercase mb-1">Код шаблона</p>
            <p className="text-sm text-white font-semibold mb-4">{exportCode.name}</p>
            <textarea
              readOnly
              value={exportCode.code}
              className="w-full h-28 px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl text-xs text-gray-400 font-mono resize-none focus:outline-none"
              onClick={(e) => e.target.select()}
            />
            <button
              onClick={() => { navigator.clipboard.writeText(exportCode.code); setSuccess('Код скопирован') ; setExportCode(null) }}
              className="mt-3 w-full py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 text-xs font-bold hover:bg-cyan-500/25 transition-all"
            >
              Скопировать код
            </button>
          </div>
        </div>
      )}

      {/* ── Saved Templates ── */}
      <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-[#1c2333]">
          <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          <h2 className="text-xs font-bold text-white tracking-[0.2em] uppercase">Сохранённые шаблоны</h2>
          <span className="ml-auto px-2.5 py-0.5 rounded-full bg-[#151b27] border border-[#1c2333] text-gray-500 text-[10px] font-semibold">
            {list.length}
          </span>
          <button
            onClick={() => { setShowImport((v) => !v); setImportError(''); setImportCode('') }}
            className="ml-2 px-3 py-1 rounded-lg border border-purple-500/30 text-purple-400 text-[10px] font-bold hover:bg-purple-500/10 transition-all"
          >
            {showImport ? 'Отмена' : '↑ Импорт'}
          </button>
        </div>

        {showImport && (
          <div className="px-6 py-4 border-b border-[#1c2333] space-y-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Вставьте код шаблона</p>
            <textarea
              value={importCode}
              onChange={(e) => { setImportCode(e.target.value); setImportError('') }}
              placeholder="Вставьте код сюда..."
              rows={3}
              className="w-full px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl text-xs text-gray-300 font-mono resize-none focus:outline-none focus:border-purple-500 transition-colors"
            />
            {importError && <p className="text-xs text-red-400">{importError}</p>}
            <button
              onClick={handleImport}
              disabled={!importCode.trim()}
              className="px-5 py-2 rounded-xl bg-purple-500/15 border border-purple-500/40 text-purple-400 text-xs font-bold hover:bg-purple-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Импортировать шаблон
            </button>
          </div>
        )}

        {loading ? (
          <div className="px-6 py-12 text-center text-gray-600 text-sm">Загрузка...</div>
        ) : list.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-700 text-xs tracking-widest uppercase">
            Нет сохранённых шаблонов
          </div>
        ) : (
          <div className="divide-y divide-[#1c2333]/60">
            {list.map((template) => (
              <div key={template.id} className="p-5 hover:bg-white/[0.01] transition-colors">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1.5">
                    <h3 className="text-white font-semibold text-sm">{template.name}</h3>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="px-2 py-0.5 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-[10px] font-semibold">
                        {template.action_count || template.actions?.length || 0} действий
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-400/10 border border-purple-400/20 text-purple-400 text-[10px] font-semibold">
                        {template.account_ids?.length || 0} аккаунтов
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleExportTemplate(template)}
                      className="px-3.5 py-1.5 rounded-full border border-teal-500/30 text-teal-400 text-[10px] font-bold tracking-wider uppercase hover:bg-teal-500/10 transition-all"
                    >
                      Экспорт
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEditTemplate(template)}
                      className="px-3.5 py-1.5 rounded-full border border-cyan-500/30 text-cyan-400 text-[10px] font-bold tracking-wider uppercase hover:bg-cyan-500/10 hover:shadow-[0_0_12px_rgba(6,182,212,0.2)] transition-all"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateTemplate(template)}
                      className="px-3.5 py-1.5 rounded-full border border-purple-500/30 text-purple-400 text-[10px] font-bold tracking-wider uppercase hover:bg-purple-500/10 hover:shadow-[0_0_12px_rgba(168,85,247,0.2)] transition-all"
                    >
                      Клонировать
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="px-3.5 py-1.5 rounded-full border border-red-500/30 text-red-400 text-[10px] font-bold tracking-wider uppercase hover:bg-red-500/10 transition-all"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {(template.actions || []).slice(0, 3).map((action) => (
                    <div key={action.id} className="text-[11px] text-gray-600">
                      {action.action_order}. {renderActionSummary(action)}
                    </div>
                  ))}
                  {(template.actions || []).length > 3 && (
                    <p className="text-[10px] text-gray-700">+{template.actions.length - 3} ещё действий</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
