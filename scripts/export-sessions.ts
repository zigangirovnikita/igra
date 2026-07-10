const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const from = args.get('--from');
const to = args.get('--to');
const out = args.get('--out');

if (!from || !to || !out) {
  throw new Error('Usage: npm run export:sessions -- --from YYYY-MM-DD --to YYYY-MM-DD --out export.csv');
}

console.log(`Session export placeholder: ${from}..${to} -> ${out}. Database export is implemented in backend stage.`);
