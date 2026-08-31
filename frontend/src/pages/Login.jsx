import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Login() {
  const [idNumber, setIdNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { idNumber });
      if (data.user.role !== 'admin') {
        setError('הכניסה לאתר הניהול מיועדת למנהלות המערכת בלבד');
        setLoading(false);
        return;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-box" onSubmit={submit}>
        <div className="icon">💜</div>
        <h2>כניסת מנהלת</h2>
        <div className="field">
          <label>תעודת זהות</label>
          <input
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
            placeholder="123456789"
            maxLength={9}
            required
          />
        </div>
        <button className="btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'מתחברת...' : 'כניסה'}
        </button>
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
