import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { z } from 'zod';
import spend from './routes/spend';



dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use('/spend', spend);

const PORT = process.env.PORT || 4000;
const LLM_URL = process.env.LLM_URL || 'http://localhost:8000';

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.get('/version', (_req, res) => res.json({ version: "0.1.0" }));

const GenSchema = z.object({ requirement: z.string().min(10) });

app.post('/generate/testcases', async (req, res) => {
    console.log("[API] incoming:", req.body?.requirement?.slice(0,60));
    
  const parse = GenSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  try {
    const r = await axios.post(`${LLM_URL}/generate/testcases`, { requirement: parse.data.requirement });
    console.log("[API] llm responded:", r.data);
    res.json(r.data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'LLM service failed' });
  }
});



app.listen(Number(PORT), () => console.log(`API listening on ${PORT}`));