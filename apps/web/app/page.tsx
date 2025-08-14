'use client';
import { useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [input, setInput] = useState('Example requirement: As a user, I want to reset my password via email link.');
  const [result, setResult] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

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
    <main style={{ maxWidth: 860, margin: '40px auto', padding: 16 }}>
      <h1>AI Test Assistant</h1>
      <textarea value={input} onChange={e => setInput(e.target.value)} rows={6} style={{ width: '100%', padding: 12 }} />
      <div style={{ marginTop: 12 }}>
        <button onClick={generate} disabled={loading}>
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