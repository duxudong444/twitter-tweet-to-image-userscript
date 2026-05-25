# Twitter/X Tweet to Image Userscript

A Tampermonkey userscript that adds a "转图片" button to X/Twitter tweets and generates a shareable PNG preview.

## Features

- Generate tweet share images directly on X/Twitter.
- Support normal images, videos as preview covers, quoted tweets, and quoted media.
- Download PNG or copy the generated image to clipboard.
- Handles long tweet cards without cropping the exported image.

## Install

1. Install Tampermonkey or another compatible userscript manager.
2. Install `twitter-tweet-to-image.user.js`.
3. Open `https://x.com` or `https://twitter.com`.
4. Click the `转图片` button on a tweet.

## Known Follow-Up Items

- Link preview cards with images are not fully supported yet.
- Generated card theme is currently light by default.
- Browser download location is controlled by browser/userscript manager behavior.

## Development Notes

The project requirements and collaboration notes are kept in:

- `REQUIREMENTS.md`
- `AI_COLLAB.md`

