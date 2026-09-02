import { NavLink, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'לוח בקרה', icon: '📊', end: true },
  { to: '/users', label: 'ניהול משתמשות', icon: '👥' },
  { to: '/reports', label: 'דוחות והורדות', icon: '📄' },
  { to: '/recordings', label: 'ניהול הקלטות', icon: '🎙️' },
  { to: '/messages', label: 'שליחת הודעות', icon: '📞' },
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
        <div className="brand">
          <div className="icon">💜</div>
          <h1>יצלח חסד ארגענעזאציע</h1>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="spacer" />
        <div className="user-info">מחוברת כ־{user?.name}</div>
        <button className="logout-btn" onClick={logout}>התנתקות</button>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
