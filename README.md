# test: Property Assistant

Made by Montana. Version 0.6.0, review build.

[Download / install the Tampermonkey script](https://raw.githubusercontent.com/TheOfficialsixx/test/main/enabledplus-property-assistant.test.user.js)

Open the link with Tampermonkey installed, or save the file and import it into Tampermonkey. Disable older copies of Property Assistant before testing this version. It does not replace the separate historic or appointment-history tools.

## Features

- Canadian lead distance estimates from Mississauga, with Maps verification. The 150 km cutoff is Central GTA only, not Eastern GTA.
- Read-only duplicate candidate lookup.
- Zillow, Redfin and Realtor.com property-type checks, conflict warnings, and address-mismatch rejection where the listing address is readable.
- Optional automatic opening of one selected property source.
- Formatted copy buttons for homeowner, address and assigned consultant.
- Four themes, draggable/resizable window, remembered settings and minimized warnings.
- No audio or company-record edits.

## Important limitations

External sites may block requests or have no matching listing. Unavailable is not verified. Distance estimates, including street-level matches, require review near the cutoff. Toronto alone does not establish Central versus Eastern territory. No result is company approval to confirm an appointment.

Address checks send the lead address to external search, housing, geocoding and routing services. Use only with company authorization. No customer records or credentials are included in this repository.

Eight local test suites passed before upload. Synthetic browser testing covered rendering, retry and minimized warnings; this is not a guarantee of live external-site availability.

Unofficial tool, not endorsed by Enabled+ or Renewal by Andersen. See PROPERTY-ASSISTANT-NOTICE.md for attribution and review terms. No automatic update URL is configured for this review build.
