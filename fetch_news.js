const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const parser = new Parser({
    customFields: {
        item: ['media:content', 'description', 'source', 'content']
    },
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
});

function stripHtml(html) {
    if (!html) return '無詳細內容';
    return html.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
}

function extractImage(item) {
    if (item['media:content'] && item['media:content']['$'] && item['media:content']['$']['url']) {
        return item['media:content']['$']['url'];
    }
    const htmlContent = item.content || item.description || item.contentSnippet || '';
    const imgMatch = htmlContent.match(/<img[^>]+src="([^">]+)"/);
    return imgMatch ? imgMatch[1] : null;
}

async function fetchGoogleNews(query, tag) {
    try {
        const url = new URL('https://news.google.com/rss/search');
        url.searchParams.append('q', query);
        url.searchParams.append('hl', 'zh-TW');
        url.searchParams.append('gl', 'TW');
        url.searchParams.append('ceid', 'TW:zh-Hant');
        
        const feed = await parser.parseURL(url.toString());
        return feed.items.slice(0, 3).map(item => ({
            tag,
            title: item.title,
            link: item.link,
            source: item.source || new URL(item.link).hostname.replace('www.', ''),
            image: extractImage(item),
            content: stripHtml(item.content || item.description || '無詳細內容')
        }));
    } catch (e) {
        console.error(`Error fetching ${tag}:`, e.message);
        return [{ tag, title: `⚠️ 無法取得 ${tag} 資訊`, content: '連線中斷', error: true }];
    }
}

async function main() {
    console.log("Fetching real news with robust URL encoding...");
    const news = [];
    
    // 將所有搜尋主題整合進 fetchGoogleNews
    const results = await Promise.all([
        fetchGoogleNews('大角咀 OR 香港新聞', '大角咀/香港'),
        fetchGoogleNews('香港 (演唱會 OR 音樂節 OR Rave Party)', '香港活動'),
        fetchGoogleNews('AI Agent OR Google Gemini OR OpenClaw', 'AI科技'),
        fetchGoogleNews('熱門電子遊戲', '遊戲情報'),
        fetchGoogleNews('最新電影消息', '電影消息')
    ]);

    results.forEach(res => news.push(...res));

    const groupedNews = news.reduce((acc, n) => {
        if (!acc[n.tag]) acc[n.tag] = [];
        acc[n.tag].push(n);
        return acc;
    }, {});

    let tabsHtml = '';
    let sectionsHtml = '';
    let first = true;
    for (const tag in groupedNews) {
        const tabId = tag.replace(/\//g, '');
        tabsHtml += `<button class="tab-btn ${first ? 'active' : ''}" onclick="showTab('${tabId}')">${tag}</button>`;
        sectionsHtml += `
            <div id="${tabId}" class="tab-content" style="display: ${first ? 'block' : 'none'}">
                ${groupedNews[tag].map(n => `
                    <div class="news-card" onclick="openModal('${encodeURIComponent(n.title)}', '${encodeURIComponent(n.content)}')">
                        ${n.image && !n.error ? `<img src="${n.image}" alt="cover">` : ''}
                        <h3>${n.title}</h3>
                        <div class="source">🗞️ 來源: ${n.source}</div>
                    </div>
                `).join('')}
            </div>
        `;
        first = false;
    }

    const htmlTemplate = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>SAD News</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>
        body { font-family: sans-serif; background: var(--tg-theme-bg-color); color: var(--tg-theme-text-color); margin: 0; }
        .tabs { display: flex; overflow-x: auto; background: var(--tg-theme-secondary-bg-color); padding: 8px; }
        .tab-btn { background: none; border: none; color: var(--tg-theme-text-color); padding: 10px; cursor: pointer; white-space: nowrap; }
        .tab-btn.active { border-bottom: 2px solid var(--tg-theme-button-color); }
        .news-card { background: var(--tg-theme-bg-color); border-bottom: 1px solid #ccc; padding: 16px; cursor: pointer; }
        .news-card img { width: 100%; border-radius: 8px; margin-bottom: 8px; }
        .news-card h3 { font-size: 16px; margin: 0 0 4px 0; }
        .source { font-size: 12px; color: var(--tg-theme-hint-color); }
        #modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: var(--tg-theme-bg-color); padding: 20px; box-sizing: border-box; overflow-y: auto; }
    </style>
</head>
<body>
    <div class="tabs">${tabsHtml}</div>
    <div id="newsContainer">${sectionsHtml}</div>
    <div id="modal">
        <button onclick="closeModal()">關閉</button>
        <h2 id="modalTitle"></h2>
        <div id="modalContent"></div>
    </div>
    <script>
        const tg = window.Telegram.WebApp;
        tg.expand();
        function showTab(id) {
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(id).style.display = 'block';
            event.currentTarget.classList.add('active');
        }
        function openModal(title, content) {
            document.getElementById('modalTitle').innerText = decodeURIComponent(title);
            document.getElementById('modalContent').innerText = decodeURIComponent(content);
            document.getElementById('modal').style.display = 'block';
        }
        function closeModal() { document.getElementById('modal').style.display = 'none'; }
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(__dirname, 'index.html'), htmlTemplate);
    console.log("index.html updated successfully with robust URL encoding.");
}

main();