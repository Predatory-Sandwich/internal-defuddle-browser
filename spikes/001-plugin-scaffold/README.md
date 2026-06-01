# Spike 001 - Obsidian Plugin Scaffold

Date: 2026-05-31
Status: VALIDATED

## Question

Given a new Obsidian plugin scaffold, when it is built, can it register commands and open a custom blank view?

## What was built

Created plugin scaffold at:

```text
<plugin-dev-folder>
```

Files:

```text
manifest.json
package.json
package-lock.json
tsconfig.json
versions.json
esbuild.config.mjs
styles.css
README.md
src/main.ts
main.js
```

## Implemented behavior

The plugin currently:

- Registers a custom view type: `internal-defuddle-browser-browser`
- Adds a ribbon icon using the scissors icon
- Adds command: `Open Internal Defuddle Browser`
- Adds command: `Clip current Internal Defuddle Browser page (spike placeholder)`
- Opens a custom Obsidian tab called `Internal Defuddle Browser`
- Shows a placeholder toolbar with:
  - Back
  - Forward
  - Reload
  - URL input placeholder
  - Folder button placeholder
  - Clip button placeholder

## Verification

Ran:

```bash
npm install
npm run build
```

Result:

```text
Build passed.
main.js generated.
```

## Fixes needed during scaffold

TypeScript 6 deprecation checks required adding this to `tsconfig.json`:

```json
"ignoreDeprecations": "6.0"
```

The build also required installing `tslib` because `importHelpers` is enabled.

## Verdict: VALIDATED

### What worked

- The scaffold builds successfully.
- The plugin has the required Obsidian files.
- The custom view code compiles.
- The plugin loads inside the actual Obsidian desktop app.
- The `Open Internal Defuddle Browser` command opens the custom view.
- The placeholder toolbar/template layout appears as intended.
- The first technical foundation is ready.

### User confirmation

The user confirmed in Obsidian that the view appears, says Spike 001 is active, and shows the planned template/layout.

### What did not get tested yet

- Webpage loading.
- Webview creation.
- Rendered DOM capture.
- Defuddle extraction.
- Vault save flow.

### Recommendation for the real build

Next spike should add an actual controlled webview/browser surface inside the custom view and test whether it can load a webpage from a URL bar.

SUPER.
