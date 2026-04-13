require('dotenv').config();
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { supabaseAdmin } = require('../config/supabaseClient');

const prisma = new PrismaClient();

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function buildLocation(index) {
  const row = (index % 10) + 1;
  const shelf = ((Math.floor(index / 10)) % 5) + 1;
  return `${ordinal(row)} row ${ordinal(shelf)} shelf`;
}

function makeBookSeed(index, columns) {
  const location = buildLocation(index);
  const copyCount = (index % 6) + 2;
  const payload = {};
  const nowIso = new Date().toISOString();

  if (columns.has('id')) payload.id = crypto.randomUUID();
  if (columns.has('createdAt')) payload.createdAt = nowIso;
  if (columns.has('updatedAt')) payload.updatedAt = nowIso;

  if (columns.has('isbn')) payload.isbn = `978-1-00${String(100000 + index).padStart(6, '0')}`;
  if (columns.has('title')) payload.title = `Library Collection Book ${index + 1}`;
  if (columns.has('author')) payload.author = `Author ${String.fromCharCode(65 + (index % 26))}`;
  if (columns.has('description')) payload.description = `Physical library copy located at ${location}.`;
  if (columns.has('genre')) payload.genre = ['Fiction', 'Science', 'History', 'Technology', 'Literature'][index % 5];
  if (columns.has('publisher')) payload.publisher = `OpenShelf Press ${((index % 7) + 1)}`;
  if (columns.has('edition')) payload.edition = `${(index % 3) + 1}th`;
  if (columns.has('year')) payload.year = 2005 + (index % 20);

  if (columns.has('format')) payload.format = 'physical';
  if (columns.has('isDigital')) payload.isDigital = false;
  if (columns.has('is_digital')) payload.is_digital = false;

  if (columns.has('shelf_location')) payload.shelf_location = location;
  if (columns.has('shelfLocation')) payload.shelfLocation = location;

  if (columns.has('available_copies')) payload.available_copies = copyCount;
  if (columns.has('availableCopies')) payload.availableCopies = copyCount;
  if (columns.has('physicalCount')) payload.physicalCount = copyCount;
  if (columns.has('physical_count')) payload.physical_count = copyCount;
  if (columns.has('digitalCount')) payload.digitalCount = 0;
  if (columns.has('digital_count')) payload.digital_count = 0;

  if (columns.has('is_premium')) payload.is_premium = false;
  if (columns.has('isPremium')) payload.isPremium = false;
  if (columns.has('status')) payload.status = 'AVAILABLE';

  return payload;
}

async function run() {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'books'
  `);
  const columnSet = new Set(cols.map((c) => c.column_name));

  const required = await prisma.$queryRawUnsafe(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'books'
      AND is_nullable = 'NO'
      AND column_default IS NULL
  `);

  const handled = new Set([
    'id', 'createdAt', 'updatedAt',
    'isbn', 'title', 'author', 'description', 'genre', 'publisher', 'edition', 'year',
    'format', 'isDigital', 'is_digital', 'shelf_location', 'shelfLocation',
    'available_copies', 'availableCopies', 'physicalCount', 'physical_count',
    'digitalCount', 'digital_count', 'is_premium', 'isPremium', 'status'
  ]);

  const unhandledRequired = required
    .map((r) => r.column_name)
    .filter((name) => !handled.has(name));

  if (unhandledRequired.length > 0) {
    throw new Error(`Unhandled required columns in books table: ${unhandledRequired.join(', ')}`);
  }

  const books = Array.from({ length: 100 }, (_, i) => makeBookSeed(i, columnSet));

  const { data, error } = await supabaseAdmin.from('books').insert(books).select('id');
  if (error) throw error;

  console.log(`Seeded ${data.length} physical books.`);
}

run()
  .catch((err) => {
    console.error('Failed to seed books:', err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
