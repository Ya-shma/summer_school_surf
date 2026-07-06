import { useState } from 'react';
import { createBooking } from '../api';

export default function BookingModal({ slot, user, onSuccess, onClose }) {
  const [equipment, setEquipment] = useState('own'); // 'own' | 'rental'
  const [bookChild, setBookChild] = useState(false);
  const [childAge, setChildAge] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rentalPrice = 300; // Тариф проката (можно брать из API)
  const basePrice = slot.price || 1500;
  const totalPrice = basePrice + (equipment === 'rental' ? rentalPrice : 0);

  const handleSubmit = async () => {
    setError('');

    // Валидация возраста ребёнка
    if (bookChild) {
      const age = parseInt(childAge);
      if (!age || age < 6) {
        setError('Возраст ребёнка должен быть ≥ 6 лет');
        return;
      }
    }

    setLoading(true);
    try {
      await createBooking({
        slot_id: slot.id,
        equipment_type: equipment,
        child_age: bookChild ? parseInt(childAge) : null,
      });
      onSuccess();
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
          child_age_invalid: 'Возраст ребёнка должен быть ≥ 6 лет',
        };
        setError(messages[err.code] || 'Ошибка записи');
      } else {
        setError(err || 'Ошибка записи');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatLabel = slot.format === 'beginner' ? 'Новички (болдеринг)' : 'Опытные (трассы с верёвкой)';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16}}>
          <span style={{fontSize: 32}}>🎫</span>
          <h2 style={{margin: 0}}>Подтверждение записи</h2>
        </div>

        {/* Информация о слоте */}
        <div style={{
          background: '#F6F3EE',
          padding: 16,
          borderRadius: 12,
          marginBottom: 20
        }}>
          <div style={{fontSize: 20, fontWeight: 600, marginBottom: 4}}>
            {new Date(slot.starts_at).toLocaleString('ru-RU', {
              day: '2-digit',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
          <div style={{color: '#6B655C', fontSize: 14}}>
            {formatLabel} · 👤 {slot.instructor_name}
          </div>
          <div style={{marginTop: 8, fontSize: 14}}>
            Свободно мест: <strong>{slot.free_places} / {slot.total_places}</strong>
          </div>
          <div style={{fontSize: 14}}>
            Прокат: <strong>{slot.rental_available} комплектов</strong>
          </div>
        </div>

        {/* Выбор снаряжения */}
        <div style={{marginBottom: 20}}>
          <div style={{fontWeight: 600, marginBottom: 8, fontSize: 14}}>
            Снаряжение
          </div>
          <div style={{display: 'flex', gap: 8}}>
            <button
              type="button"
              className={equipment === 'own' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setEquipment('own')}
              style={{flex: 1}}
            >
              🧗 Свои скальники
            </button>
            <button
              type="button"
              className={equipment === 'rental' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setEquipment('rental')}
              disabled={slot.rental_available === 0}
              style={{flex: 1}}
            >
              🎒 Прокат (+{rentalPrice} ₽)
            </button>
          </div>
          {slot.rental_available === 0 && (
            <div style={{color: '#B5413A', fontSize: 13, marginTop: 8}}>
              ⚠️ Проката нет, выберите свои скальники
            </div>
          )}
          {equipment === 'rental' && slot.rental_available > 0 && (
            <div style={{color: '#3E8A5C', fontSize: 13, marginTop: 8}}>
              ✅ Прокат зарезервирован ({slot.rental_available - 1} осталось)
            </div>
          )}
        </div>

        {/* Записать ребёнка */}
        <div style={{marginBottom: 20}}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            padding: 12,
            background: bookChild ? '#F6F3EE' : 'transparent',
            borderRadius: 8,
            border: '1px solid #E5E0D8'
          }}>
            <input
              type="checkbox"
              checked={bookChild}
              onChange={e => setBookChild(e.target.checked)}
              style={{width: 20, height: 20, cursor: 'pointer'}}
            />
            <div>
              <div style={{fontWeight: 600}}>Записать ребёнка</div>
              <div style={{fontSize: 13, color: '#6B655C'}}>
                Возраст от 6 лет, только в сопровождении родителя
              </div>
            </div>
          </label>

          {bookChild && (
            <div style={{marginTop: 12, paddingLeft: 32}}>
              <label style={{display: 'block', marginBottom: 4, fontSize: 14}}>
                Возраст ребёнка (≥ 6 лет)
              </label>
              <input
                type="number"
                min="6"
                max="17"
                value={childAge}
                onChange={e => setChildAge(e.target.value)}
                placeholder="8"
                style={{width: 100}}
              />
            </div>
          )}
        </div>

        {/* Итоговая цена */}
        <div style={{
          background: '#E8F5E9',
          padding: 16,
          borderRadius: 12,
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{fontSize: 14, color: '#6B655C'}}>Итого к оплате на стойке:</div>
            <div style={{fontSize: 24, fontWeight: 600, color: '#2E7D32'}}>
              {totalPrice} ₽
            </div>
          </div>
          <div style={{textAlign: 'right', fontSize: 13, color: '#6B655C'}}>
            <div>Тренировка: {basePrice} ₽</div>
            {equipment === 'rental' && <div>Прокат: {rentalPrice} ₽</div>}
          </div>
        </div>

        {/* Ошибка */}
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

        {/* Кнопки */}
        <div style={{display: 'flex', gap: 8}}>
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
            style={{flex: 1}}
          >
            Отмена
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading || (bookChild && (!childAge || parseInt(childAge) < 6))}
            style={{flex: 1}}
          >
            {loading ? 'Запись...' : `Записаться · ${totalPrice} ₽`}
          </button>
        </div>

        <div style={{fontSize: 12, color: '#6B655C', textAlign: 'center', marginTop: 12}}>
          Оплата производится на стойке перед тренировкой
        </div>
      </div>
    </div>
  );
}