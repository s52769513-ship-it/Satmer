import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import UserModal from '../components/UserModal.jsx';

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
  const [gradeFilter, setGradeFilter] = useState('all');
  const [newUser, setNewUser] = useState({ name: '', idNumber: '' });
  const [addError, setAddError] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const fileInputRef = useRef(null);

  const loadUsers = () => {
    setLoading(true);
    api.get('/admin/users').then((res) => setUsers(res.data)).catch(() => setError('שגיאה בטעינת רשימת המשתמשות')).finally(() => setLoading(false));
  };

  useEffect(loadUsers, []);

  const grades = useMemo(() => [...new Set(users.map((u) => u.grade).filter(Boolean))].sort(), [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      if (gradeFilter !== 'all' && u.grade !== gradeFilter) return false;
      if (search && !u.name.includes(search) && !u.idNumber.includes(search)) return false;
      return true;
    });
  }, [users, search, statusFilter, gradeFilter]);

  // Selection can only ever contain rows currently visible under the filter.
  useEffect(() => {
    const visibleIds = new Set(filteredUsers.map((u) => u.id));
    setSelectedIds((prev) => new Set([...prev].filter((id) => visibleIds.has(id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredUsers]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.has(u.id));
  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(filteredUsers.map((u) => u.id)));
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`למחוק לצמיתות ${selectedIds.size} תלמידות? פעולה זו אינה הפיכה ותמחק גם את כל היסטוריית העדכונים שלהן.`)) return;
    setBulkDeleting(true);
    try {
      await api.post('/admin/users/bulk-delete', { userIds: [...selectedIds] });
      setSelectedIds(new Set());
      loadUsers();
    } catch {
      setError('שגיאה במחיקה מרובה');
    } finally {
      setBulkDeleting(false);
    }
  };

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
          קובץ Excel עם כותרות בשורה הראשונה: <strong>שם</strong> (או <strong>שם פרטי</strong> + <strong>שם משפחה</strong> בעמודות נפרדות)
          ו-<strong>תעודת זהות</strong>. עמודות אופציונליות: <strong>טלפון</strong>, <strong>כיתה</strong>, <strong>סטטוס</strong> (פעילה/לא פעילה).
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
        <p className="muted">לחיצה על תלמידה פותחת את הכרטיס שלה - פרטים לעריכה והיסטוריית עדכונים</p>

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
          <div className="field">
            <label>כיתה</label>
            <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
              <option value="all">הכל</option>
              {grades.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          {selectedIds.size > 0 && (
            <button className="btn-secondary btn-danger" onClick={bulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? 'מוחקת...' : `מחיקת ${selectedIds.size} נבחרות`}
            </button>
          )}
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
                  <th><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} /></th>
                  <th>שם</th>
                  <th>תעודת זהות</th>
                  <th>כיתה</th>
                  <th>טלפון</th>
                  <th>תזכורת שבועית</th>
                  <th>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="clickable-row" onClick={() => setSelectedUserId(user.id)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(user.id)} onChange={() => toggleSelected(user.id)} />
                    </td>
                    <td>{user.name}</td>
                    <td>{user.idNumber}</td>
                    <td>{user.grade || '—'}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedUserId && (
        <UserModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onChanged={loadUsers}
        />
      )}
    </div>
  );
}
