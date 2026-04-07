const fs = require('fs');
const path = require('path');

async function fetchRSS(url, tag) {
    try {
        const res = await fetch(url);
        const text = await res.text();
        const items = [];
        const itemRegex = /<item>[\s\S]*?<title><!\[CDATA\[(.*?)\]\]><\/title>[\s\S]*?<link>(.*?)<\/link>/gi;
        const itemRegexFallback = /<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>/gi;
        
        let match;
        let count = 0;
        while ((match = itemRegex.exec(text)) !== null && count < 3) {
            items.push({ tag, title: match[1], link: match[2] });
            count++;
        }
        if (items.length === 0) {
            while ((match = itemRegexFallback.exec(text)) !== null && count < 3) {
                items.push({ tag, title: match[1], link: match[2] });
                count++;
            }
        }
        return items;
    } catch (e) {
        console.error(`Error fetching RSS for ${tag}:`, e);
        return [];
    }
}

async function fetchReddit(subreddit, tag) {
    try {
        const res = await fetch(`https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=3`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (!res.ok) return [];
        const json = await res.json();
        return json.data.children.map(c => ({
            tag,
            title: c.data.title,
            link: `https://www.reddit.com${c.data.permalink}`
        }));
    } catch (e) {
        console.error(`Error fetching Reddit for ${tag}:`, e);
        return [];
    }
}

async function main() {
    console.log("Fetching real news...");
    const news = [];
    
    news.push(...await fetchRSS('https://news.google.com/rss/search?q=大角咀+OR+香港新聞&hl=zh-TW&gl=TW&ceid=TW:zh-Hant', '大角咀/香港'));
    news.push(...await fetchRSS('https://news.google.com/rss/search?q=香港+演唱會+OR+音樂節+OR+Rave&hl=zh-TW&gl=TW&ceid=TW:zh-Hant', '香港活動'));
    news.push(...await fetchRSS('https://news.google.com/rss/search?q=AI+Agent+OR+Google+Gemini+OR+OpenClaw+AI&hl=zh-TW&gl=TW&ceid=TW:zh-Hant', 'AI科技'));
    news.push(...await fetchReddit('gaming', '遊戲情報 (Reddit)'));
    news.push(...await fetchReddit('movies', '電影消息 (Reddit)'));

    if (news.length === 0) {
        console.log("No news fetched.");
        return;
    }

    const htmlCards = news.map(n => `
        <div class="news-card">
            <span class="tag">${n.tag}</span>
            <h2><a href="${n.link}" target="_blank" style="color: inherit; text-decoration: none;">${n.title}</a></h2>
        </div>
    `).join('\n');

    const htmlTemplate = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>SAD News 晨報</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: var(--tg-theme-bg-color, #ffffff); color: var(--tg-theme-text-color, #000000); margin: 0; padding: 16px; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 24px; margin: 0; color: var(--tg-theme-text-color, #000); }
        .date { font-size: 14px; color: var(--tg-theme-hint-color, #888); margin-top: 4px; }
        .news-card { background-color: var(--tg-theme-secondary-bg-color, #f0f0f0); border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .news-card h2 { font-size: 18px; margin: 0 0 8px 0; line-height: 1.4; }
        .tag { display: inline-block; background-color: var(--tg-theme-button-color, #3390ec); color: var(--tg-theme-button-text-color, #ffffff); font-size: 12px; padding: 4px 8px; border-radius: 4px; margin-bottom: 8px; }
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
    console.log("index.html updated successfully with real news.");
}

main();