# Spike 002: Custom Web Viewer Surface

## Status

VALIDATED

## Question

Given the custom Obsidian view from Spike 001, when the user enters a URL, can the plugin load a real webpage inside the Obsidian tab and expose basic browser controls?

## Why this matters

This is the first project-killing technical risk for Internal Defuddle Browser. The desired workflow depends on the plugin owning a browser-like surface inside Obsidian so it can eventually attach a native Clip button and capture rendered page content.

If Obsidian did not allow an Electron `<webview>` inside an `ItemView`, the architecture would need to fall back to URL fetching or a local companion service.

## Implementation tested

Updated `src/main.ts` to replace the Spike 001 placeholder content with an Electron `<webview>` element inside the custom Obsidian `ItemView`.

Implemented:

- URL text input.
- Enter-to-load behavior.
- `Go` button.
- Back button.
- Forward button.
- Reload button.
- Status line for loading/rendering/failure state.
- URL normalization that adds `https://` when the user types a bare domain.
- Persistent Electron partition: `persist:internal-defuddle-browser`.
- Web preferences intended to keep page content isolated from the plugin context.

Relevant files:

- `src/main.ts`
- `styles.css`
- generated `main.js`

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

## Manual Obsidian verification

The updated plugin was synced into the installed plugin folder:

```text
<vault>/.obsidian/plugins/internal-defuddle-browser
```

The user tested the plugin inside Obsidian desktop and confirmed:

- The internal browser view still opens.
- A typed URL loads successfully.
- `youtube` normalized/navigated successfully to YouTube.
- The web page rendered inside the custom Obsidian tab.

## Verdict: VALIDATED

### What worked

- Electron `<webview>` can be created from the plugin's custom Obsidian `ItemView`.
- Normal web pages can load inside the Obsidian tab.
- The URL bar flow works.
- Bare domain input works for at least `youtube`.
- The architectural choice to build a custom internal browser view remains viable.

### What did not get tested yet

- Whether Back / Forward / Reload all work consistently across sites.
- Whether webview events expose enough state for robust UI polish.
- Whether the plugin can capture rendered DOM from the webview.
- Whether injected capture scripts are allowed by Electron/Obsidian in this context.
- Whether YouTube transcript data can be captured/extracted.
- How logins, CSP-heavy sites, popups, redirects, downloads, and media permissions behave.

### Surprises

- YouTube was able to load from the custom internal webview, which is an encouraging sign for the long-term YouTube transcript path.

### Recommendation for the real build

Proceed to Spike 003: Rendered DOM Capture.

Given a loaded page in the custom webview, when the user clicks Clip, the plugin should attempt to execute JavaScript in the webview context and return:

- current URL
- document title
- selected text, if any
- rendered `document.documentElement.outerHTML`
- possibly `document.body.innerText` as a simpler fallback

A successful Spike 003 would prove that this plugin can clip what the internal browser actually rendered, which is the core reason for building a custom web viewer instead of only fetching URLs.

## Next spike

Spike 003 should focus only on capture, not Defuddle yet.

Proposed Given/When/Then:

Given a webpage loaded in the internal webview, when the user clicks Clip, then the plugin captures rendered page data from the webview context and displays/saves a short debug preview proving the data crossed from webview to plugin.
