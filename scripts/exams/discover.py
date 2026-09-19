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


def download(url, max_bytes=MAX_BYTES):
    with requests.get(url, headers=HEADERS, timeout=(15, 60), stream=True) as r:
        r.raise_for_status()
        parts, total = [], 0
        for part in r.iter_content(65536):
            total += len(part)
            if total > max_bytes:
                raise ValueError(f'Source exceeds {max_bytes // 1024 // 1024} MiB limit')
            parts.append(part)
        return b''.join(parts), r.url


def save_page(item):
    url, title = item
    key = hashlib.sha256(url.encode()).hexdigest()[:20]
    try:
        cached = OUT / (key + '.html')
        if cached.exists():
            data, final = cached.read_bytes(), url
        else:
            data, final = download(url)
        (OUT / (key + '.html')).write_bytes(data)
        soup = BeautifulSoup(data, 'html.parser')
        links = []
        for el in soup.select('a[href], iframe[src], embed[src], object[data]'):
            link = urljoin(final, el.get('href') or el.get('src') or el.get('data'))
            if any(ext in link.lower() for ext in ['.pdf', '.docx', '.zip', 'drive.google.com', '.mp3', 'download']):
                links.append({'url': link, 'label': el.get_text(' ', strip=True)[:250]})
        # Some PDF viewers store the public resource in data attributes/shortcodes.
        for match in re.findall(r'https?[^\s<>\"\']+\.pdf(?:\?[^\s<>\"\']*)?', str(soup)):
            link = match.replace('&amp;', '&')
            if link not in {x['url'] for x in links}:
                links.append({'url': link, 'label': 'PDF viewer resource'})
        return {'url': url, 'final_url': final, 'title': title, 'file': key + '.html',
                'sha256': hashlib.sha256(data).hexdigest(), 'links': links}
    except Exception as exc:
        return {'url': url, 'title': title, 'error': str(exc)}
    finally:
        time.sleep(.4)


def main():
    candidates, discoveries, errors = {}, [], []
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
                            and ('10' in s or 'tuyen-sinh' in s or 'chuyen-anh' in s or 'chuyen-tieng-anh' in s)
                            and not any(x in s for x in ['thi thử', 'thi-thu', 'đề luyện', 'de-luyen', 'essay', 'bài mẫu', 'hsg', 'olympic', 'khao-sat'])):
                        candidates[post['link']] = title
                print(site, page, len(posts), 'candidates', len(candidates), flush=True)
                if len(posts) < 100:
                    break
                time.sleep(1)
            except Exception as exc:
                errors.append({'url': url, 'error': str(exc)})
                print(site, type(exc).__name__, str(exc), flush=True)
                break
    seeds = [
        'https://springboard.vn/de-thi-chuyen-anh-vao-10-2025-2026/',
        'https://springboard.vn/tuyen-tap-de-thi-chinh-thuc-chuyen-anh-2026/',
        'https://thuvienhoclieu.com/de-tuyen-sinh-lop-10-chuyen-tieng-anh-chuyen-so-gd-quang-nam-2022-2023-co-dap-an/',
        'https://thuvienhoclieu.com/de-tuyen-sinh-10-tieng-anh-chuyen-so-gd-quang-nam-2023-2024-co-dap-an/',
        'https://thuvienhoclieu.com/de-tuyen-sinh-10-mon-anh-chuyen-quang-nam-2024-2025-co-dap-an-file-nghe/',
    ]
    for seed in seeds:
        result = save_page((seed, 'Seed: ' + seed))
        if 'file' not in result:
            errors.append(result)
            continue
        candidates[seed] = result['title']
        soup = BeautifulSoup((OUT / result['file']).read_bytes(), 'html.parser')
        for a in soup.select('a[href]'):
            url = urljoin(seed, a['href']).split('#')[0]
            if (urlparse(url).netloc == urlparse(seed).netloc
                and re.search(r'202[2-6]', url)
                and ('chuyen-anh' in url or 'anh-chuyen' in url or 'chuyen-tieng-anh' in url)
                and not any(w in url for w in ['thi-thu', 'de-luyen', 'essay'])):
                candidates[url] = a.get_text(' ', strip=True)
    (OUT / 'errors.json').write_text(json.dumps(errors, ensure_ascii=False, indent=2))
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
            elif 'chuyen' in result['url']:
                match = re.match(r'https://drive\.google\.com/file/d/([A-Za-z0-9_-]+)', url)
                if match:
                    direct = 'https://drive.google.com/uc?export=download&id=' + match[1]
                    pdfs.setdefault(direct, []).append(result['url'])
    files = []
    for url, parents in list(pdfs.items())[:200]:
        key = hashlib.sha256(url.encode()).hexdigest()[:20]
        try:
            cached = OUT / (key + '.pdf')
            if cached.exists():
                data, final = cached.read_bytes(), url
            else:
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
    import sys
    if '--reparse' in sys.argv:
        old = json.loads((OUT / 'pages.json').read_text())
        results = [save_page((p['url'], p['title'])) for p in old]
        (OUT / 'pages.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        main()
