const fs = require('fs');
const path = require('path');
const lockPath = path.resolve(__dirname, '../package-lock.json');
const data = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const matches = [];
for (const [key, pkg] of Object.entries(data.packages || {})) {
  const version = pkg.version;
  if (typeof version === 'string' && version.trim() === '') {
    matches.push(key || '<root>');
  }
}
if (matches.length) {
  console.log(matches.join('\n'));
} else {
  console.log('none');
}
