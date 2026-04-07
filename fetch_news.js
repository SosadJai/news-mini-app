const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const parser = new Parser({
    customFields: {
        item: ['media:content', 'description', 'source']
    },
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SAD_News_Bot/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml'
    }
});

function extractImage(item) {
    if (item['media:content'] && item['media:content']['$'] && item['media:content']['$']['url']) {
        return item['media:content']['$']['url'];
    }
    const htmlContent = item.content || item.description || item.contentSnippet || '';
    const imgMatch = htmlContent.match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch) {
        return imgMatch[1];
    }
    return null;
}

function getSource(item, defaultSource) {
    if (item.source) return item.source;
    try {
        const url = new URL(item.link);
        return url.hostname.replace('www.', '');
    } catch(e) {
        return defaultSource;
    }
}

async function fetchGoogleNews(query, tag) {
    try {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
        const feed = await parser.parseURL(url);
        return feed.items.slice(0, 3).map(item => ({
            tag,
            title: item.title,
            link: item.link,
            source: getSource(item, 'Google News'),
            image: extractImage(item)
        }));
    } catch (e) {
        console.error(`Google News Error (${tag}):`, e.message);
        return [{ tag, title: `⚠️ 無法取得 ${tag} 新聞`, link: '#', source: '系統通知', error: true }];
    }
}

async function fetchGamingMovies() {
    try {
        const gamingFeed = await fetchGoogleNews('電子遊戲 OR 電競 OR 遊戲主機', '遊戲情報');
        const moviesFeed = await fetchGoogleNews('電影消息 OR 新片上映 OR 電影節', '電影消息');
        return [...gamingFeed, ...moviesFeed];
    } catch (e) {
        console.error(`Gaming/Movies Error:`, e.message);
        return [{ tag: '娛樂情報', title: `⚠️ 無法取得遊戲與電影資訊`, link: '#', source: '系統通知', error: true }];
    }
}

async function main() {
    console.log("Fetching real news with images and sources...");
    const news = [];
    
    const results = await Promise.all([
        fetchGoogleNews('大角咀 OR 香港新聞', '大角咀/香港'),
        fetchGoogleNews('香港 (演唱會 OR 音樂節 OR Rave Party)', '香港活動'),
        fetchGoogleNews('AI Agent OR Google Gemini OR OpenClaw', 'AI科技'),
        fetchGamingMovies()
    ]);

    results.forEach(res => news.push(...res));

    const htmlCards = news.map(n => {
        const imgHtml = n.image && !n.error ? `<img src="${n.image}" alt="cover" style="width:100%; border-radius:8px; margin-bottom:12px; object-fit: cover; max-height: 200px;">` : '';
        const sourceHtml = `<div style="font-size:12px; color:var(--tg-theme-hint-color, #888); margin-top:8px;">🗞️ 來源: ${n.source}</div>`;
        return `
        <div class="news-card">
            <span class="tag">${n.tag}</span>
            ${imgHtml}
            <h2><a href="${n.link}" target="_blank" style="color: inherit; text-decoration: none;">${n.title}</a></h2>
            ${sourceHtml}
        </div>
        `;
    }).join('\n');

    const htmlTemplate = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>SAD News 晨報</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: var(--tg-theme-bg-color, #ffffff); color: var(--tg-theme-text-color, #000000); margin: 0; padding: 16px; transition: all 0.3s; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 24px; margin: 0; color: var(--tg-theme-text-color, #000); }
        .date { font-size: 14px; color: var(--tg-theme-hint-color, #888); margin-top: 4px; }
        .news-card { background-color: var(--tg-theme-secondary-bg-color, #f0f0f0); border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .news-card h2 { font-size: 16px; margin: 0 0 8px 0; line-height: 1.4; }
        .tag { display: inline-block; background-color: var(--tg-theme-button-color, #3390ec); color: var(--tg-theme-button-text-color, #ffffff); font-size: 12px; padding: 4px 8px; border-radius: 4px; margin-bottom: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>SAD News 晨報</h1>
        <div class="date" id="dateDisplay">載入中...</div>
    </div>
    <div id="newsContainer">
        ${htmlCards}
    </div>
    <script>
        const tg = window.Telegram.WebApp;
        tg.expand();
        const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
        document.getElementById('dateDisplay').textContent = new Date().toLocaleDateString('zh-TW', options);
        tg.ready();
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(__dirname, 'index.html'), htmlTemplate);
    console.log("index.html updated successfully with real news, images, and sources.");
}

main();