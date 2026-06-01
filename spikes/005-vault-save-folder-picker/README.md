# Spike 005: Vault save + folder picker

## Goal

Add the next workflow step after the full-page Defuddle Markdown preview:

```text
Browse page → Clip → review Defuddled Markdown preview → Save Markdown into selected vault folder
```

## Changes implemented

### Folder picker

The toolbar `Folder: ... ▾` button now opens an Obsidian `FuzzySuggestModal<TFolder>` populated from the current vault's folders.

Behavior:

- Shows the vault root as `/`.
- Shows all loaded vault folders sorted by path.
- Selecting a folder updates the toolbar label.
- Default selected folder remains `Inbox`.
- If `Inbox` does not exist yet, save creates it before writing the clip.

### Save button

Added a toolbar button:

```text
Save
```

Behavior:

- Disabled until a page has been clipped and a Defuddle preview is available.
- Saves the exact current preview Markdown into the selected vault folder.
- Uses the preview title/page title for the filename.
- Sanitizes invalid filename characters.
- Avoids overwriting existing files by adding `-2`, `-3`, etc.
- Shows a status message and Obsidian notice with the saved path.

### Saved Markdown contents

Saved file content now uses an Obsidian Web Clipper-style metadata block:

```yaml
---
title: "..."
source: "https://example.com/page"
author: "[Author Name](https://example.com/author/author-name)"
published: 2024-03-02
created: 2026-06-01
description: "..."
tags:
  - clippings
---
```

Notes:

- `source` is kept as a URL property so Obsidian renders it as a clickable external link.
- `author` is stored as a Markdown link when an author URL can be detected from the page, matching the official Web Clipper-style clickable author display.
- `published` and `created` are stored as date values when available.
- Extra debug-ish metadata such as `site`, `domain`, `language`, and `word_count` is intentionally omitted from the normal saved/preview metadata to keep it closer to the official clipper output.

## Files changed

- `src/main.ts`

Runtime files synced into:

```text
<vault>/.obsidian/plugins/internal-defuddle-browser
```

## Build verification

Command:

```bash
npm run build
```

Result:

```text
> internal-defuddle-browser@0.0.1 build
> tsc -noEmit -skipLibCheck && node esbuild.config.mjs production
```

Exit code: `0`

## Manual test plan

1. Reload Obsidian or disable/re-enable `Internal Defuddle Browser`.
2. Open `Internal Defuddle Browser`.
3. Click `Folder: Inbox ▾`.
4. Confirm the folder picker opens and lists vault folders.
5. Select a destination folder.
6. Load a page.
7. Click `Clip`.
8. Confirm the full-page Markdown preview still appears.
9. Confirm the `Save` button is enabled after preview appears.
10. Click `Save`.
11. Confirm an Obsidian notice shows the saved path.
12. Open that note in the vault and verify:
    - metadata is present
    - `author` appears when Defuddle detected one
    - source URL is present
    - Markdown body matches the preview
13. Click `Save` again on the same preview and confirm it creates a non-overwriting filename with `-2`.

## Status

READY FOR MANUAL TESTING
