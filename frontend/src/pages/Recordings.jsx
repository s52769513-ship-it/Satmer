import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import MicRecorder from '../components/MicRecorder.jsx';

function PhraseRow({ phrase, onChanged }) {
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const uploadFile = async (file) => {
    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post(`/admin/phrases/${phrase.key}/recording`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChanged();
      setRecording(false);
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בהעלאה');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!confirm('להסיר את ההקלטה ולחזור לקול הממוחשב?')) return;
    await api.delete(`/admin/phrases/${phrase.key}/recording`);
    onChanged();
  };

  return (
    <tr>
      <td style={{ maxWidth: 360 }}>{phrase.text}</td>
      <td>
        <span className={`badge ${phrase.hasOverride ? 'badge-success' : 'badge-neutral'}`}>
          {phrase.hasOverride ? 'הקלטה אישית' : 'קול ממוחשב'}
        </span>
      </td>
      <td>
        {uploading ? (
          <span className="muted"><span className="spinner" />מעלה...</span>
        ) : recording ? (
          <MicRecorder onRecorded={uploadFile} />
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="btn-secondary" style={{ display: 'inline-block' }}>
              {phrase.hasOverride ? 'החלפה מקובץ' : 'העלאת קובץ'}
              <input ref={inputRef} type="file" accept="audio/*" onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0])} style={{ display: 'none' }} />
            </label>
            <button type="button" className="btn-secondary" onClick={() => setRecording(true)}>🎙️ הקלטה</button>
            {phrase.hasOverride && (
              <button className="btn-secondary btn-danger" onClick={remove}>הסרה</button>
            )}
          </div>
        )}
        {error && <div className="error-text">{error}</div>}
      </td>
    </tr>
  );
}

function PhraseOverrides() {
  const [phrases, setPhrases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/admin/phrases')
      .then((res) => setPhrases(res.data))
      .catch(() => setError('שגיאה בטעינת רשימת המשפטים'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="card">
      <h2>🗣️ הקלטת הודעות הקו בקול שלך</h2>
      <p className="muted">
        כל מה שהמערכת אומרת בטלפון מוקרא כברירת מחדל בקול ממוחשב. אפשר להחליף כל משפט קבוע בהקלטה שלך -
        המילים המשתנות (כמו שם הפרשה או מספרים) ימשיכו להישמע אוטומטית סביב ההקלטה שלך.
      </p>
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="muted"><span className="spinner" />טוענת...</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>הטקסט הנאמר</th>
                <th>מקור הקול</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {phrases.map((p) => <PhraseRow key={p.key} phrase={p} onChanged={load} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Recordings() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => {
    setLoading(true);
    setError('');
    api.get('/admin/recordings')
      .then((res) => setFiles(res.data))
      .catch((err) => setError(err.response?.data?.error || 'שגיאה בטעינת ההקלטות'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleUpload = async (file) => {
    if (!file) return;

    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/admin/recordings/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'שגיאה בהעלאת הקובץ');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId) => {
    if (!confirm('למחוק את ההקלטה?')) return;
    await api.delete(`/admin/recordings/${fileId}`);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>ניהול הקלטות</h2>
          <p>כל ההקלטות הקוליות של המערכת (הודעות פתיחה, הודעות מותאמות אישית וכו')</p>
        </div>
      </div>

      <PhraseOverrides />

      <div className="card">
        <h2>🎙️ העלאת קובץ קול כללי</h2>
        <p className="muted">קובץ קול נוסף שאינו קשור למשפט קבוע ספציפי (לשימוש עתידי).</p>
        {uploading ? (
          <p className="muted"><span className="spinner" />מעלה...</p>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="btn-secondary" style={{ display: 'inline-block' }}>
              העלאת קובץ
              <input ref={fileInputRef} type="file" accept="audio/*" onChange={(e) => handleUpload(e.target.files[0])} style={{ display: 'none' }} />
            </label>
            <MicRecorder onRecorded={handleUpload} />
          </div>
        )}
      </div>

      <div className="card">
        <h2>כל הקבצים באחסון ({files.length})</h2>
        {error && <p className="error-text">{error}</p>}
        {loading ? (
          <p className="muted"><span className="spinner" />טוענת...</p>
        ) : files.length === 0 ? (
          <div className="empty-state">אין הקלטות עדיין</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>שם</th>
                  <th>תאריך</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td>{file.name}</td>
                    <td>{file.hebrewDate || '—'}</td>
                    <td>
                      <button className="btn-secondary btn-danger" onClick={() => handleDelete(file.id)}>
                        מחיקה
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
