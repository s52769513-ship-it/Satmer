import { useEffect, useState } from 'react';
import api from '../services/api';

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

function WeeklyReport() {
  const [parashot, setParashot] = useState([]);
  const [currentYear, setCurrentYear] = useState('');
  const [parasha, setParasha] = useState('');
  const [hebrewYear, setHebrewYear] = useState('');
  const [participated, setParticipated] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/reports/filter-options/weekly').then((res) => {
      setParashot(res.data.parashot);
      setCurrentYear(res.data.currentHebrewYear);
      setHebrewYear(res.data.currentHebrewYear);
    });
  }, []);

  return (
    <ReportSection
      title="📅 דוח שבועי - לפי פרשה"
      description="פעילות חסד, מסוננת לפי פרשת השבוע ושנה עברית"
      previewUrl="/reports/weekly/preview"
      downloadUrl="/reports/weekly"
      downloadFilename={`activities_${parasha || 'all'}.csv`}
      params={{ parasha: parasha || undefined, hebrewYear: hebrewYear || undefined, participated: participated === 'all' ? undefined : participated, search: search || undefined }}
      columns={[
        { key: 'name', label: 'שם' },
        { key: 'idNumber', label: 'ת.ז' },
        { key: 'parasha', label: 'פרשה' },
        { key: 'hebrewDate', label: 'תאריך עברי' },
        { key: 'participated', label: 'השתתפה', render: (r) => <span className={`badge ${r.participated ? 'badge-success' : 'badge-danger'}`}>{r.participated ? 'כן' : 'לא'}</span> },
        { key: 'points', label: 'נקודות' },
      ]}
    >
      <div className="field">
        <label>פרשה</label>
        <select value={parasha} onChange={(e) => setParasha(e.target.value)}>
          <option value="">כל הפרשות</option>
          {parashot.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="field">
        <label>שנה עברית</label>
        <input type="number" value={hebrewYear} onChange={(e) => setHebrewYear(e.target.value)} placeholder={String(currentYear)} />
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
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
    </ReportSection>
  );
}

function MonthlyReport() {
  const [months, setMonths] = useState([]);
  const [currentYear, setCurrentYear] = useState('');
  const [hebrewMonth, setHebrewMonth] = useState('');
  const [hebrewYear, setHebrewYear] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/reports/filter-options/monthly', { params: { hebrewYear: hebrewYear || undefined } }).then((res) => {
      setMonths(res.data.months);
      setCurrentYear(res.data.currentHebrewYear);
      if (!hebrewYear) setHebrewYear(res.data.currentHebrewYear);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hebrewYear]);

  return (
    <ReportSection
      title="🗓️ דוח חודשי - לפי חודש עברי"
      description="השלמות, מסוננות לפי חודש ושנה עברית"
      previewUrl="/reports/monthly/preview"
      downloadUrl="/reports/monthly"
      downloadFilename={`completions_${hebrewMonth || 'all'}.csv`}
      params={{ hebrewMonth: hebrewMonth || undefined, hebrewYear: hebrewYear || undefined, search: search || undefined }}
      columns={[
        { key: 'name', label: 'שם' },
        { key: 'idNumber', label: 'ת.ז' },
        { key: 'completionNumber', label: 'מס\' השלמה' },
        { key: 'points', label: 'נקודות' },
        { key: 'hebrewDate', label: 'תאריך עברי' },
      ]}
    >
      <div className="field">
        <label>חודש עברי</label>
        <select value={hebrewMonth} onChange={(e) => setHebrewMonth(e.target.value)}>
          <option value="">כל החודשים</option>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="field">
        <label>שנה עברית</label>
        <input type="number" value={hebrewYear} onChange={(e) => setHebrewYear(e.target.value)} placeholder={String(currentYear)} />
      </div>
      <div className="field">
        <label>חיפוש שם/ת.ז</label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
    </ReportSection>
  );
}

function YearlyReport() {
  const [currentYear, setCurrentYear] = useState('');
  const [hebrewYear, setHebrewYear] = useState('');
  const [search, setSearch] = useState('');
  const [minPoints, setMinPoints] = useState('');

  useEffect(() => {
    api.get('/reports/filter-options/yearly').then((res) => {
      setCurrentYear(res.data.currentHebrewYear);
      setHebrewYear(res.data.currentHebrewYear);
    });
  }, []);

  return (
    <ReportSection
      title="📊 דוח שנתי מסכם - לפי שנה עברית"
      description="סיכום נקודות שנתי לכל תלמידה"
      previewUrl="/reports/yearly/preview"
      downloadUrl="/reports/yearly"
      downloadFilename={`yearly_report_${hebrewYear || currentYear}.csv`}
      params={{ hebrewYear: hebrewYear || undefined, search: search || undefined, minPoints: minPoints || undefined }}
      columns={[
        { key: 'name', label: 'שם' },
        { key: 'idNumber', label: 'ת.ז' },
        { key: 'participated', label: 'השתתפויות' },
        { key: 'completions', label: 'השלמות' },
        { key: 'totalPoints', label: 'סה"כ נקודות' },
      ]}
    >
      <div className="field">
        <label>שנה עברית</label>
        <input type="number" value={hebrewYear} onChange={(e) => setHebrewYear(e.target.value)} placeholder={String(currentYear)} />
      </div>
      <div className="field">
        <label>חיפוש שם/ת.ז</label>
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="field">
        <label>מינימום נקודות</label>
        <input type="number" value={minPoints} onChange={(e) => setMinPoints(e.target.value)} placeholder="0" />
      </div>
    </ReportSection>
  );
}

export default function Reports() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>דוחות והורדות</h2>
          <p>לפי לוח השנה העברי - תצוגה מקדימה עם סינון, לפני הורדת קובץ CSV</p>
        </div>
      </div>

      <WeeklyReport />
      <MonthlyReport />
      <YearlyReport />
    </div>
  );
}
