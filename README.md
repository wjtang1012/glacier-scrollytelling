# What Happens When the Ice Disappears?

Work-in-progress static scrollytelling website. Entry point: `index.html`.
Edit the HTML, CSS, JavaScript and data files directly; there is no build step.
The page currently loads D3 and its geographic projection plugin from jsDelivr,
and Roboto fonts from Google Fonts, so these resources require internet access.

## Preview locally

Open this folder in VS Code and use **Open with Live Server** on `index.html`.
Use the HTTP preview, not a `file://` URL: the charts and maps fetch CSV, GeoJSON
and SVG files. Local file URLs can block those requests.

## Publish later with GitHub Pages

When you are ready to create a repository, use **this folder as its root**, so
`index.html`, `style.css`, the JavaScript files, `assets/` and `data/` are at the
repository root. Use the `main` branch.

After your first push, configure the repository once:

1. Open **Settings → Pages**.
2. Set **Source** to **Deploy from a branch**.
3. Select **main** and **/(root)**, then save.

The site will be served at `https://USERNAME.github.io/REPOSITORY/`.
The empty `.nojekyll` file makes this a plain static site; no custom GitHub
Actions workflow, build command, deployment script or package installation is needed.

After that setup, update the site by editing, previewing and running:

```sh
git add .
git commit -m "Update website"
git push
```

GitHub Pages publishes the changes pushed to `main`; updates may take a few minutes.
See [GitHub's publishing-source instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Keep future edits portable

- Use relative paths such as `./data/file.csv` and `./assets/svg/image.svg`.
- Match filename capitalization exactly; GitHub Pages paths are case-sensitive.
- Avoid `/data/...`, machine paths and localhost URLs in website assets or code.
- Commit required data and artwork with the code. `.gitignore` only excludes
  OS/editor clutter, temporary caches and the existing local backup directory.
- Keep `index.html` and `.nojekyll` at the publishing root.

Preparation does not create a Git repository, configure a remote or publish anything.
