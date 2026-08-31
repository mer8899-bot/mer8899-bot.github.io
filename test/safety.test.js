const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('production publishing files remain present', () => {
  for (const relativePath of [
    '.github/workflows/build.yml',
    'build.js',
    'editor.js',
    'index.html',
    'posts/posts.json'
  ]) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), true, relativePath);
  }
});

test('example environment file contains names, not assigned secrets', () => {
  const source = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  for (const name of [
    'GITHUB_APP_PRIVATE_KEY',
    'GITHUB_CLIENT_SECRET',
    'SESSION_SECRET'
  ]) {
    assert.match(source, new RegExp(`^${name}=$`, 'm'));
  }
});
