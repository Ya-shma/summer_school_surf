import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Schedule from './pages/Schedule';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import RateInstructor from './pages/RateInstructor';
import './styles/global.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Schedule />} />
        <Route path="/bookings" element={<MyBookings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/rate/:bookingId" element={<RateInstructor />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;