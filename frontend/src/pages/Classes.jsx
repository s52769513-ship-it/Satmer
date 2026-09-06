import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const UNASSIGNED = '__unassigned__';

function ClassGroup({ label, students, allGrades, onChanged }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [targetGrade, setTargetGrade] = useState('');
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const visibleIds = new Set(students.map((s) => s.id));
    setSelectedIds((prev) => new Set([...prev].filter((id) => visibleIds.has(id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));
  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(students.map((s) => s.id)));
  };

  const move = async () => {
    if (selectedIds.size === 0 || !targetGrade.trim()) return;
    setMoving(true);
    setError('');
    try {
      await api.post('/admin/users/bulk-set-grade', { userIds: [...selectedIds], grade: targetGrade.trim() });
      setSelectedIds(new Set());
      setTargetGrade('');
      onChanged();
    } catch {
      setError('שגיאה בהעברה');
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="card">
      <h2>{label} ({students.length})</h2>
      {students.length === 0 ? (
        <div className="empty-state">אין תלמידות בקבוצה זו</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} /></th>
                <th>שם</th>
                <th>תעודת זהות</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td><input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelected(s.id)} /></td>
                  <td>{s.name}</td>
                  <td>{s.idNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="filter-bar" style={{ marginTop: 12 }}>
          <div className="field">
            <label>העברה לכיתה ({selectedIds.size} נבחרות)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                list={`grade-options-${label}`}
                placeholder="שם כיתה..."
                value={targetGrade}
                onChange={(e) => setTargetGrade(e.target.value)}
              />
              <datalist id={`grade-options-${label}`}>
                {allGrades.map((g) => <option key={g} value={g} />)}
              </datalist>
              <button className="btn-secondary" onClick={move} disabled={moving || !targetGrade.trim()}>
                {moving ? 'מעבירה...' : 'העברה'}
              </button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export default function Classes() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = () => {
    setLoading(true);
    api.get('/admin/users').then((res) => setUsers(res.data)).catch(() => setError('שגיאה בטעינת רשימת המשתמשות')).finally(() => setLoading(false));
  };

  useEffect(loadUsers, []);

  const students = useMemo(() => users.filter((u) => u.role !== 'admin'), [users]);
  const allGrades = useMemo(() => [...new Set(students.map((s) => s.grade).filter(Boolean))].sort(), [students]);

  const groups = useMemo(() => {
    const byGrade = new Map();
    for (const grade of allGrades) byGrade.set(grade, []);
    byGrade.set(UNASSIGNED, []);
    for (const s of students) {
      const key = s.grade || UNASSIGNED;
      if (!byGrade.has(key)) byGrade.set(key, []);
      byGrade.get(key).push(s);
    }
    const entries = [...byGrade.entries()];
    entries.sort(([a], [b]) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b)));
    return entries;
  }, [students, allGrades]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>ניהול כיתות</h2>
          <p>חלוקת תלמידות לכיתות - בחירה והעברה לכל כיתה קיימת, או הקלדת שם כיתה חדשה</p>
        </div>
      </div>

      {loading ? (
        <p className="muted"><span className="spinner" />טוענת...</p>
      ) : error ? (
        <p className="error-text">{error}</p>
      ) : (
        groups.map(([grade, groupStudents]) => (
          <ClassGroup
            key={grade}
            label={grade === UNASSIGNED ? 'ללא כיתה' : grade}
            students={groupStudents}
            allGrades={allGrades}
            onChanged={loadUsers}
          />
        ))
      )}
    </div>
  );
}
