import { useState, useRef, useCallback } from 'react';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwOnch7in0KD4ktQVGZW-XLhyw2Va8DT2sgqhghpRlxrKkruUDYcrhQlYo9kcAnmNI-/exec';

async function resizeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 1600;
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height / width) * maxSize);
            width = maxSize;
          } else {
            width = Math.round((width / height) * maxSize);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
        resolve({ data, mediaType: 'image/jpeg' });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function SophiaWords() {
  const [phase, setPhase] = useState('upload');
  const [pairs, setPairs] = useState([]);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [addedCount, setAddedCount] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const processImages = useCallback(async (files) => {
    setTotal(files.length);
    setProcessed(0);
    setPhase('processing');

    const allPairs = [];
    let idCounter = 0;

    for (const file of files) {
      try {
        const image = await resizeImage(file);
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image }),
        });
        const data = await res.json();
        if (Array.isArray(data.pairs)) {
          data.pairs.forEach((p) => {
            if (p.source_word && p.target_word) {
              allPairs.push({ id: idCounter++, source_word: p.source_word, target_word: p.target_word });
            }
          });
        }
      } catch {
        // continue with next image
      }
      setProcessed((n) => n + 1);
    }

    if (allPairs.length === 0) {
      allPairs.push({ id: idCounter++, source_word: '', target_word: '' });
    }

    setPairs(allPairs);
    setPhase('review');
  }, []);

  const handleFiles = (files) => {
    const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (images.length) processImages(images);
  };

  const updatePair = (id, field, value) =>
    setPairs((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const deletePair = (id) =>
    setPairs((prev) => prev.filter((p) => p.id !== id));

  const addRow = () =>
    setPairs((prev) => [...prev, { id: Date.now(), source_word: '', target_word: '' }]);

  const savePairs = async () => {
    const valid = pairs.filter((p) => p.source_word.trim() && p.target_word.trim());
    if (!valid.length) return;
    setPhase('saving');
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'addWords',
          words: valid.map((p) => ({ source_word: p.source_word.trim(), target_word: p.target_word.trim() })),
          source_lang: 'es',
          target_lang: 'de',
          source: 'ocr',
        }),
      });
      const data = await res.json();
      setAddedCount(data.added ?? valid.length);
      setPhase('done');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  };

  const reset = () => {
    setPairs([]);
    setProcessed(0);
    setTotal(0);
    setError('');
    setPhase('upload');
  };

  // ── Processing ──────────────────────────────────────────────
  if (phase === 'processing') {
    return (
      <div style={s.page}>
        <div style={s.centerCard}>
          <div style={s.spinner} />
          <p style={s.processingText}>
            Scanning image {processed + 1} of {total}…
          </p>
        </div>
      </div>
    );
  }

  // ── Review / Saving ─────────────────────────────────────────
  if (phase === 'review' || phase === 'saving') {
    const validCount = pairs.filter((p) => p.source_word.trim() && p.target_word.trim()).length;
    return (
      <div style={s.page}>
        <div style={s.topBar}>
          <span style={s.logo}>SophiaWords</span>
          <button style={s.ghostBtn} onClick={reset}>✕ Start over</button>
        </div>
        <p style={s.subtitle}>Review and edit before saving</p>

        <div style={s.table}>
          <div style={s.tableHead}>
            <span style={s.colLabel}>Spanish</span>
            <span style={s.colLabel}>German</span>
            <span style={{ width: 32 }} />
          </div>

          {pairs.map((pair) => (
            <div key={pair.id} style={s.tableRow}>
              <input
                style={s.cellInput}
                value={pair.source_word}
                onChange={(e) => updatePair(pair.id, 'source_word', e.target.value)}
                placeholder="Spanish"
              />
              <input
                style={s.cellInput}
                value={pair.target_word}
                onChange={(e) => updatePair(pair.id, 'target_word', e.target.value)}
                placeholder="German"
              />
              <button style={s.deleteBtn} onClick={() => deletePair(pair.id)}>✕</button>
            </div>
          ))}

          <button style={s.addRowBtn} onClick={addRow}>+ Add row</button>
        </div>

        <button
          style={{ ...s.primaryBtn, opacity: validCount === 0 || phase === 'saving' ? 0.5 : 1 }}
          disabled={validCount === 0 || phase === 'saving'}
          onClick={savePairs}
        >
          {phase === 'saving' ? 'Saving…' : `Add ${validCount} word${validCount !== 1 ? 's' : ''} to database`}
        </button>
      </div>
    );
  }

  // ── Done ────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <div style={s.page}>
        <div style={s.centerCard}>
          <div style={s.bigEmoji}>🎉</div>
          <h2 style={s.doneTitle}>{addedCount} word{addedCount !== 1 ? 's' : ''} added!</h2>
          <p style={s.doneSubtitle}>Sophia can practice them in SophiaLingo</p>
          <button style={s.primaryBtn} onClick={reset}>Add more words</button>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div style={s.page}>
        <div style={s.centerCard}>
          <div style={s.bigEmoji}>😵</div>
          <h2 style={s.doneTitle}>Something went wrong</h2>
          <p style={s.doneSubtitle}>{error}</p>
          <button style={s.primaryBtn} onClick={reset}>Try again</button>
        </div>
      </div>
    );
  }

  // ── Upload (default) ────────────────────────────────────────
  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <span style={s.logo}>SophiaWords</span>
      </div>
      <p style={s.subtitle}>Add Spanish → German word pairs via photo</p>

      <div
        style={s.dropZone}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <div style={s.uploadIcon}>📷</div>
        <p style={s.uploadTitle}>Tap to select images</p>
        <p style={s.uploadHint}>One or multiple — handwritten notes, books, screenshots</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div style={s.orDivider}>or</div>

      <button
        style={s.outlineBtn}
        onClick={() => {
          setPairs([{ id: 0, source_word: '', target_word: '' }]);
          setPhase('review');
        }}
      >
        Add words manually
      </button>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #F5F0E8 0%, #EDE6DA 50%, #E8DFD0 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: '24px 20px 48px',
    fontFamily: '"DM Sans", sans-serif',
    color: '#3D3229',
    maxWidth: '440px',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: {
    fontSize: 22,
    fontWeight: 700,
    color: '#3D3229',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    fontSize: 14,
    color: '#8A7F72',
    margin: '0 0 28px',
  },
  dropZone: {
    background: '#FFFFFF88',
    border: '2px dashed #C8BFB5',
    borderRadius: 16,
    padding: '40px 24px',
    textAlign: 'center',
    cursor: 'pointer',
    marginBottom: 20,
    transition: 'border-color 0.15s',
  },
  uploadIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: 600,
    margin: '0 0 8px',
    color: '#3D3229',
  },
  uploadHint: {
    fontSize: 13,
    color: '#8A7F72',
    margin: 0,
  },
  orDivider: {
    textAlign: 'center',
    color: '#A09890',
    fontSize: 13,
    margin: '4px 0 16px',
  },
  outlineBtn: {
    width: '100%',
    padding: '14px',
    borderRadius: 10,
    border: '2px solid #E8734A',
    background: 'transparent',
    color: '#E8734A',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
  },
  primaryBtn: {
    width: '100%',
    padding: '16px',
    borderRadius: 10,
    border: 'none',
    background: '#E8734A',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 16,
    fontFamily: '"DM Sans", sans-serif',
  },
  ghostBtn: {
    background: 'none',
    border: 'none',
    color: '#A09890',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: '"DM Sans", sans-serif',
    padding: 0,
  },
  centerCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    textAlign: 'center',
    gap: 12,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #E8D8CC',
    borderTop: '3px solid #E8734A',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  processingText: {
    fontSize: 15,
    color: '#8A7F72',
    margin: 0,
  },
  bigEmoji: {
    fontSize: 52,
    lineHeight: 1,
  },
  doneTitle: {
    fontSize: 22,
    fontWeight: 700,
    margin: '4px 0 0',
    color: '#3D3229',
  },
  doneSubtitle: {
    fontSize: 14,
    color: '#8A7F72',
    margin: 0,
  },
  table: {
    background: '#FFFFFFAA',
    borderRadius: 14,
    padding: '12px 12px 8px',
    marginBottom: 4,
  },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 32px',
    gap: 8,
    marginBottom: 8,
    padding: '0 4px',
  },
  colLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#A09890',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 32px',
    gap: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  cellInput: {
    padding: '9px 10px',
    borderRadius: 8,
    border: '1.5px solid #DDD5CB',
    background: '#FDFAF7',
    fontSize: 14,
    color: '#3D3229',
    fontFamily: '"DM Sans", sans-serif',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#C8BFB5',
    fontSize: 14,
    cursor: 'pointer',
    padding: 4,
    lineHeight: 1,
    fontFamily: '"DM Sans", sans-serif',
  },
  addRowBtn: {
    background: 'none',
    border: 'none',
    color: '#E8734A',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 4px 8px',
    fontFamily: '"DM Sans", sans-serif',
  },
};
