import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendCode, verifyCode } from '../api';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState(1);
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSend = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await sendCode(phone);
      setHint(res.data.hint);
      setStep(2);
    } catch (e) {
      setError(e.response?.data?.detail || 'Ошибка отправки кода');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await verifyCode(phone, code);
      localStorage.setItem('token', res.data.token);
      navigate('/');
    } catch (e) {
      setError(e.response?.data?.detail || 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: '40px auto' }}>
      <h1 style={{ marginBottom: 24 }}>Вход в «Вертикаль»</h1>
      
      {error && (
        <div style={{ background: '#FFEBEE', color: '#B5413A', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {step === 1 ? (
        <>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Номер телефона</label>
          <input 
            placeholder="+79991234567" 
            value={phone} 
            onChange={e => setPhone(e.target.value)}
            style={{ marginBottom: 16 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <input type="checkbox" id="consent" />
            <span style={{ fontSize: 14 }}>Согласен на обработку персональных данных</span>
          </label>
          <button 
            className="btn-primary" 
            onClick={handleSend} 
            disabled={loading || !phone || !document.getElementById('consent')?.checked}
            style={{ width: '100%' }}
          >
            {loading ? 'Отправка...' : 'Получить код'}
          </button>
        </>
      ) : (
        <>
          <div style={{ background: '#F6F3EE', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
            <strong>Код отправлен на {phone}</strong><br />
            <span style={{ color: '#6B655C' }}>{hint}</span>
          </div>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Код из SMS</label>
          <input 
            placeholder="1234" 
            value={code} 
            onChange={e => setCode(e.target.value)}
            style={{ marginBottom: 16 }}
            maxLength={4}
          />
          <button 
            className="btn-primary" 
            onClick={handleVerify} 
            disabled={loading || code.length < 4}
            style={{ width: '100%' }}
          >
            {loading ? 'Проверка...' : 'Войти'}
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => setStep(1)}
            style={{ width: '100%', marginTop: 8 }}
          >
            Изменить номер
          </button>
        </>
      )}
    </div>
  );
}