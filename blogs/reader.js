import { marked } from '../vendor/marked.esm.js';

const content = document.getElementById('markdown-content');
const article = new URLSearchParams(location.search).get('article');
const files = {
  'indri-audio-tokenization': 'articles/indri-audio-tokenization.md',
  'plant-monitoring-models': 'articles/plant-monitoring-models.md'
};
const source = location.pathname.endsWith('/post.html') ? files[article] : 'README.md';

if (!source) {
  content.innerHTML = '<h1>Article not found</h1><p><a href="index.html">See all writing →</a></p>';
} else {
  try {
    const response = await fetch(source);
    if (!response.ok) throw new Error('Article could not be loaded');
    content.innerHTML = marked.parse(await response.text(), { gfm: true });
    const title = content.querySelector('h1')?.textContent;
    if (title) document.title = `${title} — Subhash Gupta P`;
    for (const link of content.querySelectorAll('a[href^="http"]')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  } catch {
    content.innerHTML = '<h1>Unable to load this article</h1><p>Please refresh the page or <a href="index.html">return to all writing</a>.</p>';
  }
}
