#!/bin/bash

# 進入專案目錄
cd /Users/sadmca/.openclaw/workspace/projects/news-mini-app

# 執行新聞抓取與 HTML 產生腳本
node fetch_news.js

# 自動提交並推送到 GitHub
git add .
git commit -m "Automated daily news update: $(date +'%Y-%m-%d %H:%M:%S')"
git push origin main
