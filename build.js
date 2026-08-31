const fs = require('fs');
const path = require('path');

const postsDir = './posts';

function parseMetaValue(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return value;
    }
  }
  return value;
}

const files = fs.readdirSync(postsDir)
  .filter(f => f.endsWith('.md'))
  .sort()
  .reverse();

const posts = files.map(filename => {
  const raw = fs.readFileSync(path.join(postsDir, filename), 'utf-8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta = {};
  let body = raw;

  if (match) {
    match[1].split('\n').forEach(line => {
      const colonIdx = line.indexOf(':');
      if (colonIdx > -1) {
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        meta[key] = parseMetaValue(val);
      }
    });
    body = match[2].trim();
  }

  return {
    id: filename.replace(/\.md$/, ''),
    title: meta.title || filename.replace('.md', ''),
    date: meta.date || filename.replace('.md', ''),
    type: meta.type || 'thought',
    excerpt: body.replace(/[#>*_`\[\]-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 96),
    content: body
  };
});

fs.writeFileSync(
  path.join(postsDir, 'posts.json'),
  JSON.stringify(posts, null, 2),
  'utf-8'
);

console.log(`✓ 生成完毕，共 ${posts.length} 篇文章`);
