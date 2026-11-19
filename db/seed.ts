import { seedAllData } from '../scripts/seed-supabase';

export async function runSeed() {
  await seedAllData();
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
