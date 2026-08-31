import { useEffect, useState } from 'react';
import api from '../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/statistics').then((res) => setStats(res.data)).catch(() => setError('שגיאה בטעינת נתונים'));
    api.get('/admin/activity-logs?days=7').then((res) => setLogs(res.data.slice(0, 15))).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>לוח בקרה</h2>
          <p>סקירה כללית של המערכת</p>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}

      {stats && (
        <div className="stat-grid">
          <div className="stat-tile">
            <div className="value">{stats.users.total}</div>
            <div className="label">סה"כ תלמידות</div>
          </div>
          <div className="stat-tile">
            <div className="value">{stats.users.active}</div>
            <div className="label">פעילות</div>
          </div>
          <div className="stat-tile">
            <div className="value">{stats.activities}</div>
            <div className="label">עדכוני פעילות</div>
          </div>
          <div className="stat-tile">
            <div className="value">{stats.completions}</div>
            <div className="label">השלמות</div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>📞 פעילות אחרונה בקו (7 ימים)</h2>
        {logs.length === 0 ? (
          <div className="empty-state">אין פעילות להצגה</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>תלמידה</th>
                <th>פעולה</th>
                <th>שלוחה</th>
                <th>סטטוס</th>
                <th>תאריך</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.user?.name || '—'}</td>
                  <td>{log.action}</td>
                  <td>{log.extension}</td>
                  <td>
                    <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
                      {log.status === 'success' ? 'הצליח' : 'נכשל'}
                    </span>
                  </td>
                  <td>{new Date(log.createdAt).toLocaleString('he-IL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
