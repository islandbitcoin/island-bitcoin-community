import { db, sqlite } from '../db';
import { questions } from '../db/schema';
import { TRIVIA_QUESTIONS } from './triviaQuestions';
import { sql } from 'drizzle-orm';

async function seed() {
  const [row] = await db.select({ count: sql<number>`COUNT(*)` }).from(questions);
  if (row.count > 0) {
    console.log(`Skipping seed: ${row.count} questions already exist`);
    process.exit(0);
  }

  const rows = TRIVIA_QUESTIONS.map((q) => ({
    question: q.question,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    difficulty: q.difficulty,
    category: q.category,
    level: q.level,
  }));

  await db.insert(questions).values(rows);
  console.log(`Seeded ${rows.length} questions`);
  sqlite.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
