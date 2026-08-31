import { useEffect, useState } from 'react';
import api from '../services/api';

const currentYear = new Date().getFullYear();

async function downloadReport(url, filename) {
  const { data } = await api.get(url, { responseType: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(data);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function ReportSection({ title, description, children, previewUrl, params, downloadUrl, downloadFilename, columns }) {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPreview = () => {
    setLoading(true);
    setError('');
    api.get(previewUrl, { params })
      .then((res) => setRows(res.data))
      .catch(() => setError('שגיאה בטעינת התצוגה המקדימה'))
      .finally(() => setLoading(false));
  };

  useEffect(loadPreview, [previewUrl, JSON.stringify(params)]);

  const handleDownload = async () => {
    try {
      const query = new URLSearchParams(params).toString();
      await downloadReport(`${downloadUrl}?${query}`, downloadFilename);
    } catch {
      setError('שגיאה בהורדת הקובץ');
    }
  };

  return (
    <div className="card">
      <h2>{title}</h2>
      <p className="muted">{description}</p>

      <div className="filter-bar">
        {children}
        <button className="btn-primary" onClick={handleDownload} disabled={!rows || rows.length === 0}>
          ⬇ הורדת CSV
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p className="muted"><span className="spinner" />טוענת תצוגה מקדימה...</p>
      ) : rows && rows.length > 0 ? (
        <>
          <div className="summary-strip">
            <span>סה"כ שורות: <strong>{rows.length}</strong></span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((row, i) => (
                  <tr key={i}>
                    {columns.map((c) => <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 50 && <p className="muted">מוצגות 50 השורות הראשונות מתוך {rows.length} (בקובץ המלא יופיעו כולן)</p>}
        </>
      ) : (
        <div className="empty-state">אין נתונים להצגה עבור הסינון הנוכחי</div>
      )}
    </div>
  );
}

export default function Reports() {
  const [week, setWeek] = useState(1);
  const [weekYear, setWeekYear] = useState(currentYear);
  const [participated, setParticipated] = useState('all');
  const [weekSearch, setWeekSearch] = useState('');

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [monthYear, setMonthYear] = useState(currentYear);
  const [monthSearch, setMonthSearch] = useState('');

  const [year, setYear] = useState(currentYear);
  const [yearSearch, setYearSearch] = useState('');
  const [minPoints, setMinPoints] = useState('');

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>דוחות והורדות</h2>
          <p>תצוגה מקדימה עם סינון, לפני הורדת קובץ CSV</p>
        </div>
      </div>

      <ReportSection
        title="📅 דוח שבועי"
        description="פעילות חסד לפי שבוע"
        previewUrl="/reports/weekly/preview"
        downloadUrl="/reports/weekly"
        downloadFilename={`activities_week_${week}_${weekYear}.csv`}
        params={{ week, year: weekYear, participated: participated === 'all' ? undefined : participated, search: weekSearch || undefined }}
        columns={[
          { key: 'name', label: 'שם' },
          { key: 'idNumber', label: 'ת.ז' },
          { key: 'week', label: 'שבוע' },
          { key: 'participated', label: 'השתתפה', render: (r) => <span className={`badge ${r.participated ? 'badge-success' : 'badge-danger'}`}>{r.participated ? 'כן' : 'לא'}</span> },
          { key: 'points', label: 'נקודות' },
        ]}
      >
        <div className="field">
          <label>שבוע</label>
          <input type="number" value={week} onChange={(e) => setWeek(e.target.value)} min={1} max={53} />
        </div>
        <div className="field">
          <label>שנה</label>
          <input type="number" value={weekYear} onChange={(e) => setWeekYear(e.target.value)} />
        </div>
        <div className="field">
          <label>השתתפות</label>
          <select value={participated} onChange={(e) => setParticipated(e.target.value)}>
            <option value="all">הכל</option>
            <option value="yes">השתתפו</option>
            <option value="no">לא השתתפו</option>
          </select>
        </div>
        <div className="field">
          <label>חיפוש שם/ת.ז</label>
          <input value={weekSearch} onChange={(e) => setWeekSearch(e.target.value)} />
        </div>
      </ReportSection>

      <ReportSection
        title="🗓️ דוח חודשי"
        description="השלמות לפי חודש"
        previewUrl="/reports/monthly/preview"
        downloadUrl="/reports/monthly"
        downloadFilename={`completions_${month}_${monthYear}.csv`}
        params={{ month, year: monthYear, search: monthSearch || undefined }}
        columns={[
          { key: 'name', label: 'שם' },
          { key: 'idNumber', label: 'ת.ז' },
          { key: 'completionNumber', label: 'מס\' השלמה' },
          { key: 'points', label: 'נקודות' },
          { key: 'date', label: 'תאריך', render: (r) => new Date(r.date).toLocaleDateString('he-IL') },
        ]}
      >
        <div className="field">
          <label>חודש</label>
          <input type="number" value={month} onChange={(e) => setMonth(e.target.value)} min={1} max={12} />
        </div>
        <div className="field">
          <label>שנה</label>
          <input type="number" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} />
        </div>
        <div className="field">
          <label>חיפוש שם/ת.ז</label>
          <input value={monthSearch} onChange={(e) => setMonthSearch(e.target.value)} />
        </div>
      </ReportSection>

      <ReportSection
        title="📊 דוח שנתי מסכם"
        description="סיכום נקודות שנתי לכל תלמידה"
        previewUrl="/reports/yearly/preview"
        downloadUrl="/reports/yearly"
        downloadFilename={`yearly_report_${year}.csv`}
        params={{ year, search: yearSearch || undefined, minPoints: minPoints || undefined }}
        columns={[
          { key: 'name', label: 'שם' },
          { key: 'idNumber', label: 'ת.ז' },
          { key: 'participated', label: 'השתתפויות' },
          { key: 'completions', label: 'השלמות' },
          { key: 'totalPoints', label: 'סה"כ נקודות' },
        ]}
      >
        <div className="field">
          <label>שנה</label>
          <input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
        </div>
        <div className="field">
          <label>חיפוש שם/ת.ז</label>
          <input value={yearSearch} onChange={(e) => setYearSearch(e.target.value)} />
        </div>
        <div className="field">
          <label>מינימום נקודות</label>
          <input type="number" value={minPoints} onChange={(e) => setMinPoints(e.target.value)} placeholder="0" />
        </div>
      </ReportSection>
    </div>
  );
}
