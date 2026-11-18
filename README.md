# gnome-website

The Gnome Trading Group website: a single page built with React, TypeScript and Vite, deployed by the CDK pipeline in `cdk/`.

## Develop

```sh
npm install
npm run dev     # local dev server
npm run build   # type-check and build to dist/
```

## Layout

- `src/App.tsx`: the page sections and copy.
- `src/components/WireHat.tsx`: the fixed wireframe hat that morphs as the page scrolls.
- `src/components/Terminal.tsx`: the hidden terminal (press `~`, click the footer `_`, or click the cursor at the bottom of the page) and its `vim` file viewer.
- `src/terminal/`: the terminal's filesystem, shell commands and markdown highlighter.
- `src/content/`: the files the terminal can read.

## Terminal content

Everything in `src/content/` is bundled at build time and mounted at the guest's home directory (`~`). A leading `_` in a file or folder name becomes a `.`, so it is hidden from plain `ls`:

| In the repo                   | In the terminal         |
|-------------------------------|-------------------------|
| `src/content/README.md`       | `~/README.md`           |
| `src/content/_gnomerc`        | `~/.gnomerc`            |
| `src/content/_infra/feed.md`  | `~/.infra/feed.md`      |

To add or edit a document, change the file and rebuild. `vim <file>` shows the raw markdown beside the rendered version.
