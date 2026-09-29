# test: Property Assistant

Made by Montana. Version 0.7.27, review build.

[Download / install the Tampermonkey script](https://raw.githubusercontent.com/TheOfficialsixx/test/main/enabledplus-property-assistant.test.user.js)

Open the link with Tampermonkey installed, or save the file and import it into Tampermonkey. Disable older copies of Property Assistant before testing this version. It does not replace the separate historic or appointment-history tools.

## Features

- Smaller compact rectangle: 210 × 170 default, resizable down to 170 × 120, with tighter controls and preserved theme artwork. Full and compact views retain independent saved sizes, wrapping source results and subtle links to matching listings.

- Canadian lead distance estimates from Mississauga, with Maps verification. The 150 km cutoff is Central GTA only, not Eastern GTA.
- Read-only duplicate candidate lookup.
- Zillow, Redfin and Realtor.com property-type checks, conflict warnings, and address-mismatch rejection where the listing address is readable.
- Optional automatic opening of one selected property source.
- Formatted copy buttons for homeowner, address and assigned consultant.
- Independent appointment-history warnings, supporting evidence and next-action guidance. The companion history tool is optional.
- Fifty illustrated themes, draggable/resizable window, remembered settings, compact and circular minimized modes.
- Small pulsing notification dots instead of flashing section bars; reduced-motion support.
- Optional active-tab audio with a persistent bottom sound switch in full and compact views. The saved mute preference applies across leads.
- Theme previews and favorites, artwork enabled by default with an independent toggle, density and large-text options, and compact-view preferences.
- Property-type check marks in circle mode only after a matching, fresh listing is read. Mobile/manufactured warnings and optional unit-number review remain visible.
- No company-record edits.

## Important limitations

External sites may block requests or have no matching listing. Unavailable is not verified. Distance estimates, including street-level matches, require review near the cutoff. Postal-area and city/suburb fallbacks are explicitly labeled approximate and cannot establish cutoff eligibility. Automatic routes may include tolls. Toronto alone does not establish Central versus Eastern territory. No result is company approval to confirm an appointment. History guidance reflects saved reference material and should be checked against current company policy.

Address checks send the lead address to external search, housing, geocoding and routing services. Use only with company authorization. No customer records or credentials are included in this repository.

Nineteen local test suites passed before upload. Synthetic browser testing covered rendering, notifications and saved sound settings. The synthetic testing page is not part of the installed script. Live-lead validation of this build remains pending; this is not a guarantee of live external-site availability.

To update on another PC, open the install link and accept the update in Tampermonkey, then refresh the lead tabs. Refreshing the lead alone does not install this update. Disable duplicate older Property Assistant copies.

Unofficial tool, not endorsed by Enabled+ or Renewal by Andersen. See PROPERTY-ASSISTANT-NOTICE.md for attribution and review terms. No automatic update URL is configured for this review build.
