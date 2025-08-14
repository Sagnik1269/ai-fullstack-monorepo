'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function Home() {
  const [input, setInput] = useState('Example requirement: As a user, I want to reset my password via email link.');
  const [result, setResult] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    axios.get(`${api}/version`)
      .then(r => setVersion(r.data?.version ?? null))
      .catch(() => setVersion(null));
  }, []);

  const generate = async () => {
    try {
      setLoading(true);
      console.log("[WEB] sending:", input);
      const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await axios.post(`${api}/generate/testcases`, { requirement: input });
      setResult(res.data.testcases || []);
      console.log("[WEB] got:", res.data);
    } catch (e) {
      console.error(e);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 860, margin: '40px auto', padding: 16, position: 'relative' }}>
      {/* corner badge */}
      {version && (
        <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 12, opacity: 0.7 }}>
          API v{version}
        </div>
      )}
      <h1>AI Test Assistant</h1>
      <textarea value={input} onChange={e => setInput(e.target.value)} rows={6} style={{ width: '100%', padding: 12 }} />
      <div style={{ marginTop: 12 }}>
        <button onClick={generate} disabled={loading || input.length<10}>
          {loading ? 'Generating…' : 'Generate test cases'}
        </button>
      </div>
      {result && (
        <div style={{ marginTop: 24 }}>
          <h2>Suggestions</h2>
          <ul>{result.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
    </main>
  );
}