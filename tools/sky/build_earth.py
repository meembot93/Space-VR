# Makes data/earth.jpg: a stylized map of the whole Earth (equirectangular, 2048 x 1024) for the
# space views (Chapter 5's look at the whole planet, and the Era 1 finale).
# Coastlines: Natural Earth 1:110m land (public domain), as shipped with geopandas 0.14.
#   pip install "geopandas==0.14.4" pillow numpy  &&  python3 tools/sky/build_earth.py
import geopandas, numpy as np, os
from PIL import Image, ImageDraw, ImageFilter
W, H = 2048, 1024
world = geopandas.read_file(geopandas.datasets.get_path('naturalearth_lowres'))
mask = Image.new('L', (W, H), 0); d = ImageDraw.Draw(mask)
def px(lon, lat): return ((lon + 180) / 360 * W, (90 - lat) / 180 * H)
for geom in world.geometry:
    polys = [geom] if geom.geom_type == 'Polygon' else list(geom.geoms)
    for p in polys:
        d.polygon([px(*c) for c in p.exterior.coords], fill=255)
d.rectangle([0, H - 40, W, H], fill=255)   # Antarctica's edge
m = np.asarray(mask.filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
coast = np.asarray(mask.filter(ImageFilter.GaussianBlur(10))).astype(np.float32) / 255
rng = np.random.default_rng(3)
def noise(scale):
    n = rng.random((H // scale + 2, W // scale + 2)).astype(np.float32)
    return np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(np.float32) / 255
n = noise(64) * 0.5 + noise(16) * 0.3 + noise(4) * 0.2
lat = np.abs(90 - (np.arange(H) + 0.5) / H * 180)[:, None] * np.ones((1, W))
# land colour by latitude: deserts round 15-35 degrees, green elsewhere, tundra and ice toward the poles
green = np.array([62, 104, 48]); dry = np.array([176, 150, 98]); tundra = np.array([120, 116, 92]); ice = np.array([236, 240, 244])
desert = np.clip(1 - np.abs(lat - 24) / 12, 0, 1) * np.clip(n * 1.6 - 0.2, 0, 1)
col = green[None, None] * (1 - desert[..., None]) + dry[None, None] * desert[..., None]
t = np.clip((lat - 55) / 12, 0, 1)[..., None]; col = col * (1 - t) + tundra[None, None] * t
t = np.clip((lat - 68) / 6, 0, 1)[..., None]; col = col * (1 - t) + ice[None, None] * t
col = col * (0.82 + 0.3 * n[..., None])
# sea: deep blue, lighter near the coasts, with sea ice near the poles
deep = np.array([12, 38, 86]); shallow = np.array([30, 92, 140])
sea = deep[None, None] + (shallow - deep)[None, None] * (coast[..., None] ** 1.5) * 0.8
sea = sea * (0.95 + 0.1 * n[..., None])
t = np.clip((lat - 72) / 8, 0, 1)[..., None]; sea = sea * (1 - t) + ice[None, None] * t * 0.95
img = sea * (1 - m[..., None]) + col * m[..., None]
out = os.path.join(os.path.dirname(__file__), '../../data/earth.jpg')
Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(out, quality=82)
print('wrote', out, os.path.getsize(out))
