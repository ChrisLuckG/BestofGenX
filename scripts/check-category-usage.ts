// How many articles sit on each dynamic category? Run before removing one -
// deleting a Category row does NOT move the articles that reference its slug,
// they would keep a slug with no matching option in any dropdown.
import fs from 'fs';
import mongoose from 'mongoose';

function readMongoUri(): string {
  const env = fs.readFileSync('.env.local', 'utf8').replace(/^\uFEFF/, '');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*MONGODB_URI\s*=\s*(.*)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('MONGODB_URI not found in .env.local');
}

async function main() {
  await mongoose.connect(readMongoUri());
  const articles = mongoose.connection.collection('articles');
  const cats = mongoose.connection.collection('categories');

  const rows = (await cats.find({}).sort({ createdAt: 1 }).toArray()) as unknown as {
    slug: string;
    label: string;
  }[];

  console.log(`${rows.length} dynamic category row(s):\n`);
  for (const c of rows) {
    const n = await articles.countDocuments({ category: c.slug });
    console.log(`  ${c.slug.padEnd(14)} ${String(n).padStart(4)} article(s)   label=${JSON.stringify(c.label)}`);
  }

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
