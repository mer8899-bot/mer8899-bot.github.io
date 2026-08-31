(function () {
  'use strict';
  const id = new URLSearchParams(window.location.search).get('id');
  const title = document.getElementById('articleTitle');
  const date = document.getElementById('articleDate');
  const body = document.getElementById('articleBody');
  function setMeta(selector, value) {
    document.querySelector(selector).content = value;
  }
  function showMissing() {
    title.textContent = '没有找到这篇文章';
    date.textContent = '';
    body.className = 'article-body not-found';
    body.textContent = '它可能换了位置，或者还没有发布。';
  }
  fetch(`posts/posts.json?v=${Date.now()}`, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('load failed');
      return response.json();
    })
    .then(posts => {
      const post = posts.find(item => item.id === id);
      if (!post) return showMissing();
      document.title = `${post.title} · 深蓝`;
      const description = post.excerpt || post.content.slice(0, 96);
      setMeta('meta[name="description"]', description);
      setMeta('meta[property="og:title"]', post.title);
      setMeta('meta[property="og:description"]', description);
      setMeta('meta[name="twitter:title"]', post.title);
      setMeta('meta[name="twitter:description"]', description);
      title.textContent = post.title;
      date.dateTime = post.date;
      date.textContent = post.date.replace(/-/g, '.');
      body.innerHTML = window.ShenlanMarkdown.renderMarkdown(post.content);
    })
    .catch(showMissing);
}());
