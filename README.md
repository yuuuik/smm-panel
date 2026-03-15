# bemqel panel (Facebook)

Панель для автоматизации действий в Facebook для одного пользователя (bemqel panel).

## Технологии

- **Backend:** Python, FastAPI, SQLite
- **Frontend:** React, TailwindCSS
- **Automation:** Selenium, Requests
- **Очередь:** потоковая обработка задач (threading)

## Структура

```
smm-panel/
├── backend/          # FastAPI, модели, API, логика задач
├── frontend/         # React + Vite + Tailwind
├── automation/       # browser_manager, proxy_manager, fb_requests
└── README.md
```

## Запуск

### 1. Backend

Требования: Python 3.10+, Chrome (для Selenium), ChromeDriver в PATH или установленный через `webdriver-manager` (можно добавить при необходимости).

```bash
cd smm-panel
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

API: http://127.0.0.1:8000  
Документация: http://127.0.0.1:8000/docs  

### 2. Frontend

```bash
cd smm-panel/frontend
npm install
npm run dev
```

Откройте http://localhost:5173  

### 3. Вход в панель

- **Логин:** admin  
- **Пароль:** admin  

(Регистрация отключена — пользователь создаётся при первом запуске.)

## Функции

- **Accounts:** добавление Facebook-аккаунтов (cookies, User-Agent, прокси), проверка авторизации (Check account).
- **Proxies:** добавление прокси, Rotate URL и задержка; проверка прокси; перед запуском аккаунта вызывается rotate (GET rotate_url → ожидание rotate_delay).
- **Templates:** manual scenario templates. Каждый шаблон хранит `post_url` и упорядоченный список действий `template_actions`, где для каждого шага задаются `action_type`, `account`, `text`, `image`, `target_comment`, `reaction_type`, `delay`.
- **Actions:** задачи запускаются из шаблона и выполняют шаги строго по порядку. Поддерживаются `react_post`, `comment_post`, `reply_comment`, `react_comment`, а также таргеты `random`, `last_bot_comment`, `comment #N`, `comment_id`.
- **Очередь:** Start / Stop задачи, отображение статуса и прогресса по числу действий.
- **Logs:** просмотр логов по действиям и по задаче.

## Шаблон сценария

Пример JSON-структуры manual template:

```json
{
	"name": "Post Scenario #1",
	"post_url": "https://facebook.com/post/123",
	"actions": [
		{
			"action_order": 1,
			"account_id": 1,
			"action_type": "react_post",
			"reaction_type": "LIKE",
			"delay": 20
		},
		{
			"action_order": 2,
			"account_id": 2,
			"action_type": "comment_post",
			"text": "Интересный пост",
			"delay": 20
		},
		{
			"action_order": 3,
			"account_id": 3,
			"action_type": "reply_comment",
			"target_comment": "random",
			"text": "Согласен",
			"delay": 20
		}
	]
}
```

## Важно

- Facebook может менять вёрстку и API; токены (fb_dtsg, lsd, jazoest) и эндпоинты в `automation/fb_requests.py` и `backend/token_extractor.py` при необходимости нужно обновлять.
- Для работы автоматизации нужен установленный **Chrome** и **ChromeDriver** (совместимая версия). При ошибках драйвера установите ChromeDriver вручную или добавьте в проект зависимость `webdriver-manager` и используйте его в `browser_manager.py`.
