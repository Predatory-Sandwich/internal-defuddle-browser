# Defuddle quality improvement: choose best extracted source

## User report

The user compared the plugin's NIH article output against the same URL opened through `defuddle.md/...` in a normal browser. The user wants our generated Markdown to be as good as the Defuddle website output.

Observed likely cause:

- Our plugin was only running Defuddle against the rendered Electron webview DOM.
- The Defuddle website appears to work from the source URL / clean fetched HTML and then renders a raw Markdown-style page.
- For some sites, especially government/research/news pages, the clean fetched HTML can extract better than the browser-rendered DOM.
- For other sites, the rendered DOM is better, so we should not abandon rendered capture.

## Change made

The plugin now extracts two candidates when the user clicks `Clip`:

1. `rendered webview DOM`
   - Uses the already validated rendered DOM capture from the internal webview.

2. `clean source fetch`
   - Uses Obsidian `requestUrl(...)` to fetch the current page URL directly.
   - Parses that fetched HTML with `DOMParser`.
   - Runs Defuddle against it.

Then the plugin scores both candidates and displays the better one.

Scoring currently considers:

- word count
- Markdown length, capped to avoid blindly preferring huge noisy pages
- title presence
- description presence
- site presence

## Formatting change

The preview metadata was changed to more closely match `defuddle.md` output:

```yaml
---
title: "..."
site: "..."
source: "..."
domain: "..."
language: "en"
description: "..."
word_count: 1234
---
```

Then the Markdown body follows directly after the metadata block.

The status line now says whether the selected preview came from:

- `clean source fetch`
- `rendered webview DOM`

This lets us diagnose which extraction path is winning for each page.

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

## Runtime sync

Runtime files were copied into:

```text
<vault>/.obsidian/plugins/internal-defuddle-browser
```

Copied:

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`

Verified installed bundle contains:

- `Fetching clean source HTML for Defuddle comparison`
- `clean source fetch`
- `chooseBestDefuddleCandidate`
- `domain:`
- `word_count`

## Manual test plan

1. Reload Obsidian or disable/re-enable the plugin.
2. Open `Internal Defuddle Browser`.
3. Load the NIH article the user compared against `defuddle.md`.
4. Click `Clip`.
5. Check the status line:
   - if it says `clean source fetch`, the URL-fetched extraction won.
   - if it says `rendered webview DOM`, rendered extraction won.
6. Compare the Markdown preview with the `defuddle.md` result.
7. Confirm whether metadata now includes `domain`, `language`, and `word_count` in the same style.

## Expected outcome

NIH/research/news pages should often look closer to `defuddle.md`, because the plugin can now use clean source HTML when that produces the stronger result.

## Status

READY FOR MANUAL TESTING
