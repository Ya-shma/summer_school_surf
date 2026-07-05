# Этап 3. Проектирование. Sequence-диаграммы API-взаимодействия

Документ описывает, как клиентское приложение и сервер обмениваются вызовами в критичных сценариях бронирования. Контракты API описываются в многофайловой спецификации (домены `bookings`, `slots`, `auth`, `waitlist`, `ratings`). Операции: `createBooking`, `cancelBooking` (bookings/api.yaml), `joinWaitlist`, `leaveWaitlist` (waitlist/api.yaml), `rateInstructor` (ratings/api.yaml), `auth/otp/*` (auth/api.yaml).

**Скоуп.** Только клиентское приложение и API для него. Функции инструктора и владельца (CRUD расписания, отмена слота, массовая рассылка push, простановка флага `rope_access`) выполняются в существующей инфраструктуре и здесь не описываются.

---

## Сквозные правила взаимодействия

1. **Аутентификация.** Все вызовы (кроме `auth/otp/*`) выполняются с заголовком `Authorization: Bearer <access_token>` (`bearerAuth`). При истёкшем/неверном токене сервер отвечает `401 Unauthorized`; клиент пытается обновить access по refresh-токену (NFR-18), при неуспехе — очищает Keychain/Keystore и уходит на экран входа (UC-1).
2. **Источник истины.** Сервер — единственный источник истины по времени (`slot.start_at` в UTC), доступности мест и прокатных комплектов, статусу брони, типу отмены, флагу `rope_access`, статусу `is_permanent`, флагу `is_blocked`. Клиент ничего не пересчитывает локально (R-005, R-021, FR-45, FR-17, FR-18).
3. **Атомарность мутаций.** Запись, отмена, добавление в Alert List и оценка выполняются атомарно на стороне сервера; овербукинг и двойная бронь исключены (NFR-8, NFR-9).
4. **Идемпотентность.** Все мутирующие операции (`createBooking`, `cancelBooking`, `joinWaitlist`, `leaveWaitlist`, `rateInstructor`) требуют заголовок `Idempotency-Key` (UUID v4). При неопределённом результате (таймаут ~10 с, `5xx`, обрыв соединения) клиент повторяет запрос с тем же ключом; сервер возвращает тот же ответ, дубль не создаётся (NFR-27, R-020, R-022).
5. **Offline-режим.** Мутации офлайн запрещены — показывается понятное сообщение о необходимости подключения. Просмотр ранее загруженных данных (список слотов, свои брони) доступен из кэша с пометкой «данные могли устареть» (NFR-24).
6. **Время.** Все моменты передаются в UTC (ISO 8601), отображаются клиентом в локальной часовой зоне устройства (NFR-29).
7. **Локализация ошибок.** Коды ошибок (см. матрицу ниже) — канонические; локализованный текст отображается клиентом по коду и полям `details` (R-023).

**Каноническая матрица кодов ошибок (R-023).**

| Код | HTTP | Обязательные `details` | UX-реакция | Retry |
|---|---|---|---|---|
| `slot_full` | 409 | `available_seats`, `available_rental_boards` | Показать актуальные свободные места/прокат, обновить карточку | Нет (изменить выбор) |
| `double_booking` | 409 | `booking_id` | Сообщить, что бронь уже есть; перейти в «Мои бронирования» | Нет |
| `rope_access_required` | 403 | `slot_id`, `format` | «Сначала пройдите вводную тренировку для новичков» | Нет |
| `client_blocked` | 403 | `blocked_until`, `reason` | «Вы заблокированы до N» | Нет |
| `rental_unavailable` | 409 | `available_rental_boards` | «Проката нет, выберите свои скальники» | Нет |
| `slot_cancelled` | 410 | `slot_id`, `reason` | Убрать CTA записи, показать причину отмены | Нет |
| `slot_started` | 422 | `slot_id`, `start_at` | «Тренировка началась/прошла» | Нет |
| `safety_rules_not_accepted` | 400 | — | Вернуть клиента к шагу согласия с ТБ | Да |
| `child_age_invalid` | 400 | `min_age` | «Возраст ребёнка должен быть ≥ 6 лет» | Да |
| `already_cancelled` | 409 | `booking_id` | Бронь уже отменена, статус актуализируется | Нет |
| `waitlist_already_joined` | 409 | `slot_id` | Кнопка сразу показывает «Вы в списке ожидания» | Нет |
| `not_attended` | 403 | `booking_id` | Оценка недоступна — тренировка не посещена | Нет |
| `rating_window_closed` | 403 | `booking_id` | «Окно оценки закрыто» | Нет |
| `invalid_code` | 400/401 | — | Поле OTP остаётся активным, «Неверный код» | Да |
| `401` (unauthorized) | 401 | — | Очистка токена, переход на авторизацию (NFR-18) | Да (после входа) |
| `403` (forbidden) | 403 | — | Сообщение об отсутствии прав | Нет |
| `429` (rate limit) | 429 | `retry_after` | «Слишком много попыток», отложенный повтор | Да (после `retry_after`) |
| `5xx` (server error) | 5xx | — | Единый Error/Retry; повтор по тому же `Idempotency-Key` | Да |

---

## Сценарий 1: Создание брони (`createBooking`, UC-3)

**Поток.** SCR-004 «Оформление записи» → `POST /bookings` → BS-002 «Подтверждение». Клиент отправляет `slot_id`, `rental` (булево: свои скальники или прокат), опционально `child_age` (≥ 6 лет, если записывается ребёнок). Итоговую цену `price_total` (RUB, read-only) считает сервер — клиент её не вычисляет, а показывает (FR-45, R-005, R-010).

**Бизнес-правила, проверяемые сервером атомарно:**
- слот не отменён и не стартовал;
- у клиента есть флаг `rope_access`, если формат слота «опытный» (FR-55);
- клиент не заблокирован из-за нарушений (FR-56);
- клиент принял правила ТБ (FR-51);
- `free_seats ≥ 1` с учётом лимита формата (новичковый ≤ 8, опытный ≤ 16 — FR-13);
- если `rental = true` — `free_rental_boards ≥ 1` (FR-14);
- нет активной брони этого клиента на тот же слот (`double_booking`);
- если указан `child_age` — значение ≥ 6 (FR-54).

```mermaid
sequenceDiagram
    actor User as Клиент
    participant App as Приложение
    participant API as API (bookings)

    Note over App: SCR-004: карточка слота открыта,<br/>данные актуальны (NFR-31)
    User->>App: Тап «Записаться»
    App-->>User: BS-001 «Выбор снаряжения»<br/>(свои скальники / прокат)
    User->>App: Выбирает вариант, опц. «Записать ребёнка»<br/>с указанием возраста
    App->>App: Проверяет локально: согласие с ТБ (FR-51),<br/>флаг rope_access (FR-55), child_age ≥ 6
    User->>App: Подтверждает запись
    App->>App: Генерирует Idempotency-Key (UUID v4)

    App->>API: POST /bookings<br/>Authorization: Bearer<br/>Idempotency-Key: uuid<br/>{slot_id, rental, child_age?}
    Note over API: Сервер атомарно проверяет:<br/>лимиты мест/проката, rope_access,<br/>is_blocked, double_booking,<br/>safety_rules_accepted, slot state

    alt Успех (201 Created)
        API-->>App: 201 Booking {status: booked,<br/>price_total (read-only)}
        App-->>User: BS-002 «Подтверждение»<br/>+ снек «Бронь создана»<br/>+ переход в «Мои бронирования»
    else Нет мест (409 slot_full)
        API-->>App: 409 {code: slot_full,<br/>available_seats, available_rental_boards}
        App-->>User: Обновлённая карточка,<br/>кнопка записи неактивна
    else Нет проката (409 rental_unavailable)
        API-->>App: 409 {code: rental_unavailable,<br/>available_rental_boards: 0}
        App-->>User: «Проката нет, выберите свои скальники»
    else Гейткинг (403 rope_access_required)
        API-->>App: 403 {code: rope_access_required}
        App-->>User: «Сначала пройдите вводную<br/>тренировку для новичков»
    else Клиент заблокирован (403 client_blocked)
        API-->>App: 403 {code: client_blocked,<br/>blocked_until, reason}
        App-->>User: «Вы заблокированы до N»
    else Двойная бронь (409 double_booking)
        API-->>App: 409 {code: double_booking, booking_id}
        App-->>User: Переход в «Мои бронирования»
    else ТБ не приняты (400 safety_rules_not_accepted)
        API-->>App: 400 {code: safety_rules_not_accepted}
        App-->>User: Возврат к шагу согласия с ТБ
    else Возраст ребёнка некорректен (400 child_age_invalid)
        API-->>App: 400 {code: child_age_invalid, min_age: 6}
        App-->>User: «Возраст ребёнка должен быть ≥ 6 лет»
    else Слот отменён (410 slot_cancelled)
        API-->>App: 410 {code: slot_cancelled, reason}
        App-->>User: Убрать CTA записи, показать причину
    else Слот стартовал (422 slot_started)
        API-->>App: 422 {code: slot_started}
        App-->>User: «Тренировка началась/прошла»
    else Токен истёк (401)
        API-->>App: 401 Unauthorized
        App-->>User: Переход на вход (UC-1)
    else Сеть/сервер/таймаут (~10 с, 5xx)
        API-->>App: Ошибка / нет ответа
        App-->>User: Снек ошибки на BS-001,<br/>повтор с тем же Idempotency-Key (NFR-27)
    end

Шаг
Что происходит
Источник
Запрос
POST /bookings с Idempotency-Key; тело — CreateBookingRequest (slot_id, rental, опц. child_age)
FR-10, FR-54; bookings/api.yaml
Проверка
Сервер атомарно проверяет лимиты мест/проката, rope_access, is_blocked, double_booking, safety_rules_accepted, состояние слота
NFR-8, NFR-9, FR-13, FR-14, FR-55, FR-56
201
Возвращается Booking со status=booked и price_total (read-only)
FR-45, R-005
409
Нет мест/проката или двойная бронь; тело несёт available_seats / available_rental_boards / booking_id
common/models.yaml
403
Гейткинг (rope_access_required) или блокировка клиента (client_blocked)
FR-55, FR-56
410
Слот отменён скалодромом (slot_cancelled)
R-008, FR-46
422
Слот уже стартовал (slot_started)
UC-3 E6
400
Не приняты правила ТБ или некорректный возраст ребёнка
FR-51, FR-54
Повтор
Сетевой сбой → повтор с тем же Idempotency-Key исключает дубль
NFR-27, R-020
Сценарий 2: Отмена брони (cancelBooking, UC-4)
Поток. SCR-006 «Детали брони» → BS-003 «Подтверждение отмены» → POST /bookings/{bookingId}/cancel. Отмена — только целиком (FR-16). Тип отмены определяет сервер по времени до старта (источник истины — slot.start_at в UTC): ≥ 6 ч → cancelled_by_client (место и прокатный комплект возвращаются в слот), < 6 ч → cancelled_late (не возвращаются, штрафов нет — BR-5). Граница «ровно 6 часов» трактуется как ранняя отмена (FR-17, R-021).
Дополнительный эффект ранней отмены. Сервер уведомляет первого клиента из Alert List этого слота (FR-61, BR-6).