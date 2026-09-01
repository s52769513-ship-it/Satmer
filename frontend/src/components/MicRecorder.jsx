import { useRef, useState } from 'react';

/**
 * Records audio straight from the browser's microphone as an alternative
 * to uploading a file. Hands the finished recording to `onRecorded` as a
 * File (webm/opus - what MediaRecorder produces natively; the phone system
 * transcodes whatever it receives anyway, see technoline.js uploadFile).
 */
export default function MicRecorder({ onRecorded, label = 'הקלטה מהמחשב' }) {
  const [state, setState] = useState('idle'); // idle | recording | preview
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setPreviewUrl(URL.createObjectURL(blob));
        setState('preview');
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setState('recording');
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError('לא ניתן לגשת למיקרופון - יש לאשר הרשאה בדפדפן');
    }
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    clearInterval(timerRef.current);
  };

  const reset = () => {
    setPreviewUrl(null);
    setState('idle');
    setSeconds(0);
  };

  const save = () => {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const file = new File([blob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
    onRecorded(file);
    reset();
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  if (state === 'idle') {
    return (
      <div>
        <button type="button" className="btn-secondary" onClick={start}>🎙️ {label}</button>
        {error && <div className="error-text">{error}</div>}
      </div>
    );
  }

  if (state === 'recording') {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className="badge badge-danger">● מקליטה {mm}:{ss}</span>
        <button type="button" className="btn-secondary" onClick={stop}>עצירה</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <audio src={previewUrl} controls style={{ height: 32 }} />
      <button type="button" className="btn-primary" onClick={save}>שמירת הקלטה</button>
      <button type="button" className="btn-secondary" onClick={reset}>הקלטה מחדש</button>
    </div>
  );
}
