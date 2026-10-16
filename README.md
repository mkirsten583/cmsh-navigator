# CMSH Navigator

Search Queensland coal mining safety legislation, recognised standards and guidance notes by asking questions in plain words. The tool suggests the relevant clauses, shows which Act and Regulation sections they rely on, and links related provisions across documents.

Runs entirely in the browser (GitHub Pages). Your own data is stored in OneDrive through a Microsoft sign-in, the same way Action Tracker works (with its own app registration).

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The app |
| `parser.js` | Reads PDFs into sections and finds cross-references (used for documents you add) |
| `docs.json` | The built-in index of 34 documents: the Act (current as at 1 July 2026), the Regulation (current as at 1 September 2026), RS1–RS23, QGN9/15/22/26/32/35/36, the VCD hatch seals guideline and the RSHQ Compliance and Enforcement Policy (January 2025) |
| `pdfs/` | The source PDFs, so "Open PDF at page" works |
| `icon-180.png` | Home-screen icon |

## Set up (once)

1. **Create the repository.** On GitHub, create a public repository named `cmsh-navigator`. Choose *Add file → Upload files* and drag in everything in this folder, including the `pdfs` folder. Commit.
2. **Turn on GitHub Pages.** *Settings → Pages → Build and deployment*: Source **Deploy from a branch**, Branch **main**, folder **/ (root)**. Save. After a minute the app is at
   `https://mkirsten583.github.io/cmsh-navigator/`
3. **Sign-in app registration.** The app uses its own Azure registration, **CMSH Navigator** (client ID `05ddd0d6-958a-4762-b2c9-b60e17fd23d1`, personal Microsoft accounts only), with the single-page application redirect URI
   `https://mkirsten583.github.io/cmsh-navigator/`
   If the address ever changes, add the new one under *Authentication* in that registration.
4. Open the app and choose **Sign in with Microsoft**.

## Home screen and sign-in

- **Home** (top right) takes you back to the start screen: clears the search and filters, closes any open clause and returns to the Search tab.
- Sign-in is remembered in the browser. Inside the dashboard, Microsoft's sign-in page can't load in the embedded view, so **Sign in with Microsoft** opens a small pop-up window instead (allow pop-ups for mkirsten583.github.io if the browser asks). If the sign-in ever needs renewing while embedded, the status line shows **Sign in again** rather than leaving the page.

## Where your data goes

Everything is kept in your OneDrive folder `marc.kirsten\Browser Tools\Legislation` (on your PC: `C:\Users\Marc.Kirsten\OneDrive\marc.kirsten\Browser Tools\Legislation`). The app creates anything missing on first save:

```
OneDrive/marc.kirsten/Browser Tools/Legislation/
  cmsh-navigator-data.json   verification dates, "newer version" flags, saved searches
  documents/                 documents you add or replace (index .json + original .pdf)
  reports/                   PDF reports you choose to save to OneDrive
```

To use a different folder, change `folder` in the CONFIG block near the top of the script in `index.html`.

Before you sign in, saved searches and verifications are kept in that browser. They move into OneDrive the first time you sign in.

## Using it

- **Search**: type a question. Results rank matching clauses; the panel on top lists the Act/Regulation sections those clauses cite. Filter by Act & Regulation, standards, or guidance & policies.
- **Match**: next to the filters. **Best match** ranks clauses by relevance (including related terms such as SSE / site senior executive). **All words** only shows clauses containing every word in your question. **Exact phrase** only shows clauses containing your words together, in order. Words in "quotes" must always appear together, whichever setting is on. The setting is remembered, and saved searches keep the setting they were saved with.
- **Reader**: references in the text are clickable. The side panel shows what the clause cites, what cites it, other documents relying on the same provisions, and similar wording elsewhere.
- **Cross-reference map**: every Act and Regulation section cited across the library, with the citing documents.
- **Library & versions**: version and date read from each PDF, status flags (over 5 years old, cites the repealed 2001 Regulation, newer version recorded), **Mark verified**, **Record newer version**, **Replace** and **Revert**.
- **Saved searches**: save a question with a description and keywords; filter by keyword; re-run any time.
- **Export PDF**: from any search (or the **PDF** button on a saved search) create a PDF report: the question, filters, date and library versions, the legislation the results rely on, and each matching clause with its source, version and page. Choose how many results and whether to include the full clause text. When signed in, a copy can also be saved to `Browser Tools/Legislation/reports/` in OneDrive.

## Adding or replacing documents

When RSHQ or legislation.qld.gov.au publishes a newer version, download the PDF and use **Replace** on that document in **Library & versions** (or **Add a new document** for something new — any text-based PDF works, e.g. RSHQ policies, safety alerts, site procedures; set the type to *Policy / other* and give it a short code). Check the detected details and save. Added documents are stored in your OneDrive and appear on every device you sign in on; the previous copy is kept so you can revert.

## Updating the built-in documents

To change the built-in set (`docs.json` + `pdfs/`), ask Claude to rebuild it and upload the new files to the repository. Documents added through the app don't need this; they live in OneDrive.
