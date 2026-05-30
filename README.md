# Judol Detector

Chromium extension for detecting suspected online gambling content using exact string matching, pattern matching, and fuzzy matching.

![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178c6)
![React](https://img.shields.io/badge/React-19-61dafb)
![Vite](https://img.shields.io/badge/Vite-8-646cff)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8)
![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-22c55e)

## Overview

Judol Detector scans visible text on a web page, detects suspicious gambling-related content, highlights detected text directly in the page, and reports scan statistics through a browser extension popup.

The extension is designed around four required detection strategies:

- Knuth-Morris-Pratt for exact keyword matching
- Boyer-Moore for exact keyword matching
- RegEx for `<word><number>` patterns
- Weighted Levenshtein Distance for visually modified or typo-like text

The same product scope also covers additional matching engines, censorship mode, OCR-based image scanning, and a public demo video.

## Features

- Chromium Manifest V3 extension
- React popup interface
- Tailwind CSS styling
- DOM text scanning through a content script
- Keyword source from `keywords/keyword.txt`
- KMP exact matching engine
- Boyer-Moore exact matching engine
- RegEx detector for terms such as `SLOT99`, `MAXWIN234`, and `ZEUS222`
- Weighted Levenshtein fuzzy matcher for text such as `H0KI88` or `G4COR`
- Visual-character substitution weights
- Highlight overlay for detected text
- Custom tooltip with keyword, algorithm, count, and execution time
- Popup statistics by algorithm and keyword
- Per-site popup state persistence
- Rescan support with cleanup of old highlights
- Blur mode for detected text
- OCR detection for text embedded inside images
- Aho-Corasick multi-pattern matching
- Rabin-Karp rolling-hash matching

## Architecture

```text
Popup UI
  -> sends scan command
  -> receives scan summary
  -> renders statistics

Content Script
  -> collects visible text nodes
  -> runs scanner pipeline
  -> highlights matches
  -> attaches tooltip metadata

Scanner
  -> reads keyword list
  -> runs exact matchers
  -> runs RegEx matcher
  -> runs fuzzy matcher
  -> returns normalized results

Algorithms
  -> KMP
  -> Boyer-Moore
  -> RegEx
  -> Weighted Levenshtein
  -> Aho-Corasick
  -> Rabin-Karp
```

## Detection Pipeline

```text
visible DOM text
-> text normalization
-> exact matching with KMP and Boyer-Moore
-> pattern matching with RegEx
-> fuzzy matching with Weighted Levenshtein
-> additional matching with Aho-Corasick and Rabin-Karp
-> OCR scan for image text
-> result deduplication
-> DOM highlight
-> blur/censorship
-> popup statistics
```

## Tech Stack

| Layer | Tooling |
| --- | --- |
| Language | TypeScript |
| Popup UI | React |
| Styling | Tailwind CSS |
| Build tool | Vite |
| Extension platform | Chromium Manifest V3 |
| OCR | Tesseract.js |
| Package manager | Bun |

## Project Structure

```text
.
├── public/
│   └── manifest.json
├── keywords/
│   └── keyword.txt
├── src/
│   ├── algorithms/
│   │   ├── kmp.ts
│   │   ├── boyerMoore.ts
│   │   ├── regexMatcher.ts
│   │   ├── weightedLevenshtein.ts
│   │   ├── ahoCorasick.ts
│   │   ├── rabinKarp.ts
│   │   └── types.ts
│   ├── ocr/
│   │   └── imageScanner.ts
│   ├── content/
│   │   ├── content.ts
│   │   └── scanner.ts
│   ├── popup/
│   │   ├── Popup.tsx
│   │   ├── main.tsx
│   │   └── popup.css
│   ├── styles/
│   │   └── content.css
│   └── chrome.d.ts
├── popup.html
├── vite.config.ts
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Bun
- Chrome, Chromium, Brave, Edge, or another Chromium-based browser

### Install

```bash
bun install
```

### Build

```bash
bun run build
```

The extension build is emitted to:

```text
dist/
```

Expected output:

```text
dist/
├── manifest.json
├── popup.html
├── popup.js
├── content.js
└── assets/
    └── popup.css
```

### Load in Chromium

1. Open:

```text
chrome://extensions
```

2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `dist/` folder.
5. Open a target page.
6. Click the Judol Detector extension icon.
7. Click Rescan.

## Usage

### Scan a Page

```text
Open page
-> open extension popup
-> click Rescan
-> detected text is highlighted
-> hover highlight for details
-> inspect statistics in popup
```

The popup displays:

- total detected matches
- total execution time
- match count per algorithm
- execution time per algorithm
- top matched keywords
- scan status
- OCR scanned, matched, and skipped image counts

### Blur Detected Text

Enable Blur detected text to visually obscure highlighted content without removing the detection metadata.

### OCR Image Scan

Enable OCR scan to extract text from visible page images, run the same matching pipeline on extracted text, and highlight or blur images that contain detected gambling terms.

### Per-Site State

Scan results are stored per active site/path. Results from one website are not shown when opening another website.

## Algorithms

### Knuth-Morris-Pratt

KMP performs exact keyword matching from `keywords/keyword.txt`. The implementation is expected to include:

- border/failure function
- iterative keyword matching
- match positions
- comparison counting
- execution time measurement

### Boyer-Moore

Boyer-Moore performs exact keyword matching from `keywords/keyword.txt`. The implementation is expected to include:

- last occurrence table
- right-to-left comparison
- shifting process
- match positions
- comparison counting
- execution time measurement

### RegEx

RegEx detects compact gambling-style patterns that combine words and numeric suffixes.

Pattern category:

```text
<word><2 or 3 digits>
```

Examples:

```text
SLOT99
MAXWIN234
GACOR777
ZEUS222
```

### Weighted Levenshtein

Weighted Levenshtein detects manipulated text by assigning smaller substitution costs to visually similar characters.

Examples:

```text
HOKI88  -> H0KI88
GACOR   -> G4COR
SLOT    -> 5LOT
```

Visual substitution groups:

| Group | Examples |
| --- | --- |
| O | `O`, `0`, `ο`, `о` |
| A | `A`, `4`, `α`, `а` |
| I | `I`, `1`, `l`, `|`, `ı` |
| E | `E`, `3`, `ε` |
| S | `S`, `5`, `$` |
| B | `B`, `8` |
| G | `G`, `6`, `9` |
| T | `T`, `7` |

### Aho-Corasick

Aho-Corasick provides efficient multi-pattern matching for large keyword sets. It builds a trie with failure links, then scans page text once to detect many keywords.

Expected output:

- matched keyword
- matched text
- start and end position
- match count
- execution time

### Rabin-Karp

Rabin-Karp provides rolling-hash-based string matching. It can be used as an alternative exact matcher for keywords from `keywords/keyword.txt`.

Expected output:

- matched keyword
- matched text
- start and end position
- hash comparison count
- execution time

## Advanced Features

### Censorship / Blur Text

Detected text can be visually censored without removing it from the DOM. This keeps page layout stable while hiding suspicious content from the user.

Expected behavior:

- blur can be toggled from the popup
- blur applies only to detected elements
- blur can be disabled without rescanning
- rescan cleans previous blur/highlight state

### OCR Image Detection

OCR detection extracts text from image elements and runs the detection pipeline against extracted text.

Expected behavior:

- scan visible page images
- extract text with Tesseract.js
- detect gambling keywords inside images
- highlight or blur detected images
- report OCR results in popup statistics

### Demo Video

The demo video should show:

- extension installation through Load unpacked
- scan on a real or local test page
- highlighted DOM text
- tooltip on hover
- popup statistics
- blur toggle
- OCR image detection behavior
- explanation of algorithms and performance comparison

## Keyword List

Keywords are stored in:

```text
keywords/keyword.txt
```

Format:

```text
one keyword per line
```

Example:

```text
slot
gacor
maxwin
slot online
new member
```

## Development

### Build

```bash
bun run build
```

### Lint

```bash
bun run lint
```

### Development Preview

```bash
bun run dev
```

The popup can be previewed at:

```text
http://localhost:5173/popup.html
```

Browser extension APIs only work fully after loading the built `dist/` folder as an unpacked extension.

## Roadmap

Core completion:

- KMP implementation
- Boyer-Moore implementation
- KMP/Boyer-Moore scanner integration
- KMP/Boyer-Moore popup statistics
- automated algorithm tests
- final report documentation

Extended capabilities:

- Aho-Corasick matcher
- Rabin-Karp matcher

## Authors

```text
Pasti_Gacor_Zeus

Anggota:
1. Athilla Zaidan Zidna Fann
2. Ray Owen Martin
3. Stevanus Agustav Wongso
```
