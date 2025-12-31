'use client';

import { useState, useEffect, useRef } from 'react';
import Terminal from './components/Terminal';
import ProgressBar from './components/ProgressBar';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  // Download State
  const [taskId, setTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Polling interval
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchInfo = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to fetch');
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startDownload = async (formatId: string) => {
    setTaskId(null);
    setLogs(['Initializing...']);
    setProgress(0);
    setTaskStatus('queued');
    setShowModal(true);

    try {
      const res = await fetch('/api/start_download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format_id: formatId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      setTaskId(data.task_id);

    } catch (err: any) {
      setLogs(p => [...p, `Error: ${err.message}`]);
    }
  };

  // Polling Effect
  useEffect(() => {
    if (!taskId) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/progress/${taskId}`);
        if (!res.ok) return;
        const data = await res.json();

        setTaskStatus(data.status);
        setProgress(data.progress);
        setLogs(data.logs || []);

        if (data.status === 'finished') {
          if (pollRef.current) clearInterval(pollRef.current);
          // Trigger file download
          window.location.href = `/api/file/${taskId}`;
          setTimeout(() => setShowModal(false), 3000);
        } else if (data.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current);
        }

      } catch (e) {
        console.error(e);
      }
    }, 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [taskId]);

  const closeModal = () => {
    setShowModal(false);
    setTaskId(null);
  };

  return (
    <>
      <div className="background-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Modal */}
      <div className={`modal ${!showModal ? 'hidden' : ''}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h2><i className="fa-solid fa-terminal"></i> Server Status</h2>
            <button id="close-modal" onClick={closeModal}><i className="fa-solid fa-xmark"></i></button>
          </div>
          <ProgressBar percent={progress} status={taskStatus === 'downloading' ? 'Downloading...' : taskStatus} />
          <Terminal logs={logs} />
        </div>
      </div>

      <div className="app-container">
        <header>
          <div className="logo">
            <i className="fa-brands fa-youtube"></i>
            <span>YT Downloader</span>
          </div>
        </header>

        <main>
          <div className="search-section">
            <h1>Download Video & Audio</h1>
            <p>Paste a YouTube link to get started</p>

            <div className="input-group">
              <input
                type="text"
                placeholder="Paste link here..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button className="primary-btn" onClick={fetchInfo}>
                <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>

          {loading && (
            <div className="loader" id="loading"></div>
          )}

          {error && (
            <div id="error-message">
              {error}
            </div>
          )}

          {result && (
            <div className="video-card">
              <img id="thumb" src={result.thumbnail} alt="Thumbnail" />
              <div className="info">
                <h2>{result.title}</h2>
                <p>{result.uploader} • {Math.floor(result.duration / 60)}:{String(result.duration % 60).padStart(2, '0')}</p>

                <div className="download-options">
                  <h3>Available Formats</h3>
                  <div className="formats-grid">
                    {result.formats.map((f: any, i: number) => (
                      <div key={i} className="format-btn" onClick={() => startDownload(f.format_id)}>
                        <span className="res">{f.resolution}</span>
                        <span className="size">
                          {f.filesize ? (f.filesize / 1024 / 1024).toFixed(1) + ' MB' : f.note}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
