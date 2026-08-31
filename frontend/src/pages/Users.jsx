import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';

const DAY_LABELS = {
  sunday: 'ראשון', monday: 'שני', tuesday: 'שלישי', wednesday: 'רביעי',
  thursday: 'חמישי', friday: 'שישי', saturday: 'שבת',
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [newUser, setNewUser] = useState({ name: '', idNumber: '' });
  const [addError, setAddError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const loadUsers = () => {
    setLoading(true);
    api.get('/admin/users').then((res) => setUsers(res.data)).catch(() => setError('שגיאה בטעינת רשימת המשתמשות')).finally(() => setLoading(false));
  };

  useEffect(loadUsers, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      if (search && !u.name.includes(search) && !u.idNumber.includes(search)) return false;
      return true;
    });
  }, [users, search, statusFilter]);

  const addUser = async (e) => {
    e.preventDefault();
    setAddError('');
    try {
      await api.post('/admin/users', newUser);
      setNewUser({ name: '', idNumber: '' });
      loadUsers();
    } catch (err) {
      setAddError(err.response?.data?.error || 'שגיאה בהוספת משתמשת');
    }
  };

  const toggleActive = async (user) => {
    const action = user.isActive ? 'deactivate' : 'activate';
    await api.put(`/admin/users/${user.id}/${action}`);
    loadUsers();
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post('/admin/users/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(data);
      loadUsers();
    } catch (err) {
      setImportResult({ error: err.response?.data?.message || err.response?.data?.error || 'שגיאה בייבוא הקובץ' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>ניהול משתמשות</h2>
          <p>הוספה, השבתה וייבוא רשימת תלמידות</p>
        </div>
      </div>

      <div className="card">
        <h2>📥 ייבוא רשימת תלמידות מאקסל</h2>
        <p className="muted">
          קובץ Excel עם כותרות בשורה הראשונה: <strong>שם</strong> ו-<strong>תעודת זהות</strong> (עמודת טלפון אופציונלית).
          תלמידה קיימת (לפי ת.ז) תתעדכן, תלמידה חדשה תיווצר.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleImport}
          disabled={importing}
          style={{ width: 'auto' }}
        />
        {importing && <p className="muted"><span className="spinner" />מייבאת...</p>}
        {importResult && (
          importResult.error ? (
            <p className="error-text">{importResult.error}</p>
          ) : (
            <div className="success-text">
              <p>✓ נוספו: {importResult.added} | עודכנו: {importResult.updated} | דולגו: {importResult.skipped.length}</p>
              {importResult.skipped.length > 0 && (
                <ul style={{ fontSize: 13, color: 'var(--danger)' }}>
                  {importResult.skipped.map((s, i) => (
                    <li key={i}>שורה {s.row}{s.name ? ` (${s.name})` : ''}: {s.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )
        )}
      </div>

      <div className="card">
        <h2>➕ הוספת תלמידה בודדת</h2>
        <form onSubmit={addUser} className="form-row">
          <div className="field">
            <label>שם מלא</label>
            <input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>תעודת זהות</label>
            <input value={newUser.idNumber} onChange={(e) => setNewUser({ ...newUser, idNumber: e.target.value })} maxLength={9} required />
          </div>
          <button className="btn-primary">הוספה</button>
        </form>
        {addError && <p className="error-text">{addError}</p>}
      </div>

      <div className="card">
        <h2>כל התלמידות ({filteredUsers.length}{filteredUsers.length !== users.length ? ` מתוך ${users.length}` : ''})</h2>

        <div className="filter-bar">
          <div className="field">
            <label>חיפוש</label>
            <input placeholder="שם או תעודת זהות..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="field">
            <label>סטטוס</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">הכל</option>
              <option value="active">פעילות</option>
              <option value="inactive">לא פעילות</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="muted"><span className="spinner" />טוענת...</p>
        ) : error ? (
          <p className="error-text">{error}</p>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">לא נמצאו תלמידות התואמות את הסינון</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>שם</th>
                  <th>תעודת זהות</th>
                  <th>טלפון</th>
                  <th>תזכורת שבועית</th>
                  <th>סטטוס</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.idNumber}</td>
                    <td>{user.phone || '—'}</td>
                    <td>
                      {user.notificationDay
                        ? `יום ${DAY_LABELS[user.notificationDay] || user.notificationDay}, ${user.notificationHour}:00`
                        : <span className="muted">לא הוגדרה</span>}
                    </td>
                    <td>
                      <span className={`badge ${user.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {user.isActive ? 'פעילה' : 'לא פעילה'}
                      </span>
                    </td>
                    <td>
                      <button className="btn-secondary" onClick={() => toggleActive(user)}>
                        {user.isActive ? 'השבתה' : 'הפעלה'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
