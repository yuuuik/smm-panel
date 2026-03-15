import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAccounts, getTasks, getTemplates, getProxies } from './api'
import { Users, Globe, FileText, ListChecks, UserPlus, FilePlus, Play, ShieldPlus } from 'lucide-react'

function StatCard({ label, value, sub, subColor = 'text-cyan-400', icon: Icon, iconColor = 'text-cyan-400', glowColor = 'rgba(0,212,255,0.15)' }) {
  return (
    <div
      className="bg-panel-card border border-[#1c2333] rounded-2xl p-5 relative overflow-hidden transition-all hover:border-[#2a3a50]"
      style={{ boxShadow: `0 0 0 0 ${glowColor}`, transition: 'box-shadow 0.3s' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 24px ${glowColor}`}
      onMouseLeave={e => e.currentTarget.style.boxShadow = `0 0 0 0 ${glowColor}`}
    >
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-5 blur-2xl" style={{ background: glowColor }} />
      <div className="absolute top-4 right-4">
        <Icon size={22} className={`${iconColor} opacity-80`} />
      </div>
      <p className="text-[11px] font-semibold tracking-widest uppercase text-panel-muted mb-2">{label}</p>
      <p className="text-5xl font-bold text-white mb-1 leading-none">{value}</p>
      {sub && <p className={`text-xs mt-2 font-medium ${subColor}`}>{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [accounts, setAccounts] = useState([])
  const [tasks, setTasks] = useState([])
  const [templates, setTemplates] = useState([])
  const [proxies, setProxies] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    getAccounts().then(setAccounts).catch(() => {})
    getTasks().then(setTasks).catch(() => {})
    getTemplates().then(setTemplates).catch(() => {})
    getProxies().then(setProxies).catch(() => {})
  }, [])

  const running = tasks.filter((t) => t.status === 'running').length
  const completed = tasks.filter((t) => t.status === 'completed').length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Главная</h1>
        <p className="text-base font-semibold text-gray-400 mt-1">Обзор системы и быстрые действия</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Аккаунты" value={accounts.length} sub="Активно" icon={Users} iconColor="text-cyan-400" glowColor="rgba(0,212,255,0.18)" />
        <StatCard label="Прокси" value={proxies.length} sub="Стабильно" subColor="text-cyan-400" icon={Globe} iconColor="text-cyan-400" glowColor="rgba(0,212,255,0.15)" />
        <StatCard label="Шаблоны" value={templates.length} sub="Используется" subColor="text-pink-400" icon={FileText} iconColor="text-pink-400" glowColor="rgba(236,72,153,0.15)" />
        <StatCard label="Задачи" value={`${running}/${completed}`} sub="Запущено / Завершено" subColor="text-purple-400" icon={ListChecks} iconColor="text-purple-400" glowColor="rgba(168,85,247,0.15)" />
      </div>

      <div className="flex flex-wrap gap-4 justify-center">
        <button onClick={() => navigate('/accounts')} className="flex items-center gap-2 px-8 py-3 rounded-full font-bold text-sm uppercase tracking-widest text-white bg-gradient-to-r from-cyan-400 to-purple-600 hover:shadow-[0_0_24px_rgba(0,212,255,0.45)] transition-shadow">
          <UserPlus size={16} />Добавить аккаунт
        </button>
        <button onClick={() => navigate('/proxies')} className="flex items-center gap-2 px-8 py-3 rounded-full font-bold text-sm uppercase tracking-widest text-white bg-gradient-to-r from-teal-500 to-cyan-600 hover:shadow-[0_0_24px_rgba(20,184,166,0.45)] transition-shadow">
          <ShieldPlus size={16} />Добавить прокси
        </button>
        <button onClick={() => navigate('/templates')} className="flex items-center gap-2 px-8 py-3 rounded-full font-bold text-sm uppercase tracking-widest text-white bg-gradient-to-r from-purple-600 to-purple-800 hover:shadow-[0_0_24px_rgba(168,85,247,0.45)] transition-shadow">
          <FilePlus size={16} />Создать шаблон
        </button>
        <button onClick={() => navigate('/actions')} className="flex items-center gap-2 px-8 py-3 rounded-full font-bold text-sm uppercase tracking-widest text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:shadow-[0_0_24px_rgba(236,72,153,0.45)] transition-shadow">
          <Play size={16} />Запустить задачу
        </button>
      </div>
    </div>
  )
}