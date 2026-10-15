# ARSARA storefront

Story-led Himalayan food storefront with cart, shipping calculator, WhatsApp order enquiries, admin panel and six legal pages.
No third-party npm packages: Node.js 22.13 or newer is the only requirement (uses Node's built-in SQLite).

## Run locally
```
cp .env.example .env      # set ADMIN_EMAIL and ADMIN_PASSWORD
npm start                 # http://localhost:3000   (admin: /admin)
npm test                  # 91 integration checks against a temporary database
```
If `ADMIN_PASSWORD` is empty or shorter than 12 characters, a one-time password is generated and printed once in the server log.

## Deploy
Any host that runs Node 22.13+ and has a **persistent disk** works (Render, Railway, Fly.io, a VPS).
1. Start command: `npm start`. Set the variables from `.env.example`.
2. Mount a persistent volume and set `DATA_DIR` to it. **Without one, the database and uploads are lost on every redeploy.**
3. Use HTTPS (hosts do this for you) and set `TRUST_PROXY=1`, `NODE_ENV=production` and `SITE_URL`.
4. Sign in at `/admin`, then work through the "Before launch" panel on the dashboard.

## Backup and recovery
Everything lives in `DATA_DIR`: `arsara.db` (products, stock, enquiries, settings, policies) and `uploads/` (images).
- Back up: stop writes briefly or use SQLite's online copy, then copy the whole folder, e.g. `sqlite3 arsara.db ".backup backup.db"` and `cp -r uploads`. Do this at least daily; keep copies off the server.
- Restore: stop the app, put `arsara.db` and `uploads/` back into `DATA_DIR`, start the app.
- Test a restore once before launch.

## What is configurable in /admin
Products, price, sale price, stock (every change is logged), images, SEO, shipping charge and free-shipping threshold, WhatsApp number, email, social links, address, legal name, FSSAI number, grievance contact, homepage text/order/visibility, recipe, and all policy pages. Shipping values flow into the cart, WhatsApp message, server checks and the Shipping policy text.

## How ordering works
The cart lives in the customer's browser. The WhatsApp button asks the server to re-check prices, stock and shipping, saves an enquiry (reference + items + amounts, no personal data) and opens WhatsApp with the message. It never marks anything paid and never changes stock. In Admin > Orders you verify payment yourself, record the reference, and only then optionally deduct stock.

## Security notes
Server-side sessions (HttpOnly, SameSite=Strict cookies), scrypt password hashing, login rate limiting, CSRF header + origin checks, strict Content-Security-Policy, validated inputs, image uploads checked by file signature. Change the first admin password from the generated one after signing in.
