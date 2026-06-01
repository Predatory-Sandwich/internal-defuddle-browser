# Spike 004: Defuddle Markdown Preview

## Status

VALIDATED

## Question

Given rendered HTML captured from the Internal Defuddle Browser webview, when the user clicks `Clip`, can the plugin run Defuddle and produce a clean Markdown preview inside Obsidian?

## Why this matters

Spike 003 proved that rendered page data can cross from the webview into the plugin. Spike 004 tests the next critical step: converting that captured rendered HTML into useful article Markdown.

This spike intentionally does not save notes to the vault yet. It only validates extraction quality and bundling/runtime behavior.

## Implementation

Installed dependency:

```bash
npm install defuddle
```

Updated `src/main.ts`:

- Imports `Defuddle` from `defuddle`.
- Imports `createMarkdownContent` from `defuddle/full`.
- The existing `Clip` button now:
  1. captures rendered `document.documentElement.outerHTML` from the webview
  2. parses the HTML with `DOMParser`
  3. runs `new Defuddle(parsedDocument, { url, separateMarkdown: true })`
  4. falls back to `createMarkdownContent(result.content, url)` if needed
  5. opens an Obsidian modal titled `Spike 004 Defuddle Markdown Preview`

The preview modal shows:

- source URL
- extracted title
- original page title
- author/site/published if available
- word count
- extractor type
- rendered HTML length
- extracted HTML length
- Markdown length
- Markdown preview textarea

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

## Installed runtime sync

Copied runtime files into:

```text
<vault>/.obsidian/plugins/internal-defuddle-browser
```

Copied files:

- `manifest.json`
- `main.js`
- `styles.css`
- `versions.json`

Verified installed `main.js` contains:

```text
Spike 004 Defuddle Markdown Preview
```

## Manual test plan

In Obsidian:

1. Reload Obsidian or disable/re-enable the plugin.
2. Open `Internal Defuddle Browser`.
3. Load a clean article page, such as the PubMed Central article previously tested.
4. Click `Clip`.
5. Expected result: a modal titled `Spike 004 Defuddle Markdown Preview` appears.
6. Check that the textarea contains readable Markdown, not only navigation boilerplate.
7. Try one ordinary blog/news article too.

## Verdict

VALIDATED

### Manual Obsidian verification

The user tested Spike 004 inside Obsidian and provided a screenshot showing the `Spike 004 Defuddle Markdown Preview` modal.

Visible extracted example from RecipeTin Eats:

```json
{
  "url": "https://www.recipetineats.com/birria-tacos/",
  "title": "Birria Tacos",
  "pageTitle": "Birria Tacos - RecipeTin Eats",
  "author": "Nagi",
  "site": "RecipeTin Eats",
  "wordCount": 6848,
  "extractorType": "default",
  "renderedHtmlLength": 683068,
  "extractedHtmlLength": 79018
}
```

The modal displayed the page description:

```text
Here’s how to make our legendary Birria Tacos. This recipe delivers big flavour in every crispy, cheesy bite!
```

The Markdown preview contained readable article/recipe content, including an image Markdown link and body text such as:

```markdown
And this is how you eat them:

![Birria Tacos recipe](https://www.recipetineats.com/tachyon/2025/09/Birria-tacos_1a.jpg?resize=1200%2C1500&zoom=1)

Birria Tacos recipe

Have I got your attention? 😅
```

This validates rendered HTML → Defuddle extraction → Markdown preview inside Obsidian.

### What worked so far

- Dependency installed.
- TypeScript build passed.
- Runtime bundle generated.
- Installed plugin bundle contains the Spike 004 preview modal.
- Defuddle ran successfully inside Obsidian at runtime.
- Markdown preview is useful and article-like for a real recipe page.
- Extraction metadata was populated, including title, author, site, word count, rendered HTML length, and extracted HTML length.

### What still needs later testing

- Extraction quality across more article/blog/news/science pages.
- Large rendered pages and slow pages under repeated use.
- YouTube-specific extraction/transcript behavior.
- Vault file creation and filename/path handling.

## Recommendation if validated

Proceed to Spike 005: Vault Save.

Given extracted Markdown, when the user clicks a save action, create a Markdown note in the vault using `app.vault.create()`. Use a simple hardcoded/default folder first, then add a real folder picker afterward.
