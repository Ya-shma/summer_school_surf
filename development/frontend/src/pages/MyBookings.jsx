import { useEffect, useState } from 'react';
import { getMyBookings } from '../api';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import CancelConfirmModal from '../components/CancelConfirmModal';
import BookingDetailsModal from '../components/BookingDetailsModal';

const statusLabels = {
  booked: { text: 'Активна', cls: 'status-booked', icon: '✅' },
  attended: { text: 'Посещено', cls: 'status-attended', icon: '🎉' },
  cancelled_by_client: { text: 'Отменено вами', cls: 'status-cancelled', icon: '❌' },
  cancelled_late: { text: 'Поздняя отмена', cls: 'status-late', icon: '⚠️' },
  no_show: { text: 'Неявка', cls: 'status-noshow', icon: '❌' },
  cancelled_by_gym: { text: 'Отменено скалодромом', cls: 'status-gym', icon: '🚫' },
};

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [tab, setTab] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getMyBookings();
      setBookings(res.data);
    } catch (err) {
      console.error('Ошибка загрузки броней:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSuccess = (data) => {
    setShowCancelModal(false);
    setShowDetailsModal(false);
    setSelectedBooking(null);
    
    if (data.status === 'cancelled_late') {
      alert('⚠️ ' + data.message);
    } else {
      alert('✅ Запись отменена');
    }
    load(); // Перезагружаем список
  };

  const openDetails = (booking) => {
    setSelectedBooking(booking);
    setShowDetailsModal(true);
  };

  const openCancelModal = (booking) => {
    setSelectedBooking(booking);
    setShowDetailsModal(false);
    setShowCancelModal(true);
  };

  const now = new Date();
  const upcoming = bookings.filter(b => new Date(b.starts_at) >= now);
  const past = bookings.filter(b => new Date(b.starts_at) < now);
  const shown = tab === 'upcoming' ? upcoming : past;

  const gymCancelled = bookings.filter(b => b.status === 'cancelled_by_gym');

  return (
    <>
      <div className="main-content">
        <h1 style={{marginBottom: 16}}>Мои записи</h1>

        {/* Баннер отмен скалодромом */}
        {gymCancelled.length > 0 && (
          <div className="card" style={{background: '#FFEBEE', borderLeft: '4px solid #B5413A', marginBottom: 16}}>
            <div style={{fontWeight: 600, color: '#B5413A', marginBottom: 8}}>
              🚫 {gymCancelled.length} тренировок отменено скалодромом
            </div>
            {gymCancelled.map(b => (
              <div key={b.id} style={{fontSize: 14, marginTop: 4}}>
                <div style={{marginBottom: 4}}>
                  {new Date(b.starts_at).toLocaleString('ru-RU', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}: {b.cancel_reason || 'Причина не указана'}
                </div>
                <button
                  className="btn-secondary"
                  style={{padding: '4px 12px', fontSize: 12, minHeight: 32}}
                  onClick={() => navigate(`/?format=${b.format}`)}
                >
                  Выбрать другое время
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Табы */}
        <div style={{display: 'flex', gap: 8, marginBottom: 16}}>
          <button
            className={tab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTab('upcoming')}
            style={{flex: 1}}
          >
            Предстоящие ({upcoming.length})
          </button>
          <button
            className={tab === 'past' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTab('past')}
            style={{flex: 1}}
          >
            Прошедшие ({past.length})
          </button>
        </div>

        {/* Контент */}
        {loading ? (
          <div>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{height: 100, marginBottom: 12}} />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <p>{tab === 'upcoming' ? 'У вас пока нет записей' : 'Нет прошедших записей'}</p>
            {tab === 'upcoming' && (
              <button className="btn-secondary" onClick={() => navigate('/')} style={{marginTop: 12}}>
                Посмотреть расписание
              </button>
            )}
          </div>
        ) : (
          shown.map(b => {
            const st = statusLabels[b.status] || { text: b.status, cls: '', icon: '❓' };
            
            return (
              <div 
                key={b.id} 
                className="card" 
                style={{cursor: 'pointer'}}
                onClick={() => openDetails(b)}
              >
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8}}>
                  <div style={{flex: 1}}>
                    <div style={{fontSize: 18, fontWeight: 600}}>
                      {new Date(b.starts_at).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    <div style={{marginTop: 4, color: '#6B655C', fontSize: 14}}>
                      {b.format === 'beginner' ? 'Новички' : 'Опытные'} · {b.instructor_name}
                    </div>
                    <div style={{fontSize: 13, color: '#6B655C', marginTop: 4}}>
                      🎒 {b.equipment_type === 'rental' ? 'Прокат' : 'Свои скальники'}
                      {b.child_age && ` · 👶 ${b.child_age} лет`}
                    </div>
                  </div>
                  <span className={`badge ${st.cls}`} style={{fontSize: 12}}>
                    {st.icon} {st.text}
                  </span>
                </div>

                {/* Быстрые действия */}
                <div style={{marginTop: 12, display: 'flex', gap: 8}}>
                  {b.status === 'booked' && b.can_cancel && (
                    <button
                      className="btn-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCancelModal(b);
                      }}
                      style={{flex: 1, padding: '8px 12px', minHeight: 36, fontSize: 14}}
                    >
                      Отменить
                    </button>
                  )}

                  {b.status === 'booked' && !b.can_cancel && (
                    <a
                      href="https://t.me/vertical_gym"
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                      style={{flex: 1, textAlign: 'center', textDecoration: 'none', display: 'block', padding: '8px 12px', minHeight: 36, fontSize: 14}}
                      onClick={(e) => e.stopPropagation()}
                    >
                      💬 Написать Оле
                    </a>
                  )}

                  {b.status === 'attended' && (
                    <button
                      className="btn-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/rate/${b.id}`);
                      }}
                      style={{flex: 1, padding: '8px 12px', minHeight: 36, fontSize: 14}}
                    >
                      ⭐ Оценить
                    </button>
                  )}

                  {b.status === 'cancelled_by_gym' && (
                    <button
                      className="btn-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/?format=${b.format}`);
                      }}
                      style={{flex: 1, padding: '8px 12px', minHeight: 36, fontSize: 14}}
                    >
                      Выбрать другое время
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <BottomNav />

      {/* Модалка деталей */}
      {showDetailsModal && selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          onCancel={() => openCancelModal(selectedBooking)}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedBooking(null);
          }}
        />
      )}

      {/* Модалка подтверждения отмены */}
      {showCancelModal && selectedBooking && (
        <CancelConfirmModal
          booking={selectedBooking}
          onSuccess={handleCancelSuccess}
          onClose={() => {
            setShowCancelModal(false);
            setSelectedBooking(null);
          }}
        />
      )}
    </>
  );
}