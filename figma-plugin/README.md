# Symph covers (Figma plugin)

Makes new cover frames from a client's Figma templates, using the cover text Symph wrote for each post.
The templates are only ever cloned, never edited. Each run adds a new section per post on a **Posts** page.

## One-time setup
1. In the Symph app: Settings, Figma plugin, **Create token**. Copy it (it is shown once).
2. Build the plugin:
   ```
   cd figma-plugin
   npm install
   npm run build
   ```
3. In Figma desktop: Plugins, Development, **Import plugin from manifest…**, choose `figma-plugin/manifest.json`.

## Per client
- Keep one Figma file per client with the template frames at the top level of a page. Name each frame with its size, for example
  `Instagram - 1080x1350`. Inside, keep text layers named `Eyebrow`, `Heading` and `Description`.
  Put the client's logo on the templates once. The photo is yours to swap on each new frame.
- Add the file link to the client in Symph (Business details, Social templates).

## Each time
1. Open the client's file, then run Plugins, Development, **Symph covers**. It finds the templates on any page except Posts.
2. First run: paste the address (your Symph site) and the token. They are remembered.
3. Pick the client, tick the posts and the templates, press **Create frames**.
4. Replace the photo on each new frame.

Posts show up once they have cover text (write it on the post page in Symph).
Tighten `networkAccess.allowedDomains` in `manifest.json` to your site address if you publish the plugin.
