## 🛠️ Стек технологий

| Слой | Технология | Версия |
|---|---|---|
| **Backend** | Python + FastAPI | Python 3.11, FastAPI 0.110 |
| **Frontend** | React + Vite | React 18, Vite 5 |
| **База данных** | SQLite + SQLAlchemy | SQLAlchemy 2.0 |
| **Контейнеризация** | Docker + Docker Compose | Docker 20.10+ |
| **HTTP-клиент** | Axios | Axios 1.6 |
| **Маршрутизация** | React Router | React Router 6 |

**Почему этот стек:**
- **FastAPI** — быстрая разработка REST API с автоматической документацией (Swagger UI)
- **React + Vite** — современный frontend с hot-reload для быстрой разработки
- **SQLite** — не требует отдельного сервера БД, идеально для учебного проекта
- **Docker** — единая среда разработки, легко развернуть на любой машине


## 🚀 Быстрый старт

### 1. Проверка окружения

```bash
# Проверить Docker
docker --version        # должно быть 20.10+
docker-compose --version  
```

### 2. Запуск проекта

# Перейти в папку проекта
cd development

# Собрать и запустить контейнеры
docker-compose up --build

# Остановка
# В терминале, где запущен docker-compose:
Ctrl+C

# Или в другом терминале:
docker-compose down