const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Tiny .env loader so you do not need an extra package just to read env vars.
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter(line => line.trim() && !line.trim().startsWith("#"))
    .forEach(line => {
      const eq = line.indexOf("=");
      if (eq > -1) {
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
        if (!process.env[key]) process.env[key] = value;
      }
    });
}

let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch {
  // Email is optional. The server still works and saves orders locally.
}

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const ORDERS_DIR = path.join(ROOT, "orders");
const ORDERS_FILE = path.join(ORDERS_DIR, "orders.json");

let repPins = {
  "1847": process.env.ADMIN_PIN_1847,
  "3729": process.env.ADMIN_PIN_3729,
  "6408": process.env.ADMIN_PIN_6408,
  "9152": process.env.ADMIN_PIN_9152
};

const REPS = {
  "1847": {
    name: "Darren",
    code: "DC",
    herbalifeId: process.env.REP_1847_HERBALIFE_ID || "MTY0001889",
    email: "darrencaruana21@gmail.com"
  },

  "3729": {
    name: "Yanice",
    code: "YA",
    herbalifeId: process.env.REP_3729_HERBALIFE_ID || "MTY0001890",
    email: "malliayanice@gmail.com"
  },

  "6408": {
    name: "Joshua",
    code: "JO",
    herbalifeId: process.env.REP_6408_HERBALIFE_ID || "MTY0001891",
    email: "joshua_sultana@hotmail.com"
  },

  "9152": {
    name: "Valerie",
    code: "UP",
    herbalifeId: process.env.REP_9152_HERBALIFE_ID || "MT16060798",
    email: "valerie_xx3@hotmail.com"
  }
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function readOrders() {
  if (!fs.existsSync(ORDERS_FILE)) return [];

  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  fs.mkdirSync(ORDERS_DIR, { recursive: true });
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function saveOrder(order) {
  const orders = readOrders();

  const orderRef = `HL-${new Date().getFullYear()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;

  const savedOrder = {
    orderRef,
    createdAt: new Date().toISOString(),
    status: "New",
    ...order
  };

  orders.push(savedOrder);
  writeOrders(orders);

  return savedOrder;
}

function money(value) {
  return `€${Number(value || 0).toFixed(2)}`;
}

function buildSellerOrderText(order) {
  const items = (order.items || [])
    .map(item => {
      const lineTotal = item.quoteRequired
        ? "Quote Required"
        : money(Number(item.price || 0) * Number(item.quantity || 1));

      return `- ${item.name} x${item.quantity || 1} — ${lineTotal}`;
    })
    .join("\n");

  return `
Order Reference: ${order.orderRef}
Date: ${order.createdAt}
Status: ${order.status}

Assigned Rep:
${order.rep?.name || "Unknown"} (${order.rep?.repCode || "no code"})
Herbalife ID: ${order.rep?.herbalifeId || "not set"}
Rep Email: ${order.rep?.email || "not set"}

Customer:
${order.customer?.name || ""}
Phone: ${order.customer?.phone || ""}
Email: ${order.customer?.email || ""}
Fulfilment: ${order.customer?.fulfillment || ""}
Payment: ${order.customer?.paymentMethod || order.paymentMethod || ""}
Address: ${order.customer?.address || ""}
Notes: ${order.customer?.notes || ""}

Items:
${items}

Fixed Total: ${money(order.totals?.fixedTotal)}
Quote Required Items: ${order.totals?.hasQuoteRequiredItems ? "Yes" : "No"}
`.trim();
}

function buildCustomerOrderText(order) {
  const items = (order.items || [])
    .map(item => {
      const lineTotal = item.quoteRequired
        ? "Quote Required"
        : money(Number(item.price || 0) * Number(item.quantity || 1));

      return `- ${item.name} x${item.quantity || 1} — ${lineTotal}`;
    })
    .join("\n");

  return `
Hi ${order.customer?.name || ""},

Thank you. We received your order/enquiry.

Order Reference: ${order.orderRef}

Items:
${items}

Fixed Total: ${money(order.totals?.fixedTotal)}
Quote Required Items: ${order.totals?.hasQuoteRequiredItems ? "Yes" : "No"}

Payment will be completed manually using your selected method.

Your assigned team member will contact you shortly.

HL Wellness & Beauty
`.trim();
}

async function sendBrevoEmail(apiKey, payload) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Brevo error ${response.status}: ${text}`);
  }

  return text;
}

function buildItemsText(order, items, title) {
  const itemLines = items.map(item => {
    const lineTotal = item.quoteRequired
      ? "Quote Required"
      : money(Number(item.price || 0) * Number(item.quantity || 1));

    return `- ${item.name} x${item.quantity || 1} — ${lineTotal}`;
  }).join("\n");

  return `
${title}

Order Reference: ${order.orderRef}
Date: ${order.createdAt}
Status: ${order.status}

Original Assigned Rep:
${order.rep?.name || "Unknown"} (${order.rep?.repCode || "no code"})

Customer:
${order.customer?.name || ""}
Phone: ${order.customer?.phone || ""}
Email: ${order.customer?.email || ""}
Fulfilment: ${order.customer?.fulfillment || ""}
Payment: ${order.customer?.paymentMethod || order.paymentMethod || ""}
Address: ${order.customer?.address || ""}
Notes: ${order.customer?.notes || ""}

Items:
${itemLines}
`.trim();
}

async function sendOrderEmails(order) {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    return {
      sent: false,
      reason: "BREVO_API_KEY missing"
    };
  }

  const senderEmail = process.env.SMTP_FROM || "darrencaruana47@gmail.com";

  const fixedItems = (order.items || []).filter(item => !item.quoteRequired);
  const quoteItems = (order.items || []).filter(item => item.quoteRequired);

  const assignedRepEmail = order.rep?.email;

  const darrenEmail = REPS["1847"]?.email;
  const valerieEmail = REPS["9152"]?.email;

  function uniqueEmails(emails) {
    const seen = new Set();

    return emails
      .filter(Boolean)
      .filter(email => {
        const lower = email.toLowerCase();

        if (seen.has(lower)) {
          return false;
        }

        seen.add(lower);
        return true;
      })
      .map(email => ({ email }));
  }

  try {
    if (fixedItems.length > 0 && assignedRepEmail) {
      await sendBrevoEmail(apiKey, {
        sender: {
          name: "HL Wellness & Beauty",
          email: senderEmail
        },
        to: uniqueEmails([assignedRepEmail]),
        subject: `New Product Order ${order.orderRef}`,
        textContent: buildItemsText(
          order,
          fixedItems,
          "NEW PRODUCT ORDER"
        )
      });
    }

    if (quoteItems.length > 0) {
      await sendBrevoEmail(apiKey, {
        sender: {
          name: "HL Wellness & Beauty",
          email: senderEmail
        },
        to: uniqueEmails([darrenEmail, valerieEmail]),
        subject: `New Quote Request ${order.orderRef}`,
        textContent: buildItemsText(
          order,
          quoteItems,
          "NEW QUOTE / COACHING REQUEST"
        )
      });
    }

    await sendBrevoEmail(apiKey, {
      sender: {
        name: "HL Wellness & Beauty",
        email: senderEmail
      },
      to: [
        {
          email: order.customer.email
        }
      ],
      subject: `Order received ${order.orderRef}`,
      textContent: buildCustomerOrderText(order)
    });

    console.log("Emails sent successfully.");

    return {
      sent: true
    };
  } catch (error) {
    console.error("Brevo email error:", error);

    return {
      sent: false,
      reason: error.message
    };
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let requestedPath = decodeURIComponent(url.pathname);

  // Clean rep links: /1847, /3729, etc.
  if (/^\/\d{4}\/?$/.test(requestedPath)) {
    requestedPath = "/index.html";
  }

  if (requestedPath === "/") {
    requestedPath = "/index.html";
  }

  // Prevent direct browsing of saved orders or secret files.
  if (
    requestedPath.startsWith("/orders") ||
    requestedPath === "/.env" ||
    requestedPath === "/server.js"
  ) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  const safePath = path.normalize(requestedPath).replace(/^([.][.][\/\\])+/, "");
  let filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Cannot GET ${requestedPath}`);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();

  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-cache"
  });

  fs.createReadStream(filePath).pipe(res);
}

function getOrdersForPin(pin) {
  const masterPin = process.env.MASTER_ADMIN_PIN;
  
  let allowedRepCode = null;
  let isMaster = false;

  if (masterPin && pin === masterPin) {
    isMaster = true;
  } else {
    allowedRepCode = Object.keys(repPins).find(repCode => {
      return repPins[repCode] && repPins[repCode] === pin;
    });
  }

  if (!isMaster && !allowedRepCode) {
    return null;
  }

  let orders = readOrders().slice().reverse();

  if (!isMaster) {
    orders = orders.filter(order => {
      return String(order.rep?.repCode) === String(allowedRepCode);
    });
  }

  const safeOrders = orders.map(order => ({
    orderRef: order.orderRef,
    createdAt: order.createdAt,
    status: order.status,
    rep: {
      repCode: order.rep?.repCode,
      name: order.rep?.name,
      code: order.rep?.code
    },
    customer: {
      name: order.customer?.name,
      phone: order.customer?.phone,
      email: order.customer?.email,
      fulfillment: order.customer?.fulfillment,
      paymentMethod: order.customer?.paymentMethod || order.paymentMethod,
      address: order.customer?.address,
      notes: order.customer?.notes
    },
    items: order.items,
    totals: order.totals
  }));

  return {
    mode: isMaster ? "master" : "rep",
    repCode: isMaster ? "ALL" : allowedRepCode,
    orders: safeOrders
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url.startsWith("/api/manual-order")) {
      const body = await readBody(req);
      const order = JSON.parse(body || "{}");

      if (
        !order.customer?.name ||
        !order.customer?.phone ||
        !order.customer?.email ||
        !Array.isArray(order.items) ||
        order.items.length === 0
      ) {
        return sendJson(res, 400, {
          error: "Missing customer details or cart items."
        });
      }

      const repCode = String(order.rep?.repCode || "");
      const rep = REPS[repCode] || REPS["1847"];

      order.rep = {
        repCode: repCode || "1847",
        ...rep
      };

      const saved = saveOrder(order);

      sendOrderEmails(saved)
  .then(result => console.log("Email result:", result))
  .catch(error => console.error("Email failed:", error.message));

return sendJson(res, 200, {
  ok: true,
  orderRef: saved.orderRef,
  email: {
    sent: "background"
  }
});
    }

    if (req.method === "GET" && req.url.startsWith("/api/orders")) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pin = url.searchParams.get("pin");

      const result = getOrdersForPin(pin);

      if (!result) {
        return sendJson(res, 401, {
          error: "Wrong admin PIN."
        });
      }

      return sendJson(res, 200, result);
    }
  if (req.method === "POST" && req.url === "/api/change-password") {

  const body = await readBody(req);
  const data = JSON.parse(body || "{}");

  const currentPin = String(data.currentPin || "");
  const newPin = String(data.newPin || "");

  if (!newPin || newPin.length < 4) {
    return sendJson(res, 400, {
      error: "New PIN must be at least 4 characters."
    });
  }

  const repCode = Object.keys(repPins).find(rep => {
    return repPins[rep] === currentPin;
  });

  if (!repCode) {
    return sendJson(res, 401, {
      error: "Current PIN incorrect."
    });
  }

  repPins[repCode] = newPin;

  return sendJson(res, 200, {
    ok: true,
    message: "PIN changed successfully."
  });
}
    serveStatic(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "Server error." });
  }
});

server.listen(PORT, () => {
  console.log(`HL Wellness site running at http://localhost:${PORT}`);
  console.log("Orders save to orders/orders.json");
  console.log("Admin orders API: /api/orders?pin=YOUR_PIN");
});
