#!/usr/bin/env python3
"""The extra detail for the night sky, on top of build_sky.py:

    python3 tools/sky/build_sky_detail.py FOLDER_WITH_THE_DOWNLOADED_JSON_FILES

  data/faint.bin          the stars from magnitude 6 to 8 (d3-celestial's stars.8.json, about 36,000),
                          too faint to see one by one but together they make the sky rich.
                          Little-endian int16 x 4 per star: RA*65535/360-32768, Dec*100, mag*1000, B-V*1000.
  data/milkyway-color.jpg the Milky Way in colour at 4096 x 2048 (RA 0..360 across, Dec +90..-90 down):
                          the real outline map (data/milkyway.jpg from build_sky.py) with clumpy star clouds,
                          dark dust lanes (the Great Rift from Cygnus to Sagittarius), a warm glowing core,
                          and the brightest nebulae and galaxies (Orion, Lagoon, Carina, Andromeda,
                          the Magellanic Clouds).
Needs numpy, scipy and Pillow. Data: d3-celestial by Olaf Frohn (BSD licence)."""
import json, os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'data')
D2R = np.pi / 180

# ---- faint stars
feats = json.load(open(os.path.join(SRC, 'stars.8.json')))['features']
rows = []
for f in feats:
    m = f['properties']['mag']
    if not (6.0 < m <= 8.0): continue
    lon, dec = f['geometry']['coordinates']
    ra = lon if lon >= 0 else lon + 360
    try: bv = float(f['properties']['bv'])
    except (TypeError, ValueError): bv = 0.6
    rows.append((round(ra / 360 * 65535) - 32768, round(dec * 100), round(m * 1000), round(max(-0.5, min(2.5, bv)) * 1000)))
np.array(rows, dtype='<i2').tofile(os.path.join(OUT, 'faint.bin'))
print(len(rows), 'faint stars')

# ---- the Milky Way in colour
W, H = 4096, 2048
ra = (np.arange(W) + 0.5) / W * 360
dec = 90 - (np.arange(H) + 0.5) / H * 180
RA, DEC = np.meshgrid(ra * D2R, dec * D2R)
eq = np.stack([np.cos(DEC) * np.cos(RA), np.cos(DEC) * np.sin(RA), np.sin(DEC)], -1).astype('float32')
G = np.array([[-0.0548755604, -0.8734370902, -0.4838350155],
              [0.4941094279, -0.4448296300, 0.7469822445],
              [-0.8676661490, -0.1980763734, 0.4559837762]], dtype='float32')
gal = eq @ G.T
l = np.arctan2(gal[..., 1], gal[..., 0]) / D2R          # galactic longitude, -180..180 (0 = the centre, in Sagittarius)
b = np.arcsin(np.clip(gal[..., 2], -1, 1)) / D2R         # galactic latitude
del gal

rng = np.random.default_rng(7)
def noise(vec, freq, n=64):
    """Smooth value noise on the sphere (trilinear on a random 3D grid)."""
    grid = rng.random((n, n, n), dtype='float32')
    c = (vec * freq + 1000.0) % n
    return map_coordinates(grid, [c[..., 0].ravel(), c[..., 1].ravel(), c[..., 2].ravel()], order=1, mode='grid-wrap').reshape(vec.shape[:2])
def fbm(vec, f0, octaves, gain=0.55):
    out, amp, tot = np.zeros(vec.shape[:2], 'float32'), 1.0, 0.0
    for o in range(octaves):
        out += noise(vec, f0 * 2.07 ** o) * amp; tot += amp; amp *= gain
    return out / tot

base = np.asarray(Image.open(os.path.join(OUT, 'milkyway.jpg')).convert('L').resize((W, H), Image.BICUBIC), 'float32') / 255
toward = np.cos(np.clip(l, -150, 150) * D2R * 0.6) * 0.5 + 0.5            # brighter toward the centre
band = np.exp(-(b / 9.0) ** 2) * (0.35 + 0.65 * toward)
bulge = np.exp(-(l / 14.0) ** 2 - (b / 9.0) ** 2)
clouds = fbm(eq, 7.0, 7, 0.62)                                            # clumpy star clouds, down to fine grain
clouds = np.clip((clouds - 0.3) * 2.1, 0, 1.5)
light = (base * 0.75 + band * 0.4) * (0.35 + 0.95 * clouds) + bulge * 0.55
# dust: dark lanes along the middle of the band, strongest along the Great Rift (Cygnus -> Sagittarius)
ridge = 1 - np.abs(fbm(eq * np.float32(1.0), 11.0, 5) * 2 - 1)            # thin winding filaments
ridge = ridge ** 3
blob = fbm(eq, 5.0, 4)
rift = np.exp(-((b - 1.0 + 2.5 * np.sin(l * D2R * 2.2)) / 3.2) ** 2) * np.clip((80 - np.abs(l - 25)) / 50, 0, 1)
lanes = np.exp(-(b / 5.0) ** 2) * (0.45 * ridge + 0.5 * np.clip((blob - 0.45) * 3, 0, 1))
patch = np.clip((fbm(eq, 9.0, 5) - 0.38) * 2.6, 0, 1)                    # the rift breaks up into patches
dust = np.clip(rift * (0.25 + 0.75 * patch) * (0.5 + 0.6 * ridge) + lanes * (0.4 + 0.6 * patch), 0, 0.85)
light *= 1 - dust
light = np.clip(light, 0, None)
# colour: a warm core, blue-white arms, and reddish-brown where the dust thins the light
warm = np.clip(bulge * 1.4 + np.exp(-(l / 40.0) ** 2) * 0.3, 0, 1)[..., None]
col = light[..., None] * (warm * np.array([1.0, 0.82, 0.6], 'float32') + (1 - warm) * np.array([0.78, 0.84, 1.0], 'float32'))
col += (dust * light * 0.35)[..., None] * np.array([0.5, 0.25, 0.1], 'float32')
del base, band, clouds, ridge, blob, rift, lanes, dust, warm, light, patch

# nebulae and galaxies: (RA, Dec, size x, size y in degrees, angle, colour, strength)
def ang_dist(ra0, dec0):
    v = np.array([np.cos(dec0 * D2R) * np.cos(ra0 * D2R), np.cos(dec0 * D2R) * np.sin(ra0 * D2R), np.sin(dec0 * D2R)], 'float32')
    return v
PINK, WARM, BLUE = (1.0, 0.45, 0.6), (1.0, 0.85, 0.65), (0.75, 0.82, 1.0)
OBJS = [(83.8, -5.4, 1.4, 1.1, 0, PINK, 0.9),      # the Orion Nebula
        (270.9, -24.4, 1.2, 0.8, 0, PINK, 0.8),    # the Lagoon
        (161.3, -59.9, 2.2, 2.0, 0, PINK, 0.8),    # the Carina Nebula
        (314.7, 44.3, 2.4, 2.0, 0, PINK, 0.35),    # the North America Nebula, by Deneb
        (98.0, 4.9, 1.4, 1.4, 0, PINK, 0.35),      # the Rosette
        (10.7, 41.3, 3.2, 1.0, 35, WARM, 0.75),    # the Andromeda Galaxy
        (80.9, -69.8, 8.0, 3.0, 10, BLUE, 1.0),    # Large Magellanic Cloud
        (13.2, -72.8, 4.5, 2.5, 45, BLUE, 0.8)]    # Small Magellanic Cloud
lumpy = fbm(eq, 40.0, 3)
for ra0, dec0, sx, sy, ang, c, k in OBJS:
    v = ang_dist(ra0, dec0)
    # local tangent coordinates around the object (degrees)
    e = np.array([-np.sin(ra0 * D2R), np.cos(ra0 * D2R), 0], 'float32'); n = np.cross(v, e)
    d = eq @ v
    m = d > np.cos(12 * D2R)
    x = (eq[m] @ e) / D2R; y = (eq[m] @ n) / D2R
    a = ang * D2R; xr = x * np.cos(a) + y * np.sin(a); yr = -x * np.sin(a) + y * np.cos(a)
    r2 = (xr / sx) ** 2 + (yr / sy) ** 2
    glow = (np.exp(-r2 * 2.2) * 0.8 + np.exp(-r2 * 9) * 0.6) * k * (0.6 + 0.8 * lumpy[m])
    col[m] += glow[:, None] * np.array(c, 'float32')

col = np.clip(col / 1.35, 0, 1) ** 0.9
Image.fromarray((col * 255).astype('uint8')).save(os.path.join(OUT, 'milkyway-color.jpg'), quality=86)
print('colour milky way written')
