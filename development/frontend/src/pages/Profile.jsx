import { useEffect, useState } from 'react';
import { getMe, updateProfile } from '../api';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [pushWarning, setPushWarning] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getMe().then(r => {
      setUser(r.data);
      setName(r.data.name);
    });

    // FR-60: предупреждение о push
    if ('Notification' in window && Notification.permission === 'denied') {
      const shown = localStorage.getItem('push_warning_shown');
      if (!shown) {
        setPushWarning(true);
        localStorage.setItem('push_warning_shown', '1');
      }
    }
  }, []);

  const save = async () => {
    await updateProfile({ name });
    alert('Данные обновлены');
  };

  const logout = () => {
    if (!confirm('Выйти из аккаунта?')) return;
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (!user) return <div className="main-content"><div className="skeleton" style={{height: 200}} /></div>;

  const phoneMasked = user.phone.replace(/(\d{1})(\d{3})(\d{3})(\d{2})(\d{2})/, '+$1 *** *** ** $5');

  return (
    <>
      <div className="main-content">
        <h1 style={{marginBottom: 16}}>Профиль</h1>

        {pushWarning && (
          <div className="card" style={{background: '#FFF8E1', borderLeft: '4px solid #D9A441'}}>
            <div style={{fontWeight: 600}}>🔔 Уведомления отключены</div>
            <div style={{fontSize: 14, marginTop: 4}}>
              Вы не будете получать напоминания. Включите уведомления в настройках браузера.
            </div>
            <button className="btn-secondary" style={{marginTop: 8}} onClick={() => setPushWarning(false)}>
              Понятно
            </button>
          </div>
        )}

        <div className="card">
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <div style={{fontSize: 18, fontWeight: 600}}>{user.name || 'Без имени'}</div>
            {user.is_permanent && <span className="badge badge-permanent">⭐ Постоянный клиент</span>}
          </div>
          <div style={{color: '#6B655C', marginTop: 4}}>{phoneMasked}</div>
          {user.age && <div style={{color: '#6B655C', fontSize: 14}}>Возраст: {user.age}</div>}
          {user.birthday && <div style={{color: '#6B655C', fontSize: 14}}>День рождения: {user.birthday}</div>}
        </div>

        <div className="card">
          <div style={{fontWeight: 600, marginBottom: 8}}>Статистика</div>
          <div>Пройдено тренировок: <b>{user.attended_count}</b></div>
          {!user.is_permanent && (
            <>
              <div className="progress">
                <div className="progress-fill" style={{width: `${Math.min(100, user.attended_count * 10)}%`}} />
              </div>
              <div style={{fontSize: 13, color: '#6B655C'}}>
                До постоянного клиента: {10 - user.attended_count} тренировок
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div style={{fontWeight: 600, marginBottom: 8}}>Связь</div>
          <a href="https://t.me/vertical_gym" target="_blank" rel="noreferrer" style={{color: '#C65D3A', textDecoration: 'none'}}>
            💬 Написать Оле
          </a>
        </div>

        <div className="card">
          <label style={{display: 'block', marginBottom: 8}}>Имя</label>
          <input value={name} onChange={e => setName(e.target.value)} />
          <button className="btn-primary" onClick={save} style={{marginTop: 12, width: '100%'}}>Сохранить</button>
        </div>

        <button className="btn-destructive" onClick={logout} style={{width: '100%', marginTop: 12}}>Выйти</button>
      </div>

      <BottomNav />
    </>
  );
}