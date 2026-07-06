import axios from 'axios';

const api = axios.create({ 
  baseURL: 'http://localhost:8000/api',
  timeout: 10000,
});

// Генерация UUID с fallback для не-secure контекста (HTTP)
const generateIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback если crypto.randomUUID недоступен
    }
  }
  // Fallback генерация UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

// Добавляем токен ко всем запросам
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Обработка ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const sendCode = (phone) => api.post('/auth/send-code', { phone });
export const verifyCode = (phone, code) => api.post('/auth/verify', { phone, code });
export const getMe = () => api.get('/auth/me');
export const updateProfile = (data) => api.post('/auth/profile', data);

// Slots
export const getSlots = (params) => api.get('/slots/', { params });

// Bookings — с Idempotency-Key
export const createBooking = (data) => api.post('/bookings/', data, {
  headers: { 'Idempotency-Key': generateIdempotencyKey() }
});
export const getMyBookings = () => api.get('/bookings/');
export const cancelBooking = (id) => api.delete(`/bookings/${id}`, {
  headers: { 'Idempotency-Key': generateIdempotencyKey() }
});

// Waitlist
export const joinWaitlist = (slotId) => api.post(`/slots/${slotId}/waitlist`, {}, {
  headers: { 'Idempotency-Key': generateIdempotencyKey() }
});
export const leaveWaitlist = (slotId) => api.delete(`/slots/${slotId}/waitlist`, {
  headers: { 'Idempotency-Key': generateIdempotencyKey() }
});

// Ratings
export const getRating = (bookingId) => api.get(`/ratings/booking/${bookingId}`);
export const rateInstructor = (data) => api.post('/ratings/', data, {
  headers: { 'Idempotency-Key': generateIdempotencyKey() }
});