import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      <h2>ניהול משתמשות</h2>

      <div className="card">
        <h2>ייבוא רשימת תלמידות מאקסל</h2>
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
        />
        {importing && <p className="muted">מייבאת...</p>}
        {importResult && (
          importResult.error ? (
            <p className="error-text">{importResult.error}</p>
          ) : (
            <div className="success-text">
              <p>נוספו: {importResult.added} | עודכנו: {importResult.updated} | דולגו: {importResult.skipped.length}</p>
              {importResult.skipped.length > 0 && (
                <ul style={{ fontSize: 13, color: '#d64545' }}>
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
        <h2>הוספת תלמידה בודדת</h2>
        <form onSubmit={addUser} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>שם מלא</label>
            <input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required />
          </div>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label>תעודת זהות</label>
            <input value={newUser.idNumber} onChange={(e) => setNewUser({ ...newUser, idNumber: e.target.value })} maxLength={9} required />
          </div>
          <button className="btn-primary">הוספה</button>
        </form>
        {addError && <p className="error-text">{addError}</p>}
      </div>

      <div className="card">
        <h2>כל התלמידות ({users.length})</h2>
        {loading ? (
          <p className="muted">טוענת...</p>
        ) : error ? (
          <p className="error-text">{error}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>שם</th>
                <th>תעודת זהות</th>
                <th>טלפון</th>
                <th>סטטוס</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.idNumber}</td>
                  <td>{user.phone || '—'}</td>
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
        )}
      </div>
    </div>
  );
}
