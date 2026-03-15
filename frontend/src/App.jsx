import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext } from 'react'
import Layout from './Layout'
import Login from './Login'
import Dashboard from './Dashboard'
import Accounts from './Accounts'
import Proxies from './Proxies'
import Templates from './Templates'
import Actions from './Actions'
import Logs from './Logs'
import Profile from './Profile'
import Admin from './Admin'
import FAQ from './FAQ'
import Support from './Support'
import Subscription from './Subscription'
import { me } from './api'

export const AuthContext = createContext({ isAdmin: false })

function PrivateRoute({ children }) {
  const [ok, setOk] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    me()
      .then((u) => { setIsAdmin(u.is_admin === true); setOk(true) })
      .catch(() => setOk(false))
  }, [])
  if (ok === null) return <div className="flex items-center justify-center min-h-screen bg-panel-bg"><div className="text-panel-muted">Loading...</div></div>
  if (!ok) return <Navigate to="/login" replace />
  return <AuthContext.Provider value={{ isAdmin }}>{children}</AuthContext.Provider>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="proxies" element={<Proxies />} />
          <Route path="templates" element={<Templates />} />
          <Route path="actions" element={<Actions />} />
          <Route path="logs" element={<Logs />} />
          <Route path="profile" element={<Profile />} />
          <Route path="admin" element={<Admin />} />
          <Route path="faq" element={<FAQ />} />
          <Route path="support" element={<Support />} />
          <Route path="subscription" element={<Subscription />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
