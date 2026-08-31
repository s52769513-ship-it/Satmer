import { useState } from 'react';
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

export default function Reports() {
  const [week, setWeek] = useState(1);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(currentYear);
  const [error, setError] = useState('');

  const handle = async (fn) => {
    setError('');
    try {
      await fn();
    } catch {
      setError('שגיאה בהורדת הדוח');
    }
  };

  return (
    <div>
      <h2>דוחות והורדות</h2>
      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <h2>דוח שבועי</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>מספר שבוע</label>
            <input type="number" value={week} onChange={(e) => setWeek(e.target.value)} min={1} max={53} />
          </div>
          <button
            className="btn-primary"
            onClick={() => handle(() => downloadReport(`/reports/weekly?week=${week}&year=${year}`, `activities_week_${week}.csv`))}
          >
            הורדת CSV
          </button>
        </div>
      </div>

      <div className="card">
        <h2>דוח חודשי</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>חודש</label>
            <input type="number" value={month} onChange={(e) => setMonth(e.target.value)} min={1} max={12} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>שנה</label>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <button
            className="btn-primary"
            onClick={() => handle(() => downloadReport(`/reports/monthly?month=${month}&year=${year}`, `completions_${month}_${year}.csv`))}
          >
            הורדת CSV
          </button>
        </div>
      </div>

      <div className="card">
        <h2>דוח שנתי מסכם</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>שנה</label>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <button
            className="btn-primary"
            onClick={() => handle(() => downloadReport(`/reports/yearly?year=${year}`, `yearly_report_${year}.csv`))}
          >
            הורדת CSV
          </button>
        </div>
      </div>
    </div>
  );
}
