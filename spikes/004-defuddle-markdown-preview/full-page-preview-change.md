# Full-page Defuddle preview change

## User request

The user asked to stop showing Defuddle output in a popup/modal. Instead, after clicking `Clip`, the defuddled Markdown should display across the whole custom webviewer page, similar to the `defuddle.md/...` reader-style output shown in the reference screenshot.

Desired behavior:

1. User browses normally inside the Internal Defuddle Browser.
2. User clicks `Clip`.
3. The webview area is replaced by a full-page dark monospace Markdown preview.
4. The original webpage remains loaded in the hidden webview.
5. User presses `Backspace` to return to the original webpage.
6. The toolbar back button (`←`) also returns from preview mode before doing browser history navigation.

## Implementation

Updated `src/main.ts`:

- Removed the Spike 004 preview modal behavior.
- Added an in-view `<pre>` preview surface inside `.internal-defuddle-browser-content`.
- The preview surface starts hidden.
- After Defuddle extraction, the plugin now calls `showDefuddlePreviewPage(...)` instead of opening a modal.
- `showDefuddlePreviewPage(...)`:
  - formats YAML-style metadata plus Markdown body
  - hides the Electron `<webview>`
  - shows the preview `<pre>`
  - focuses the preview
  - updates the status line with the Backspace instruction
- `returnToBrowserPage(...)`:
  - hides the preview
  - shows the existing webview again
  - does not reload the page
- Added a document-level Backspace handler while preview mode is active.
- The toolbar `←` button now exits preview mode first.

Updated `styles.css`:

- Added `.internal-defuddle-browser-hidden`.
- Added `.internal-defuddle-browser-reader-preview` dark full-page monospace styling.

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

Copied runtime files into:

```text
<vault>/.obsidian/plugins/internal-defuddle-browser
```

Copied:

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`

Verified installed bundle contains:

- `Backspace`
- `buildPreviewDocument`
- `Showing Defuddle preview`

Verified installed CSS contains:

- `.internal-defuddle-browser-reader-preview`
- `.internal-defuddle-browser-hidden`

## Manual test plan

1. Reload Obsidian or disable/re-enable the plugin.
2. Open `Internal Defuddle Browser`.
3. Load an article.
4. Click `Clip`.
5. Expected: no popup appears.
6. Expected: the webview area becomes a full-page dark monospace Markdown preview with YAML metadata at top.
7. Press `Backspace`.
8. Expected: the original webpage reappears without needing to reload.
9. Click `Clip` again to ensure repeated preview works.

## Status

READY FOR MANUAL TESTING
