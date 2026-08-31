import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

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

  const handleUpload = async (e) => {
    const file = e.target.files[0];
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
      <h2>ניהול הקלטות</h2>
      <p className="muted">כל ההקלטות הקוליות של המערכת (הודעות פתיחה, הודעות מותאמות אישית וכו').</p>

      <div className="card">
        <h2>העלאת הקלטה חדשה</h2>
        <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleUpload} disabled={uploading} />
        {uploading && <p className="muted">מעלה...</p>}
      </div>

      <div className="card">
        <h2>קבצים קיימים ({files.length})</h2>
        {error && <p className="error-text">{error}</p>}
        {loading ? (
          <p className="muted">טוענת...</p>
        ) : files.length === 0 ? (
          <p className="muted">אין הקלטות עדיין</p>
        ) : (
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
                  <td>{file.time ? new Date(Number(file.time) * 1000).toLocaleDateString('he-IL') : '—'}</td>
                  <td>
                    <button className="btn-secondary btn-danger" onClick={() => handleDelete(file.id)}>
                      מחיקה
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
