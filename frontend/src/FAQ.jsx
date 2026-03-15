import { useState } from 'react'
import { ChevronDown, ChevronRight, Cookie, Globe, ListChecks, PlayCircle, HelpCircle } from 'lucide-react'

const sections = [
  {
    id: 'proxies',
    icon: Globe,
    color: 'text-cyan-400',
    title: 'Как добавить прокси',
    items: [
      {
        q: 'Какой формат прокси поддерживается?',
        a: 'Поддерживаются HTTP/HTTPS и SOCKS5 прокси. При добавлении укажите: название (любое), IP-адрес, порт, и при наличии — логин и пароль.',
      },
      {
        q: 'Что такое Rotate URL и зачем он нужен?',
        a: 'Rotate URL — это ссылка, которую панель открывает (GET-запросом) перед каждым действием аккаунта, чтобы сменить IP у ротирующего прокси (например, мобильного или резидентного). Если ваш прокси статический — оставьте поле пустым.',
      },
      {
        q: 'Что такое Rotate Delay?',
        a: 'Задержка в секундах после обращения к Rotate URL — время, которое нужно прокси для смены IP. Обычно 5–15 секунд. Если Rotate URL не задан, поле игнорируется.',
      },
      {
        q: 'Как проверить, работает ли прокси?',
        a: 'На странице Прокси нажмите кнопку «Проверить» (иконка сигнала) рядом с нужным прокси. Панель попытается подключиться через него и покажет статус: зелёный — рабочий, красный — недоступный.',
      },
      {
        q: 'Как привязать прокси к аккаунту?',
        a: 'При добавлении или редактировании аккаунта в разделе Аккаунты выберите нужный прокси из выпадающего списка. Все запросы этого аккаунта будут проходить через него.',
      },
    ],
  },
  {
    id: 'accounts',
    icon: Cookie,
    color: 'text-purple-400',
    title: 'Как добавить аккаунт Facebook',
    items: [
      {
        q: 'Что такое cookies и зачем они нужны?',
        a: 'Cookies — это данные авторизации вашего Facebook-аккаунта. Панель использует их вместо логина/пароля, чтобы выполнять действия от имени аккаунта без открытия браузера.',
      },
      {
        q: 'Как получить cookies аккаунта?',
        a: 'Установите расширение для Chrome «EditThisCookie» или «Cookie-Editor». Войдите в нужный аккаунт на facebook.com, откройте расширение и нажмите «Экспорт» (иконка копирования). Скопируйте весь JSON-массив.',
      },
      {
        q: 'Какое расширение лучше использовать?',
        a: 'Рекомендуем «Cookie-Editor» (доступно в Chrome Web Store). После установки: 1) откройте facebook.com, 2) нажмите иконку расширения, 3) нажмите «Export» → «Export as JSON», 4) скопируйте результат в поле Cookies при добавлении аккаунта.',
      },
      {
        q: 'Что такое User-Agent и нужно ли его заполнять?',
        a: 'User-Agent — это строка, которую браузер отправляет серверу для идентификации. Желательно указать User-Agent того браузера, в котором использовался аккаунт. Это снижает риск блокировки. Можно скопировать из адресной строки: chrome://version/ → «Строка агента пользователя».',
      },
      {
        q: 'Как проверить, работает ли аккаунт?',
        a: 'Нажмите кнопку «Check» рядом с аккаунтом — панель выполнит тестовый запрос к Facebook и покажет статус. Зелёный (Valid) — аккаунт активен, красный (Invalid) — cookies устарели или аккаунт заблокирован.',
      },
      {
        q: 'Что делать, если аккаунт показывает Invalid?',
        a: 'Cookies могли устареть (Facebook периодически их сбрасывает) или аккаунт был заблокирован. Войдите в аккаунт заново в браузере, экспортируйте свежие cookies и обновите их в панели.',
      },
    ],
  },
  {
    id: 'templates',
    icon: ListChecks,
    color: 'text-pink-400',
    title: 'Как создать шаблон (сценарий)',
    items: [
      {
        q: 'Что такое шаблон?',
        a: 'Шаблон — это готовый сценарий автоматизации: набор последовательных действий (лайки, комментарии, ответы) для конкретного поста. Один шаблон можно запускать многократно для разных постов.',
      },
      {
        q: 'Как создать шаблон?',
        a: 'Перейдите в раздел Шаблоны → нажмите «Новый шаблон». Введите название и URL поста. Затем добавляйте действия по порядку: каждому действию выберите аккаунт, тип действия, текст/реакцию и задержку перед выполнением.',
      },
      {
        q: 'Какие типы действий поддерживаются?',
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>react_post</b> — поставить реакцию на пост (LIKE, LOVE, HAHA, WOW, SAD, ANGRY)</li>
            <li><b>comment_post</b> — написать комментарий к посту</li>
            <li><b>reply_comment</b> — ответить на комментарий</li>
            <li><b>react_comment</b> — поставить реакцию на комментарий</li>
          </ul>
        ),
      },
      {
        q: 'Что такое «Цель» (target_comment) для reply_comment?',
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>random</b> — ответить на случайный комментарий</li>
            <li><b>last_bot_comment</b> — ответить на последний комментарий, оставленный одним из аккаунтов панели</li>
            <li><b>comment #N</b> — ответить на N-й комментарий в посте</li>
            <li><b>comment_id:123456</b> — ответить на конкретный комментарий по ID</li>
          </ul>
        ),
      },
      {
        q: 'Зачем нужна задержка (delay)?',
        a: 'Задержка в секундах перед выполнением действия имитирует поведение живого пользователя. Рекомендуем 15–60 секунд между действиями, чтобы снизить риск блокировки аккаунтов.',
      },
    ],
  },
  {
    id: 'tasks',
    icon: PlayCircle,
    color: 'text-green-400',
    title: 'Как запускать задачи',
    items: [
      {
        q: 'Как запустить задачу?',
        a: 'Перейдите в раздел Задачи → нажмите «Новая задача». Выберите шаблон из списка, при необходимости укажите URL поста (если хотите переопределить URL из шаблона). Нажмите «Запустить».',
      },
      {
        q: 'Что означают статусы задачи?',
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b className="text-purple-400">pending</b> — задача ожидает запуска в очереди</li>
            <li><b className="text-cyan-400">running</b> — задача выполняется прямо сейчас</li>
            <li><b className="text-green-400">completed</b> — все действия выполнены успешно</li>
            <li><b className="text-gray-400">stopped</b> — задача остановлена вручную</li>
            <li><b className="text-red-400">failed / error</b> — произошла ошибка при выполнении</li>
          </ul>
        ),
      },
      {
        q: 'Как остановить задачу?',
        a: 'На странице Задачи нажмите кнопку «Стоп» (квадрат) рядом с активной задачей. Уже выполненные действия не отменяются — останавливаются только следующие.',
      },
      {
        q: 'Несколько задач работают одновременно?',
        a: 'Задачи выполняются в очереди — по одной за раз. Если запустили несколько, они встанут в очередь и будут выполняться последовательно.',
      },
      {
        q: 'Где смотреть ошибки и детали выполнения?',
        a: 'Перейдите в раздел Логи. Там отображаются все события: успешные действия (голубые) и ошибки (красные), с указанием аккаунта, типа действия и сообщения об ошибке. Можно фильтровать по конкретной задаче.',
      },
      {
        q: 'Что делать, если задача завершилась с ошибкой?',
        a: 'Проверьте Логи — там будет подробное сообщение. Частые причины: устаревшие cookies аккаунта, недоступный прокси, изменение структуры Facebook. Обновите cookies или прокси и попробуйте снова.',
      },
    ],
  },
]

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`border border-[#1c2333] rounded-xl overflow-hidden transition-all ${open ? 'bg-[#0d1117]' : 'bg-[#0a0e16] hover:bg-[#0d1117]'}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-4"
      >
        <span className={`text-sm font-semibold transition-colors ${open ? 'text-white' : 'text-gray-300'}`}>{q}</span>
        {open
          ? <ChevronDown size={16} className="text-cyan-400 flex-shrink-0" />
          : <ChevronRight size={16} className="text-[#4b6080] flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm text-gray-400 leading-relaxed border-t border-[#1c2333] pt-4">
          {typeof a === 'string' ? a : a}
        </div>
      )}
    </div>
  )
}

export default function FAQ() {
  const [activeSection, setActiveSection] = useState(null)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <HelpCircle size={24} className="text-cyan-400" />
          Часто задаваемые вопросы
        </h1>
        <p className="text-base font-semibold text-gray-400 mt-1">Руководство по работе с панелью автоматизации</p>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveSection(null)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${activeSection === null ? 'bg-[rgba(6,182,212,0.15)] border-cyan-500/50 text-cyan-400' : 'bg-[#0d1117] border-[#1c2333] text-gray-500 hover:text-white hover:border-[#2a3a50]'}`}
        >
          Все разделы
        </button>
        {sections.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${activeSection === s.id ? `bg-[rgba(6,182,212,0.15)] border-cyan-500/50 text-white` : 'bg-[#0d1117] border-[#1c2333] text-gray-500 hover:text-white hover:border-[#2a3a50]'}`}
            >
              <Icon size={14} className={activeSection === s.id ? s.color : ''} />
              {s.title}
            </button>
          )
        })}
      </div>

      <div className="space-y-8">
        {sections
          .filter((s) => activeSection === null || s.id === activeSection)
          .map((s) => {
            const Icon = s.icon
            return (
              <div key={s.id}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-lg bg-[#0d1117] border border-[#1c2333] flex items-center justify-center`}>
                    <Icon size={16} className={s.color} />
                  </div>
                  <h2 className="text-lg font-bold text-white">{s.title}</h2>
                  <div className="flex-1 h-px bg-[#1c2333]" />
                </div>
                <div className="space-y-2">
                  {s.items.map((item, i) => (
                    <FAQItem key={i} q={item.q} a={item.a} />
                  ))}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
