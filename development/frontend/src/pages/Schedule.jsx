import { useEffect, useState } from 'react';
import { getSlots, joinWaitlist, getMe, updateProfile } from '../api';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import FiltersModal from '../components/FiltersModal';
import BookingModal from '../components/BookingModal';
import SafetyRulesModal from '../components/SafetyRulesModal';

export default function Schedule() {
  const [slots, setSlots] = useState([]);
  const [filters, setFilters] = useState({ format: null, only_available: false });
  const [showFilters, setShowFilters] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      navigate('/login');
      return;
    }
    
    getMe()
      .then(res => {
        console.log('[USER]', res.data);
        setUser(res.data);
      })
      .catch(err => {
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
        }
      });
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    
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
  }, [filters, user]);

  const handleBookClick = (slot) => {
    console.log('[BOOK_CLICK]', { slot, user, safetyAccepted: user?.safety_rules_accepted });
    
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
      console.log('[BOOK_CLICK] Safety rules not accepted, showing modal');
      setSelectedSlot(slot);
      setShowSafetyModal(true);
      return;
    }

    // Если ТБ принято — сразу показываем модалку записи
    console.log('[BOOK_CLICK] Safety rules accepted, showing booking modal');
    setSelectedSlot(slot);
    setShowBookingModal(true);
  };

  const handleSafetyAccepted = async () => {
    console.log('[SAFETY_ACCEPTED] Updating profile...');
    try {
      const res = await updateProfile({ safety_rules_accepted: true });
      console.log('[SAFETY_ACCEPTED] Response:', res.data);
      
      // Обновляем user state
      setUser(prev => ({ ...prev, safety_rules_accepted: true }));
      setShowSafetyModal(false);
      
      // После принятия ТБ — показываем модалку записи
      setShowBookingModal(true);
    } catch (e) {
      console.error('[SAFETY_ACCEPTED] Error:', e);
      alert('Ошибка сохранения');
    }
  };

  const handleBookingSuccess = () => {
    setShowBookingModal(false);
    setSelectedSlot(null);
    alert('✅ Запись создана!');
    navigate('/bookings');
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

  return (
    <>
      <div className="main-content">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
          <h1>Расписание</h1>
          <button className="btn-secondary" onClick={() => setShowFilters(true)}>
            ⚙️ Фильтры
          </button>
        </div>

        {(filters.format || filters.only_available) && (
          <div style={{marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center'}}>
            {filters.format && (
              <span 
                className="chip" 
                style={{cursor: 'pointer', background: '#E8F5E9', color: '#2E7D32'}}
                onClick={() => setFilters({...filters, format: null})}
              >
                {formatLabel(filters.format)} ✕
              </span>
            )}
            {filters.only_available && (
              <span 
                className="chip" 
                style={{cursor: 'pointer', background: '#FFF3E0', color: '#E65100'}}
                onClick={() => setFilters({...filters, only_available: false})}
              >
                Только свободные ✕
              </span>
            )}
          </div>
        )}

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
              <button className="btn-secondary" onClick={() => setFilters({})} style={{marginTop: 12}}>
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
                      onClick={() => handleBookClick(s)} 
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
          onSave={(f) => { setFilters(f); setShowFilters(false); }}
          onClose={() => setShowFilters(false)}
        />
      )}

      {showSafetyModal && selectedSlot && (
        <SafetyRulesModal
          onAccept={handleSafetyAccepted}
          onClose={() => { setShowSafetyModal(false); setSelectedSlot(null); }}
        />
      )}

      {showBookingModal && selectedSlot && user && (
        <BookingModal
          slot={selectedSlot}
          user={user}
          onSuccess={handleBookingSuccess}
          onClose={() => { setShowBookingModal(false); setSelectedSlot(null); }}
        />
      )}
    </>
  );
}