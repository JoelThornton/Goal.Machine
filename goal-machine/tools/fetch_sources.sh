#!/usr/bin/env bash
# Downloads every dataset build_players.py needs into $1 (default: ./src). Only the FPL data changes week to week.
set -euo pipefail
SRC="${1:-src}"
mkdir -p "$SRC" && cd "$SRC"
clone() { [ -d "$2" ] || GIT_LFS_SKIP_SMUDGE=1 git clone -q --depth 1 "$@"; }
clone https://github.com/mshodge/epl-stats epl-stats
clone https://github.com/douglasbc/scraping-understat-dataset us
clone https://github.com/ewenme/transfers transfers
if [ ! -d fpl ]; then
  git clone -q --depth 1 --filter=blob:none --sparse https://github.com/vaastav/Fantasy-Premier-League fpl
  git -C fpl sparse-checkout set --no-cone '/data/*/players_raw.csv' '/data/*/gws/merged_gw.csv' '/data/*/teams.csv' '/data/*/players/*/history.csv'
else
  git -C fpl pull -q --depth 1 origin HEAD
fi
if [ ! -d football-datasets ]; then
  GIT_LFS_SKIP_SMUDGE=1 git clone -q --depth 1 --filter=blob:none --sparse https://github.com/salimt/football-datasets
  git -C football-datasets sparse-checkout set datalake/transfermarkt/player_profiles datalake/transfermarkt/player_teammates_played_with
fi
echo "sources ready in $PWD"
