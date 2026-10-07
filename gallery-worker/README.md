# Template gallery (private)

`https://template-gallery.michaelamarino16.workers.dev`: the template gallery from any device, behind a
Cloudflare Access sign-in. Files are served from the `bymamstudio-templates` R2 bucket under `gallery/`.

The Worker verifies every request's Access token itself. With `TEAM_DOMAIN` / `POLICY_AUD` unset, everything
returns 403, so nothing is ever public.

## Turn on sign-in (Michael, one time, about 5 minutes)

1. Cloudflare dashboard → **Workers & Pages** → **template-gallery** → **Settings** → **Domains & Routes**.
2. On the `workers.dev` row, open the menu and choose **Enable Cloudflare Access** (wording may be "Cloudflare
   Access: Enable"). If Cloudflare asks you to set up Zero Trust first, pick a team name and the **Free** plan
   (up to 50 users).
3. Open **Manage Cloudflare Access** (or Zero Trust → Access → Applications → the template-gallery app) and make
   sure the policy allows only your email address(es).
4. From that application's overview, copy the **Application Audience (AUD) Tag**, and note your **team domain**
   (`<team>.cloudflareaccess.com`, shown under Zero Trust → Settings → Custom Pages). Neither is a secret; send
   both to Claude, or put them in `wrangler.toml` under `[vars]` and run `npx wrangler deploy`.

After that, opening the link asks for your email, sends a one-time code, and keeps you signed in on that device.

## Updating the gallery

After the tokenizer adds templates:

```
python scripts/build_gallery.py
cd scripts
node upload-to-r2.js --dir ../templates/processed --prefix gallery/processed/
node upload-to-r2.js --file ../templates/gallery.html --key gallery/index.html
```

The uploader skips files that are already in the bucket with the same size.
