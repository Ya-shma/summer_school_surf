import { useState } from 'react';

export default function FiltersModal({ filters, onSave, onClose }) {
  const [local, setLocal] = useState(filters);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 style={{marginBottom: 16}}>Фильтры</h2>

        <div style={{marginBottom: 16}}>
          <div style={{fontWeight: 600, marginBottom: 8}}>Формат</div>
          <div style={{display: 'flex', gap: 8}}>
            <button
              className={local.format === 'beginner' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setLocal({...local, format: local.format === 'beginner' ? null : 'beginner'})}
            >Новички</button>
            <button
              className={local.format === 'advanced' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setLocal({...local, format: local.format === 'advanced' ? null : 'advanced'})}
            >Опытные</button>
          </div>
        </div>

        <div style={{marginBottom: 16}}>
          <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <input
              type="checkbox"
              checked={local.only_available || false}
              onChange={e => setLocal({...local, only_available: e.target.checked})}
              style={{width: 20, height: 20}}
            />
            Только свободные
          </label>
        </div>

        <div style={{display: 'flex', gap: 8}}>
          <button className="btn-secondary" onClick={() => setLocal({})} style={{flex: 1}}>Сбросить</button>
          <button className="btn-primary" onClick={() => onSave(local)} style={{flex: 1}}>Применить</button>
        </div>
      </div>
    </div>
  );
}