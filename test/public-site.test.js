const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { renderMarkdown } = require('../assets/markdown');

const root = path.join(__dirname, '..');

test('Markdown renderer keeps author HTML inert', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)>\n\n**安全的强调**');
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.match(html, /<strong>安全的强调<\/strong>/);
});

test('generated post index includes stable ids and excerpts', () => {
  const posts = JSON.parse(fs.readFileSync(path.join(root, 'posts', 'posts.json'), 'utf8'));
  for (const post of posts) {
    assert.match(post.id, /^\d{4}-\d{2}-\d{2}/);
    assert.equal(typeof post.excerpt, 'string');
    assert.ok(post.excerpt.length <= 96);
  }
});
