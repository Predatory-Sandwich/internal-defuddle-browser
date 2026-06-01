# Navigation Behavior Notes

## User report

The user reported that Google search result links did not load inside the Internal Defuddle Browser. The internal browser could load sites when their URLs were typed manually, but clicking a Google result either did nothing or previously escaped to the system default browser.

## Cause hypothesis

The internal browser is an Electron `<webview>`, not a full Chrome/Firefox browser UI. Some sites, especially Google, may use links or scripts that open results in a new browsing context using one or more of:

- `target="_blank"`
- `window.open(...)`
- popup/new-window behavior
- JavaScript-driven redirect handlers

Inside an Obsidian plugin webview, those new-window paths need to be explicitly redirected back into the same internal webview. Otherwise they may be blocked, do nothing, or open outside Obsidian depending on Electron/Obsidian behavior.

## Desired behavior

The desired behavior is explicit: when the user clicks a website link inside Google or any other page inside the custom webviewer, that website should open inside the same custom webviewer tab in Obsidian.

External Chrome/Firefox behavior is not wanted for normal in-webviewer browsing.

## Fix attempted

Added an in-page navigation shim after each `dom-ready` event.

The shim now aggressively keeps normal browsing inside the same webview:

- overrides `window.open(...)` for HTTP/HTTPS URLs and redirects those URLs into the same webview
- intercepts normal left-clicks on all HTTP/HTTPS `a[href]` links and redirects them into the same webview
- ignores modified clicks such as Ctrl/Cmd/Shift/Alt-click so future advanced behavior can be added intentionally
- ignores non-web links such as `mailto:`, `tel:`, `javascript:`, and same-page `#fragment` links
- changes existing `a[target]` values to `_self`
- changes forms with non-self targets back to `_self`

Also retained the plugin-side `new-window` handler.

## Build/sync verification

`npm run build` passed with exit code `0`.

Runtime files were copied into:

```text
<vault>/.obsidian/plugins/internal-defuddle-browser
```

Copied files:

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`

Verified the installed bundle contains `internalDefuddleNavigationShimInstalled`.

## Browser engine decision

The plugin cannot literally embed the user's installed Chrome or Firefox browser UI inside Obsidian. Obsidian is an Electron app, so the embeddable internal browser surface is Chromium via Electron `<webview>`.

A future setting can still support user browser preference for external-open behavior, for example:

- Open external links in system default browser
- Open external links in Chrome
- Open external links in Firefox
- Keep links inside Internal Defuddle Browser

But the internal in-Obsidian browsing engine itself will be Electron/Chromium, not the user's separate Chrome/Firefox installation.

## Next manual test

1. Reload Obsidian or disable/re-enable the plugin.
2. Open Internal Defuddle Browser.
3. Go to Google.
4. Search for something.
5. Click a result.
6. Confirm whether the result now loads inside the Obsidian tab.

If it still does not work, the next fallback is to inspect Google's actual clicked link behavior in DevTools and add a webview-level navigation handler or a preload-based navigation bridge.
