# Spike 003: Rendered DOM Capture

## Status

VALIDATED

## Question

Given a page loaded in the Internal Defuddle Browser webview, when the user clicks `Clip`, can the plugin execute JavaScript in the rendered page context and return useful page data back to the Obsidian plugin?

## Why this matters

This is the central feasibility test for the project. The reason to build a custom internal browser is to clip the page that actually rendered inside Obsidian, not only fetch a URL from the network.

If this spike works, the project can proceed toward Defuddle extraction using rendered HTML.

If this spike fails, the project may need a fallback architecture such as URL fetching, preload scripts, or a local companion service.

## User observation that triggered this spike

The user clicked `Clip` in the Spike 002 build and saw the old placeholder notice:

```text
Clip placeholder: rendered DOM capture comes in Spike 003.
```

The user also noticed that from Google, clicking a result/link could open the link in the system default browser outside Obsidian.

That means two things needed immediate attention:

1. Replace the placeholder Clip button with an actual capture test.
2. Try to keep target-blank/new-window navigation inside the internal webview.

## Implementation

Updated `src/main.ts` so the `Clip` button now calls `webview.executeJavaScript(...)` and attempts to return a debug payload from the rendered page:

- current URL
- document title
- selected text
- rendered HTML length
- body text length
- body text preview
- capture timestamp

The debug payload is displayed in an Obsidian modal titled:

```text
Spike 003 Capture Debug
```

Also updated webview popup behavior:

- Removed `allowpopups` from the webview element.
- Added a `new-window` event handler that prevents the default popup and loads the target URL inside the internal browser when Electron exposes the URL.
- Added a `did-create-window` event status message as an observation hook for newer Electron behavior.

Updated `styles.css` with modal/debug preview styling.

## Build verification

Command run from plugin project folder:

```bash
npm run build
```

Result:

```text
> internal-defuddle-browser@0.0.1 build
> tsc -noEmit -skipLibCheck && node esbuild.config.mjs production
```

Exit code: `0`

## Installed runtime sync

After the successful build, only the runtime files were copied into the installed Obsidian plugin folder:

```text
<vault>/.obsidian/plugins/internal-defuddle-browser
```

Copied files:

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`

This avoids copying development-only files such as `node_modules` into the live plugin install.

## Manual test plan

In Obsidian:

1. Reload Obsidian or disable/re-enable the plugin.
2. Open `Internal Defuddle Browser`.
3. Load `https://example.com`.
4. Click `Clip`.
5. Expected result: a modal titled `Spike 003 Capture Debug` appears and shows URL/title/body text metrics.
6. Then test a more realistic article page.
7. Then test Google/YouTube navigation and whether clicked links stay inside the internal browser.

## Verdict

VALIDATED

### Manual Obsidian verification

The user tested the Spike 003 Clip button inside Obsidian and provided a screenshot showing the `Spike 003 Capture Debug` modal.

The modal reported that rendered page data successfully crossed from the internal webview back into the Obsidian plugin.

Captured debug example from a PubMed Central article:

```json
{
  "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC9839201/",
  "title": "Long COVID: major findings, mechanisms and recommendations",
  "selectedTextLength": 0,
  "htmlLength": 400940,
  "bodyTextLength": 110754,
  "capturedAt": "2026-06-01T02:41:28.900Z"
}
```

The modal also displayed a body text preview from the rendered page.

This validates the core rendered DOM capture path: webview page context → plugin code → Obsidian modal.

### What worked so far

- Code compiles.
- Runtime bundle includes the Spike 003 modal/capture code.
- Installed plugin runtime files were updated.
- `webview.executeJavaScript(...)` is allowed in Obsidian's Electron webview context.
- Rendered page URL/title/body text metrics can be captured.
- A large real article page produced substantial rendered HTML and body text.

### What still needs testing later

- Whether CSP-heavy pages or Google/YouTube block or limit capture.
- Whether selection capture works when text is highlighted.
- Whether captured HTML is clean enough for Defuddle extraction.
- Whether target-blank/new-window links remain reliable across many sites.

## Recommendation if validated

Proceed to Spike 004: Defuddle extraction.

Use the captured rendered HTML as input to a Defuddle extraction service, then produce clean Markdown and metadata.
