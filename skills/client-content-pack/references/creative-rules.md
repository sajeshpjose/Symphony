# Creative rules

A creative is a photo with three short lines of text and the client logo. Nothing else.

## Text (three elements only)
| Element | Max characters | Notes |
|---|---|---|
| Eyebrow | 24 | The topic in two or three words. Shown in capitals with spacing. |
| Heading | 40 | The point, as a short statement or question. Six words or fewer when possible. |
| Description | 80 | One short sentence that adds the useful detail. |

- No em dashes or en dashes. No banned words. No exclamation marks. No hashtags or URLs on the image.
- Do not repeat the heading in the description.
- Minimal character count wins. If it reads fine with fewer words, cut.

## Layout (strict)
- **No frame in frame.** No borders, outlines, boxes, cards, rounded panels, badges, pills, buttons, speech bubbles, inset frames or overlay rectangles. The photo fills the canvas edge to edge. Text sits directly on the photo.
- Legibility comes from a soft gradient fade at the bottom (and a lighter one at the top for the logo). A gradient is not a frame.
- Text is left-aligned in one block at the bottom left. The logo sits top left (or the position set in the profile) at a modest size. No other graphics, icons, shapes or stickers.
- Margins are even and generous. Keep text away from edges so platform crops do not cut it.
- Sizes: Facebook 1200 x 630, LinkedIn 1200 x 627, Instagram 1080 x 1350.

## Logo
- The client logo comes from the profile (`brand.logo_path`), added when the client is onboarded. Never invent, redraw or restyle a logo.
- PNG with a transparent background, at least 600 pixels wide, or SVG.
- `logo_mode` is `original` or `white`. Use `white` for dark or busy photos when the logo is a single colour.
- If no logo is on file, render without it and tell the user.

## Images
The user chooses the image. Never create or generate images. For each topic, give search keywords for stock sites (Unsplash, Pexels, Pixabay) or the client's own photos:
- **Primary search**: three to five words naming the subject, for example "autumn lawn raking".
- **Two alternates** with different angles.
- **Look for**: landscape orientation, at least 2400 pixels wide, calm empty space in the lower left, no text or logos in the photo, natural light, one clear subject.
- **Avoid**: obvious stock poses, heavy filters, watermarks, busy detail in the lower left, visible faces of private people.
Remind the user to check the licence and to attribute where it asks.

## Contrast
Heading and description are white on the darkened fade. The eyebrow uses the brand accent colour only if it reads clearly on the fade, otherwise white. The render script checks this and prints a warning.
