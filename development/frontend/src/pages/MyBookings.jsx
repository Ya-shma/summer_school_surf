import { useEffect, useState } from 'react';
import { getMyBookings, cancelBooking } from '../api';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';

const statusLabels = {
  booked: { text: 'Активна', cls: 'status-booked' },
  attended: { text: 'Посещено', cls: 'status-attended' },
  cancelled_by_client: { text: 'Отменено вами', cls: 'status-cancelled' },
  cancelled_late: { text: 'Поздняя отмена', cls: 'status-late' },
  no_show: { text: 'Неявка', cls: 'status-noshow' },
  cancelled_by_gym: { text: 'Отменено скалодромом', cls: 'status-gym' },
};

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [tab, setTab] = useState('upcoming');
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);
  const load = async () => {
    const res = await getMyBookings();
    setBookings(res.data);
  };

  const cancel = async (id) => {
    if (!confirm('Отменить запись?')) return;
    try {
      const res = await cancelBooking(id);
      alert(res.data.message || 'Отменено');
      load();
    } catch (e) {
      alert(e.response?.data?.detail || 'Ошибка');
    }
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

        {gymCancelled.length > 0 && (
          <div className="card" style={{background: '#FFEBEE', borderLeft: '4px solid #B5413A'}}>
            <div style={{fontWeight: 600, color: '#B5413A'}}>⚠️ {gymCancelled.length} тренировок отменено скалодромом</div>
            {gymCancelled.map(b => (
              <div key={b.id} style={{fontSize: 14, marginTop: 4}}>
                {new Date(b.starts_at).toLocaleString('ru-RU')}: {b.cancel_reason}
                <button
                  className="btn-secondary"
                  style={{marginLeft: 8, padding: '4px 8px', fontSize: 12, minHeight: 32}}
                  onClick={() => navigate(`/?format=${b.format}`)}
                >Выбрать другое время</button>
              </div>
            ))}
          </div>
        )}

        <div style={{display: 'flex', gap: 8, marginBottom: 16}}>
          <button
            className={tab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTab('upcoming')}
            style={{flex: 1}}
          >Предстоящие ({upcoming.length})</button>
          <button
            className={tab === 'past' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTab('past')}
            style={{flex: 1}}
          >Прошедшие ({past.length})</button>
        </div>

        {shown.length === 0 && (
          <div className="empty-state">
            <p>{tab === 'upcoming' ? 'У вас пока нет записей' : 'Нет прошедших записей'}</p>
            {tab === 'upcoming' && (
              <button className="btn-secondary" onClick={() => navigate('/')} style={{marginTop: 12}}>
                Посмотреть расписание
              </button>
            )}
          </div>
        )}

        {shown.map(b => {
          const st = statusLabels[b.status] || { text: b.status, cls: '' };
          return (
            <div key={b.id} className="card">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                <div>
                  <div style={{fontSize: 18, fontWeight: 600}}>
                    {new Date(b.starts_at).toLocaleString('ru-RU', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'})}
                  </div>
                  <div style={{marginTop: 4, color: '#6B655C'}}>
                    {b.format === 'beginner' ? 'Новички' : 'Опытные'} · {b.instructor_name}
                  </div>
                  <div style={{fontSize: 13, color: '#6B655C', marginTop: 4}}>
                    🎒 {b.equipment_type === 'rental' ? 'Прокат' : 'Свои скальники'}
                    {b.child_age && ` · Ребёнок, ${b.child_age} лет`}
                  </div>
                </div>
                <span className={`badge ${st.cls}`}>{st.text}</span>
              </div>

              {b.status === 'cancelled_by_gym' && b.cancel_reason && (
                <div style={{marginTop: 8, padding: 8, background: '#FFEBEE', borderRadius: 8, fontSize: 13, color: '#B5413A'}}>
                  Причина: {b.cancel_reason}
                </div>
              )}

              <div style={{marginTop: 12, display: 'flex', gap: 8}}>
                {b.status === 'booked' && b.can_cancel && (
                  <button className="btn-destructive" onClick={() => cancel(b.id)} style={{flex: 1}}>Отменить</button>
                )}
                {b.status === 'booked' && !b.can_cancel && (
                  <>
                    <div style={{flex: 1, fontSize: 13, color: '#6B655C'}}>
                      Отмена возможна не позднее чем за 6 часов до начала
                    </div>
                    <a href="https://t.me/vertical_gym" target="_blank" rel="noreferrer" className="btn-secondary" style={{flex: 1, textAlign: 'center', textDecoration: 'none', display: 'block'}}>
                      💬 Написать Оле
                    </a>
                  </>
                )}
                {b.status === 'attended' && (
                  <button className="btn-primary" onClick={() => navigate(`/rate/${b.id}`)} style={{flex: 1}}>
                    ⭐ Оценить инструктора
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav />
    </>
  );
}