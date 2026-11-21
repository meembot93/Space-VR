#!/usr/bin/env python3
"""Builds the real night sky's data from Olaf Frohn's d3-celestial catalogs (BSD licence,
https://github.com/ofrohn/d3-celestial, data from the Hipparcos and Yale Bright Star catalogs).

    python3 tools/sky/build_sky.py FOLDER_WITH_THE_DOWNLOADED_JSON_FILES

Needs stars.6.json, starnames.json, constellations.json, constellations.lines.json and mw.json
from d3-celestial's data/ folder. Writes data/sky.json (stars, names, constellation figures) and
data/milkyway.jpg (the Milky Way's glow as a 2:1 map of the whole sky). Needs Pillow."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'data')
os.makedirs(OUT, exist_ok=True)
load = lambda f: json.load(open(os.path.join(SRC, f), encoding='utf-8'))
ra360 = lambda lon: lon if lon >= 0 else lon + 360

GREEK = {'α': 'Alpha', 'β': 'Beta', 'γ': 'Gamma', 'δ': 'Delta', 'ε': 'Epsilon', 'ζ': 'Zeta', 'η': 'Eta', 'θ': 'Theta',
         'ι': 'Iota', 'κ': 'Kappa', 'λ': 'Lambda', 'μ': 'Mu', 'ν': 'Nu', 'ξ': 'Xi', 'ο': 'Omicron', 'π': 'Pi', 'ρ': 'Rho',
         'σ': 'Sigma', 'τ': 'Tau', 'υ': 'Upsilon', 'φ': 'Phi', 'χ': 'Chi', 'ψ': 'Psi', 'ω': 'Omega'}
# Proper names worth showing even for fainter stars (the rest of the IAU list is mostly obscure)
FAMOUS = {'Polaris', 'Thuban', 'Mizar', 'Alcor', 'Algol', 'Alcyone', 'Electra', 'Maia', 'Merope', 'Taygeta', 'Atlas',
          'Pleione', 'Celaeno', 'Asterope', 'Sadr', 'Albireo', 'Vindemiatrix', 'Zubenelgenubi', 'Zubeneschamali', 'Mira',
          'Alnitak', 'Alnilam', 'Mintaka', 'Saiph', 'Meissa', 'Hyadum I', 'Ain', 'Cor Caroli', 'Rasalhague', 'Kochab',
          'Pherkad', 'Megrez', 'Phecda', 'Merak', 'Dubhe', 'Alioth', 'Alkaid', 'Schedar', 'Caph', 'Ruchbah', 'Segin',
          'Navi', 'Sheliak', 'Sulafat', 'Tarazed', 'Alshain', 'Sualocin', 'Rotanev', 'Eltanin', 'Rastaban', 'Izar',
          'Muphrid', 'Alphecca', 'Nunki', 'Kaus Australis', 'Shaula', 'Lesath', 'Antares', 'Acrux', 'Mimosa', 'Gacrux',
          'Hadar', 'Rigil Kentaurus', 'Achernar', 'Canopus', 'Fomalhaut', 'Diphda', 'Hamal', 'Sheratan', 'Mesarthim',
          'Menkar', 'Alpheratz', 'Mirach', 'Almach', 'Markab', 'Scheat', 'Algenib', 'Enif', 'Sadalmelik', 'Sadalsuud',
          'Deneb Algedi', 'Denebola', 'Algieba', 'Zosma', 'Chertan', 'Castor', 'Pollux', 'Alhena', 'Procyon', 'Gomeisa',
          'Adhara', 'Wezen', 'Mirzam', 'Aludra', 'Capella', 'Menkalinan', 'Elnath', 'Aldebaran', 'Bellatrix', 'Betelgeuse',
          'Rigel', 'Sirius', 'Arcturus', 'Vega', 'Deneb', 'Altair', 'Spica', 'Regulus', 'Alphard', 'Mirfak'}

stars = load('stars.6.json')['features']
names = load('starnames.json')
cons = {f['id']: f for f in load('constellations.json')['features']}

# Each star: right ascension and declination (degrees), brightness (magnitude), colour (B-V)
star_out, name_out = [], []
for f in sorted(stars, key=lambda f: f['properties']['mag']):
    mag = f['properties']['mag']
    if mag > 6.0: continue
    lon, dec = f['geometry']['coordinates']
    try: bv = float(f['properties']['bv'])
    except (TypeError, ValueError): bv = 0.6
    i = len(star_out) // 4
    star_out += [round(ra360(lon), 3), round(dec, 3), round(mag, 2), round(bv, 2)]
    info = names.get(str(f['id']))
    if mag < 4.6 and info and info.get('c') in cons:
        c = info['c']; label = ''
        if info.get('name') and (mag < 3.0 or info['name'] in FAMOUS): label = info['name']
        elif info.get('bayer') in GREEK and mag < 3.6: label = GREEK[info['bayer']] + ' ' + cons[c]['properties']['gen']
        name_out.append([i, label, c])

con_out = {}
for f in load('constellations.lines.json')['features']:
    c = cons.get(f['id'])
    if not c: continue
    p = c['properties']; lr, ld = c['geometry']['coordinates']
    en = p['en'].replace(' ', ' ')
    con_out[f['id']] = {
        'name': p['name'], 'en': en, 'rank': int(p['rank']), 'label': [round(ra360(lr), 2), round(ld, 2)],
        'lines': [[[round(ra360(a), 2), round(b, 2)] for a, b in line] for line in f['geometry']['coordinates']],
    }

json.dump({'source': 'd3-celestial by Olaf Frohn (BSD licence), Hipparcos / Yale Bright Star catalogs',
           'stars': star_out, 'names': name_out, 'constellations': con_out},
          open(os.path.join(OUT, 'sky.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(star_out) // 4, 'stars,', len(name_out), 'labelled,', len(con_out), 'constellations')

# The Milky Way: five nested brightness outlines, painted on top of each other and blurred.
# The map's x runs with right ascension 0..360 degrees, y from declination +90 (top) to -90.
W, H = 2048, 1024
def unwrap(ring):
    pts, prev = [], None
    for lon, lat in ring:
        ra = ra360(lon)
        if prev is not None:
            while ra - prev > 180: ra -= 360
            while prev - ra > 180: ra += 360
        prev = ra; pts.append((ra, lat))
    return pts
def paint(d, pts, fill):
    for shift in (-720, -360, 0, 360, 720):
        d.polygon([((ra + shift) / 360 * W, (90 - lat) / 180 * H) for ra, lat in pts], fill=fill)
def signed(r): return sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1)) / 2

total = np.zeros((H, W), dtype='uint16')
for f in load('mw.json')['features']:
    level = Image.new('L', (W, H), 0); d = ImageDraw.Draw(level)
    rings = [r for poly in f['geometry']['coordinates'] for r in poly]
    # Rings that go all the way round the sky are the edges of the main band: fill everything below
    # the northern edge, then take away everything below the southern edge
    full = [unwrap(r) for r in rings if max(a for a, b in r) - min(a for a, b in r) > 300 and abs(unwrap(r)[-1][0] - unwrap(r)[0][0]) > 300]
    full.sort(key=lambda p: -max(b for a, b in p))
    for k, pts in enumerate(full):
        paint(d, pts + [(pts[-1][0], -95), (pts[0][0], -95)], 255 if k == 0 else 0)
    # Other outlines: clockwise ones are bright patches, anticlockwise ones dark holes (like the Coalsack)
    for fill_pass in (255, 0):
        for r in rings:
            pts = unwrap(r)
            if abs(pts[-1][0] - pts[0][0]) > 300: continue
            if (signed(r) < 0) == (fill_pass == 255): paint(d, pts, fill_pass)
    total += np.asarray(level, dtype='uint16') // 5
img = Image.fromarray(np.minimum(255, total).astype('uint8')).filter(ImageFilter.GaussianBlur(5))
px = lambda ra, dec: img.getpixel((int(ra / 360 * W) % W, int((90 - dec) / 180 * H)))
print('galactic centre', px(266.4, -29), ' north galactic pole', px(192.9, 27.1), ' Cygnus', px(305, 40), ' Coalsack', px(190, -63))
img.save(os.path.join(OUT, 'milkyway.jpg'), quality=88)
print('milky way map written')
