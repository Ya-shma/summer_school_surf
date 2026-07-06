# Sequence-диаграммы API-взаимодействия

Связанные артефакты: `use-cases.md`, `functional-requirements.md`, `non-functional-requirements.md`, `design-brief.md`

**Цель:** формализовать обмен вызовами между клиентским веб-приложением и бэкендом в критичных сценариях бронирования. Диаграммы служат контрактом для разработки и основой для нагрузочного/интеграционного тестирования.

## 1. Участники (Actors)

| Участник | Роль |
|---|---|
| Client | Веб-приложение (браузер) |
| Storage | Защищённое хранилище браузера (HttpOnly cookies / secure localStorage) |
| API | Бэкенд скалодрома (источник истины) |
| SMS | SMS-провайдер (OTP) |
| Push | Web Push API (VAPID + service worker) |

Все взаимодействия с API — по HTTPS (TLS 1.2+). Все мутирующие запросы требуют заголовок `Idempotency-Key: <UUID v4>` (NFR-27).

## 2. UC-1. Регистрация и вход по SMS OTP

**Сценарий:** новый клиент вводит телефон, получает код, создаёт профиль.
**Связь:** UC-1, FR-1, FR-2, FR-43, FR-50, NFR-18, NFR-19.

```mermaid
sequenceDiagram
    autonumber
    actor U as Клиент
    participant C as Client (браузер)
    participant S as Storage
    participant API as API
    participant SMS as SMS-провайдер

    U->>C: Открыть веб-приложение
    C->>U: Экран входа (телефон + галочка ПДн)
    U->>C: Ввести телефон, поставить галочку ПДн
    C->>API: POST /auth/otp/request<br/>{phone, consent_pd=true}
    API->>SMS: Отправить 4–6-значный код (TTL 5 мин)
    SMS-->>U: SMS с кодом
    API-->>C: 200 {otp_ttl: 300, retry_after: 30}
    Note over C: Запуск таймера повторной отправки

    alt Повторная отправка до истечения retry_after
        C-->>U: Кнопка «Отправить повторно» disabled + таймер
    end

    U->>C: Ввести код
    C->>API: POST /auth/otp/verify<br/>{phone, code}

    alt Неверный код (< 3 попыток)
        API-->>C: 401 {error: "invalid_code", attempts_left: 2}
        C-->>U: «Неверный код, попробуйте ещё раз»
    else 3-я неверная попытка
        API-->>C: 401 {error: "invalid_code", blocked_until: <timestamp>}
        C-->>U: Экран блокировки на 15 минут с таймером
    else Rate-limit исчерпан
        API-->>C: 429 {error: "rate_limited", retry_after: N}
        C-->>U: «Слишком много попыток, попробуйте через N минут»
    else Успех (существующий клиент)
        API-->>C: 200 {access_token, refresh_token, profile}
        C->>S: Сохранить access + refresh (HttpOnly cookies / secure localStorage)
        C->>API: POST /push/subscription {push_subscription}
        API-->>C: 200
        C-->>U: Главный экран «Расписание»
    else Успех (новый клиент)
        API-->>C: 200 {access_token, refresh_token, profile: null}
        C->>S: Сохранить токены
        C->>API: POST /push/subscription {push_subscription}
        C-->>U: Экран заполнения профиля
        U->>C: Ввести имя (обяз.), возраст, ДР (опц.)
        C->>API: PATCH /profile {name, age?, birthday?}
        API-->>C: 200 {profile}
        C-->>U: Главный экран «Расписание»
    end


Ключевые моменты:
TTL OTP — 5 минут; при повторной отправке старый код аннулируется (NFR-19).
Rate-limit: ~1 запрос / 30–60 с, ~5 / час.
После 3 неверных попыток — блокировка на 15 минут.
Токены хранятся в HttpOnly cookies / secure localStorage (NFR-18).
Push-подписка регистрируется сразу после входа.

## 3. UC-2. Просмотр слотов и открытие карточки

Сценарий: клиент листает ленту слотов, применяет фильтры, открывает карточку.
Связь: UC-2, FR-9, FR-9a, FR-38, FR-52, NFR-24, NFR-31.

```mermaid
sequenceDiagram
    autonumber
    actor U as Клиент
    participant C as Client (браузер)
    participant API as API

    U->>C: Открыть вкладку «Расписание»
    C->>API: GET /slots?date_from=now&date_to=now+7d
    API-->>C: 200 {slots: [...]}
    C-->>U: Лента карточек слотов

    U->>C: Применить фильтры (формат, инструктор, период)
    C->>API: GET /slots?date_from=...&date_to=...<br/>&format=newbie,experienced<br/>&instructor_id=...&only_available=false
    API-->>C: 200 {slots: [...], instructors: [...]}
    C-->>U: Отфильтрованная лента + чипы активных фильтров

    U->>C: Тап по слоту
    Note over C: NFR-31 — карточка ВСЕГДА запрашивается<br/>свежей с бэкенда (не из кэша)
    C->>API: GET /slots/{id}
    API-->>C: 200 {slot: {..., free_seats, free_rental_boards,<br/>price_total, can_book, rope_access_required,<br/>is_blocked, opens_at}}

    alt Слот доступен
        C-->>U: Карточка + активная CTA «Записаться · 1500 ₽»
    else Мест нет
        C-->>U: Карточка + CTA «Уведомить, если появится место»
    else Слот ещё не открыт для категории клиента (FR-52)
        C-->>U: CTA «Откроется через N дней» (disabled)
    else Слот отменён скалодромом
        C-->>U: Плашка «Отменена скалодромом» + причина
    else Клиент заблокирован (FR-56)
        C-->>U: CTA «Запись недоступна» + дата окончания блокировки
    end

    alt Нет сети (NFR-24)
        C->>C: Показать кэш списка слотов (через Service Worker / Cache API)
        C-->>U: Лента + баннер «Данные могли устареть · Обновить»
        Note over C: CTA записи / Alert List — заблокированы
    end


Ключевые моменты:
Лента слотов — можно кэшировать (через Service Worker, с пометкой «могли устареть»).
Карточка слота — всегда свежий запрос (NFR-31), т.к. от неё зависит возможность записи.
Поля can_book, rope_access_required, is_blocked, opens_at приходят с сервера — клиент не вычисляет их сам.

## 4. UC-3. Запись на тренировку (критичный сценарий)

Сценарий: клиент подтверждает бронь с выбором снаряжения. Самый важный сценарий — включает идемпотентность, гонки за места, обработку конфликтов.
Связь: UC-3, FR-10, FR-11, FR-13, FR-14, FR-15, FR-45, FR-51, FR-54, FR-55, NFR-27.

```mermaid
sequenceDiagram
    autonumber
    actor U as Клиент
    participant C as Client (браузер)
    participant API as API

    U->>C: Открыть карточку слота
    C->>API: GET /slots/{id}
    API-->>C: 200 {slot, free_seats, free_rental_boards, price_total}
    C-->>U: Карточка + CTA «Записаться»

    U->>C: Выбрать «Нужно прокатное снаряжение» (FR-11)
    U->>C: [Опц.] Включить «Записать ребёнка» + возраст ≥ 6 (FR-54)
    U->>C: Тап «Подтвердить запись»
    C->>C: Сгенерировать Idempotency-Key = UUID v4 (NFR-27)

    alt Первая запись в жизни (FR-51)
        C-->>U: Модалка «Ознакомлен с правилами и ТБ»
        U->>C: Поставить галочку
        C->>API: PATCH /profile {safety_rules_accepted: true}
        API-->>C: 200
    end

    C->>API: POST /bookings<br/>Idempotency-Key: <UUID><br/>{slot_id, rental: true, child_age?: 8}

    alt Успех
        API-->>C: 201 {booking_id, price_total, slot}
        C-->>U: Экран успеха «Вы записаны!» + сводка
    else Места закончились (гонка)
        API-->>C: 409 {error: "slot_full", available_seats: 0}
        C-->>U: «Места закончились» + обновление карточки
    else Проката нет
        API-->>C: 409 {error: "rental_unavailable",<br/>available_rental_boards: 0}
        C-->>U: «Проката нет, выберите свои скальники»
    else Двойная бронь
        API-->>C: 409 {error: "double_booking", booking_id: "..."}
        C-->>U: «Вы уже записаны» → переход в «Мои бронирования»
    else Гейткинг (нет rope_access)
        API-->>C: 403 {error: "rope_access_required"}
        C-->>U: «Сначала пройдите вводную тренировку для новичков»
    else Клиент заблокирован
        API-->>C: 403 {error: "client_blocked", blocked_until: "..."}
        C-->>U: «Вы заблокированы до N»
    else Слот отменён / стартовал
        API-->>C: 410 / 422 {error: "slot_cancelled" / "slot_started"}
        C-->>U: «Тренировка отменена» / «Тренировка началась»
    else Возраст ребёнка < 6
        API-->>C: 400 {error: "child_age_invalid", min_age: 6}
        C-->>U: «Возраст ребёнка должен быть ≥ 6 лет»
    end

    alt Таймаут / обрыв соединения / 5xx (NFR-27)
        Note over C: НЕОПРЕДЕЛЁННЫЙ РЕЗУЛЬТАТ<br/>Повторяем запрос с ТЕМ ЖЕ Idempotency-Key
        C->>API: POST /bookings<br/>Idempotency-Key: <ТОТ ЖЕ UUID><br/>{...}
        API-->>C: Тот же ответ, что и при первом успешном вызове<br/>(дубль не создаётся)
    end

Ключевые моменты:
Идемпотентность — ключ генерируется клиентом один раз на операцию и переиспользуется при retry (NFR-27).
Гонка за места — атомарная проверка на стороне API; клиент получает понятный 409 Conflict с кодом slot_full.
Цена — клиент не пересчитывает price_total локально, использует значение из ответа API (FR-45).
Согласие с ТБ — запрашивается один раз в жизни, флаг сохраняется в профиле (FR-51).
Retry при неопределённом результате — только с тем же Idempotency-Key.

## 5. UC-4. Отмена записи

Сценарий: клиент отменяет предстоящую запись. Сервер — источник истины по правилу 6 часов.
Связь: UC-4, FR-16, FR-17, FR-18, FR-16a, NFR-27, NFR-29.

```mermaid
sequenceDiagram
    autonumber
    actor U as Клиент
    participant C as Client (браузер)
    participant API as API

    U->>C: Открыть «Мои бронирования» → детали брони
    C->>API: GET /bookings/{id}
    API-->>C: 200 {booking, slot, can_cancel: true|false,<br/>cancel_deadline: <timestamp>}

    alt can_cancel = true (ранняя отмена, ≥ 6 ч до старта)
        C-->>U: Активная CTA «Отменить»
        U->>C: Тап «Отменить»
        C-->>U: Модалка подтверждения
        U->>C: Подтвердить
        C->>C: Сгенерировать Idempotency-Key
        C->>API: POST /bookings/{id}/cancel<br/>Idempotency-Key: <UUID>
        API-->>C: 200 {status: "cancelled_by_client"}
        Note over API: Место + прокат возвращаются в слот.<br/>Первый в Alert List получает push (FR-61).
        C-->>U: Тост «Запись отменена» + обновление списка
    else can_cancel = false (поздняя отмена, < 6 ч)
        C-->>U: CTA «Отменить» disabled
        C-->>U: Пояснение «Отмена возможна не позднее чем за 6 часов»
        C-->>U: Кнопка «Написать Оле» (FR-16a)
        U->>C: Тап «Написать Оле»
        C->>C: Открыть веб-ссылку https://t.me/... (NFR-26)
    end

    alt Расхождение клиентского прогноза и сервера (A2 UC-4)
        Note over C: Клиент показал «можно отменить»,<br/>но сервер вернул can_cancel = false
        C-->>U: Применить серверный статус, CTA заблокирована
    end

    alt Таймаут / 5xx
        C->>API: POST /bookings/{id}/cancel<br/>Idempotency-Key: <ТОТ ЖЕ UUID>
        API-->>C: Идентичный ответ
    end


Ключевые моменты:
Сервер — источник истины по времени и статусу отмены (FR-17).
Граница «ранней» отмены — ровно за 6 часов включительно (FR-17).
При успешной отмене сервер сам уведомляет первого в Alert List (FR-61).
При поздней отмене — только веб-ссылка в Telegram (FR-16a).

## 6. UC-5. Подписка на список ожидания (Alert List)

Сценарий: клиент подписывается на уведомление об освобождении места.
Связь: UC-5, FR-53, FR-61, BR-6, NFR-27.

```mermaid
sequenceDiagram
    autonumber
    actor U as Клиент
    participant C as Client (браузер)
    participant API as API
    participant Push as Web Push API

    U->>C: Открыть карточку заполненного слота
    C->>API: GET /slots/{id}
    API-->>C: 200 {slot, free_seats: 0, waitlist_joined: false}
    C-->>U: CTA «Уведомить, если появится место»
    U->>C: Тап CTA
    C->>C: Сгенерировать Idempotency-Key
    C->>API: POST /slots/{id}/waitlist<br/>Idempotency-Key: <UUID>

    alt Успех
        API-->>C: 201 {position: 3}
        C-->>U: CTA меняется на «Вы в списке ожидания» + «Отписаться»
    else Уже в списке
        API-->>C: 409 {error: "waitlist_already_joined", position: 3}
        C-->>U: CTA сразу показывает «Вы в списке ожидания»
    else Слот уже не заполнен
        API-->>C: 409 {error: "slot_not_full"}
        C-->>U: Переключить UI на обычную CTA «Записаться»
    else Слот отменён
        API-->>C: 410 {error: "slot_cancelled"}
        C-->>U: Кнопка Alert List скрывается
    end

    Note over API,Push: ...спустя некоторое время...
    Note over API: Другой клиент отменил бронь (UC-4)
    API->>Push: Push первому в очереди (FR-61)<br/>«Появилось место на тренировке N»
    Push->>U: Push-уведомление в браузере
    U->>C: Тап по push → deep-link в карточку слота
    C->>API: GET /slots/{id}
    API-->>C: 200 {slot, free_seats: 1}
    C-->>U: Карточка + активная CTA «Записаться»
    Note over U: Клиент САМ записывается (UC-3).<br/>Автобронь НЕ происходит (BR-6).


Ключевые моменты:
Alert List — уведомление, а не автобронь (BR-6).
Один клиент — одна подписка на слот.
Если первый в очереди не успел записаться — уведомление не отправляется повторно (A3 UC-5).

## 7. UC-6. Оценка инструктора

Сценарий: клиент ставит оценку после посещения тренировки.
Связь: UC-6, FR-57, FR-58, NFR-27.

```mermaid
sequenceDiagram
    autonumber
    actor U as Клиент
    participant C as Client (браузер)
    participant API as API
    participant Push as Web Push API

    Note over API,Push: Тренировка завершилась ≥ 1 часа назад
    API->>Push: Push «Оцените инструктора»<br/>(только для статуса attended, FR-57)
    Push->>U: Push-уведомление в браузере
    U->>C: Тап по push → deep-link в экран оценки
    C->>API: GET /bookings/{id}/rating
    API-->>C: 200 {booking, instructor, rating: null|existing}
    C-->>U: Экран оценки (5 звёзд)
    U->>C: Выбрать 1–5 звёзд
    U->>C: Тап «Отправить оценку» / «Изменить оценку»
    C->>C: Сгенерировать Idempotency-Key
    C->>API: POST /bookings/{id}/rating<br/>Idempotency-Key: <UUID><br/>{rating: 4}

    alt Успех
        API-->>C: 200 {rating: 4}
        C-->>U: Тост «Спасибо за оценку!» → возврат в «Мои бронирования»
    else Бронь не в статусе attended
        API-->>C: 403 {error: "not_attended"}
        C-->>U: «Оценка недоступна для этой записи»
    else Окно оценки закрыто
        API-->>C: 403 {error: "rating_window_closed"}
        C-->>U: «Окно оценки закрыто»
    end

    alt Таймаут / 5xx
        C->>API: POST /bookings/{id}/rating<br/>Idempotency-Key: <ТОТ ЖЕ UUID>
        API-->>C: Идентичный ответ (дубль не создаётся)
    end


Ключевые моменты:
Оценка — только для статуса attended (FR-57).
Только звёзды 1–5, без текстовых комментариев (FR-58).
Идемпотентность защищает от дублей при сетевых сбоях.

## 8. UC-8. Обработка 401 и обновление сессии

Сценарий: access-токен истёк, клиент продолжает работу.
Связь: NFR-18.

```mermaid
sequenceDiagram
    autonumber
    actor U as Клиент
    participant C as Client (браузер)
    participant S as Storage
    participant API as API

    U->>C: Выполнить действие (напр., запись)
    C->>S: Прочитать access_token
    C->>API: POST /bookings<br/>Authorization: Bearer <access>
    API-->>C: 401 Unauthorized (access expired)
    C->>S: Прочитать refresh_token
    C->>API: POST /auth/refresh<br/>{refresh_token}

    alt Успех
        API-->>C: 200 {access_token, refresh_token}
        C->>S: Сохранить новую пару токенов
        C->>API: Повтор исходного запроса<br/>POST /bookings с новым access
        API-->>C: 201 {...}
        C-->>U: Успех
    else Refresh тоже невалиден / отозван
        API-->>C: 401
        C->>S: Очистить access + refresh
        C-->>U: Переход на экран входа
    end


Ключевые моменты:
Access-токен — короткоживущий, refresh — долгоживущий (NFR-18).
При 401 — автоматическая попытка обновить access через refresh.
При неудаче — очистка хранилища и редирект на экран входа.

## 9. UC-8 (push). Push при отмене скалодромом

Сценарий: владелец отменил слот в админке.
Связь: UC-8 (S2), FR-46, BR-14.

```mermaid
sequenceDiagram
    autonumber
    participant Owner as Владелец (админка)
    participant API as API
    participant Push as Web Push API
    participant U as Клиент
    participant C as Client (браузер)

    Owner->>API: Отменить слот {slot_id, reason}
    Note over API: Действие вне скоупа клиента —<br/>выполняется в существующей инфраструктуре

    loop Для каждой активной брони на слоте
        API->>Push: Push клиенту<br/>«Тренировка отменена: <reason>»<br/>+ кнопка «Выбрать другое время»
    end

    Push->>U: Push-уведомление в браузере
    U->>C: Тап по push → deep-link
    C->>API: GET /slots?format=<same>&date_from=now
    API-->>C: 200 {slots: [...]}
    C-->>U: Расписание с предзаполненным фильтром по формату

    Note over U,C: Бронь в истории остаётся<br/>со статусом cancelled_by_gym + причина (FR-46).<br/>Повторная запись на этот слот → 410.

## 10. Сводная таблица эндпоинтов

| Метод | Эндпоинт | Идемпотентность | Назначение | UC |
|---|---|---|---|---|
| POST | `/auth/otp/request` | — | Запрос SMS-кода | UC-1 |
| POST | `/auth/otp/verify` | — | Подтверждение кода | UC-1 |
| POST | `/auth/refresh` | — | Обновление access-токена | NFR-18 |
| GET | `/slots` | — | Список слотов (лента) | UC-2 |
| GET | `/slots/{id}` | — | Детали слота (карточка) | UC-2, UC-3, UC-5 |
| POST | `/slots/{id}/waitlist` | ✅ | Подписка на Alert List | UC-5 |
| DELETE | `/slots/{id}/waitlist` | ✅ | Отписка от Alert List | UC-5 |
| POST | `/bookings` | ✅ | Создание брони | UC-3 |
| GET | `/bookings/{id}` | — | Детали брони | UC-4, UC-6 |
| POST | `/bookings/{id}/cancel` | ✅ | Отмена брони | UC-4 |
| POST | `/bookings/{id}/rating` | ✅ | Оценка инструктора | UC-6 |
| GET | `/bookings/{id}/rating` | — | Получить существующую оценку | UC-6 |
| PATCH | `/profile` | — | Обновление профиля | UC-1, UC-7 |
| GET | `/profile` | — | Текущий профиль | UC-7 |
| POST | `/push/token` | — | Регистрация push-токена | UC-1 |


## 11. Общие правила взаимодействия

Идемпотентность (NFR-27). Все мутирующие эндпоинты требуют заголовок Idempotency-Key: <UUID v4>. Сервер гарантирует идентичный ответ в окне ≥ 24 ч.
Авторизация. Все эндпоинты, кроме /auth/otp/*, требуют Authorization: Bearer <access_token>.
Время (NFR-29). API принимает/возвращает время в UTC (ISO 8601). Веб-приложение отображает в локальной зоне.
Коды ответов. Клиент обрабатывает по единой матрице ошибок (UC-3, US-25):
200/201 — успех;
400 — валидация (повтор с исправлениями);
401 — refresh-flow (NFR-18);
403 — гейткинг/блокировка (без retry);
409 — конфликт (без retry, изменить выбор);
410 — ресурс удалён/отменён;
422 — бизнес-правило (слот стартовал);
429 — rate-limit (ждать retry_after);
5xx / таймаут — retry с тем же Idempotency-Key.
Timeout. ~10 с на запрос (NFR-24).
Offline (NFR-24). Мутации офлайн запрещены. Чтение — из кэша (через Service Worker / Cache API) с пометкой «данные могли устареть».
Приватность (NFR-20). В логах и UI — только маскированный телефон (+7 *** *** ** 67). OTP-коды и токены не логируются.

## 12. Что НЕ покрыто диаграммами (намеренно)

Внутренняя логика бэкенда (транзакции, маппинг сущностей) — вне скоупа клиента (R-004).
Админские операции (создание слотов, выставление флага rope_access, блокировки) — выполняются в существующей инфраструктуре.
Отметка явки (attended) — выставляется бэкендом автоматически по факту старта тренировки.
Начисление статуса «постоянный клиент» — автоматическое на стороне бэкенда после 10 attended.