# Security Policy

SyncKai is a browser extension that syncs what you watch on streaming platforms to AniList and MyAnimeList. It has no server of its own: everything runs in your browser, and it only talks to the AniList and MyAnimeList APIs. Security reports are welcome and taken seriously.

## Supported versions

Only the latest version published on the stores receives security fixes.

| Version | Supported |
| --- | --- |
| Latest release on the [Chrome Web Store](https://chromewebstore.google.com/detail/synckai/khokcmigioggannjoojambdgioigdceb) and [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/synckai/) | ✅ |
| Older releases | ❌ (update the extension) |
| `develop` branch | ✅ (fixes land here first) |

## Reporting a vulnerability

**Please do not open a public issue, pull request or discussion for a security problem.**

Report it privately through GitHub: open the [Security tab](https://github.com/Sync-Kai/SyncKai/security) of this repository and click **Report a vulnerability**. Only the maintainers can read the report.

Please include:

- the affected version (shown at the bottom of the popup, or in `chrome://extensions` / `about:addons`) and browser;
- what an attacker can do, and under which conditions (for example: a malicious web page, another extension, a network attacker);
- steps to reproduce, or a proof of concept;
- any idea of a fix, if you have one.

Never include real access tokens, cookies or personal data in a report: use test accounts.

## What to expect

SyncKai is maintained by one person in their spare time. Target timelines:

- acknowledgement within **7 days**;
- a first assessment (confirmed or not, severity) within **14 days**;
- a fix released within **30 days** for high or critical issues, as part of the next release otherwise.

Store reviews (Chrome Web Store, Firefox Add-ons) can add a few days before a fix reaches users. You will be kept informed, and credited in the release notes and the security advisory if you wish. Please give us a reasonable time to ship a fix before disclosing the issue publicly.

## Scope

In scope:

- the extension in this repository: service worker, popup, side panel, settings and import pages, content scripts and the page bridges that run on Crunchyroll, ADN, Netflix, Disney+ and Prime Video;
- the handling of the AniList and MyAnimeList sign-in and tokens (stored encrypted, decrypted only in the service worker);
- the backup file format and its import;
- the build and release pipeline in `.github/workflows/`.

Out of scope:

- vulnerabilities in AniList, MyAnimeList or the streaming platforms themselves (report them to those services);
- attacks that require an attacker who can already read your browser profile folder or control your device;
- the presentation website [synckai.app](https://synckai.app) (separate repository);
- reports produced only by automated scanners without a demonstrated impact.

## Good faith

Research done in good faith, within this policy, on your own accounts, without harming other users and without accessing data that is not yours, will not lead to any complaint from the maintainer. See also the [privacy policy](PRIVACY.md) for what the extension stores and sends.
