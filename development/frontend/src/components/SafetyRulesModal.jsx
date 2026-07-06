import { useState } from 'react';

export default function SafetyRulesModal({ onAccept, onClose }) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16}}>
          <span style={{fontSize: 32}}>📋</span>
          <h2 style={{margin: 0}}>Правила скалодрома и ТБ</h2>
        </div>

        <div style={{
          background: '#F6F3EE',
          padding: 16,
          borderRadius: 12,
          marginBottom: 20,
          lineHeight: 1.6,
          fontSize: 14,
          maxHeight: '40vh',
          overflowY: 'auto'
        }}>
          <p style={{marginBottom: 12}}>
            <strong>Перед первой записью необходимо ознакомиться с правилами скалодрома и техникой безопасности.</strong>
          </p>
          
          <h3 style={{fontSize: 16, marginBottom: 8, marginTop: 16}}>Основные правила:</h3>
          <ul style={{paddingLeft: 20, marginBottom: 16}}>
            <li style={{marginBottom: 8}}>Следуйте инструкциям инструктора на тренировке</li>
            <li style={{marginBottom: 8}}>Используйте только исправное снаряжение</li>
            <li style={{marginBottom: 8}}>Не допускайте опасного поведения на трассах</li>
            <li style={{marginBottom: 8}}>Сообщайте инструктору о проблемах со здоровьем</li>
            <li style={{marginBottom: 8}}>Уважайте других участников тренировки</li>
          </ul>

          <h3 style={{fontSize: 16, marginBottom: 8}}>Техника безопасности:</h3>
          <ul style={{paddingLeft: 20, marginBottom: 16}}>
            <li style={{marginBottom: 8}}>Используйте страховочную систему при работе с верёвкой</li>
            <li style={{marginBottom: 8}}>Не лазьте без разминки</li>
            <li style={{marginBottom: 8}}>Соблюдайте дистанцию на трассах</li>
            <li style={{marginBottom: 8}}>При усталости — прекратите лазание</li>
          </ul>

          <h3 style={{fontSize: 16, marginBottom: 8}}>Политика отмен:</h3>
          <ul style={{paddingLeft: 20}}>
            <li style={{marginBottom: 8}}>Бесплатная отмена — не позднее чем за 6 часов до начала</li>
            <li style={{marginBottom: 8}}>Поздняя отмена или неявка — нарушение</li>
            <li style={{marginBottom: 8}}>3 нарушения подряд — блокировка записи на неделю</li>
          </ul>
        </div>

        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 20,
          cursor: 'pointer',
          padding: 12,
          background: accepted ? '#E8F5E9' : 'transparent',
          borderRadius: 8,
          border: `2px solid ${accepted ? '#3E8A5C' : '#E5E0D8'}`,
          transition: 'all 0.2s'
        }}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={e => setAccepted(e.target.checked)}
            style={{width: 20, height: 20, marginTop: 2, cursor: 'pointer', flexShrink: 0}}
          />
          <span style={{fontSize: 14, lineHeight: 1.5}}>
            <strong>Ознакомлен с правилами скалодрома и техникой безопасности</strong>
            <div style={{color: '#6B655C', fontSize: 13, marginTop: 4}}>
              Подтверждаю, что прочитал и принимаю правила. Флаг сохранится в профиле и не будет запрашиваться повторно.
            </div>
          </span>
        </label>

        <div style={{display: 'flex', gap: 8}}>
          <button
            className="btn-secondary"
            onClick={onClose}
            style={{flex: 1}}
          >
            Отмена
          </button>
          <button
            className="btn-primary"
            onClick={() => accepted && onAccept()}
            disabled={!accepted}
            style={{flex: 1}}
          >
            Принять и продолжить
          </button>
        </div>
      </div>
    </div>
  );
}