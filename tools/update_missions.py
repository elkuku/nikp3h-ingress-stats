#!/usr/bin/env python3
"""Update mission-banners/missions-data.js (and the screenshot tiles) for index.html.

  python3 tools/update_missions.py                       # notes only, keep tiles, rows and done list
  python3 tools/update_missions.py --screenshot ingress-missions.png
  python3 tools/update_missions.py --done done-banners.json [--synced-at 2026-10-27T19:34:07Z]

--screenshot cuts the screenshot into half-size JPEG tiles (mission-banners/shot/) and finds the
y range of every medal row. The rows must still match data.js: when new medals were added at the
top, the script stops and says how many rows are new (data.js has to be updated first).

--done takes the Bannergress done list as JSON: a list, or {"member": [...]}, of objects with
bannerId (or id), title, missions, startLatitude/startLongitude (or lat/lng), doneAt and,
optionally, picture (/bnrs/pictures/…) and position (else the order of the list).

The notes come from tools/notes.json. Every run also draws the link preview image (mission-banners/preview.png)
and writes the description and image link of index.html's preview tags (Telegram, WhatsApp, …). Needs Pillow.
"""
import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat

Image.MAX_IMAGE_PIXELS = None

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'mission-banners'
OUT = SITE / 'missions-data.js'
SHOT = SITE / 'shot'
NOTES = ROOT / 'tools' / 'notes.json'
SCALE = 0.5
TILE = 1500  # tile height after scaling
PAGE = 'https://elkuku.github.io/nikp3h-ingress-stats/mission-banners/'
PREVIEW = SITE / 'preview.jpg'
FONTS = Path('/usr/share/fonts/noto')
# The SpecOps medal (unique missions completed), as in index.html
SPECOPS = [(500, 'black'), (200, 'platinum'), (100, 'gold'), (25, 'silver'), (5, 'bronze')]


def read_js(path, prefix):
    src = path.read_text(encoding='utf-8')
    start = src.index(prefix) + len(prefix)
    return json.loads(src[start:src.rindex(';')])


def load_banners():
    src = (SITE / 'data.js').read_text(encoding='utf-8')
    return json.loads(src[src.index('['):src.rindex(']') + 1])


def number(banners, banner):
    """The number the page shows: the oldest banner is #1, single missions have none ('-')."""
    if banner.get('single'):
        return '-'
    return sum(1 for b in banners[banner['i']:] if not b.get('single'))


def row_ranges(banner):
    """"13-14,211" -> [13, 14, 211]"""
    rows = []
    for part in banner['rows'].split(','):
        a, _, b = part.partition('-')
        rows.extend(range(int(a), int(b or a) + 1))
    return rows


def find_rows(im):
    """The y ranges of the medal rows: bright bands between dark gaps, below the header."""
    w, h = im.size
    band = im.convert('L').crop((80, 0, 1000, h)).resize((115, h))
    px = band.load()
    runs, y = [], 0
    while y < h:
        if max(px[x, y] for x in range(115)) >= 40:
            start = y
            while y < h and max(px[x, y] for x in range(115)) >= 40:
                y += 1
            runs.append([start, y])
        else:
            y += 1
    # The header (title, agent name, line) ends about 280 px down at 1080 px width.
    runs = [r for r in runs if r[0] > 280 * w / 1080]
    # A dark line inside a medal splits a row: join runs with a small gap that stay one row high.
    merged = []
    for a, b in runs:
        if merged and a - merged[-1][1] < 8 and b - merged[-1][0] <= 150:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return [r for r in merged if r[1] - r[0] >= 60]


def check_rows(im, rows, banners):
    """Compare each banner's medal picture (img/) with its first row in the screenshot.

    Returns the offset of the first banner (new rows at the top) and the banners that don't fit.
    """
    size = (60, 10)
    cache = {}

    def shot_row(k):
        if k not in cache:
            a, b = rows[k]
            c = (a + b) // 2
            cache[k] = im.crop((84, c - 76, 996, c + 76)).resize(size)
        return cache[k]

    def diff(x, y):
        return sum(ImageStat.Stat(ImageChops.difference(x, y)).mean) / 3

    def best(banner, around, spread):
        pic = Image.open(SITE / banner['img']).convert('RGB')
        first = pic.crop((0, 0, pic.width, pic.height // len(row_ranges(banner)))).resize(size)
        ks = range(max(0, around - spread), min(len(rows), around + spread + 1))
        scores = {k: diff(first, shot_row(k)) for k in ks}
        return min(scores, key=scores.get), scores

    first_row = row_ranges(banners[0])[0]
    k, _ = best(banners[0], first_row, 30)
    offset = k - first_row
    wrong = []
    for b in banners:
        r = row_ranges(b)[0]
        if r >= len(rows):
            wrong.append((b, 'row missing'))
            continue
        k, scores = best(b, r, 4)
        # Similar rows (a series of banners) can win by a hair; only a clear difference counts.
        if r not in scores or scores[r] > scores[k] + 2:
            wrong.append((b, f'looks like row {k}'))
    return offset, wrong


def write_tiles(im):
    half = im.resize((round(im.width * SCALE), round(im.height * SCALE)), Image.LANCZOS)
    SHOT.mkdir(exist_ok=True)
    for old in SHOT.glob('s*.jpg'):
        old.unlink()
    tiles = []
    for n, y in enumerate(range(0, half.height, TILE)):
        tile = half.crop((0, y, half.width, min(y + TILE, half.height)))
        name = f's{n:02d}.jpg'
        tile.save(SHOT / name, quality=72, optimize=True, progressive=True)
        tiles.append({'src': f'shot/{name}', 'h': tile.height})
    return {'w': im.width, 'h': im.height, 'scale': SCALE, 'tiles': tiles}


def read_done(path):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    if isinstance(data, dict):
        data = data.get('member') or data.get('hydra:member') or []
    out = []
    for n, d in enumerate(data):
        out.append({
            'id': d.get('bannerId') or d['id'],
            'title': d['title'].strip(),
            'missions': d['missions'],
            'pos': d.get('position', d.get('pos', n)),
            'lat': d.get('startLatitude', d.get('lat')),
            'lng': d.get('startLongitude', d.get('lng')),
            'doneAt': d.get('doneAt'),
            'picture': d.get('picture'),
        })
    return sorted(out, key=lambda d: d['pos'])


def font(name, size):
    try:
        return ImageFont.truetype(str(FONTS / name), size)
    except OSError:
        return ImageFont.load_default(size)


def write_preview(banners):
    """The link preview: a 1200×630 image and the description in index.html's og/twitter tags."""
    count = sum(1 for b in banners if not b.get('single'))
    missions = sum(b['count'] for b in banners)
    W, H, bg = 1200, 630, (11, 16, 15)
    im = Image.new('RGB', (W, H), bg)
    # Right: the newest banners' medals in two columns, faded into the background on the left
    x0, cw, gap = 790, 200, 8
    for c in range(2):
        y = -20 - c * 60
        for b in [b for b in banners if not b.get('single')][c::2]:
            pic = Image.open(SITE / b['img']).convert('RGB')
            pic = pic.resize((cw, round(pic.height * cw / pic.width)), Image.LANCZOS)
            im.paste(pic, (x0 + c * (cw + gap), y))
            y += pic.height + gap
            if y > H:
                break
    fade = Image.linear_gradient('L').rotate(-90).resize((160, H))  # opaque on the left
    im.paste(Image.new('RGB', (160, H), bg), (x0, 0), fade)
    d = ImageDraw.Draw(im)
    # Left: the title (the name in white, "Banners" in the page's green to blue), the counts and the medal
    title = font('NotoSans-Bold.ttf', 84)
    d.text((64, 110), "nikp3h's", font=title, fill=(228, 236, 233))
    tw, th = d.textbbox((0, 0), 'Banners', font=title)[2:]
    grad = Image.linear_gradient('L').rotate(90).resize((tw, th + 20))
    green, blue = Image.new('RGB', grad.size, (58, 209, 154)), Image.new('RGB', grad.size, (90, 162, 255))
    mask = Image.new('L', grad.size, 0)
    ImageDraw.Draw(mask).text((0, 0), 'Banners', font=title, fill=255)
    im.paste(Image.composite(blue, green, grad), (64, 215), mask)
    for k, line in enumerate(('Ingress mission banners matched with', 'Bannergress, on a map of the start points')):
        d.text((66, 345 + k * 40), line, font=font('NotoSans-Regular.ttf', 30), fill=(143, 161, 155))
    y, x = 470, 66
    for n, label in ((count, 'BANNERS'), (missions, 'MISSIONS')):
        d.text((x, y), f'{n:,}', font=font('NotoSans-Bold.ttf', 52), fill=(228, 236, 233))
        x += d.textlength(f'{n:,}', font=font('NotoSans-Bold.ttf', 52)) + 12
        d.text((x, y + 24), label, font=font('NotoSansMono-Regular.ttf', 24), fill=(143, 161, 155))
        x += d.textlength(label, font=font('NotoSansMono-Regular.ttf', 24)) + 40
    tier = next((t for n, t in SPECOPS if missions >= n), None)
    if tier:
        medal = Image.open(SITE / 'medals' / f'specops-{tier}.webp').convert('RGBA').resize((96, 96), Image.LANCZOS)
        im.paste(medal, (round(x) - 16, y - 14), medal)
        onyx = missions // SPECOPS[0][0]
        if onyx > 1:
            d.text((x + 84, y + 12), f'X {onyx}', font=font('NotoSans-Bold.ttf', 40), fill=(227, 165, 59))
    im.save(PREVIEW, quality=85, optimize=True, progressive=True)

    desc = (f'{count} Ingress mission banners and {missions:,} missions of agent nikp3h: the medals, '
            'a map of the start points and the matching Bannergress banners.')
    version = hashlib.sha1(PREVIEW.read_bytes()).hexdigest()[:8]
    page = SITE / 'index.html'
    html = page.read_text(encoding='utf-8')
    new = re.sub(r'(<meta (?:name|property)="(?:description|og:description|twitter:description)" content=")[^"]*',
                 lambda m: m.group(1) + desc, html)
    new = re.sub(r'(<meta (?:property|name)="(?:og:image|twitter:image)" content=")[^"]*',
                 lambda m: m.group(1) + f'{PAGE}{PREVIEW.name}?v={version}', new)
    if new != html:
        page.write_text(new, encoding='utf-8')
    print(f'{PREVIEW.relative_to(ROOT)}: {count} banners, {missions:,} missions')


def main():
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    p.add_argument('--screenshot', help='the mission medal screenshot (PNG, 1080 px wide)')
    p.add_argument('--done', help='the Bannergress done list as JSON')
    p.add_argument('--synced-at', help='when the done list was synced (default: now)')
    args = p.parse_args()

    banners = load_banners()
    old = read_js(OUT, 'window.MISSIONS=') if OUT.exists() else {}
    shot, rows = old.get('shot'), old.get('rows')

    if args.screenshot:
        im = Image.open(args.screenshot).convert('RGB')
        if im.width != 1080:
            sys.exit(f'The screenshot is {im.width} px wide; the row search expects 1080 px.')
        rows = find_rows(im)
        print(f'{len(rows)} medal rows found')
        offset, wrong = check_rows(im, rows, banners)
        if offset > 0:
            sys.exit(f'{offset} new medal rows at the top of the screenshot: add their banners to data.js '
                     f'(and move the rows of the others) first. Nothing written.')
        if offset < 0 or len(wrong) > 3:
            for b, why in wrong[:20]:
                print(f'  #{number(banners, b)} {b["name"]} (rows {b["rows"]}): {why}', file=sys.stderr)
            sys.exit('The screenshot does not match data.js. Nothing written.')
        for b, why in wrong:
            print(f'  check #{number(banners, b)} {b["name"]} (rows {b["rows"]}): {why}')
        last = max(r for b in banners for r in row_ranges(b))
        if len(rows) - 1 > last:
            print(f'  note: the screenshot has {len(rows) - 1 - last} medal rows after the last banner of data.js'
                  ' (the last one may be cut off)')
        shot = write_tiles(im)
        size = sum(f.stat().st_size for f in SHOT.glob('s*.jpg'))
        print(f'{len(shot["tiles"])} tiles written to {SHOT.relative_to(ROOT)} ({size / 1e6:.1f} MB)')
    if not shot or not rows:
        sys.exit('No screenshot data yet: run with --screenshot.')

    done = old.get('done')
    if args.done:
        synced = args.synced_at or datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        done = {'source': 'AgentTools: the Bannergress done list', 'syncedAt': synced, 'banners': read_done(args.done)}
    if not done:
        sys.exit('No done list yet: run with --done.')
    for d in done['banners']:
        d.pop('note', None)  # notes live in tools/notes.json now

    notes = json.loads(NOTES.read_text(encoding='utf-8')) if NOTES.exists() else {}
    keys = {b['id'] for b in banners if b.get('id')} | {'medal:' + b['name'] for b in banners if not b.get('id')} \
        | {d['id'] for d in done['banners']}
    for k in notes:
        if k not in keys:
            print(f'  note for "{k}" matches no banner any more')

    out = {'shot': shot, 'rows': rows, 'done': done, 'notes': notes}
    OUT.write_text('// Written by tools/update_missions.py: the screenshot tiles, the y range (in the full screenshot)'
                   ' of each medal row, the done list from AgentTools and the notes.\n'
                   'window.MISSIONS=' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    ids = {b.get('id') for b in banners}
    both = sum(1 for d in done['banners'] if d['id'] in ids)
    print(f'{OUT.relative_to(ROOT)}: {len(done["banners"])} done ({both} with medals), {len(notes)} notes')
    write_preview(banners)


if __name__ == '__main__':
    main()
