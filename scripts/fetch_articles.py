#!/usr/bin/env python3
"""抓取经济学人各版块官方 RSS，生成 data/articles.json。

仅保存 RSS 公开的标题、摘要、日期和原文链接，不抓取付费正文。
每天由 GitHub Actions 定时运行，有新文章才提交。
"""
import html
import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

FEEDS = {
    'leaders': '社论',
    'briefing': '深度报道',
    'business': '商业',
    'finance-economics': '金融经济',
    'science-and-technology': '科技',
    'china': '中国',
    'united-states': '美国',
    'europe': '欧洲',
    'asia': '亚洲',
    'middle-east-and-africa': '中东与非洲',
    'international': '国际',
    'culture': '文化',
    'books-and-arts': '书籍与艺术',
}

MAX_ARTICLES = 60
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}


def strip_html(text):
    text = re.sub(r'<[^>]+>', ' ', text or '')
    return re.sub(r'\s+', ' ', html.unescape(text)).strip()


def fetch_feed(section):
    url = f'https://www.economist.com/{section}/rss.xml'
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return ET.parse(resp).getroot()


def parse_items(root, section):
    items = []
    for item in root.iter('item'):
        title = (item.findtext('title') or '').strip()
        link = (item.findtext('link') or '').strip()
        summary = strip_html(item.findtext('description'))
        if not title or not link or not summary:
            continue
        try:
            date = parsedate_to_datetime(item.findtext('pubDate'))
        except (TypeError, ValueError):
            continue
        items.append({
            'title': title,
            'summary': summary,
            'link': link,
            'section': FEEDS[section],
            'date': date.astimezone(timezone.utc).strftime('%Y-%m-%d'),
        })
    return items


def main():
    articles = {}
    for section in FEEDS:
        try:
            for a in parse_items(fetch_feed(section), section):
                articles.setdefault(a['link'], a)
        except Exception as e:
            print(f'[跳过] {section}: {e}')

    result = sorted(articles.values(), key=lambda a: a['date'], reverse=True)[:MAX_ARTICLES]
    out = {
        'updated': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC'),
        'articles': result,
    }
    with open('data/articles.json', 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f'共 {len(result)} 篇文章，最新日期: {result[0]["date"] if result else "无"}')


if __name__ == '__main__':
    main()
