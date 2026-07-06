import { useState } from 'react';
import { cancelBooking } from '../api';

export default function CancelConfirmModal({ booking, onSuccess, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await cancelBooking(booking.id);
      onSuccess(res.data);
    } catch (e) {
      const err = e.response?.data?.detail;
      if (typeof err === 'object' && err.code) {
        const messages = {
          slot_started: 'Тренировка уже началась, отмена невозможна',
          already_cancelled: 'Бронь уже отменена',
          slot_cancelled: 'Тренировка отменена скалодромом',
        };
        setError(messages[err.code] || 'Ошибка отмены');
      } else {
        setError(err || 'Ошибка отмены');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16}}>
          <span style={{fontSize: 32}}>⚠️</span>
          <h2 style={{margin: 0}}>Отмена записи</h2>
        </div>

        <div style={{
          background: '#FFF8E1',
          padding: 16,
          borderRadius: 12,
          marginBottom: 20,
          borderLeft: '4px solid #D9A441'
        }}>
          <div style={{fontWeight: 600, marginBottom: 8}}>
            Отменить запись на тренировку?
          </div>
          <div style={{fontSize: 14, color: '#6B655C', lineHeight: 1.6}}>
            <div>📅 {formatDate(booking.starts_at)}</div>
            <div>🧗 {booking.format === 'beginner' ? 'Новички' : 'Опытные'} · {booking.instructor_name}</div>
            <div>🎒 {booking.equipment_type === 'rental' ? 'Прокат' : 'Свои скальники'}</div>
            {booking.child_age && <div>👶 Ребёнок, {booking.child_age} лет</div>}
          </div>
        </div>

        <div style={{
          background: '#F6F3EE',
          padding: 12,
          borderRadius: 8,
          marginBottom: 20,
          fontSize: 14,
          lineHeight: 1.5
        }}>
          <strong>Что произойдёт:</strong>
          <ul style={{marginTop: 8, paddingLeft: 20}}>
            <li>Место и прокатный комплект освободятся</li>
            <li>Бронь перейдёт в статус «Отменено вами»</li>
            <li>Первый в списке ожидания получит уведомление</li>
          </ul>
        </div>

        {error && (
          <div style={{
            background: '#FFEBEE',
            color: '#B5413A',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14
          }}>
            ❌ {error}
          </div>
        )}

        <div style={{display: 'flex', gap: 8}}>
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
            style={{flex: 1}}
          >
            Оставить запись
          </button>
          <button
            className="btn-destructive"
            onClick={handleCancel}
            disabled={loading}
            style={{flex: 1}}
          >
            {loading ? 'Отмена...' : 'Отменить запись'}
          </button>
        </div>
      </div>
    </div>
  );
}