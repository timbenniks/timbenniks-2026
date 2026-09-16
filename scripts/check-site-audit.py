"""Check the September 2026 audit pages after `npm run build`."""
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = [
    '/', '/about', '/ai', '/alive-and-kicking', '/contact', '/developers',
    '/livestreams', '/projects',
    *('/projects/' + slug for slug in (
        'agentlint', 'butterkeys', 'contentstack-mcp-hub', 'contentstack-openapi',
        'contentstack-platform-sdk', 'contentstack-stacksmith', 'contentstack-webmcp',
        'cursor-rules', 'dex', 'doorbell-devrel', 'loadout',
        'mach-alliance-enterprise-ai-agents', 'nuxt-contentstack', 'open-loops',
        'turbo-relay',
    )),
]


class AuditPage(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ''
        self.in_title = False
        self.description = ''
        self.invalid_images = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'title':
            self.in_title = True
        if tag == 'meta' and attrs.get('name') == 'description':
            self.description = attrs.get('content', '')
        if tag == 'img':
            # Astro serializes alt="" as a bare alt attribute. Decorative
            # backgrounds explicitly hidden from assistive tech may be empty.
            if 'alt' not in attrs or (
                not (attrs.get('alt') or '').strip()
                and attrs.get('aria-hidden') != 'true'
            ):
                self.invalid_images.append(attrs.get('src'))

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


for path in PAGES:
    page = AuditPage()
    page.feed((ROOT / 'dist/client' / path.lstrip('/') / 'index.html').read_text())
    assert 30 <= len(page.title) <= 60, (path, 'title', len(page.title))
    assert 120 <= len(page.description) <= 160, (path, 'description', len(page.description))
    assert not page.invalid_images, (path, 'alt text', page.invalid_images)

print(f'Passed: metadata lengths and image alternatives on {len(PAGES)} audit pages.')
