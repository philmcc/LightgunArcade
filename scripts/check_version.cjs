const fs = require('fs');
const path = require('path');
const text = fs.readFileSync(path.resolve(__dirname, '../package-lock.json'), 'utf8');
const regex = /"version"\s*:\s*""/g;
let match;
let count = 0;
while ((match = regex.exec(text))) {
  const start = Math.max(0, match.index - 40);
  const end = Math.min(text.length, match.index + 60);
  console.log(text.slice(start, end));
  count++;
}
if (!count) console.log('none'); else console.log(`${count} matches`);
