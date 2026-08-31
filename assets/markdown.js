(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ShenlanMarkdown = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }
  function inline(value) {
    const code = [];
    let safe = escapeHtml(value).replace(/`([^`]+)`/g, (_match, content) => {
      code.push(`<code>${content}</code>`);
      return `@@CODE${code.length - 1}@@`;
    });
    safe = safe
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
    return safe.replace(/@@CODE(\d+)@@/g, (_match, index) => code[Number(index)]);
  }
  function renderMarkdown(source) {
    const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
    const html = [];
    let paragraph = [], listType = '', quote = [], inCode = false, codeLines = [];
    function flushParagraph() {
      if (paragraph.length) html.push(`<p>${inline(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`);
      paragraph = [];
    }
    function flushList() { if (listType) html.push(`</${listType}>`); listType = ''; }
    function flushQuote() {
      if (quote.length) html.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
      quote = [];
    }
    for (const line of lines) {
      if (/^```/.test(line)) {
        flushParagraph(); flushList(); flushQuote();
        if (inCode) { html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`); codeLines = []; }
        inCode = !inCode; continue;
      }
      if (inCode) { codeLines.push(line); continue; }
      if (!line.trim()) { flushParagraph(); flushList(); flushQuote(); continue; }
      const heading = line.match(/^(#{2,3})\s+(.+)$/);
      if (heading) {
        flushParagraph(); flushList(); flushQuote();
        const level = heading[1].length;
        html.push(`<h${level}>${inline(heading[2])}</h${level}>`); continue;
      }
      const quoted = line.match(/^>\s?(.*)$/);
      if (quoted) { flushParagraph(); flushList(); quote.push(quoted[1]); continue; }
      const unordered = line.match(/^[-*]\s+(.+)$/);
      const ordered = line.match(/^\d+[.)]\s+(.+)$/);
      if (unordered || ordered) {
        flushParagraph(); flushQuote();
        const nextType = unordered ? 'ul' : 'ol';
        if (listType && listType !== nextType) flushList();
        if (!listType) { listType = nextType; html.push(`<${listType}>`); }
        html.push(`<li>${inline((unordered || ordered)[1])}</li>`); continue;
      }
      flushList(); flushQuote(); paragraph.push(line);
    }
    if (inCode) html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
    flushParagraph(); flushList(); flushQuote();
    return html.join('\n');
  }
  return { escapeHtml, renderMarkdown };
}));
