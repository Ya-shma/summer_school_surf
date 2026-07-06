import { useState, useEffect } from 'react';

export default function FiltersModal({ filters, onSave, onClose }) {
  // Локальное состояние — копия фильтров для редактирования
  const [local, setLocal] = useState({
    format: filters.format || null,
    only_available: filters.only_available || false,
  });

  // Синхронизация при изменении props
  useEffect(() => {
    setLocal({
      format: filters.format || null,
      only_available: filters.only_available || false,
    });
  }, [filters]);

  // Переключение формата (только один формат за раз для MVP)
  const toggleFormat = (fmt) => {
    setLocal(prev => ({
      ...prev,
      format: prev.format === fmt ? null : fmt,
    }));
  };

  // Переключение "только свободные"
  const toggleAvailable = () => {
    setLocal(prev => ({
      ...prev,
      only_available: !prev.only_available,
    }));
  };

  // Сброс локальных фильтров
  const resetLocal = () => {
    setLocal({ format: null, only_available: false });
  };

  // Проверка, есть ли активные фильтры
  const hasActiveFilters = local.format || local.only_available;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 style={{marginBottom: 20}}>Фильтры</h2>

        {/* Формат */}
        <div style={{marginBottom: 20}}>
          <div style={{fontWeight: 600, marginBottom: 8, fontSize: 14, color: '#6B655C'}}>
            Формат тренировки
          </div>
          <div style={{display: 'flex', gap: 8}}>
            <button
              type="button"
              className={local.format === 'beginner' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => toggleFormat('beginner')}
              style={{flex: 1}}
            >
              🌱 Новички
            </button>
            <button
              type="button"
              className={local.format === 'advanced' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => toggleFormat('advanced')}
              style={{flex: 1}}
            >
              🧗 Опытные
            </button>
          </div>
          {local.format && (
            <div style={{fontSize: 13, color: '#6B655C', marginTop: 8}}>
              Выбрано: {local.format === 'beginner' ? 'Новички (болдеринг)' : 'Опытные (трассы с верёвкой)'}
            </div>
          )}
        </div>

        {/* Только свободные */}
        <div style={{marginBottom: 24}}>
          <label 
            style={{
              display: 'flex', 
              alignItems: 'center', 
              gap: 12, 
              cursor: 'pointer',
              padding: 12,
              background: local.only_available ? '#F6F3EE' : 'transparent',
              borderRadius: 8,
              border: '1px solid #E5E0D8'
            }}
          >
            <input
              type="checkbox"
              checked={local.only_available}
              onChange={toggleAvailable}
              style={{width: 20, height: 20, cursor: 'pointer'}}
            />
            <div>
              <div style={{fontWeight: 600}}>Только свободные</div>
              <div style={{fontSize: 13, color: '#6B655C'}}>
                Скрыть заполненные и отменённые слоты
              </div>
            </div>
          </label>
        </div>

        {/* Кнопки действий */}
        <div style={{display: 'flex', gap: 8}}>
          <button 
            className="btn-secondary" 
            onClick={resetLocal}
            disabled={!hasActiveFilters}
            style={{flex: 1}}
          >
            Сбросить
          </button>
          <button 
            className="btn-primary" 
            onClick={() => onSave(local)}
            style={{flex: 1}}
          >
            Применить
          </button>
        </div>

        <button 
          className="btn-secondary" 
          onClick={onClose}
          style={{width: '100%', marginTop: 8, background: 'transparent'}}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}