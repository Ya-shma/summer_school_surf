import { useEffect, useState } from 'react';
import { getMe, updateProfile } from '../api';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    getMe()
      .then(r => {
        setUser(r.data);
        setName(r.data.name || '');
      })
      .catch(e => {
        setError('Не удалось загрузить профиль');
        if (e.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
        }
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const save = async () => {
    try {
      await updateProfile({ name });
      alert('Данные обновлены');
      const res = await getMe();
      setUser(res.data);
    } catch (e) {
      alert('Ошибка сохранения');
    }
  };

  const logout = () => {
    if (!confirm('Выйти из аккаунта?')) return;
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="main-content">
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="main-content">
        <div style={{ background: '#FFEBEE', color: '#B5413A', padding: 16, borderRadius: 8 }}>
          {error}
        </div>
      </div>
    );
  }

  if (!user) return null;

  const phoneMasked = user.phone?.replace(/(\d{1})(\d{3})(\d{3})(\d{2})(\d{2})/, '+$1 *** *** ** $5') || '';

  return (
    <>
      <div className="main-content">
        <h1 style={{ marginBottom: 16 }}>Профиль</h1>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{user.name || 'Без имени'}</div>
            {user.is_permanent && <span className="badge badge-permanent">⭐ Постоянный клиент</span>}
          </div>
          <div style={{ color: '#6B655C', marginBottom: 4 }}>{phoneMasked}</div>
          {user.age && <div style={{ color: '#6B655C', fontSize: 14 }}>Возраст: {user.age}</div>}
          {user.birthday && <div style={{ color: '#6B655C', fontSize: 14 }}>День рождения: {user.birthday}</div>}
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Статистика</div>
          <div>Пройдено тренировок: <b>{user.attended_count || 0}</b></div>
          {!user.is_permanent && (
            <>
              <div className="progress">
                <div className="progress-fill" style={{ width: `${Math.min(100, (user.attended_count || 0) * 10)}%` }} />
              </div>
              <div style={{ fontSize: 13, color: '#6B655C' }}>
                До постоянного клиента: {10 - (user.attended_count || 0)} тренировок
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Связь</div>
          <a href="https://t.me/vertical_gym" target="_blank" rel="noreferrer" style={{ color: '#C65D3A', textDecoration: 'none' }}>
            💬 Написать Оле
          </a>
        </div>

        <div className="card">
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Имя</label>
          <input 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="Введите имя"
          />
          <button 
            className="btn-primary" 
            onClick={save} 
            style={{ marginTop: 12, width: '100%' }}
            disabled={!name.trim()}
          >
            Сохранить
          </button>
        </div>

        <button 
          className="btn-destructive" 
          onClick={logout} 
          style={{ width: '100%', marginTop: 12 }}
        >
          Выйти
        </button>
      </div>

      <BottomNav />
    </>
  );
}