import { useEffect, useState } from 'react';
import { getSlots, joinWaitlist, createBooking, getMe } from '../api';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import FiltersModal from '../components/FiltersModal';

export default function Schedule() {
  const [slots, setSlots] = useState([]);
  const [filters, setFilters] = useState({ format: null, only_available: false });
  const [showFilters, setShowFilters] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Загрузка профиля при монтировании
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login');
      return;
    }
    
    getMe()
      .then(res => setUser(res.data))
      .catch(err => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
        }
      });
  }, [navigate]);

  // 🔑 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: перезагрузка слотов при ЛЮБОМ изменении filters
  useEffect(() => {
    const loadSlots = async () => {
      setLoading(true);
      try {
        const params = {};
        if (filters.format) params.format = filters.format;
        if (filters.only_available) params.only_available = true;
        
        const res = await getSlots(params);
        setSlots(res.data);
      } catch (err) {
        console.error('Ошибка загрузки слотов:', err);
        setSlots([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadSlots();
  }, [filters]); // ← Зависимость от filters — главный фикс

  const book = async (slot) => {
    // Проверка гейткинга
    if (slot.format === 'advanced' && !user?.is_allowed_to_rope) {
      alert('Сначала пройдите вводную тренировку для новичков');
      return;
    }

    // Проверка блокировки
    if (user?.blocked_until && new Date(user.blocked_until) > new Date()) {
      alert(`Вы заблокированы до ${new Date(user.blocked_until).toLocaleDateString('ru-RU')}`);
      return;
    }

    // Проверка согласия с ТБ
    if (!user?.safety_rules_accepted) {
      const accept = confirm('Необходимо принять правила техники безопасности.\nПринять сейчас?');
      if (accept) {
        try {
          await fetch('http://localhost:8000/api/auth/profile', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ safety_rules_accepted: true })
          });
          setUser({ ...user, safety_rules_accepted: true });
        } catch (e) {
          alert('Ошибка сохранения');
          return;
        }
      } else {
        return;
      }
    }

    // Выбор снаряжения
    const useRental = confirm('Нужно прокатное снаряжение?\n\nOK = прокат\nОтмена = свои скальники');
    const equipment = useRental ? 'rental' : 'own';

    try {
      await createBooking({ 
        slot_id: slot.id, 
        equipment_type: equipment 
      });
      alert('✅ Запись создана!');
      navigate('/bookings');
    } catch (e) {
      const err = e.response?.data?.detail;
      if (typeof err === 'object' && err.code) {
        const messages = {
          slot_full: 'Места закончились',
          rental_unavailable: 'Проката нет, выберите свои скальники',
          rope_access_required: 'Сначала пройдите вводную тренировку для новичков',
          client_blocked: `Вы заблокированы до ${new Date(err.blocked_until).toLocaleDateString('ru-RU')}`,
          double_booking: 'Вы уже записаны на эту тренировку',
          slot_cancelled: 'Тренировка отменена',
          slot_started: 'Тренировка уже началась',
          safety_rules_not_accepted: 'Необходимо принять правила техники безопасности',
        };
        alert(messages[err.code] || 'Ошибка записи');
      } else {
        alert(err || 'Ошибка записи');
      }
    }
  };

  const toggleWaitlist = async (slot) => {
    try {
      await joinWaitlist(slot.id);
      alert('✅ Вы в списке ожидания');
    } catch (e) {
      if (e.response?.status === 409) {
        alert('Вы уже в списке ожидания');
      } else {
        alert('Ошибка добавления в список ожидания');
      }
    }
  };

  const formatLabel = (f) => f === 'beginner' ? 'Новички' : 'Опытные';

  // 🔑 Функции изменения фильтров — просто меняют state,
  // useEffect сам перезагрузит данные
  const removeFormatFilter = () => {
    setFilters(prev => ({ ...prev, format: null }));
  };

  const removeAvailableFilter = () => {
    setFilters(prev => ({ ...prev, only_available: false }));
  };

  const resetAllFilters = () => {
    setFilters({ format: null, only_available: false });
  };

  const applyFilters = (newFilters) => {
    setFilters(newFilters);
    setShowFilters(false);
  };

  return (
    <>
      <div className="main-content">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
          <h1>Расписание</h1>
          <button className="btn-secondary" onClick={() => setShowFilters(true)}>
            ⚙️ Фильтры
          </button>
        </div>

        {/* Активные фильтры — чипы */}
        {(filters.format || filters.only_available) && (
          <div style={{marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center'}}>
            {filters.format && (
              <span 
                className="chip" 
                style={{cursor: 'pointer', background: '#E8F5E9', color: '#2E7D32'}}
                onClick={removeFormatFilter}
                title="Убрать фильтр"
              >
                {formatLabel(filters.format)} ✕
              </span>
            )}
            {filters.only_available && (
              <span 
                className="chip" 
                style={{cursor: 'pointer', background: '#FFF3E0', color: '#E65100'}}
                onClick={removeAvailableFilter}
                title="Убрать фильтр"
              >
                Только свободные ✕
              </span>
            )}
            <button 
              className="btn-secondary" 
              onClick={resetAllFilters}
              style={{padding: '4px 12px', minHeight: '32px', fontSize: '13px'}}
            >
              Сбросить все
            </button>
          </div>
        )}

        {/* Контент */}
        {loading ? (
          <div>
            {[1,2,3].map(i => (
              <div key={i} className="skeleton" style={{height: 120, marginBottom: 12}} />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <div className="empty-state">
            <p>Пока нет доступных тренировок</p>
            {(filters.format || filters.only_available) && (
              <button className="btn-secondary" onClick={resetAllFilters} style={{marginTop: 12}}>
                Сбросить фильтры
              </button>
            )}
          </div>
        ) : (
          slots.map(s => {
            const isFull = s.free_places === 0;
            const isCancelled = s.status === 'cancelled';
            
            return (
              <div key={s.id} className="card" style={{opacity: isCancelled ? 0.6 : 1}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                  <div style={{flex: 1}}>
                    <div style={{fontSize: 24, fontWeight: 600}}>
                      {new Date(s.starts_at).toLocaleString('ru-RU', {
                        day: '2-digit', 
                        month: 'short', 
                        hour: '2-digit', 
                        minute: '2-digit'
                      })}
                    </div>
                    <span className={`chip chip-${s.format}`} style={{marginTop: 4, display: 'inline-block'}}>
                      {formatLabel(s.format)}
                    </span>
                    <div style={{marginTop: 8, color: '#6B655C', fontSize: 14}}>
                      👤 {s.instructor_name}
                    </div>
                  </div>
                  <div style={{textAlign: 'right'}}>
                    <div style={{fontWeight: 600}}>{s.free_places} / {s.total_places}</div>
                    <div style={{fontSize: 13, color: '#6B655C'}}>
                      Прокат: {s.rental_available}
                    </div>
                    <div style={{fontWeight: 600, marginTop: 4}}>
                      {s.price} ₽
                    </div>
                  </div>
                </div>

                <div style={{marginTop: 12}}>
                  {isCancelled ? (
                    <div style={{color: '#B5413A', fontSize: 14}}>
                      ⚠️ Отменено: {s.cancel_reason || 'Причина не указана'}
                    </div>
                  ) : isFull ? (
                    <button 
                      className="btn-secondary" 
                      onClick={() => toggleWaitlist(s)} 
                      style={{width: '100%'}}
                    >
                      🔔 Уведомить, если появится место
                    </button>
                  ) : (
                    <button 
                      className="btn-primary" 
                      onClick={() => book(s)} 
                      style={{width: '100%'}}
                    >
                      Записаться · {s.price} ₽
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <BottomNav />

      {showFilters && (
        <FiltersModal
          filters={filters}
          onSave={applyFilters}
          onClose={() => setShowFilters(false)}
        />
      )}
    </>
  );
}