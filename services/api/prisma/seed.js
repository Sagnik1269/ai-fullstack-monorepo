// What: Inserts starter data. Why: So endpoints have rows to return.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Categories
  const catNames = ['Dining','Groceries','Subscriptions','Shopping','Transport','Savings','Uncategorized'];
  const cats = {};
  for (const name of catNames) {
    const c = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
    cats[name] = c.id;
  }

  // Account
  const acc = await prisma.account.upsert({
    where: { name: 'My Checking' },
    update: {},
    create: { name: 'My Checking', type: 'checking' }
  });

  // Salary
  await prisma.salary.upsert({
    where: { id: (await prisma.salary.findFirst({ where: { active: true } }))?.id || 'seed' },
    update: { amount: 5000.00, cadence: 'monthly', active: true },
    create: { amount: 5000.00, cadence: 'monthly', active: true }
  });

  // Transactions (this month)
  const month = new Date();
  const y = month.getUTCFullYear(), m = String(month.getUTCMonth()+1).padStart(2,'0');
  const d = (day)=> new Date(`${y}-${m}-${String(day).padStart(2,'0')}T12:00:00Z`);

  const rows = [
    { date: d(1), amount: 24.99, merchant: 'Spotify', categoryId: cats['Subscriptions'] },
    { date: d(2), amount: 58.40, merchant: 'Uber Eats', categoryId: cats['Dining'] },
    { date: d(3), amount: 189.00, merchant: 'Costco', categoryId: cats['Groceries'] },
    { date: d(4), amount: 75.00, merchant: 'Target', categoryId: cats['Shopping'] },
    { date: d(5), amount: 0.00, merchant: 'Auto-Save', categoryId: cats['Savings'] }
  ];

  for (const r of rows) {
    await prisma.transaction.create({
      data: { accountId: acc.id, date: r.date, amount: r.amount, merchant: r.merchant, categoryId: r.categoryId }
    });
  }

  console.log('Seeded ✔');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());