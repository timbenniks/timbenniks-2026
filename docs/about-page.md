# About Page

The `/about` page now follows the same data-driven section renderer as the homepage.

- Page metadata and sections live in `src/content/pages.json` under the `about` entry.
- `src/pages/about.astro` only loads `pages/about`, preloads marked hero images, and renders `PageSections`.
- The about hero uses `imageLeft: true`, which places the image before the copy on desktop while keeping copy first on mobile.
- Image/text sections can use `equalWidth: true` for 50/50 desktop columns and `imageSide: "left"` or `"right"` for image placement.
- Image/text `body` values are rendered as Markdown, so JSON strings can include multiple paragraphs with `\n\n`, links, emphasis, and lists.
- The content is adapted from the previous live about page and uses the existing section types only.
- FAQ and detailed career timeline content are not included yet because they need dedicated section support.
