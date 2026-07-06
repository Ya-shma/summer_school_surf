import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRating, rateInstructor } from '../api';

export default function RateInstructor() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [stars, setStars] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRating(bookingId)
      .then(r => {
        setData(r.data);
        if (r.data.rating) setStars(r.data.rating);
      })
      .catch(() => alert('Оценка недоступна'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const submit = async () => {
    if (stars === 0) return;
    try {
      await rateInstructor({ booking_id: parseInt(bookingId), stars });
      alert('Спасибо за оценку!');
      navigate('/bookings');
    } catch (e) {
      alert(e.response?.data?.detail || 'Ошибка');
    }
  };

  if (loading) return <div className="main-content"><div className="skeleton" style={{height: 200}} /></div>;
  if (!data) return <div className="main-content"><p>Оценка недоступна</p></div>;

  return (
    <div className="main-content">
      <h1 style={{marginBottom: 16}}>Как прошла тренировка?</h1>
      <div className="card" style={{textAlign: 'center'}}>
        <div style={{fontSize: 18, fontWeight: 600}}>{data.instructor_name}</div>
        <div style={{color: '#6B655C', marginTop: 4}}>
          {new Date(data.starts_at).toLocaleString('ru-RU')}
        </div>

        <div className="star-rating" style={{marginTop: 24}}>
          {[1, 2, 3, 4, 5].map(n => (
            <span
              key={n}
              className={`star ${n <= stars ? 'active' : ''}`}
              onClick={() => setStars(n)}
              role="button"
              aria-label={`${n} звёзд`}
            >★</span>
          ))}
        </div>

        <button
          className="btn-primary"
          onClick={submit}
          disabled={stars === 0}
          style={{marginTop: 24, width: '100%'}}
        >
          {data.rating ? 'Изменить оценку' : 'Отправить оценку'}
        </button>
      </div>
    </div>
  );
}