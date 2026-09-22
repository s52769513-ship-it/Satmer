import { useEffect, useState } from 'react';
import api from '../services/api';
import { ACTION_LABELS } from '../utils/labels.js';

const STATUS_LABELS = { success: 'הצליח', failed: 'נכשל', incomplete: 'לא הושלם' };

export default function CallLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [extension, setExtension] = useState('all');
  const [status, setStatus] = useState('all');
  const [days, setDays] = useState(90);

  const pageSize = 50;

  const params = {
    days,
    search: search || undefined,
    extension: extension === 'all' ? undefined : extension,
    status: status === 'all' ? undefined : status,
    pageSize,
  };

  const load = (targetPage) => {
    const isFirstPage = targetPage === 1;
    isFirstPage ? setLoading(true) : setLoadingMore(true);
    setError('');
    api.get('/admin/activity-logs', { params: { ...params, page: targetPage } })
      .then((res) => {
        setLogs((prev) => (isFirstPage ? res.data.logs : [...prev, ...res.data.logs]));
        setTotal(res.data.total);
        setPage(targetPage);
      })
      .catch(() => setError('שגיאה בטעינת יומן השיחות'))
      .finally(() => (isFirstPage ? setLoading(false) : setLoadingMore(false)));
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, extension, status, days]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>יומן שיחות</h2>
          <p>כל הפעולות שבוצעו דרך הקו הטלפוני</p>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="field">
            <label>חיפוש</label>
            <input placeholder="שם או תעודת זהות..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="field">
            <label>שלוחה</label>
            <select value={extension} onChange={(e) => setExtension(e.target.value)}>
              <option value="all">הכל</option>
              <option value="1">שלוחה 1</option>
              <option value="2">שלוחה 2</option>
              <option value="3">שלוחה 3</option>
              <option value="4">שלוחה 4</option>
            </select>
          </div>
          <div className="field">
            <label>סטטוס</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">הכל</option>
              <option value="success">הצליח</option>
              <option value="failed">נכשל</option>
              <option value="incomplete">לא הושלם</option>
            </select>
          </div>
          <div className="field">
            <label>ימים אחרונים</label>
            <input type="number" value={days} onChange={(e) => setDays(Number(e.target.value) || 90)} min={1} />
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        {loading ? (
          <p className="muted"><span className="spinner" />טוענת...</p>
        ) : logs.length === 0 ? (
          <div className="empty-state">אין פעילות להצגה עבור הסינון הנוכחי</div>
        ) : (
          <>
            <div className="summary-strip">
              <span>מוצגות <strong>{logs.length}</strong> מתוך <strong>{total}</strong></span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>תלמידה</th>
                    <th>פעולה</th>
                    <th>שלוחה</th>
                    <th>סטטוס</th>
                    <th>תאריך עברי</th>
                    <th>שעה</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.user?.name || '—'}</td>
                      <td>{ACTION_LABELS[log.action] || log.action}</td>
                      <td>{log.extension}</td>
                      <td>
                        <span className={`badge ${log.status === 'success' ? 'badge-success' : 'badge-danger'}`}>
                          {STATUS_LABELS[log.status] || log.status}
                        </span>
                      </td>
                      <td>{log.hebrewDate}</td>
                      <td>{new Date(log.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {logs.length < total && (
              <button className="btn-secondary" onClick={() => load(page + 1)} disabled={loadingMore} style={{ marginTop: 12 }}>
                {loadingMore ? 'טוענת...' : 'טעינת עוד'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
