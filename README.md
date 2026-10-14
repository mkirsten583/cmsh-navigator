# CMSH Navigator

Search Queensland coal mining safety legislation, recognised standards and guidance notes by asking questions in plain words. The tool suggests the relevant clauses, shows which Act and Regulation sections they rely on, and links related provisions across documents.

Runs entirely in the browser (GitHub Pages). Your own data is stored in OneDrive through a Microsoft sign-in, the same way Action Tracker works (with its own app registration).

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The app |
| `parser.js` | Reads PDFs into sections and finds cross-references (used for documents you add) |
| `docs.json` | The built-in index of 33 documents: the Act (current as at 1 July 2026), the Regulation (current as at 1 September 2026), RS1–RS23, QGN9/15/22/26/32/35/36 and the VCD hatch seals guideline |
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

## Where your data goes

On first save the app creates a folder in your OneDrive:

```
OneDrive/CMSH Navigator/
  cmsh-navigator-data.json   verification dates, "newer version" flags, saved searches
  documents/                 documents you add or replace (index .json + original .pdf)
```

Before you sign in, saved searches and verifications are kept in that browser. They move into OneDrive the first time you sign in.

## Using it

- **Search**: type a question. Results rank matching clauses; the panel on top lists the Act/Regulation sections those clauses cite. Filter by Act & Regulation, standards, or guidance.
- **Reader**: references in the text are clickable. The side panel shows what the clause cites, what cites it, other documents relying on the same provisions, and similar wording elsewhere.
- **Cross-reference map**: every Act and Regulation section cited across the library, with the citing documents.
- **Library & versions**: version and date read from each PDF, status flags (over 5 years old, cites the repealed 2001 Regulation, newer version recorded), **Mark verified**, **Record newer version**, **Replace** and **Revert**.
- **Saved searches**: save a question with a description and keywords; filter by keyword; re-run any time.

## Adding or replacing documents

When RSHQ or legislation.qld.gov.au publishes a newer version, download the PDF and use **Replace** on that document in **Library & versions** (or **Add a new document** for something new). Check the detected details and save. Added documents are stored in your OneDrive and appear on every device you sign in on; the previous copy is kept so you can revert.

## Updating the built-in documents

To change the built-in set (`docs.json` + `pdfs/`), ask Claude to rebuild it and upload the new files to the repository. Documents added through the app don't need this; they live in OneDrive.
