import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendCode, verifyCode } from '../api';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState(1);
  const [hint, setHint] = useState('');
  const navigate = useNavigate();

  const handleSend = async () => {
    const res = await sendCode(phone);
    setHint(res.data.hint);
    setStep(2);
  };

  const handleVerify = async () => {
    const res = await verifyCode(phone, code);
    localStorage.setItem('token', res.data.token);
    navigate('/');
  };

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: '0 auto' }}>
      <h1>Вход в «Вертикаль»</h1>
      {step === 1 ? (
        <>
          <input placeholder="+7..." value={phone} onChange={e => setPhone(e.target.value)} />
          <button onClick={handleSend}>Получить код</button>
        </>
      ) : (
        <>
          <p style={{ color: '#888' }}>{hint}</p>
          <input placeholder="Код" value={code} onChange={e => setCode(e.target.value)} />
          <button onClick={handleVerify}>Войти</button>
        </>
      )}
    </div>
  );
}