# Модель данных для веб-приложения скалодрома

## Сущности и атрибуты

### Client (Клиент)

| Атрибут | Тип | Описание |
|---|---|---|
| id | UUID (PK) | Идентификатор клиента |
| name | string | Имя (обязательно при регистрации, FR-1) |
| phone | string (unique) | Номер телефона — логин; вход подтверждается кодом из SMS (OTP, FR-43) |
| age | int? (nullable) | Возраст (опционально, FR-47) |
| birthday | date? (nullable) | День рождения (опционально, FR-47) |
| push_subscription | string? (nullable) | Подписка для push-уведомлений (Web Push API), регистрируется при входе (FR-33) |
| safety_rules_accepted | boolean | Флаг «ознакомлен с правилами и техникой безопасности» (FR-51) |
| rope_access | boolean | Флаг «допущен к верёвкам» (FR-55) |
| is_permanent | boolean | Флаг «постоянный клиент» (FR-59). Выставляется автоматически после 10 `attended` |
| violation_counter | int | Счётчик нарушений подряд (`cancelled_late` + `no_show`). Сбрасывается после `attended`. При 3 → `is_blocked = true` (BR-5) |
| is_blocked | boolean | Флаг блокировки из-за нарушений (FR-56) |
| blocked_until | datetime? (nullable) | Дата окончания блокировки (FR-56) |
| blocked_reason | string? (nullable) | Причина блокировки (FR-56) |
| created_at | datetime | Дата регистрации |

Вход/регистрация — по телефону с SMS OTP (FR-1, FR-2, FR-43). Сам код подтверждения (OTP) и его проверка — на стороне бэкенда, отдельной сущностью в модели не хранится. Смена номера телефона выполняется владельцем вручную через существующую админку (UC-7 A1).

**История броней (FR-35a).** Клиенту доступна вся история своих броней (активные, отменённые, поздние отмены, неявки, отменённые клубом, посещённые) — `listBookings` отдаёт её постранично (пагинация `limit`/`offset`).

### Format (Формат тренировки) — справочник, read-only

| Атрибут | Тип | Описание |
|---|---|---|
| id | UUID (PK) | Идентификатор формата |
| name | string | Название («Новичковый» / «Опытный») |
| type | enum (`novice` / `experienced`) | Тип формата |
| capacity_cap | int | Потолок мест по формату (новичковый ≤ 8, опытный ≤ 16, FR-13) |
| description | string? (nullable) | Описательный текст формата для карточки слота (FR-9a) |
| checklist | string? (nullable) | Чек-лист «что взять с собой» (FR-9a) |
| safety_rules_url | string? (nullable) | Ссылка на страницу с правилами техники безопасности (FR-9a) |

Формат — справочная read-only сущность, приходит из существующего бэкенда. Определяет жёсткий лимит мест (`capacity_cap`) и используется для фильтрации расписания (FR-38) и гейткинга (FR-55).

### Instructor (Инструктор) — справочник, read-only

| Атрибут | Тип | Описание |
|---|---|---|
| id | UUID (PK) | Идентификатор инструктора |
| name | string | Имя инструктора |

Справочная read-only сущность. Публичный рейтинг инструктора клиентам не показывается (FR-58) — оценки видны только владельцу в существующей админке.

### Slot (Слот / тренировка) — предзаполняется, read-only для клиента

| Атрибут | Тип | Описание |
|---|---|---|
| id | UUID (PK) | Идентификатор слота |
| format_id | FK → Format | Формат тренировки (новичковый / опытный) |
| instructor_id | FK → Instructor | Назначенный инструктор |
| start_at | datetime (UTC) | Дата и время старта в UTC; источник истины — сервер. Веб-приложение отображает в локальной зоне, но право/тип отмены (правило 6 часов) вычисляет сервер (FR-17, R-021) |
| total_seats | int | Всего мест (≤ `capacity_cap` формата) |
| free_seats | int | Свободно мест (расчётное/денормализованное) |
| free_rental_kits | int | Свободно прокатных комплектов (из общих 20) |
| price | money (RUB) | Цена за место (фикс. 1500 ₽, FR-45) |
| rental_price | money (RUB) | Тариф проката одного комплекта (отдельно от `price`). Итог брони = `price × seats_count + rental_price × rental_count` (FR-45) |
| address | string | Текстовый адрес скалодрома (FR-9a) |
| status | enum (`scheduled` / `cancelled`) | Статус слота |
| cancel_reason | string? (nullable) | Причина отмены слота (заполняется при `status = cancelled`, FR-46) |

### Booking (Запись / бронь)

| Атрибут | Тип | Описание |
|---|---|---|
| id | UUID (PK) | Идентификатор записи |
| slot_id | FK → Slot | Слот |
| client_id | FK → Client | Кто записал |
| participant_age | int? (nullable) | Возраст участника. Заполняется, если родитель записывает ребёнка (≥ 6 лет, FR-54). Для взрослых — `null` |
| rental_count | int | Сколько прокатных комплектов в записи (0 или 1; одна бронь = один участник, FR-13). Выводится из выбора «свои скальники / прокат» (FR-11) |
| status | enum (`booked` / `cancelled_by_client` / `cancelled_late` / `no_show` / `cancelled_by_gym` / `attended`) | Статус записи (FR-35a, business-requirements.md) |
| price_total | money (RUB), read-only | Итоговая цена, рассчитанная и возвращаемая сервером (read-only). Веб-приложение использует её как есть и не пересчитывает (FR-45, R-005, R-010) |
| created_at | datetime | Время создания |
| cancelled_at | datetime? (nullable) | Время отмены (если была) |

**Примечание:** одна бронь = один участник (FR-13, FR-54). Родитель, желающий прийти с ребёнком, оформляет две последовательные брони на один и тот же слот (на себя и на ребёнка) — массовое бронирование «в одной операции» не поддерживается.

Итоговая цена `price_total` рассчитывается на сервере и приходит в ответе API как read-only (FR-45). Веб-приложение не пересчитывает её, а отображает; исходные тарифы `price` / `rental_price` лежат в связанном `Slot`. Расчёт сервера: `price × seats_count + rental_price × rental_count`, валюта — рубли; цена фиксируется на момент создания брони (R-010).

### InstructorRating (Оценка инструктора)

| Атрибут | Тип | Описание |
|---|---|---|
| id | UUID (PK) | Идентификатор оценки |
| booking_id | FK → Booking (unique) | Бронь, к которой привязана оценка (оценка возможна только для брони в статусе `attended`, FR-57). Одна бронь — одна оценка |
| instructor_id | FK → Instructor | Кого оценивают |
| client_id | FK → Client | Кто оценивает |
| score | int (1–5) | Оценка звёздами, без текстовых комментариев (FR-58) |
| created_at | datetime | Время создания оценки |

Оценка отправляется в существующую инфраструктуру и видна только владельцу в админке (внутренний KPI). Клиентам публичный рейтинг не показывается (FR-58). Запрос на оценку приходит через 1 час после окончания тренировки (FR-57).

### WaitlistEntry (Список ожидания / Alert List)

| Атрибут | Тип | Описание |
|---|---|---|
| id | UUID (PK) | Идентификатор записи в очереди |
| slot_id | FK → Slot | Слот |
| client_id | FK → Client | Клиент в очереди |
| position | int | Позиция в очереди (1 — первый) |
| status | enum (`active` / `notified` / `expired`) | Статус записи в очереди: `active` — ожидает, `notified` — push отправлен (место освободилось), `expired` — клиент отписался или слот отменён |
| created_at | datetime | Время подписки |

Клиент явно нажимает «Уведомить, если появится место» на заполненном слоте (FR-53). При освобождении места первый в очереди (`position = 1`, `status = active`) получает push-уведомление (FR-61). Уведомление не резервирует место автоматически — клиент сам записывается через веб-приложение (BR-6). Один клиент — одна подписка на слот.

## Связи

- `Client 1 – * Booking` — клиент может иметь несколько броней.
- `Client 1 – * InstructorRating` — клиент может оставить несколько оценок.
- `Client 1 – * WaitlistEntry` — клиент может быть в списке ожидания на нескольких слотах.
- `Format 1 – * Slot` — каждый формат используется во многих слотах.
- `Instructor 1 – * Slot` — каждый инструктор ведёт несколько слотов.
- `Instructor 1 – * InstructorRating` — каждый инструктор получает несколько оценок.
- `Slot 1 – * Booking` — слот может иметь несколько броней.
- `Slot 1 – * WaitlistEntry` — слот может иметь очередь из клиентов.
- `Booking 1 – 1 InstructorRating` — одна бронь — одна оценка (unique FK).

## Модель состояний (жизненный цикл)

Две сущности имеют явный жизненный цикл: `Booking` (управляется клиентским API) и `Slot` (read-only-проекция; переходы выполняет существующая инфраструктура, клиент только читает текущий статус).

### Booking (Запись / бронь)

Создаётся в `booked`. Переходы в `cancelled_by_client` / `cancelled_late` — по инициативе клиента (тип определяется сервером по правилу 6 часов, FR-17/FR-18). Переход в `cancelled_by_gym` — при отмене слота клубом (FR-46). Переход в `attended` / `no_show` — фиксируется существующей инфраструктурой по факту начала тренировки.

Какой именно переход (ранняя/поздняя отмена) — определяется сервером по времени до старта на момент отмены (`slot.start_at` в UTC — источник истины); граница «ровно 6 часов» трактуется как ранняя (≥ 6 ч, FR-17).

**«Прошедшая» бронь — не хранимый статус.** Группы «Предстоящие» / «Прошедшие» в UI (FR-35a) — производное отображение по `Slot.start_at` относительно текущего времени. Статус остаётся `booked` / `cancelled_*` / `attended`.

| Из | Событие / условие | В | Эффект на слот | Трасса |
|---|---|---|---|---|
| — | Клиент подтверждает бронь | booked | `free_seats −= 1`; если `rental_count = 1` — `free_rental_kits −= 1` | UC-3, FR-10 |
| booked | Отмена, до старта ≥ 6 ч | cancelled_by_client | Место и прокатный комплект возвращаются в слот; уведомляется первый клиент из Alert List | UC-4, FR-17 |
| booked | Отмена, до старта < 6 ч | cancelled_late | Место и прокатный комплект НЕ освобождаются; фиксируется нарушение. Счётчик нарушений +1; при 3 подряд — блокировка на неделю | UC-4 A1, FR-18, BR-5 |
| booked | Слот отменён клубом (`Slot.status → cancelled`) | cancelled_by_gym | Слот снят; клиент уведомляется push с причиной (FR-46) | R-008, FR-46 |
| booked | Тренировка началась, бронь активна | attended | Факт посещения; счётчик нарушений сбрасывается | FR-57, BR-5 |
| booked | Тренировка началась, клиент не пришёл | no_show | Фиксируется неявка; нарушение. Счётчик нарушений +1 | BR-5 |
| cancelled_by_client / cancelled_late / no_show / cancelled_by_gym / attended | — (терминальные) | — | Повторная отмена не выполняется | UC-4 E2 |

Отмена возможна только пока тренировка не началась (`start_at` в будущем) — после старта CTA недоступна (UC-4 E1).

```mermaid
stateDiagram-v2
    [*] --> booked: Создание брони
    booked --> cancelled_by_client: Отмена ≥6ч до старта
    booked --> cancelled_late: Отмена <6ч до старта
    booked --> cancelled_by_gym: Слот отменён клубом
    booked --> attended: Тренировка началась
    booked --> no_show: Неявка
    cancelled_by_client --> [*]
    cancelled_late --> [*]
    cancelled_by_gym --> [*]
    attended --> [*]
    no_show --> [*]

### Slot (Тренировка / слот)

Переход в `cancelled` инициирует владелец в существующей инфраструктуре (массовое уведомление участников — FR-46). Клиент видит статус и реагирует на UI: при `cancelled` запись недоступна, в карточке отображается причина.

**«Прошедшая»** — производное (`start_at` в прошлом). Отметка явки — вне скоупа клиента (существующая инфраструктура).

| Статус | Что видит клиент | Запись |
|--------|------------------|--------|
| `scheduled` (старт в будущем) | Слот в списке/карточке; при `free_seats = 0` — пометка «Мест нет» и CTA «Уведомить, если появится место» (FR-53) | Доступна при `free_seats > 0` и соблюдении гейткинга/блокировок |
| `scheduled` (старт в прошлом) — производное «Прошедшая» | В клиентских сценариях не предлагается к записи | Недоступна |
| `cancelled` | Пометка «Отменена скалодромом» + причина (FR-46) | Недоступна (HTTP 410 при попытке) |

```mermaid
stateDiagram-v2
    [*] --> scheduled: Создание слота
    
    scheduled --> cancelled: Отмена скалодромом
    scheduled --> [*]: Старт прошёл (производное)
    
    cancelled --> [*]


Ключевые инварианты (целостность данных)
Slot.free_seats = Slot.total_seats − Σ(booked bookings) — место при поздней отмене (cancelled_late) и неявке (no_show) НЕ освобождается.
Slot.total_seats ≤ Format.capacity_cap (новичковый ≤ 8, опытный ≤ 16, FR-13).
Slot.free_rental_kits = исходный прокатный фонд слота − Σ(booked bookings с rental_count = 1) — прокатный комплект при поздней отмене тоже НЕ освобождается; общий прокатный фонд клуба — 20 комплектов (BR-3).
Только ранняя отмена (cancelled_by_client) возвращает места и прокатные комплекты в слот (FR-17); cancelled_late и no_show удерживают и место, и комплект (FR-18, BR-5).
Запись/отмена выполняются атомарно: овербукинг и двойная бронь исключены при параллельных операциях (NFR-8, NFR-9). Клиент передаёт Idempotency-Key (UUID v4) для мутирующих операций (NFR-27).
Одна бронь = один участник (FR-13). Родитель + ребёнок — две последовательные брони на один слот (FR-54).
Гейткинг по формату: запись на слот с format.type = experienced требует Client.rope_access = true (FR-55).
Блокировка клиента: при Client.is_blocked = true и Client.blocked_until > now() запись запрещена (FR-56).
Список ожидания: один клиент — одна активная подписка на слот (WaitlistEntry с status = active); при освобождении места push получает клиент с минимальным position (FR-61).

```mermaid
erDiagram
    Client ||--o{ Booking : "создаёт"
    Client ||--o{ InstructorRating : "оставляет"
    Client ||--o{ WaitlistEntry : "подписывается"
    Format ||--o{ Slot : "определяет"
    Instructor ||--o{ Slot : "ведёт"
    Instructor ||--o{ InstructorRating : "получает"
    Slot ||--o{ Booking : "вмещает"
    Slot ||--o{ WaitlistEntry : "имеет очередь"
    Booking ||--o| InstructorRating : "оценивается"

    Client {
        uuid id PK
        string name
        string phone UK
        int age
        date birthday
        boolean safety_rules_accepted
        boolean rope_access
        boolean is_permanent
        boolean is_blocked
        datetime blocked_until
        string blocked_reason
        datetime created_at
    }
    Format {
        uuid id PK
        string name
        enum type "novice | experienced"
        int capacity_cap
        string description
        string checklist
        string safety_rules_url
    }
    Instructor {
        uuid id PK
        string name
    }
    Slot {
        uuid id PK
        uuid format_id FK
        uuid instructor_id FK
        datetime start_at
        int total_seats
        int free_seats
        int free_rental_kits
        money price
        money rental_price
        string address
        enum status "scheduled | cancelled"
        string cancel_reason
    }
    Booking {
        uuid id PK
        uuid slot_id FK
        uuid client_id FK
        int participant_age
        int rental_count "0 | 1"
        enum status "booked | cancelled_by_client | cancelled_late | no_show | cancelled_by_gym | attended"
        money price_total
        datetime created_at
        datetime cancelled_at
    }
    InstructorRating {
        uuid id PK
        uuid booking_id FK "unique"
        uuid instructor_id FK
        uuid client_id FK
        int score "1..5"
        datetime created_at
    }
    WaitlistEntry {
        uuid id PK
        uuid slot_id FK
        uuid client_id FK
        int position
        enum status "active | notified | expired"
        datetime created_at
    }