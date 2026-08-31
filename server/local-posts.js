const fs = require('node:fs');
const path = require('node:path');
const { buildPosts } = require('../build');

const root = path.join(__dirname, '..');
const postsDir = path.join(root, 'posts');

function persistPublishedArticle(article, { rootDir = root } = {}) {
  const targetPostsDir = path.join(rootDir, 'posts');
  fs.mkdirSync(targetPostsDir, { recursive: true });
  const destination = path.join(targetPostsDir, article.filename);
  if (!destination.startsWith(`${targetPostsDir}${path.sep}`)) {
    throw new Error('invalid article path');
  }
  fs.writeFileSync(destination, article.markdown, { encoding: 'utf8', flag: 'wx' });
  buildPosts(targetPostsDir);
  return destination;
}

module.exports = { persistPublishedArticle };
