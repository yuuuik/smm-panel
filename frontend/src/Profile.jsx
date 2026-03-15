import { useState, useEffect } from 'react'
import { me, updateProfile, changePassword, sendVerificationCode, confirmVerification } from './api'
import { User, Mail, Send, Lock, Eye, EyeOff, CheckCircle, AlertCircle, Save, ShieldCheck, ShieldAlert, KeyRound } from 'lucide-react'

const inputCls =
  'w-full px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all'

const labelCls = 'block text-[10px] font-semibold tracking-widest uppercase text-gray-500 mb-1.5'

function Notice({ type, msg, onClose }) {
  if (!msg) return null
  const isErr = type === 'error'
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm mb-0 ${
        isErr
          ? 'bg-red-500/10 border border-red-500/30 text-red-400'
          : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
      }`}
    >
      {isErr ? <AlertCircle size={14} /> : <CheckCircle size={14} />}
      <span className="flex-1">{msg}</span>
      <button onClick={onClose} className="text-xs opacity-60 hover:opacity-100 ml-2">✕</button>
    </div>
  )
}

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [infoForm, setInfoForm] = useState({ email: '', telegram: '' })
  const [infoMsg, setInfoMsg] = useState({ type: '', text: '' })
  const [infoLoading, setInfoLoading] = useState(false)

  // Email verification
  const [verifyStep, setVerifyStep] = useState(null) // null | 'code_sent'
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyMsg, setVerifyMsg] = useState({ type: '', text: '' })

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    me().then((data) => {
      setProfile(data)
      setInfoForm({
        email: data.email || '',
        telegram: data.telegram || '',
      })
    }).catch(() => {})
  }, [])

  const handleInfoSave = async (e) => {
    e.preventDefault()
    setInfoMsg({ type: '', text: '' })
    if (infoForm.email && (!infoForm.email.includes('@') || infoForm.email.length < 5)) {
      setInfoMsg({ type: 'error', text: 'Неверный формат email' })
      return
    }
    setInfoLoading(true)
    try {
      const updated = await updateProfile({
        email: infoForm.email || null,
        telegram: infoForm.telegram || null,
      })
      setProfile(updated)
      // If email was changed, reset verification UI
      setVerifyStep(null)
      setVerifyCode('')
      setVerifyMsg({ type: '', text: '' })
      setInfoMsg({ type: 'success', text: 'Профиль сохранён' })
    } catch (err) {
      setInfoMsg({ type: 'error', text: err.message })
    } finally {
      setInfoLoading(false)
    }
  }

  const handleSendCode = async () => {
    setVerifyMsg({ type: '', text: '' })
    setVerifyLoading(true)
    try {
      const res = await sendVerificationCode()
      setVerifyStep('code_sent')
      setVerifyCode('')
      setVerifyMsg({ type: 'success', text: res.message || 'Код отправлен' })
    } catch (err) {
      setVerifyMsg({ type: 'error', text: err.message })
    } finally {
      setVerifyLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (verifyCode.trim().length !== 6) {
      setVerifyMsg({ type: 'error', text: 'Введите 6-значный код' })
      return
    }
    setVerifyLoading(true)
    setVerifyMsg({ type: '', text: '' })
    try {
      await confirmVerification(verifyCode.trim())
      const updated = await me()
      setProfile(updated)
      setVerifyStep(null)
      setVerifyCode('')
      setVerifyMsg({ type: 'success', text: 'Email успешно подтверждён!' })
    } catch (err) {
      setVerifyMsg({ type: 'error', text: err.message })
    } finally {
      setVerifyLoading(false)
    }
  }

  const handlePwSave = async (e) => {
    e.preventDefault()
    setPwMsg({ type: '', text: '' })
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'Новые пароли не совпадают' })
      return
    }
    if (pwForm.next.length < 6) {
      setPwMsg({ type: 'error', text: 'Новый пароль должен содержать минимум 6 символов' })
      return
    }
    setPwLoading(true)
    try {
      await changePassword(pwForm.current, pwForm.next)
      setPwMsg({ type: 'success', text: 'Пароль успешно изменён' })
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message })
    } finally {
      setPwLoading(false)
    }
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-600 text-sm">
        Загрузка...
      </div>
    )
  }

  const emailVerified = Boolean(profile.is_email_verified)
  const hasEmail = Boolean(profile.email)

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Профиль</h1>
        <p className="text-base font-semibold text-gray-400 mt-1">Управляйте своей учётной записью</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* ── Account info card ── */}
        <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl p-6 flex flex-col gap-5">

          {/* Avatar + identity row */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-purple-600/30 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
              <User size={26} className="text-cyan-400" />
            </div>
            <div>
              <p className="text-white font-bold text-base">{profile.username}</p>
              <p className="text-sm font-semibold text-gray-400 mt-0.5">
                С нами с{' '}
                {profile.created_at
                  ? new Date(profile.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '—'}
              </p>
            </div>
          </div>

          <div className="h-px bg-[#1c2333]" />

          {/* Info form */}
          <form onSubmit={handleInfoSave} className="flex flex-col gap-4">
            {/* Email field */}
            <div>
              <label className={labelCls}>
                Email
              </label>
              {emailVerified ? (
                /* Verified — read-only display */
                <div className="flex items-center gap-2 px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl">
                  <Mail size={14} className="text-gray-600 flex-shrink-0" />
                  <span className="text-white text-sm flex-1">{profile.email}</span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2 py-0.5">
                    <ShieldCheck size={11} />
                    Подтверждён
                  </span>
                </div>
              ) : (
                /* Not verified — editable */
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type="email"
                    value={infoForm.email}
                    onChange={(e) => setInfoForm((f) => ({ ...f, email: e.target.value }))}
                    className={`${inputCls} pl-9`}
                    placeholder="you@example.com"
                  />
                </div>
              )}
              {!emailVerified && (
                <p className="text-[10px] text-gray-600 mt-1">
                  После подтверждения email изменить будет нельзя
                </p>
              )}
            </div>

            {/* Email verification section */}
            {!emailVerified && hasEmail && (
              <div className="flex flex-col gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <div className="flex items-center gap-2 text-amber-400">
                  <ShieldAlert size={15} />
                  <span className="text-xs font-semibold">Email не подтверждён</span>
                </div>
                <p className="text-[11px] text-gray-500">
                  Подтвердите email, чтобы получить возможность запускать задачи.
                </p>

                {verifyStep !== 'code_sent' ? (
                  <button
                    type="button"
                    onClick={handleSendCode}
                    disabled={verifyLoading}
                    className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-widest text-black bg-gradient-to-r from-amber-400 to-orange-500 hover:shadow-[0_0_16px_rgba(245,158,11,0.4)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none self-start"
                  >
                    <Send size={12} />
                    {verifyLoading ? 'Отправка...' : 'Отправить код'}
                  </button>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <div>
                      <label className={labelCls}>Код из письма</label>
                      <div className="relative">
                        <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                        <input
                          type="text"
                          value={verifyCode}
                          onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className={`${inputCls} pl-9 tracking-[0.4em] font-mono text-lg`}
                          placeholder="000000"
                          maxLength={6}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleVerifyCode}
                        disabled={verifyLoading || verifyCode.length !== 6}
                        className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-widest text-black bg-gradient-to-r from-cyan-400 to-teal-500 hover:shadow-[0_0_16px_rgba(6,182,212,0.4)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                      >
                        <ShieldCheck size={12} />
                        {verifyLoading ? 'Проверка...' : 'Подтвердить'}
                      </button>
                      <button
                        type="button"
                        onClick={handleSendCode}
                        disabled={verifyLoading}
                        className="text-[10px] text-gray-500 hover:text-cyan-400 transition-colors disabled:opacity-40"
                      >
                        Отправить снова
                      </button>
                    </div>
                  </div>
                )}

                {verifyMsg.text && (
                  <Notice type={verifyMsg.type} msg={verifyMsg.text} onClose={() => setVerifyMsg({ type: '', text: '' })} />
                )}
              </div>
            )}

            {/* Telegram field */}
            <div>
              <label className={labelCls}>
                Telegram
              </label>
              <div className="relative">
                <Send size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="text"
                  value={infoForm.telegram}
                  onChange={(e) => setInfoForm((f) => ({ ...f, telegram: e.target.value }))}
                  className={`${inputCls} pl-9`}
                  placeholder="@username"
                />
              </div>
              <p className="text-[10px] text-gray-600 mt-1.5">Символ @ необязателен</p>
            </div>

            {infoMsg.text && (
              <Notice type={infoMsg.type} msg={infoMsg.text} onClose={() => setInfoMsg({ type: '', text: '' })} />
            )}

            {!emailVerified && (
              <button
                type="submit"
                disabled={infoLoading}
                className="flex items-center justify-center gap-2 py-2.5 rounded-full font-bold text-sm uppercase tracking-widest text-black bg-gradient-to-r from-cyan-400 to-teal-500 hover:shadow-[0_0_24px_rgba(6,182,212,0.5)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
              >
                <Save size={14} />
                {infoLoading ? 'Сохранение...' : 'Сохранить'}
              </button>
            )}

            {emailVerified && (
              /* When email is locked, only telegram is editable */
              <button
                type="submit"
                disabled={infoLoading}
                className="flex items-center justify-center gap-2 py-2.5 rounded-full font-bold text-sm uppercase tracking-widest text-black bg-gradient-to-r from-cyan-400 to-teal-500 hover:shadow-[0_0_24px_rgba(6,182,212,0.5)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
              >
                <Save size={14} />
                {infoLoading ? 'Сохранение...' : 'Сохранить'}
              </button>
            )}
          </form>
        </div>

        {/* ── Change password card ── */}
        <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-purple-400" />
            <h2 className="text-white font-semibold">Изменить пароль</h2>
          </div>

          <div className="h-px bg-[#1c2333]" />

          <form onSubmit={handlePwSave} className="flex flex-col gap-4">
            {/* Current password */}
            <div>
              <label className={labelCls}>Текущий пароль</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={pwForm.current}
                  onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                  className={`${inputCls} pl-9 pr-10`}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-cyan-400 transition-colors"
                >
                  {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className={labelCls}>Новый пароль</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type={showNext ? 'text' : 'password'}
                  value={pwForm.next}
                  onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                  className={`${inputCls} pl-9 pr-10`}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowNext((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-cyan-400 transition-colors"
                >
                  {showNext ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[10px] text-gray-600 mt-1.5">Минимум 6 символов</p>
            </div>

            {/* Confirm new password */}
            <div>
              <label className={labelCls}>Повторите новый пароль</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                  className={`${inputCls} pl-9 pr-10`}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-cyan-400 transition-colors"
                >
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {pwForm.confirm && pwForm.next && pwForm.confirm !== pwForm.next && (
                <p className="text-[10px] text-red-400 mt-1.5">Пароли не совпадают</p>
              )}
              {pwForm.confirm && pwForm.next && pwForm.confirm === pwForm.next && (
                <p className="text-[10px] text-cyan-500 mt-1.5">Пароли совпадают</p>
              )}
            </div>

            {pwMsg.text && (
              <Notice type={pwMsg.type} msg={pwMsg.text} onClose={() => setPwMsg({ type: '', text: '' })} />
            )}

            <button
              type="submit"
              disabled={pwLoading}
              className="flex items-center justify-center gap-2 py-2.5 rounded-full font-bold text-sm uppercase tracking-widest text-white bg-gradient-to-r from-purple-600 to-purple-800 hover:shadow-[0_0_24px_rgba(168,85,247,0.45)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
            >
              <Lock size={14} />
              {pwLoading ? 'Сохранение...' : 'Изменить пароль'}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}

