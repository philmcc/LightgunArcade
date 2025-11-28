const fs = require('fs');
const path = require('path');
const lockPath = path.resolve(__dirname, '../package-lock.json');
const data = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const matches = [];
function walk(obj, prefix) {
  if (obj && typeof obj === 'object') {
    if (Object.prototype.hasOwnProperty.call(obj, 'version')) {
      const version = obj.version;
      if (typeof version === 'string' && version.trim() === '') {
        matches.push(prefix || '<root>');
      }
    }
    for (const key of Object.keys(obj)) {
      walk(obj[key], prefix ? `${prefix}.${key}` : key);
    }
  }
}
walk(data, '');
if (matches.length) {
  console.log(matches.join('\n'));
} else {
  console.log('none');
}
