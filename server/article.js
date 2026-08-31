const { randomToken } = require('./security');

const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 100000;

function validateArticle(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('文章格式不正确');
  }
  const title = String(input.title || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const content = String(input.content || '').replace(/\r\n?/g, '\n').trim();
  if (!title) throw new TypeError('请先写标题');
  if (!content) throw new TypeError('正文还是空的');
  if (title.length > MAX_TITLE_LENGTH) throw new TypeError(`标题不能超过 ${MAX_TITLE_LENGTH} 个字`);
  if (content.length > MAX_CONTENT_LENGTH) throw new TypeError('正文太长，请分成两篇发布');
  if (title.includes('\0') || content.includes('\0')) throw new TypeError('文章包含无法保存的字符');
  return { title, content };
}

function createArticle(input, { now = () => new Date(), unique = () => randomToken(5) } = {}) {
  const { title, content } = validateArticle(input);
  const timestamp = now();
  const date = [
    timestamp.getFullYear(),
    String(timestamp.getMonth() + 1).padStart(2, '0'),
    String(timestamp.getDate()).padStart(2, '0')
  ].join('-');
  const time = [timestamp.getHours(), timestamp.getMinutes(), timestamp.getSeconds()]
    .map(value => String(value).padStart(2, '0'))
    .join('');
  const safeUnique = unique().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'post';
  const filename = `${date}-${time}-${safeUnique}.md`;
  const markdown = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `date: ${date}`,
    'type: thought',
    '---',
    '',
    content,
    ''
  ].join('\n');

  return { title, content, date, filename, path: `posts/${filename}`, markdown };
}

module.exports = { MAX_CONTENT_LENGTH, MAX_TITLE_LENGTH, createArticle, validateArticle };
