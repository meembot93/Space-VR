#!/usr/bin/env python3
"""Add Meem's narration recordings to the game.

Usage:  python3 tools/narration/import.py <folder with recordings>

Each recording is named by its line number, e.g. ch2_05.m4a or br5_01.m4a (any of .m4a .mp3 .wav .ogg .aac .caf).
Each one is trimmed of silence at both ends, evened out in loudness, saved as
sounds/narration/<id>.mp3, and listed in sounds/narration/index.json so the game plays it
instead of showing the line as a subtitle-only placeholder. Needs ffmpeg.
"""
import json, pathlib, re, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'sounds' / 'narration'
EXTS = {'.m4a', '.mp3', '.wav', '.ogg', '.aac', '.caf', '.flac'}

def main(src):
    OUT.mkdir(parents=True, exist_ok=True)
    index_path = OUT / 'index.json'
    index = json.loads(index_path.read_text()) if index_path.exists() else {}
    added = []
    for f in sorted(pathlib.Path(src).iterdir()):
        m = re.match(r'^((?:ch|br)\d+_\d+)', f.stem.lower())
        if not m or f.suffix.lower() not in EXTS:
            continue
        line = m.group(1)
        dest = OUT / f'{line}.mp3'
        trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.25,areverse'
        # two passes (trim, then even out the loudness): some ffmpeg versions hang doing both at once
        with tempfile.TemporaryDirectory() as tmp:
            mid = pathlib.Path(tmp) / 'trimmed.wav'
            subprocess.run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-i', str(f), '-af', trim, '-ac', '1', str(mid)], check=True)
            subprocess.run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-i', str(mid), '-af', 'loudnorm=I=-18:TP=-2:LRA=9',
                            '-ac', '1', '-ar', '44100', '-b:a', '96k', str(dest)], check=True)
        index[line] = dest.name
        added.append(line)
    index_path.write_text(json.dumps(dict(sorted(index.items())), indent=1) + '\n')
    print(f'Added {len(added)} recordings: {", ".join(added) or "none"}')

if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
