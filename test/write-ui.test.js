const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const writeDir = path.join(__dirname, '..', 'write');
const html = fs.readFileSync(path.join(writeDir, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(writeDir, 'app.js'), 'utf8');
const clientSource = [
  html,
  app,
  fs.readFileSync(path.join(writeDir, 'config.js'), 'utf8')
].join('\n');

test('writer UI contains the essential author states', () => {
  assert.match(html, /私人写作入口/);
  assert.match(html, /使用 GitHub 登录/);
  assert.match(html, /id="title"/);
  assert.match(html, /id="content"/);
  assert.match(html, /id="publishButton"/);
});

test('draft is cleared only in the successful publish path', () => {
  const requestIndex = app.indexOf("fetch(apiUrl('/api/publish')");
  const responseCheckIndex = app.indexOf('if (!response.ok)', requestIndex);
  const clearIndex = app.indexOf('localStorage.removeItem', responseCheckIndex);
  assert.ok(requestIndex > -1);
  assert.ok(responseCheckIndex > requestIndex);
  assert.ok(clearIndex > responseCheckIndex);
});

test('public writer files do not contain server secret names', () => {
  for (const secretName of [
    'GITHUB_APP_PRIVATE_KEY',
    'GITHUB_CLIENT_SECRET',
    'SESSION_SECRET'
  ]) {
    assert.doesNotMatch(clientSource, new RegExp(secretName));
  }
});
