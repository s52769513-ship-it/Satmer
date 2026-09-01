import { useEffect, useState } from 'react';
import api from '../services/api';

const HISTORY_ICONS = { activity: '✅', completion: '⭐' };

function DetailsTab({ user, onSaved }) {
  const [form, setForm] = useState({ name: user.name, idNumber: user.idNumber, phone: user.phone || '', email: user.email || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await api.put(`/admin/users/${user.id}`, form);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בשמירת הפרטים');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save}>
      <div className="field">
        <label>שם מלא</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div className="field">
        <label>תעודת זהות</label>
        <input value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} maxLength={9} required />
      </div>
      <div className="field">
        <label>טלפון</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="050-0000000" />
      </div>
      <div className="field">
        <label>אימייל</label>
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      {user.notificationDay && (
        <p className="muted">
          תזכורת שבועית: יום {user.notificationDay} בשעה {user.notificationHour}:00 (נבחר על ידי התלמידה בטלפון)
        </p>
      )}
      <button className="btn-primary" disabled={saving}>{saving ? 'שומרת...' : 'שמירת שינויים'}</button>
      {error && <p className="error-text">{error}</p>}
      {saved && <p className="success-text">✓ נשמר בהצלחה</p>}
    </form>
  );
}

function HistoryTab({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/admin/users/${userId}/history`)
      .then((res) => setData(res.data))
      .catch(() => setError('שגיאה בטעינת ההיסטוריה'))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <p className="muted"><span className="spinner" />טוענת...</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!data.history.length) return <div className="empty-state">אין עדיין עדכונים מהתלמידה</div>;

  return (
    <div>
      <div className="summary-strip">
        <span>סה"כ נקודות: <strong>{data.totalPoints}</strong></span>
        <span>סה"כ עדכונים: <strong>{data.history.length}</strong></span>
      </div>
      <div>
        {data.history.map((item) => (
          <div className="history-item" key={`${item.kind}-${item.id}`}>
            <span>
              <span className="icon">{HISTORY_ICONS[item.kind]}</span>
              {item.kind === 'activity'
                ? (item.parasha ? `פעילות חסד - ${item.parasha}` : 'פעילות חסד')
                : `השלמה מס' ${item.completionNumber}`}
              {' · '}
              <span className="muted">{item.hebrewDate}</span>
            </span>
            <span className="points">+{item.points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UserModal({ userId, onClose, onChanged }) {
  const [tab, setTab] = useState('details');
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    api.get(`/admin/users/${userId}`)
      .then((res) => setUser(res.data))
      .catch(() => setError('שגיאה בטעינת פרטי התלמידה'));
  };

  useEffect(load, [userId]);

  const toggleActive = async () => {
    const action = user.isActive ? 'deactivate' : 'activate';
    await api.put(`/admin/users/${userId}/${action}`);
    load();
    onChanged();
  };

  const handleDelete = async () => {
    if (!confirm(`למחוק לצמיתות את ${user.name}? פעולה זו אינה הפיכה ותמחק גם את כל היסטוריית העדכונים שלה.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${userId}`);
      onChanged();
      onClose();
    } catch {
      setError('שגיאה במחיקת התלמידה');
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{user ? user.name : 'טוענת...'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {user && (
          <>
            <div className="modal-tabs">
              <button className={tab === 'details' ? 'active' : ''} onClick={() => setTab('details')}>פרטים</button>
              <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>עדכונים</button>
            </div>
            <div className="modal-body">
              {tab === 'details'
                ? <DetailsTab user={user} onSaved={() => { load(); onChanged(); }} />
                : <HistoryTab userId={userId} />}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={toggleActive}>
                {user.isActive ? 'השבתת תלמידה' : 'הפעלת תלמידה'}
              </button>
              <button className="btn-secondary btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'מוחקת...' : 'מחיקת תלמידה'}
              </button>
            </div>
          </>
        )}
        {error && <p className="error-text" style={{ padding: '0 24px 16px' }}>{error}</p>}
      </div>
    </div>
  );
}
