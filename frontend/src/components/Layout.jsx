import { NavLink, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'לוח בקרה', end: true },
  { to: '/users', label: 'ניהול משתמשות' },
  { to: '/reports', label: 'דוחות והורדות' },
  { to: '/recordings', label: 'ניהול הקלטות' },
  { to: '/messages', label: 'שליחת הודעות' },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>מערכת פעילות חסד</h1>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="muted" style={{ color: 'rgba(255,255,255,0.6)', marginTop: 24, fontSize: 12 }}>
          {user?.name}
        </div>
        <button className="logout-btn" onClick={logout}>התנתקות</button>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
