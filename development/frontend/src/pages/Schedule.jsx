import { useEffect, useState } from 'react';
import { getSlots, joinWaitlist, leaveWaitlist, createBooking } from '../api';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import FiltersModal from '../components/FiltersModal';

export default function Schedule() {
  const [slots, setSlots] = useState([]);
  const [filters, setFilters] = useState({ format: null, instructor_id: null, only_available: false });
  const [showFilters, setShowFilters] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem('token')) return navigate('/login');
    load();
    fetch('http://localhost:8000/api/auth/me', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    }).then(r => r.json()).then(setUser);
  }, []);

  const load = async () => {
    const params = {};
    if (filters.format) params.format = filters.format;
    if (filters.instructor_id) params.instructor_id = filters.instructor_id;
    if (filters.only_available) params.only_available = true;
    const res = await getSlots(params);
    setSlots(res.data);
  };

  const book = async (slot) => {
    if (slot.format === 'advanced' && !user?.is_allowed_to_rope) {
      alert('Сначала пройдите вводную тренировку для новичков');
      return;
    }
    const equipment = confirm('Нужно прокатное снаряжение?\nOK = прокат, Отмена = свои скальники')
      ? 'rental' : 'own';
    try {
      await createBooking({ slot_id: slot.id, equipment_type: equipment });
      alert('Запись создана!');
      navigate('/bookings');
    } catch (e) {
      const err = e.response?.data?.detail;
      if (typeof err === 'object' && err.code) {
        const messages = {
          slot_full: 'Места закончились',
          rental_unavailable: 'Проката нет, выберите свои скальники',
          rope_access_required: 'Сначала пройдите вводную тренировку',
          client_blocked: `Вы заблокированы до ${new Date(err.blocked_until).toLocaleDateString('ru-RU')}`,
          double_booking: 'Вы уже записаны на эту тренировку',
          slot_cancelled: 'Тренировка отменена',
          slot_started: 'Тренировка уже началась',
        };
        alert(messages[err.code] || 'Ошибка');
      } else {
        alert(err || 'Ошибка');
      }
    }
  };

  const toggleWaitlist = async (slot) => {
    try {
      await joinWaitlist(slot.id);
      alert('Вы в списке ожидания');
    } catch (e) {
      if (e.response?.status === 409) alert('Вы уже в списке');
    }
  };

  const formatLabel = (f) => f === 'beginner' ? 'Новички' : 'Опытные';

  return (
    <>
      <div className="main-content">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
          <h1>Расписание</h1>
          <button className="btn-secondary" onClick={() => setShowFilters(true)}>⚙️ Фильтры</button>
        </div>

        {Object.keys(filters).some(k => filters[k]) && (
          <div style={{marginBottom: 12}}>
            {filters.format && <span className="chip" style={{marginRight: 8}}>{formatLabel(filters.format)} ✕</span>}
            {filters.only_available && <span className="chip">Только свободные ✕</span>}
          </div>
        )}

        {slots.length === 0 && (
          <div className="empty-state">
            <p>Пока нет доступных тренировок</p>
            <button className="btn-secondary" onClick={() => setFilters({})} style={{marginTop: 12}}>Сбросить фильтры</button>
          </div>
        )}

        {slots.map(s => {
          const isFull = s.free_places === 0;
          const isCancelled = s.status === 'cancelled';
          return (
            <div key={s.id} className="card" style={{opacity: isCancelled ? 0.6 : 1}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                <div>
                  <div style={{fontSize: 24, fontWeight: 600}}>
                    {new Date(s.starts_at).toLocaleString('ru-RU', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'})}
                  </div>
                  <span className={`chip chip-${s.format}`} style={{marginTop: 4}}>{formatLabel(s.format)}</span>
                  <div style={{marginTop: 8, color: '#6B655C', fontSize: 14}}>👤 {s.instructor_name}</div>
                </div>
                <div style={{textAlign: 'right'}}>
                  <div style={{fontWeight: 600}}>{s.free_places} / {s.total_places}</div>
                  <div style={{fontSize: 13, color: '#6B655C'}}>Прокат: {s.rental_available}</div>
                  <div style={{fontWeight: 600, marginTop: 4}}>{s.price} ₽</div>
                </div>
              </div>

              <div style={{marginTop: 12}}>
                {isCancelled ? (
                  <div style={{color: '#B5413A', fontSize: 14}}>⚠️ Отменено: {s.cancel_reason}</div>
                ) : isFull ? (
                  <button className="btn-secondary" onClick={() => toggleWaitlist(s)} style={{width: '100%'}}>
                    🔔 Уведомить, если появится место
                  </button>
                ) : (
                  <button className="btn-primary" onClick={() => book(s)} style={{width: '100%'}}>
                    Записаться · {s.price} ₽
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />

      {showFilters && (
        <FiltersModal
          filters={filters}
          onSave={(f) => { setFilters(f); setShowFilters(false); load(); }}
          onClose={() => setShowFilters(false)}
        />
      )}
    </>
  );
}