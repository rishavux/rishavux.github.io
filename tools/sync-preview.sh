#!/bin/sh
# Mirrors this folder to ~/.portfolio-preview/site, which the preview server serves
# (the browser pane can't read Documents). Run after every edit.
cd "$(dirname "$0")/.." && rsync -a --delete --exclude .git --exclude .claude ./ ~/.portfolio-preview/site/
