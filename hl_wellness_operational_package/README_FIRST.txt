HL WELLNESS & BEAUTY — WEBSITE SETUP GUIDE
==========================================

WHAT THIS ZIP CONTAINS
----------------------
This project is now a working website package with:

1) Frontend shop
   - index.html
   - products/*.html
   - success.html
   - cancel.html

2) Backend order server
   - server.js
   - package.json
   - .env.example

3) Rep/referral tracking
   - /1847 = Darren
   - /3729 = Yanice
   - /6408 = Joshua
   - /9152 = Sister / Upline

4) Cart + manual order flow
   - Fixed-price products calculate a cart total.
   - Quote-required plans do not add to the total.
   - Orders save to orders/orders.json on the backend.
   - Optional email notifications can be enabled with SMTP settings.

IMPORTANT HOSTING NOTE
----------------------
GitHub is good for storing the code.
GitHub Pages is only for static websites. It cannot run server.js.

Because your cart sends orders to /api/manual-order, you need Node hosting for the live website, such as Render, Railway, VPS, or another Node-capable host.

Use GitHub repository = code storage.
Use Render/Railway/VPS = live website/backend.

LOCAL TESTING
-------------
1) Install Node.js LTS from nodejs.org
2) Open the project folder in VS Code
3) Open terminal in the project folder
4) Run:

   npm install
   npm start

5) Open:

   http://localhost:3000

Test rep links:

   http://localhost:3000/1847
   http://localhost:3000/3729
   http://localhost:3000/6408
   http://localhost:3000/9152

Admin orders page:

   http://localhost:3000/admin.html

Default admin PIN is 1234 unless changed in .env / hosting environment variables.

GITHUB REPOSITORY SETTINGS
--------------------------
When creating the GitHub repository:

- Visibility: Private is fine for code storage.
- Add README: ON is fine, but this project already includes README_FIRST.txt.
- .gitignore: Choose Node, or use the included .gitignore.
- License: No license for now if you do not want others to use/copy it.

After creating the repo, upload/push these files:

- index.html
- server.js
- package.json
- .env.example
- .gitignore
- README_FIRST.txt
- admin.html
- success.html
- cancel.html
- _redirects
- products folder

DO NOT upload:

- .env
- node_modules folder
- orders folder

These are ignored by .gitignore.

GITHUB PAGES WARNING
--------------------
Do not rely on GitHub Pages for the final operational version unless you remove the backend/cart order system or use an external backend.

GitHub Pages can show the HTML pages, but it cannot process:

- /api/manual-order
- order saving
- email sending
- admin orders page data

For the operational version, deploy to Render/Railway/VPS instead.

RENDER DEPLOYMENT SETTINGS
--------------------------
Render is a simple option for this project.

1) Create a Render account.
2) New Web Service.
3) Connect your GitHub repository.
4) Use these settings:

   Environment: Node
   Build Command: npm install
   Start Command: npm start

5) Add environment variables from .env.example.

Minimum variables to set:

   ADMIN_PIN=choose-a-private-pin
   ORDER_ADMIN_EMAIL=your-order-email
   REP_1847_EMAIL=darrens-email
   REP_1847_HERBALIFE_ID=darrens-id
   REP_3729_EMAIL=yanices-email
   REP_3729_HERBALIFE_ID=yanices-id
   REP_6408_EMAIL=joshuas-email
   REP_6408_HERBALIFE_ID=joshuas-id
   REP_9152_EMAIL=sisters-email
   REP_9152_HERBALIFE_ID=sisters-id

For email notifications, also set:

   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=yourgmail@gmail.com
   SMTP_PASS=your_gmail_app_password
   SMTP_FROM=HL Wellness & Beauty <yourgmail@gmail.com>

For Gmail, SMTP_PASS must be a Google App Password, not your normal Gmail password.

LIVE LINKS YOU WILL SHARE
-------------------------
Once deployed, your rep links become:

   https://your-live-domain.com/1847
   https://your-live-domain.com/3729
   https://your-live-domain.com/6408
   https://your-live-domain.com/9152

Each link loads the same website, but the order is assigned to the correct rep internally.

CUSTOM DOMAIN
-------------
When you buy a domain, point it to your hosting provider, not just GitHub, because the backend must run.

Examples:

   hlwellnessbeauty.com/1847
   hlwellnessbeauty.com/3729

PRODUCTS AND PRICES
-------------------
Edit product names/prices in:

   index.html

Look for:

   const products = [ ... ]

Each product has:

   name
   category
   price
   quoteRequired
   description
   detailsUrl
   image

For fixed-price products:

   quoteRequired: false
   price: 45.00

For custom gym/meal/coaching plans:

   quoteRequired: true
   price: 0

Also edit the dedicated product pages inside:

   products/

CURRENT REP CODES
-----------------
1847 = Darren
3729 = Yanice
6408 = Joshua
9152 = Sister / Upline

You can change the numbers, but if you change them, update both:

1) index.html reps object
2) server.js REPS object
3) Any links you have already shared

FILES AND WHERE THEY GO
-----------------------
Root of project:

   index.html          main shop page
   server.js           backend server and API
   package.json        Node dependencies/scripts
   .env.example        template for private settings
   .gitignore          prevents secrets/orders/node_modules being uploaded
   admin.html          admin order viewer
   success.html        order success page
   cancel.html         cancel page
   README_FIRST.txt    this guide
   _redirects          useful for some static hosts; not required for Render

Products folder:

   products/formula-1-shake.html
   products/protein-drink-mix.html
   products/herbal-tea.html
   products/aloe-drink.html
   products/beauty-products.html
   products/wellness-bundle.html
   products/gym-workout-plan.html
   products/meal-plan.html
   products/coaching-pack.html

Generated locally/on server:

   orders/orders.json

This file stores placed orders and should NOT be uploaded to GitHub.

NEXT THINGS TO REPLACE BEFORE PUBLIC LAUNCH
-------------------------------------------
1) Real product names
2) Real product prices
3) Real product photos
4) Official/compliant product descriptions
5) Correct rep emails
6) Correct Herbalife IDs
7) Your final domain
8) Your SMTP/email settings
9) Your privacy/terms/refund wording

