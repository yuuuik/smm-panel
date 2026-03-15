import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, register } from './api'
import { Zap, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

const inputCls =
  'w-full px-3 py-2.5 bg-[#080c12] border border-[#1c2333] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-all'

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Пароли не совпадают')
        return
      }
      if (password.length < 6) {
        setError('Пароль должен содержать минимум 6 символов')
        return
      }
    }

    setLoading(true)
    try {
      const fn = mode === 'register' ? register : login
      const { access_token } = await fn(email, password)
      localStorage.setItem('token', access_token)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen bg-panel-bg flex items-center justify-center p-4"
      style={{
        backgroundImage:
          'linear-gradient(rgba(6,182,212,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.04) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(0,212,255,0.4)]">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-lg leading-tight">bemqel panel</h1>
            <p className="text-[10px] text-cyan-500 tracking-widest uppercase">FB Automation</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.07)]">
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-[#080c12] rounded-xl border border-[#1c2333] mb-6">
            {[
              { key: 'login', label: 'Войти' },
              { key: 'register', label: 'Регистрация' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => switchMode(key)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  mode === key
                    ? 'bg-gradient-to-r from-cyan-500/20 to-cyan-600/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div>
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-gray-500 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${inputCls} pl-9`}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-gray-500 mb-1.5">
                Пароль
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputCls} pl-9 pr-10`}
                  placeholder="••••••••"
                  required
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-cyan-400 transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Confirm password (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-[10px] font-semibold tracking-widest uppercase text-gray-500 mb-1.5">
                  Повторите пароль
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                <p className="text-[10px] text-gray-600 mt-1.5">Минимум 6 символов</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                <AlertCircle size={13} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-1 flex items-center justify-center gap-2 py-3 rounded-full font-bold text-sm uppercase tracking-widest text-black bg-gradient-to-r from-cyan-400 to-teal-500 hover:shadow-[0_0_28px_rgba(6,182,212,0.55)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
            >
              {loading
                ? (mode === 'register' ? 'Регистрация...' : 'Вход...')
                : (mode === 'register' ? 'Создать аккаунт' : 'Войти')}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
