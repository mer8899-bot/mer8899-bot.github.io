(function () {
  'use strict';
  const list = document.getElementById('posts');
  const count = document.getElementById('postCount');

  function createPostCard(post) {
    const link = document.createElement('a');
    link.className = 'post-card';
    link.href = `post.html?id=${encodeURIComponent(post.id)}`;
    const date = document.createElement('time');
    date.className = 'post-date';
    date.dateTime = post.date;
    date.textContent = String(post.date).replace(/-/g, '.');
    const copy = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'post-title';
    title.textContent = post.title;
    const excerpt = document.createElement('p');
    excerpt.className = 'post-excerpt';
    excerpt.textContent = post.excerpt || post.content.slice(0, 96);
    copy.append(title, excerpt);
    const arrow = document.createElement('span');
    arrow.className = 'post-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';
    link.append(date, copy, arrow);
    return link;
  }

  fetch(`posts/posts.json?v=${Date.now()}`, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('load failed');
      return response.json();
    })
    .then(posts => {
      list.replaceChildren(...posts.map(createPostCard));
      count.textContent = `${posts.length} 篇`;
    })
    .catch(() => {
      list.textContent = '';
      const message = document.createElement('p');
      message.className = 'loading';
      message.textContent = '文章暂时没有打开，请稍后再来。';
      list.append(message);
    });
}());
