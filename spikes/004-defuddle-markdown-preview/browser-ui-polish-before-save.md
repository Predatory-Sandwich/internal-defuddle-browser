# Browser UI polish before Spike 005

## User requests

Before implementing vault saving, the user asked for several browser/UI improvements:

1. Add an `Internal Defuddle Browser` launcher link/button to Obsidian's empty new-tab screen, near the built-in `Create new note`, `Go to file`, and `Close` actions.
2. Rename the plugin from `Internal Defuddle Browser` to `Internal Defuddle Browser`.
3. Hide Obsidian's small top-left view history arrows for this custom browser view because they do not control the internal webview and the custom large in-view buttons are preferred.
4. Make the Obsidian tab title reflect the current webpage/page title instead of always showing `Internal Defuddle Browser`.

## Changes implemented

### Plugin name

Updated `manifest.json`:

```json
"name": "Internal Defuddle Browser"
```

The plugin id remains unchanged:

```json
"id": "internal-defuddle-browser"
```

Keeping the id stable avoids breaking the installed plugin folder and existing Obsidian plugin state.

### Empty new-tab launcher

Added a DOM observer that looks for Obsidian empty-tab views and injects a text-style button:

```text
Internal Defuddle Browser
```

The button is styled like Obsidian's empty-tab action links and attempts to replace the active empty leaf with the Internal Defuddle Browser view.

This uses DOM integration because Obsidian does not expose a clean public API for adding custom actions to the built-in empty-tab page.

### Hide Obsidian view-history buttons

Added CSS scoped to leaves containing this view:

```css
.workspace-leaf:has(.workspace-leaf-content[data-type="internal-defuddle-browser-browser"]) .view-header-nav-buttons {
  display: none !important;
}
```

The custom toolbar's large back/forward/reload buttons remain visible and continue controlling the internal webview.

### Dynamic tab title

The view now keeps a `currentDisplayTitle`, returns it from `getDisplayText()`, and updates it from:

```js
document.title || location.hostname || location.href
```

It also directly updates Obsidian's tab header/title DOM for immediate visual feedback.

When Defuddle preview is shown, the tab title changes to the extracted article title. When returning to the original webpage, it restores the web page title.

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

Runtime files synced into:

```text
<vault>/.obsidian/plugins/internal-defuddle-browser
```

Verified installed bundle contains:

- `Internal Defuddle Browser`
- `internal-defuddle-browser-empty-tab-launcher`
- `updateTitleFromWebview`
- `workspace-tab-header-inner-title`
- CSS hiding `.view-header-nav-buttons`

## Manual test plan

1. Reload Obsidian or disable/re-enable the plugin.
2. Confirm the Community Plugins/plugin list name shows `Internal Defuddle Browser`.
3. Open a new empty tab and check for an `Internal Defuddle Browser` action near `Create new note`, `Go to file`, and `Close`.
4. Click that action and confirm it opens/replaces with the browser view.
5. Confirm the tiny Obsidian top-left back/forward arrows are hidden for this view.
6. Confirm the large custom toolbar buttons still show and still work.
7. Navigate to a webpage and confirm the tab title changes to the current website/page title.
8. Click `Clip` and confirm the tab title changes to the article title during preview.
9. Press Backspace and confirm the original webpage returns and the tab title returns to the page title.

## Status

READY FOR MANUAL TESTING
