// Logs
export async function clearAllLogs() {
  const r = await fetch(`${API_BASE}/logs/all`, { method: 'DELETE', headers: headers() });
  if (!r.ok) throw new Error('Не удалось очистить логи');
  return r.json();
}
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function headers(includeAuth = true) {
  const h = { 'Content-Type': 'application/json' };
  if (includeAuth && getToken()) h['Authorization'] = `Bearer ${getToken()}`;
  return h;
}

export async function login(email, password) {
  const r = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: headers(false),
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || 'Ошибка входа');
  }
  return r.json();
}

export async function register(email, password) {
  const r = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: headers(false),
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || 'Ошибка регистрации');
  }
  return r.json();
}

export async function me() {
  const r = await fetch(`${API_BASE}/me`, { headers: headers() });
  if (!r.ok) throw new Error('Not authenticated');
  return r.json();
}

export async function updateProfile(data) {
  const r = await fetch(`${API_BASE}/me`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || 'Ошибка обновления профиля');
  }
  return r.json();
}

export async function changePassword(current_password, new_password) {
  const r = await fetch(`${API_BASE}/me/change-password`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ current_password, new_password }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || 'Ошибка смены пароля');
  }
  return r.json();
}

export async function sendVerificationCode() {
  const r = await fetch(`${API_BASE}/me/send-verification`, {
    method: 'POST',
    headers: headers(),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || 'Не удалось отправить код');
  }
  return r.json();
}

export async function confirmVerification(code) {
  const r = await fetch(`${API_BASE}/me/verify-email`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ code }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || 'Ошибка подтверждения');
  }
  return r.json();
}

// Accounts
export async function getAccounts() {
  const r = await fetch(`${API_BASE}/accounts`, { headers: headers() });
  if (!r.ok) throw new Error('Failed to load accounts');
  return r.json();
}
export async function createAccount(data) {
  const r = await fetch(`${API_BASE}/accounts`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error('Failed to create account');
  return r.json();
}
export async function deleteAccount(id) {
  const r = await fetch(`${API_BASE}/accounts/${id}`, { method: 'DELETE', headers: headers() });
  if (!r.ok) throw new Error('Failed to delete');
  return r.json();
}
export async function updateAccount(id, data) {
  const r = await fetch(`${API_BASE}/accounts/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка сохранения'); }
  return r.json();
}
export async function checkAccount(id, options = {}) {
  const r = await fetch(`${API_BASE}/accounts/${id}/check`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ show_browser: options.show_browser ?? true }),
  });
  return r.json();
}
export async function getOpenBrowsers() {
  const r = await fetch(`${API_BASE}/accounts/open-status`, { headers: headers() });
  if (!r.ok) return { open: [] };
  return r.json();
}
export async function openAccountBrowser(id) {
  const r = await fetch(`${API_BASE}/accounts/${id}/open`, { method: 'POST', headers: headers() });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка открытия'); }
  return r.json();
}
export async function closeAccountBrowser(id) {
  const r = await fetch(`${API_BASE}/accounts/${id}/close-browser`, { method: 'POST', headers: headers() });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка закрытия'); }
  return r.json();
}

// Proxies
export async function getProxies() {
  const r = await fetch(`${API_BASE}/proxies`, { headers: headers() });
  if (!r.ok) throw new Error('Failed to load proxies');
  return r.json();
}
export async function createProxy(data) {
  const r = await fetch(`${API_BASE}/proxies`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error('Failed to create proxy');
  return r.json();
}
export async function deleteProxy(id) {
  const r = await fetch(`${API_BASE}/proxies/${id}`, { method: 'DELETE', headers: headers() });
  if (!r.ok) throw new Error('Failed to delete');
  return r.json();
}
export async function checkProxy(id) {
  const r = await fetch(`${API_BASE}/proxies/${id}/check`, { method: 'POST', headers: headers() });
  return r.json();
}

// Templates (universal action templates)
export async function getTemplates() {
  const r = await fetch(`${API_BASE}/templates`, { headers: headers() });
  if (!r.ok) throw new Error('Failed to load templates');
  return r.json();
}
function _extractDetail(d) {
  if (!d.detail) return null
  if (typeof d.detail === 'string') return d.detail
  if (Array.isArray(d.detail)) return d.detail.map(e => `${e.loc?.join('.')}: ${e.msg}`).join('; ')
  return JSON.stringify(d.detail)
}

export async function createTemplate(data) {
  const r = await fetch(`${API_BASE}/templates`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); console.error('createTemplate error', r.status, JSON.stringify(d)); throw new Error(_extractDetail(d) || `HTTP ${r.status}: ${JSON.stringify(d)}`); }
  return r.json();
}
export async function updateTemplate(id, data) {
  const r = await fetch(`${API_BASE}/templates/${id}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(_extractDetail(d) || 'Failed to update template'); }
  return r.json();
}
export async function deleteTemplate(id) {
  const r = await fetch(`${API_BASE}/templates/${id}`, { method: 'DELETE', headers: headers() });
  if (!r.ok) throw new Error('Failed to delete');
  return r.json();
}

// Upload image for template (comment attachment)
export async function uploadImage(file) {
  const h = { Authorization: `Bearer ${getToken()}` };
  const form = new FormData();
  form.append('file', file);
  const r = await fetch(`${API_BASE}/upload/image`, {
    method: 'POST',
    headers: h,
    body: form,
  });
  if (!r.ok) throw new Error('Upload failed');
  const d = await r.json();
  return d.path; // e.g. "comments/xxx.jpg"
}
// URL for displaying uploaded image
export function uploadsUrl(path) {
  if (!path) return null;
  return `${API_BASE}/uploads/${path}`;
}

// Actions (tasks)
export async function getTasks() {
  const r = await fetch(`${API_BASE}/actions`, { headers: headers() });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка загрузки задач'); }
  return r.json();
}
export async function updateTask(id, data) {
  const r = await fetch(`${API_BASE}/actions/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(typeof d.detail === 'string' ? d.detail : 'Ошибка сохранения'); }
  return r.json();
}
export async function createTask(data) {
  const r = await fetch(`${API_BASE}/actions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    const detail = d.detail;
    if (detail && typeof detail === 'object' && detail.reset_at) {
      const err = new Error(detail.message || 'Ошибка создания задачи');
      err.resetAt = detail.reset_at;
      throw err;
    }
    throw new Error(typeof detail === 'string' ? detail : 'Ошибка создания задачи');
  }
  return r.json();
}
export async function deleteTask(id) {
  const r = await fetch(`${API_BASE}/actions/${id}`, { method: 'DELETE', headers: headers() });
  return r.json();
}
export async function startTask(id) {
  const r = await fetch(`${API_BASE}/actions/${id}/start`, { method: 'POST', headers: headers() });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(d.detail || 'Ошибка запуска задачи');
  }
  return r.json();
}
export async function stopTask(id) {
  const r = await fetch(`${API_BASE}/actions/${id}/stop`, { method: 'POST', headers: headers() });
  return r.json();
}

// Logs
export async function getLogs(taskId = null, limit = 100) {
  let url = `${API_BASE}/logs?limit=${limit}`;
  if (taskId) url += `&task_id=${taskId}`;
  const r = await fetch(url, { headers: headers() });
  if (!r.ok) throw new Error('Failed');
  return r.json();
}

// Admin
export async function adminGetUsers() {
  const r = await fetch(`${API_BASE}/admin/users`, { headers: headers() });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка'); }
  return r.json();
}
export async function adminUpdateUser(id, data) {
  const r = await fetch(`${API_BASE}/admin/users/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка'); }
  return r.json();
}
export async function adminDeleteUser(id) {
  const r = await fetch(`${API_BASE}/admin/users/${id}`, { method: 'DELETE', headers: headers() });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка'); }
  return r.json();
}
export async function adminCreateUser(data) {
  const r = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка'); }
  return r.json();
}
export async function adminGetUserTasks(userId) {
  const r = await fetch(`${API_BASE}/admin/users/${userId}/tasks`, { headers: headers() });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка'); }
  return r.json();
}
export async function adminGetTaskLogs(taskId) {
  const r = await fetch(`${API_BASE}/admin/tasks/${taskId}/logs?limit=200`, { headers: headers() });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка'); }
  return r.json();
}

// Support (user)
export async function createSupportTicket(subject, message) {
  const r = await fetch(`${API_BASE}/support/tickets`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ subject, message }),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка'); }
  return r.json();
}
export async function getSupportTickets() {
  const r = await fetch(`${API_BASE}/support/tickets`, { headers: headers() });
  if (!r.ok) throw new Error('Ошибка загрузки');
  return r.json();
}
export async function getSupportTicket(id) {
  const r = await fetch(`${API_BASE}/support/tickets/${id}`, { headers: headers() });
  if (!r.ok) throw new Error('Ошибка загрузки');
  return r.json();
}
export async function addSupportMessage(ticketId, text) {
  const r = await fetch(`${API_BASE}/support/tickets/${ticketId}/messages`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ text }),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка'); }
  return r.json();
}

// Support (admin)
export async function adminGetSupportTickets() {
  const r = await fetch(`${API_BASE}/admin/support/tickets`, { headers: headers() });
  if (!r.ok) throw new Error('Ошибка загрузки');
  return r.json();
}
export async function adminGetSupportTicket(id) {
  const r = await fetch(`${API_BASE}/admin/support/tickets/${id}`, { headers: headers() });
  if (!r.ok) throw new Error('Ошибка загрузки');
  return r.json();
}
export async function adminReplySupportTicket(id, text) {
  const r = await fetch(`${API_BASE}/admin/support/tickets/${id}/reply`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ text }),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка'); }
  return r.json();
}
export async function adminUpdateSupportTicket(id, status) {
  const r = await fetch(`${API_BASE}/admin/support/tickets/${id}`, {
    method: 'PATCH', headers: headers(), body: JSON.stringify({ status }),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка'); }
  return r.json();
}
export async function deleteSupportTicket(id) {
  const r = await fetch(`${API_BASE}/support/tickets/${id}`, { method: 'DELETE', headers: headers() });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка'); }
  return r.json();
}
export async function adminDeleteSupportTicket(id) {
  const r = await fetch(`${API_BASE}/admin/support/tickets/${id}`, { method: 'DELETE', headers: headers() });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка'); }
  return r.json();
}

// Subscription
export async function getSubscriptionInfo() {
  const r = await fetch(`${API_BASE}/me/subscription`, { headers: headers() });
  if (!r.ok) throw new Error('Ошибка загрузки подписки');
  return r.json();
}
export async function adminSetUserSubscription(userId, subscription, subscriptionExpiresAt = null) {
  const r = await fetch(`${API_BASE}/admin/users/${userId}/subscription`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ subscription, subscription_expires_at: subscriptionExpiresAt }),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка'); }
  return r.json();
}

export async function getWalletInfo() {
  const r = await fetch(`${API_BASE}/subscription/wallet`);
  if (!r.ok) throw new Error('Ошибка загрузки реквизитов');
  return r.json();
}

export async function submitPayment(txHash, network) {
  const r = await fetch(`${API_BASE}/subscription/pay`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ tx_hash: txHash, network }),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.detail || 'Ошибка проверки'); }
  return r.json();
}

