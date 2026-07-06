import { NavLink } from 'react-router-dom';
import '../styles/global.css';

export default function BottomNav() {
  return (
    <>
      {/* Desktop: top nav */}
      <div className="top-nav">
        <nav>
          <NavLink to="/" className={({isActive}) => isActive ? 'active' : ''}>📅 Расписание</NavLink>
          <NavLink to="/bookings" className={({isActive}) => isActive ? 'active' : ''}>🎫 Мои записи</NavLink>
          <NavLink to="/profile" className={({isActive}) => isActive ? 'active' : ''}>👤 Профиль</NavLink>
        </nav>
      </div>

      {/* Mobile: bottom tab bar */}
      <div className="bottom-nav">
        <NavLink to="/" className={({isActive}) => isActive ? 'active' : ''}>
          <span style={{fontSize: 24}}>📅</span>
          <span>Расписание</span>
        </NavLink>
        <NavLink to="/bookings" className={({isActive}) => isActive ? 'active' : ''}>
          <span style={{fontSize: 24}}>🎫</span>
          <span>Записи</span>
        </NavLink>
        <NavLink to="/profile" className={({isActive}) => isActive ? 'active' : ''}>
          <span style={{fontSize: 24}}>👤</span>
          <span>Профиль</span>
        </NavLink>
      </div>
    </>
  );
}