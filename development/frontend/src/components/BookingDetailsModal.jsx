import { useNavigate } from 'react-router-dom';

export default function BookingDetailsModal({ booking, onCancel, onClose }) {
  const navigate = useNavigate();

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusLabels = {
    booked: { text: 'Активна', cls: 'status-booked', icon: '✅' },
    attended: { text: 'Посещено', cls: 'status-attended', icon: '🎉' },
    cancelled_by_client: { text: 'Отменено вами', cls: 'status-cancelled', icon: '❌' },
    cancelled_late: { text: 'Поздняя отмена', cls: 'status-late', icon: '⚠️' },
    no_show: { text: 'Неявка', cls: 'status-noshow', icon: '❌' },
    cancelled_by_gym: { text: 'Отменено скалодромом', cls: 'status-gym', icon: '🚫' },
  };

  const st = statusLabels[booking.status] || { text: booking.status, cls: '', icon: '❓' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
          <h2 style={{margin: 0}}>Детали записи</h2>
          <span className={`badge ${st.cls}`} style={{fontSize: 14, padding: '6px 12px'}}>
            {st.icon} {st.text}
          </span>
        </div>

        {/* Основная информация */}
        <div style={{
          background: '#F6F3EE',
          padding: 16,
          borderRadius: 12,
          marginBottom: 16
        }}>
          <div style={{fontSize: 20, fontWeight: 600, marginBottom: 8}}>
            📅 {formatDate(booking.starts_at)}
          </div>
          <div style={{color: '#6B655C', fontSize: 14}}>
            <div style={{marginBottom: 4}}>
              🧗 {booking.format === 'beginner' ? 'Новички (болдеринг)' : 'Опытные (трассы с верёвкой)'}
            </div>
            <div>👤 Инструктор: {booking.instructor_name}</div>
          </div>
        </div>

        {/* Снаряжение */}
        <div style={{
          background: 'white',
          padding: 16,
          borderRadius: 12,
          marginBottom: 16,
          border: '1px solid #E5E0D8'
        }}>
          <div style={{fontWeight: 600, marginBottom: 8}}>Снаряжение</div>
          <div style={{fontSize: 14}}>
            🎒 {booking.equipment_type === 'rental' ? 'Прокатное (скальники + страховка)' : 'Свои скальники'}
          </div>
          {booking.child_age && (
            <div style={{fontSize: 14, marginTop: 8}}>
              👶 Ребёнок, {booking.child_age} лет
            </div>
          )}
        </div>

        {/* Причина отмены скалодромом */}
        {booking.status === 'cancelled_by_gym' && booking.cancel_reason && (
          <div style={{
            background: '#FFEBEE',
            padding: 16,
            borderRadius: 12,
            marginBottom: 16,
            borderLeft: '4px solid #B5413A'
          }}>
            <div style={{fontWeight: 600, color: '#B5413A', marginBottom: 8}}>
              Причина отмены
            </div>
            <div style={{fontSize: 14}}>{booking.cancel_reason}</div>
          </div>
        )}

        {/* Действия */}
        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
          {booking.status === 'booked' && booking.can_cancel && (
            <button
              className="btn-destructive"
              onClick={onCancel}
              style={{width: '100%'}}
            >
              Отменить запись
            </button>
          )}

          {booking.status === 'booked' && !booking.can_cancel && (
            <>
              <div style={{
                background: '#FFF8E1',
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
                color: '#F57F17'
              }}>
                ⚠️ Отмена возможна не позднее чем за 6 часов до начала тренировки
              </div>
              <a
                href="https://t.me/vertical_gym"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
                style={{width: '100%', textAlign: 'center', textDecoration: 'none', display: 'block'}}
              >
                💬 Написать Оле
              </a>
            </>
          )}

          {booking.status === 'cancelled_by_gym' && (
            <button
              className="btn-primary"
              onClick={() => {
                onClose();
                navigate(`/?format=${booking.format}`);
              }}
              style={{width: '100%'}}
            >
              Выбрать другое время
            </button>
          )}

          {booking.status === 'attended' && (
            <button
              className="btn-primary"
              onClick={() => {
                onClose();
                navigate(`/rate/${booking.id}`);
              }}
              style={{width: '100%'}}
            >
              ⭐ Оценить инструктора
            </button>
          )}

          <button
            className="btn-secondary"
            onClick={onClose}
            style={{width: '100%'}}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}