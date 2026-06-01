# Third-party notices

This project builds on open-source work from the Obsidian ecosystem.

## Obsidian Web Clipper

- Repository: https://github.com/obsidianmd/obsidian-clipper
- Copyright: Copyright (c) 2024 Obsidian
- License: MIT

Obsidian Web Clipper was used as research/reference for clipping architecture, Defuddle-based extraction concepts, metadata ideas, and future roadmap inspiration. This project is an Obsidian desktop plugin with its own internal browser view and vault-save workflow; it is not a copy of the browser extension.

## Defuddle

- Package: defuddle
- Repository: https://github.com/kepano/defuddle
- License: MIT

Defuddle is used as the article/content extraction engine.

## youtube-transcript

- Package: youtube-transcript
- Repository: https://github.com/Kakulukian/youtube-transcript
- License: MIT

youtube-transcript is used to fetch available captions/transcripts for YouTube videos so they can be previewed and saved as timestamped Markdown notes.

## Obsidian desktop Web viewer

- Product: Obsidian desktop core Web viewer
- Website: https://obsidian.md

Obsidian's built-in desktop Web viewer influenced the product direction and user experience goals for keeping browsing/research inside Obsidian. This project does not copy code from the core Web viewer; it implements its own custom internal browser view for this plugin.

## Obsidian API

- Package: obsidian
- Website: https://obsidian.md

This plugin uses the Obsidian plugin API for commands, views, settings, and vault file creation.

## Other dependencies

Additional npm dependencies are listed in `package.json` and `package-lock.json`. Their license files are included by npm in `node_modules` after installation.
