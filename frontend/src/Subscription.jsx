import { useState, useEffect } from 'react'
import { getSubscriptionInfo, getWalletInfo, submitPayment } from './api'
import { Crown, Zap, CheckCircle, Clock, AlertCircle, Copy, Check, Loader, ArrowRight, ChevronDown } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

const NETWORK_META = {
  trc20: { name: 'TRC-20',   chain: 'Tron',     color: 'text-red-400',    border: 'border-red-500/40',    bg: 'bg-red-500/10',    activeBg: 'bg-red-500/15' },
  erc20: { name: 'ERC-20',   chain: 'Ethereum',  color: 'text-blue-400',   border: 'border-blue-500/40',   bg: 'bg-blue-500/10',   activeBg: 'bg-blue-500/15' },
  bep20: { name: 'BEP-20',   chain: 'BSC',       color: 'text-yellow-400', border: 'border-yellow-500/40', bg: 'bg-yellow-500/10', activeBg: 'bg-yellow-500/15' },
  ton:   { name: 'TON',      chain: 'TON',       color: 'text-cyan-400',   border: 'border-cyan-500/40',   bg: 'bg-cyan-500/10',   activeBg: 'bg-cyan-500/15' },
}

function formatDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatTimeLeft(iso) {
  if (!iso) return null
  const diff = new Date(iso) - Date.now()
  if (diff <= 0) return 'Истекла'
  const days    = Math.floor(diff / 86400000)
  const hours   = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  if (days > 0)  return `${days} дн. ${hours} ч.`
  if (hours > 0) return `${hours} ч. ${minutes} мин.`
  return `${minutes} мин.`
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      title="Скопировать"
      className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#1c2333] border border-[#2a3a50] flex items-center justify-center text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40 transition-all"
    >
      {copied ? <Check size={13} className="text-cyan-400" /> : <Copy size={13} />}
    </button>
  )
}

export default function Subscription() {
  const [info, setInfo]       = useState(null)
  const [wallet, setWallet]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [countdown, setCountdown] = useState('')

  const [showPayment, setShowPayment] = useState(false)
  const [network, setNetwork]     = useState('trc20')
  const [txHash, setTxHash]       = useState('')
  const [paying, setPaying]       = useState(false)
  const [payError, setPayError]   = useState('')
  const [paySuccess, setPaySuccess] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([getSubscriptionInfo(), getWalletInfo()])
      .then(([i, w]) => { setInfo(i); setWallet(w) })
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const resetAt = info?.limit_reset_at
    if (!resetAt) { setCountdown(''); return }
    const tick = () => {
      const diff = new Date(resetAt) - Date.now()
      if (diff <= 0) { setCountdown(''); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [info?.limit_reset_at])

  const isPro      = info?.plan === 'pro'
  const tasksToday = info?.tasks_today ?? 0
  const tasksLimit = info?.tasks_limit ?? 2
  const usagePct   = isPro ? 0 : Math.min(100, Math.round((tasksToday / tasksLimit) * 100))
  const remaining  = isPro ? null : Math.max(0, tasksLimit - tasksToday)

  const handlePay = async (e) => {
    e.preventDefault()
    if (!txHash.trim()) return
    setPaying(true)
    setPayError('')
    setPaySuccess(null)
    try {
      const res = await submitPayment(txHash.trim(), network)
      setPaySuccess(res)
      setTxHash('')
      load()
    } catch (err) {
      setPayError(err.message)
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-white text-xl font-bold">
          <Crown size={20} className="text-yellow-400" />
          Подписка
        </div>
        <p className="text-base font-semibold text-gray-400 mt-1">Управление тарифным планом</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm">Загрузка...</div>
      ) : (
        <div className="space-y-5">
          {/* Plan cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Free card */}
            <div className={`relative bg-[#0d1117] border rounded-2xl p-5 transition-all ${!isPro ? 'border-cyan-500/50 shadow-[0_0_24px_rgba(6,182,212,0.12)]' : 'border-[#1c2333] opacity-60'}`}>
              {!isPro && (
                <span className="absolute top-3 right-3 text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
                  Текущий
                </span>
              )}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#1c2333] border border-[#2a3a50] flex items-center justify-center">
                  <Zap size={15} className="text-gray-400" />
                </div>
                <h2 className="text-white font-bold text-base">Free</h2>
              </div>
              <p className="text-2xl font-black text-white mb-1">Бесплатно</p>
              <p className="text-xs text-gray-500 mb-4">Навсегда</p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-400">
                  <CheckCircle size={13} className="text-gray-600 flex-shrink-0" />
                  2 задачи за 24 часа
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-400">
                  <CheckCircle size={13} className="text-gray-600 flex-shrink-0" />
                  Все функции панели
                </li>
              </ul>
            </div>

            {/* Pro card */}
            <div
              onClick={() => setShowPayment(s => !s)}
              className={`relative bg-[#0d1117] border rounded-2xl p-5 transition-all cursor-pointer select-none ${isPro ? 'border-yellow-500/50 shadow-[0_0_24px_rgba(234,179,8,0.12)]' : `border-[#1c2333] hover:border-yellow-500/30 ${showPayment ? 'border-yellow-500/30' : ''}`}`}>
              {isPro && (
                <span className="absolute top-3 right-3 text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400">
                  Текущий
                </span>
              )}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center">
                  <Crown size={15} className="text-yellow-400" />
                </div>
                <h2 className="text-white font-bold text-base">Pro</h2>
              </div>
              <div className="flex items-baseline gap-1.5 mb-4">
                <p className="text-2xl font-black text-white">{wallet?.amount ?? 30} USDT</p>
                <span className="text-xs text-gray-500">/ {wallet?.days ?? 30} дней</span>
              </div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle size={13} className="text-yellow-400 flex-shrink-0" />
                  Безлимитные задачи
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle size={13} className="text-yellow-400 flex-shrink-0" />
                  Приоритетная поддержка
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-300">
                  <CheckCircle size={13} className="text-yellow-400 flex-shrink-0" />
                  Всё из Free
                </li>
              </ul>
              <div className="mt-4 pt-3 border-t border-[#1c2333] flex items-center justify-between">
                <span className="text-xs text-yellow-400 font-semibold">{isPro ? 'Продлить' : 'Купить Pro'}</span>
                <ChevronDown size={14} className={`text-yellow-400 transition-transform duration-200 ${showPayment ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </div>

          {/* Usage / Status block */}
          <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl p-5">
            <h3 className="text-xs font-bold text-[#4b6080] tracking-widest uppercase mb-4">Использование за 24 часа</h3>
            {isPro ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center flex-shrink-0">
                    <Crown size={18} className="text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">Безлимитный режим</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {info.subscription_expires_at
                        ? `До: ${formatDate(info.subscription_expires_at)}`
                        : 'Без ограничения по времени'}
                    </p>
                  </div>
                  {info.subscription_expires_at && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-yellow-400 font-bold text-sm">{formatTimeLeft(info.subscription_expires_at)}</p>
                      <p className="text-[10px] text-gray-600">осталось</p>
                    </div>
                  )}
                </div>
                {info.subscription_expires_at && (() => {
                  const total = 30 * 24 * 3600000
                  const left  = Math.max(0, new Date(info.subscription_expires_at) - Date.now())
                  const pct   = Math.min(100, Math.round((left / total) * 100))
                  return (
                    <div>
                      <div className="h-1.5 rounded-full bg-[#1c2333] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct > 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1">{pct}% времени осталось</p>
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Задачи запущено</span>
                  <span className={`text-sm font-bold ${tasksToday >= tasksLimit ? 'text-red-400' : 'text-white'}`}>
                    {tasksToday} / {tasksLimit}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#1c2333] overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${usagePct >= 100 ? 'bg-red-500' : usagePct >= 50 ? 'bg-yellow-500' : 'bg-cyan-500'}`}
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
                {remaining === 0 ? (
                  <div className="text-sm text-red-400">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertCircle size={14} />
                      Лимит исчерпан. Перейдите на Pro.
                    </div>
                    {countdown && (
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-red-300">
                        <Clock size={12} />
                        Сброс через: <span className="font-mono font-bold text-red-200">{countdown}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock size={13} />
                    Осталось задач: <span className="text-white font-semibold">{remaining}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment block (free = buy, pro = renew) */}
          {wallet && showPayment && (
            <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-[#4b6080] tracking-widest uppercase">
                {isPro ? 'Продлить подписку' : `Купить Pro — ${wallet.amount} USDT / ${wallet.days} дней`}
              </h3>

              {/* Network tabs */}
              <div className="flex gap-1.5 flex-wrap">
                {Object.entries(NETWORK_META).map(([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => { setNetwork(key); setPayError(''); setPaySuccess(null) }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      network === key
                        ? `${meta.activeBg} ${meta.color} ${meta.border}`
                        : 'bg-[#0d1117] text-gray-500 border-[#1c2333] hover:border-[#2a3a50]'
                    }`}
                  >
                    {meta.name} · {meta.chain}
                  </button>
                ))}
              </div>

              {/* Wallet address for selected network */}
              {(() => {
                // Support both old single-wallet format and new multi-network format
                const nets = wallet.networks || { trc20: { wallet: wallet.wallet } }
                const cur  = nets[network]
                const meta = NETWORK_META[network]
                if (!cur) return null
                return (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">
                      {isPro ? 'Отправь' : 'Шаг 1 — Отправь'}{' '}
                      <span className="text-yellow-400 font-bold">{wallet.amount} USDT</span>{' '}
                      на кошелёк (<span className={`font-semibold ${meta.color}`}>{meta.name}</span>):
                    </p>
                    <div className="flex items-center gap-2 bg-[#080c14] border border-[#1c2333] rounded-xl px-3 py-2.5">
                      <code className={`flex-1 text-xs break-all font-mono ${meta.color}`}>{cur.wallet}</code>
                      <CopyButton text={cur.wallet} />
                    </div>
                    <div className="flex justify-center pt-1">
                      <div className="bg-white p-2.5 rounded-xl inline-block">
                        <QRCodeSVG value={cur.wallet} size={150} />
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Hash input */}
              <div className="space-y-2">
                <p className="text-sm text-gray-400">
                  {isPro ? 'Вставь хэш новой транзакции:' : 'Шаг 2 — Дождись подтверждения и вставь хэш:'}
                </p>
                {paySuccess ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                    <CheckCircle size={15} />
                    {isPro
                      ? `Подписка продлена до ${formatDate(paySuccess.subscription_expires_at)}`
                      : `Оплата подтверждена! Pro активирован до ${formatDate(paySuccess.subscription_expires_at)}`}
                  </div>
                ) : (
                  <form onSubmit={handlePay} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={txHash}
                        onChange={e => { setTxHash(e.target.value); setPayError('') }}
                        placeholder="Хэш транзакции"
                        disabled={paying}
                        className="flex-1 min-w-0 bg-[#080c14] border border-[#1c2333] rounded-xl px-3 py-2.5 text-xs text-white font-mono placeholder:text-gray-600 focus:outline-none focus:border-yellow-500/50 transition-colors disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={paying || !txHash.trim()}
                        className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-sm font-bold hover:bg-yellow-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {paying ? <Loader size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                        {paying ? 'Проверка...' : isPro ? 'Продлить' : 'Проверить'}
                      </button>
                    </div>
                    {payError && (
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                        <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                        {payError}
                      </div>
                    )}
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

