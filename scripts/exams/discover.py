#!/usr/bin/env python3
"""Download public source pages for manual review; never authenticate to source sites.

HTML and PDFs are temporary artifacts, not exam records. A discovered page is NOT
proof that an exam is official, complete, or suitable for importing.
"""
import concurrent.futures
import hashlib
import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

OUT = Path('.cache/exams')
OUT.mkdir(parents=True, exist_ok=True)
HEADERS = {'User-Agent': 'ExamArchiveResearch/1.0 (public educational sources; low concurrency)'}
MAX_BYTES = 15 * 1024 * 1024


def download(url):
    with requests.get(url, headers=HEADERS, timeout=(15, 60), stream=True) as r:
        r.raise_for_status()
        parts, total = [], 0
        for part in r.iter_content(65536):
            total += len(part)
            if total > MAX_BYTES:
                raise ValueError('Source exceeds 15 MiB limit')
            parts.append(part)
        return b''.join(parts), r.url


def save_page(item):
    url, title = item
    key = hashlib.sha256(url.encode()).hexdigest()[:20]
    try:
        data, final = download(url)
        (OUT / (key + '.html')).write_bytes(data)
        soup = BeautifulSoup(data, 'html.parser')
        links = []
        for el in soup.select('a[href], iframe[src], embed[src], object[data]'):
            link = urljoin(final, el.get('href') or el.get('src') or el.get('data'))
            if any(ext in link.lower() for ext in ['.pdf', '.docx', 'drive.google.com', '.mp3', 'download']):
                links.append({'url': link, 'label': el.get_text(' ', strip=True)[:250]})
        return {'url': url, 'final_url': final, 'title': title, 'file': key + '.html',
                'sha256': hashlib.sha256(data).hexdigest(), 'links': links}
    except Exception as exc:
        return {'url': url, 'title': title, 'error': str(exc)}
    finally:
        time.sleep(.4)


def main():
    candidates, discoveries = {}, []
    for site, query in [('springboard.vn', 'chuyên anh'),
                        ('thuvienhoclieu.com', 'anh chuyên'),
                        ('tailieudieuky.com/baiviet', 'chuyên anh')]:
        for page in range(1, 9):
            url = f'https://{site}/wp-json/wp/v2/posts'
            try:
                r = requests.get(url, headers=HEADERS, params={
                    'search': query, 'per_page': 100, 'page': page,
                    '_fields': 'id,link,title,date'}, timeout=60)
                if r.status_code == 400:
                    break
                r.raise_for_status()
                posts = r.json()
                for post in posts:
                    title = BeautifulSoup(post['title']['rendered'], 'html.parser').get_text()
                    discoveries.append({'title': title, 'url': post['link']})
                    s = (title + ' ' + post['link']).lower()
                    if (re.search(r'202[2-6]|22-23|23-24|24-25|25-26|26-27', s)
                            and ('10' in s or 'tuyen-sinh' in s)
                            and not any(x in s for x in ['thi thử', 'thi-thu', 'đề luyện', 'de-luyen', 'essay', 'bài mẫu', 'hsg'])):
                        candidates[post['link']] = title
                print(site, page, len(posts), 'candidates', len(candidates), flush=True)
                if len(posts) < 100:
                    break
                time.sleep(1)
            except Exception as exc:
                print(site, type(exc).__name__, str(exc), flush=True)
                break
    (OUT / 'discovery.json').write_text(json.dumps(discoveries, ensure_ascii=False, indent=2))
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(save_page, sorted(candidates.items())))
    (OUT / 'pages.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
    # Direct public PDFs only. Google Drive folders/login pages are logged, not bypassed.
    pdfs = {}
    for result in results:
        for link in result.get('links', []):
            url = link['url']
            if re.search(r'\.pdf(?:$|[?#])', url, re.I):
                pdfs.setdefault(url, []).append(result['url'])
    files = []
    for url, parents in list(pdfs.items())[:200]:
        key = hashlib.sha256(url.encode()).hexdigest()[:20]
        try:
            data, final = download(url)
            if not data.startswith(b'%PDF'):
                raise ValueError('Not PDF')
            (OUT / (key + '.pdf')).write_bytes(data)
            files.append({'url': url, 'parents': parents, 'file': key + '.pdf',
                          'sha256': hashlib.sha256(data).hexdigest()})
        except Exception as exc:
            files.append({'url': url, 'parents': parents, 'error': str(exc)})
        time.sleep(.5)
    (OUT / 'pdfs.json').write_text(json.dumps(files, ensure_ascii=False, indent=2))
    print('Pages:', len(results), 'PDFs:', len(files), flush=True)


if __name__ == '__main__':
    main()
