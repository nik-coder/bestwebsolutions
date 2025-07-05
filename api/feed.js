import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

export default async function handler(req, res) {
  const FEED_URL = 'https://draxe.com/feed/?post_type=recipe';
  const TRANSLATE_API = 'https://libretranslate.de/translate';

  try {
    const feedRes = await fetch(FEED_URL);
    const xml = await feedRes.text();
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const items = [...dom.window.document.querySelectorAll('item')];

    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let results = [];

    for (const item of items.slice(0, 8)) {
      const pubDate = new Date(item.querySelector('pubDate').textContent);
      if (pubDate < first || pubDate > last) continue;

      const title = item.querySelector('title').textContent;
      const link = item.querySelector('link').textContent;

      const articleRes = await fetch(link);
      const html = await articleRes.text();
      const page = new JSDOM(html).window.document;
      const content = page.querySelector('.article-content') || page.querySelector('article');
      const image = page.querySelector('meta[property="og:image"]')?.content;

      const text = content?.textContent?.slice(0, 3000) ?? '';

      const translatedTitle = await translate(title, TRANSLATE_API);
      const translatedBody = await translate(text, TRANSLATE_API);

      results.push(`
        <article>
          <h2>${translatedTitle}</h2>
          ${image ? `<img src="${image}" style="max-width:100%"><br>` : ''}
          <p>${translatedBody}</p>
          <a href="${link}" target="_blank">Pročitaj ceo članak →</a>
        </article>
      `);
    }

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`<html><body style="font-family:sans-serif; max-width:800px; margin:auto;">${results.join("<hr>")}</body></html>`);
  } catch (err) {
    res.status(500).send('Greška: ' + err.message);
  }
}

async function translate(text, api) {
  const response = await fetch(api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source: 'en', target: 'sr', format: 'text' })
  });
  const json = await response.json();
  return json.translatedText;
}
