import { Router } from 'express';
import { z } from 'zod';
import prisma from '../db/prisma';

const r = Router();

/**
 * POST /spend/salary
 * Body: { amount: number (>0), cadence: "monthly" | "biweekly" | "weekly" }
 * Upserts the active salary record.
 */
r.post('/salary', async (req, res) => {
  const S = z.object({
    amount: z.number().positive(),
    cadence: z.enum(['monthly', 'biweekly', 'weekly'])
  });

  const p = S.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error.flatten());

  const { amount, cadence } = p.data;

  const current = await prisma.salary.findFirst({ where: { active: true } });
  const s = current
    ? await prisma.salary.update({
        where: { id: current.id },
        data: { amount, cadence, active: true },
      })
    : await prisma.salary.create({
        data: { amount, cadence, active: true },
      });

  res.json(s);
});

/**
 * POST /spend/transactions/import
 * Body: {
 *   accountName: string,
 *   rows: [{ date: string(ISO or parseable), amount: number, merchant?: string, category?: string, raw?: string }]
 * }
 * Creates (or finds) the account, ensures categories exist, then inserts transactions.
 */
r.post('/transactions/import', async (req, res) => {
  const S = z.object({
    accountName: z.string().min(1),
    rows: z.array(z.object({
      date: z.string(),
      amount: z.number(),
      merchant: z.string().optional(),
      category: z.string().optional(),
      raw: z.string().optional(),
    }))
  });

  const p = S.safeParse(req.body);
  if (!p.success) return res.status(400).json(p.error.flatten());

  const { accountName, rows } = p.data;

  const account = await prisma.account.upsert({
    where: { name: accountName },
    update: {},
    create: { name: accountName, type: 'checking' }
  });

  const catCache: Record<string, string> = {};

  for (const row of rows) {
    let categoryId: string | undefined;

    if (row.category) {
      if (!catCache[row.category]) {
        const c = await prisma.category.upsert({
          where: { name: row.category },
          update: {},
          create: { name: row.category }
        });
        catCache[row.category] = c.id;
      }
      categoryId = catCache[row.category];
    }

    await prisma.transaction.create({
      data: {
        accountId: account.id,
        date: new Date(row.date),
        amount: row.amount as unknown as any, // Prisma Decimal accepts number via any cast here
        merchant: row.merchant,
        raw: row.raw,
        categoryId
      }
    });
  }

  res.json({ ok: true, inserted: rows.length });
});

/**
 * GET /spend/insights?month=YYYY-MM
 * Returns totals, category breakdown, normalized salary, and suggestions.
 */
r.get('/insights', async (req, res) => {
  const month = String(req.query.month || '').trim(); // e.g., "2025-08"
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });

  const first = new Date(`${month}-01T00:00:00Z`);
  const next = new Date(first); next.setUTCMonth(first.getUTCMonth() + 1);

  const txns = await prisma.transaction.findMany({
    where: { date: { gte: first, lt: next } },
    include: { category: true }
  });

  const salary = await prisma.salary.findFirst({ where: { active: true } });

  const totalSpend = txns.reduce((s, t) => s + Number(t.amount), 0);

  const byCat: Record<string, number> = {};
  for (const t of txns) {
    const name = t.category?.name || 'Uncategorized';
    byCat[name] = (byCat[name] || 0) + Number(t.amount);
  }

  const normalizeMonthly = (amount: number, cadence: string) => {
    if (cadence === 'monthly') return amount;
    if (cadence === 'biweekly') return amount * 26 / 12;
    if (cadence === 'weekly') return amount * 52 / 12;
    return amount;
  };

  const salaryMonthly = salary ? normalizeMonthly(Number(salary.amount), salary.cadence) : null;

  const suggestions: string[] = [];
  if (salaryMonthly) {
    const rate = totalSpend / salaryMonthly;
    if (rate > 0.9) suggestions.push('Spent >90% of income — trim variable categories by 10–20%.');
    if (rate < 0.5) suggestions.push('Great savings rate (<50%) — consider boosting investments.');
  }
  const food = (byCat['Dining'] || 0) + (byCat['Groceries'] || 0);
  if (food > totalSpend * 0.35) suggestions.push('Food >35% — meal plan; reduce delivery to 1–2/week.');
  const subs = byCat['Subscriptions'] || 0;
  if (subs > totalSpend * 0.1) suggestions.push('Subscriptions >10% — audit and cancel overlaps.');
  const shopping = byCat['Shopping'] || 0;
  if (shopping > totalSpend * 0.15) suggestions.push('Shopping >15% — add a monthly cap + 48-hour wait rule.');
  if (!byCat['Savings']) suggestions.push('No “Savings” logged — automate a transfer on payday (start 10%).');

  res.json({ month, totalSpend, byCat, salaryMonthly, suggestions });
});

/**
 * GET /spend/accounts
 * Lists accounts (for quick UI/testing).
 */
r.get('/accounts', async (_req, res) => {
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: 'desc' }
  });
  res.json(accounts);
});

/**
 * GET /spend/transactions?month=YYYY-MM
 * Lists transactions for a month (with category & account).
 */
r.get('/transactions', async (req, res) => {
  const month = String(req.query.month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });

  const first = new Date(`${month}-01T00:00:00Z`);
  const next = new Date(first); next.setUTCMonth(first.getUTCMonth() + 1);

  const txns = await prisma.transaction.findMany({
    where: { date: { gte: first, lt: next } },
    orderBy: { date: 'asc' },
    include: { category: true, account: true }
  });

  res.json(txns);
});

export default r;