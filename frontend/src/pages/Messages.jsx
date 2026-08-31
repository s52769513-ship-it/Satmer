import { useState } from 'react';
import api from '../services/api';

export default function Messages() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const send = async (e) => {
    e.preventDefault();
    if (!confirm('לשלוח את הצינתוק הזה לכל התלמידות הפעילות?')) return;

    setSending(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.post('/admin/broadcast', { message });
      setResult(data);
      setMessage('');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'שגיאה בשליחת ההודעה');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>שליחת הודעות</h2>
          <p>שיחת צינתוק קולית לכל התלמידות הפעילות</p>
        </div>
      </div>
      <div className="card">
        <p className="muted">
          ההודעה תישלח כשיחה קולית לכל התלמידות הפעילות במערכת, דרך המערכת הטלפונית של טכנוליין בלבד.
        </p>
        <form onSubmit={send}>
          <div className="field">
            <label>תוכן ההודעה</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} required />
          </div>
          <button className="btn-primary" disabled={sending}>
            {sending && <span className="spinner" />}{sending ? 'שולחת...' : '📞 שליחת צינתוק לכולן'}
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
        {result && <p className="success-text">✓ נשלח בהצלחה ל-{result.sentTo} תלמידות</p>}
      </div>
    </div>
  );
}
