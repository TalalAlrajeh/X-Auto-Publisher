# Duenox TikTok media

This directory stores public media for the Duenox TikTok posts. It is isolated from the X/Buffer publisher in `src/` and the existing X workflows.

## Enable free hosting (one-time)

1. In GitHub, open **Settings → Pages** for `TalalAlrajeh/X-Auto-Publisher`.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch `main`, folder `/docs`, then **Save**.
4. Wait for GitHub to show the Pages URL: `https://talalalrajeh.github.io/X-Auto-Publisher/`.
5. Put one final media file per post under `docs/tiktok/`. Example `duenox-001.jpg` will then have the direct HTTPS URL `https://talalalrajeh.github.io/X-Auto-Publisher/tiktok/duenox-001.jpg`.
6. Test the direct URL in a private browser window before sending it to Metricool. Do not schedule if the response is not the image itself.

## Media requirements

- Exactly **one design per post**; vertical 9:16, ideally 1080 × 1920 px.
- Export as JPEG or PNG (not SVG/HTML) and keep the file size within Metricool/TikTok's current limits.
- Include `duenox.com` on the artwork and in the caption. The URL printed on a picture is *not* clickable; add the website to the TikTok profile's website field if the account supports it.
- For photo posts, use `autoPublish: true` and `tiktokData.autoAddMusic: false`. If a post needs a vocal-only background, prepare an actual video with permitted vocal-only audio before scheduling; disabling auto music does not add that audio by itself.
- Avoid duplicate scheduling: inspect Metricool's pending posts and check the final publication status.

GitHub Pages **only hosts the image**. Scheduling and publishing must be performed separately through the connected Metricool app; GitHub Actions cannot bypass Metricool API or TikTok account restrictions.
