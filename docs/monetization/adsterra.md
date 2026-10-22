# Adsterra

Adsterra is configured in `components/adsterra-ad.tsx`. Each unit runs in its own iframe so its `atOptions` cannot overwrite another slot's configuration. The Adsterra tag requires cookie access; because the frame uses the site's origin, treat the publisher tag as trusted third-party JavaScript with access to the page.

## Placements

- Home: responsive 320x50, 468x60, or 728x90 display unit shown alongside the MU Komik campaign slot.
- Catalog: Native Banner shown alongside the MU Komik campaign in the inline catalog placement.
- Comic detail: 300x250 display unit shown alongside the MU Komik campaign slot.
- Reader: a 9:16 container using the 160x300 display unit after every 10th page. MU Komik campaign ads appear after pages 5, 15, 25, and so on; the two ad sources never share the same page break.
- Episode transition: 300x250 display unit shown alongside the MU Komik campaign. The five-second transition starts when either ad source reports available; reading continues after the existing load timeout if neither loads.

Adsterra ads are hidden for paid memberships and Kids Mode, consistent with the platform's existing advertising rules. Popunder is intentionally not installed.

The Adsterra zone IDs in the component are public publisher tag identifiers, not account credentials. The configured website must be approved and reachable on its production domain for Adsterra to serve ads; browser extensions and content-security rules can also block ad requests.
