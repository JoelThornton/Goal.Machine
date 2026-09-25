"""Adds new songs to the Soundtrack playlist (goal-machine/music/playlist.json).

Any .mp3 uploaded outside the music folder (e.g. to the top of the repo by mistake) is moved into it first. Epidemic
Sound downloads are named 'ES_Title - Artist.mp3', which gives the title and artist; other files use the file name as
the title (fix it by hand in playlist.json). Songs whose file has gone are dropped. Run from the repo root:
    python3 goal-machine/tools/add_songs.py
The 'Add songs' GitHub Action runs it automatically whenever an .mp3 is uploaded."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MUSIC = ROOT / 'goal-machine' / 'music'
LIST = MUSIC / 'playlist.json'


def main():
    # stray uploads: any .mp3 in the repo that isn't in music/
    for f in ROOT.rglob('*.mp3'):
        if f.parent != MUSIC and '.git' not in f.parts:
            dest = MUSIC / f.name
            subprocess.run(['git', 'mv', str(f), str(dest)], cwd=ROOT, check=False)
            if f.exists():
                f.rename(dest)
            print('moved', f.relative_to(ROOT), '-> music/')
    p = json.loads(LIST.read_text())
    tracks = [t for t in p['tracks'] if (MUSIC / t['file']).exists()]
    have = {t['file'] for t in tracks}
    for f in sorted(MUSIC.glob('*.mp3')):
        if f.name in have:
            continue
        stem = f.stem[3:] if f.stem.startswith('ES_') else f.stem
        title, _, artist = stem.partition(' - ')
        tracks.append({'file': f.name, 'title': title.strip(), 'artist': artist.strip()})
        print('added', title.strip(), '-', artist.strip())
    p['tracks'] = tracks
    LIST.write_text('{\n  "about": ' + json.dumps(p['about'], ensure_ascii=False) + ',\n  "tracks": [\n'
                    + ',\n'.join('    ' + json.dumps(t, ensure_ascii=False) for t in tracks) + '\n  ]\n}\n')
    print(len(tracks), 'songs in the playlist')


if __name__ == '__main__':
    main()
