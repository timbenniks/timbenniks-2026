# Speaking structured data

The September 16, 2026 Search Console export reported 36 valid Event items,
no critical issues, and seven non-critical missing-field warnings: location
address, organizer URL, end date, offers, image, event status, and description.

`/speaking` is a speaker portfolio and archive of multiple appearances. It has
no individual event detail pages, and the source records contain only a talk
title, conference, date, location label, and optional external link. Those
records cannot reliably supply venue addresses, ticket offers, or end dates.

Removed the Event JSON-LD emitted for every talk and its unused helper. The
page keeps its WebPage, WebSite, Person, and BreadcrumbList structured data;
the visible talk listings, links, and machine-readable content remain intact.
This removes the source of all seven warnings rather than inventing event data.
The archive no longer advertises eligibility for Google event rich results.

[Google's event guidelines](https://developers.google.com/search/docs/appearance/structured-data/event#technical-guidelines)
require a unique leaf page for each event and a page focused on a single event.
Only add Event markup again if dedicated event pages and verified event details
are available.

After deployment, Google must recrawl `/speaking` before Search Console reflects
the removal. The downloaded CSV report folder was removed after local validation.

Validation also exposed an obsolete logger argument in the Cloudinary image
service. Its srcset hook and getURL call now match the installed Astro API
(two arguments); image URL generation is unchanged.

Validation: `npm run build` and `npm run check` pass (23 existing hints,
no errors or warnings). The generated HTML contains all 91 talks, no Event
objects, all four expected page schema types, and Cloudinary srcsets.

The required deployed-site Agentlint scan scored 100 after resolving its six
evidence-based reasoning tasks. Its remaining P1 recommendation reports that
`document.modelContext` is unavailable in the scanner browser. The public
script already detects both document and navigator modelContext and exposes
the catalog without registration when neither exists. No browser polyfill or
deployment was added to make that environment-specific check pass. All bounded
missions passed; N/A checks were left unchanged.
