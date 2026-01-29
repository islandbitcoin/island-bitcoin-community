import { db, sqlite } from '../db';
import { achievementDefinitions } from '../db/schema';
import type { NewAchievementDefinition } from '../db/schema';

const INITIAL_ACHIEVEMENTS: NewAchievementDefinition[] = [
  { type: 'first_correct', name: 'First Correct', description: 'Answer first question correctly', criteria: { event: 'trivia:correct', condition: { field: 'streak', operator: 'gte', value: 1 } }, reward: 0 },
  { type: 'streak_5', name: '5 Streak', description: 'Get 5 correct in a row', criteria: { event: 'trivia:correct', condition: { field: 'streak', operator: 'gte', value: 5 } }, reward: 0 },
  { type: 'streak_10', name: '10 Streak', description: 'Get 10 correct in a row', criteria: { event: 'trivia:correct', condition: { field: 'streak', operator: 'gte', value: 10 } }, reward: 0 },
  { type: 'level_7', name: 'Easy Complete', description: 'Complete easy levels', criteria: { event: 'trivia:level-up', condition: { field: 'newLevel', operator: 'gte', value: 7 } }, reward: 0 },
  { type: 'level_14', name: 'Medium Complete', description: 'Complete medium levels', criteria: { event: 'trivia:level-up', condition: { field: 'newLevel', operator: 'gte', value: 14 } }, reward: 0 },
  { type: 'level_21', name: 'All Levels', description: 'Complete all levels', criteria: { event: 'trivia:level-up', condition: { field: 'newLevel', operator: 'gte', value: 21 } }, reward: 0 },
];

async function seed() {
  let inserted = 0;

  for (const def of INITIAL_ACHIEVEMENTS) {
    const existing = await db.query.achievementDefinitions.findFirst({
      where: (t, { eq }) => eq(t.type, def.type),
    });

    if (existing) {
      console.log(`Skipping "${def.type}" — already exists`);
      continue;
    }

    await db.insert(achievementDefinitions).values(def);
    inserted++;
    console.log(`Inserted "${def.type}"`);
  }

  console.log(`Seeded ${inserted} achievement definitions (${INITIAL_ACHIEVEMENTS.length - inserted} skipped)`);
  sqlite.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
