import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:8000/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Генерация Idempotency-Key (NFR-27)
const idempotencyKey = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

export const sendCode = (phone) => api.post('/auth/send-code', { phone });
export const verifyCode = (phone, code) => api.post('/auth/verify', { phone, code });
export const getMe = () => api.get('/auth/me');
export const updateProfile = (data) => api.post('/auth/profile', data);
export const acceptSafetyRules = () => api.post('/auth/profile', { safety_rules_accepted: true });

export const getSlots = (params) => api.get('/slots/', { params });
export const getSlot = (id) => api.get(`/slots/${id}`);

export const createBooking = (data) => api.post('/bookings/', data, {
  headers: { 'Idempotency-Key': idempotencyKey() }
});
export const getMyBookings = () => api.get('/bookings/');
export const cancelBooking = (id) => api.delete(`/bookings/${id}`, {
  headers: { 'Idempotency-Key': idempotencyKey() }
});

export const joinWaitlist = (slotId) => api.post(`/slots/${slotId}/waitlist`, {}, {
  headers: { 'Idempotency-Key': idempotencyKey() }
});
export const leaveWaitlist = (slotId) => api.delete(`/slots/${slotId}/waitlist`, {
  headers: { 'Idempotency-Key': idempotencyKey() }
});

export const getRating = (bookingId) => api.get(`/ratings/booking/${bookingId}`);
export const rateInstructor = (data) => api.post('/ratings/', data, {
  headers: { 'Idempotency-Key': idempotencyKey() }
});