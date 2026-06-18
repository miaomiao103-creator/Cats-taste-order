const SHEET_NAME = "Orders";
const PRODUCT_SHEET_NAME = "PRODUCTS";
const PRODUCT_SHEET_ALIASES = ["Products", "products"];
const HEADERS = [
  "id",
  "at",
  "updatedAt",
  "name",
  "phone",
  "addr",
  "itemsJson",
  "sub",
  "da",
  "tot",
  "freeShip",
  "hasGift",
  "gift",
  "status",
  "trackingNo",
  "courier",
  "waConf",
  "waShip",
  "staffNote"
];
const PRODUCT_HEADERS = [
  "id",
  "sku",
  "cat",
  "name",
  "spec",
  "up",
  "bp",
  "bq",
  "rem",
  "on",
  "updatedAt"
];

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "ping");
  const callback = e && e.parameter && e.parameter.callback;

  if (action === "ensureSheets" || action === "setup") {
    return json_(Object.assign({ status: "ok", result: "success" }, ensureSheets_()), callback);
  }

  if (action === "getOrders") return json_({ status: "ok", orders: getOrders_() }, callback);
  if (action === "getProducts") {
    const products = getProducts_();
    return json_({ status: "ok", products, updatedAt: latestProductsUpdatedAt_(products) }, callback);
  }
  return json_({ status: "ok", result: "success", at: new Date().toISOString() }, callback);
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(body.action || "upsertOrder");

    if (action === "saveProducts") {
      const saved = saveProducts_(body.products || [], body.updatedAt);
      return json_({ status: "ok", result: "success", count: saved.count, updatedAt: saved.updatedAt, sheetName: saved.sheetName || PRODUCT_SHEET_NAME });
    }

    if (action !== "addOrder" && action !== "upsertOrder") {
      return json_({ status: "error", message: "Unsupported action" });
    }

    const saved = upsertOrder_(normaliseIncomingOrder_(body));
    return json_({ status: "ok", result: "success", id: saved.id, updatedAt: saved.updatedAt });
  } catch (err) {
    return json_({ status: "error", message: err && err.message ? err.message : String(err) });
  }
}

function normaliseIncomingOrder_(body) {
  if (!body || typeof body !== "object") throw new Error("Missing request body");

  // Frontend may send either:
  // 1) { action: "upsertOrder", order: {...} }
  // 2) { action: "upsertOrder", id: "...", name: "...", ... }
  const source = body.order && typeof body.order === "object" ? body.order : body;
  const order = Object.assign({}, source);

  delete order.action;
  delete order.products;

  normaliseOrderAliases_(order);

  if (!hasMeaningfulOrderData_(order)) {
    throw new Error("Missing order data");
  }

  order.id = String(
    order.id ||
    order.orderId ||
    order.orderID ||
    order.orderNo ||
    order.orderNumber ||
    order.localId ||
    ""
  ).trim();

  if (!order.id) order.id = makeOrderId_(order);
  if (!order.at) order.at = new Date().toISOString();

  return order;
}

function normaliseOrderAliases_(order) {
  order.name = order.name || order.customerName || order.customer || order.recipientName || "";
  order.phone = order.phone || order.tel || order.mobile || order.customerPhone || "";
  order.addr = order.addr || order.address || order.deliveryAddress || order.shippingAddress || "";
  order.staffNote = order.staffNote || order.staffRemark || order.internalNote || order.note || order.remark || "";

  if (order.sub == null || order.sub === "") order.sub = order.subtotal || order.originalTotal || 0;
  if (order.da == null || order.da === "") order.da = order.discountAmount || order.discount || 0;
  if (order.tot == null || order.tot === "") order.tot = order.total || order.amount || order.grandTotal || 0;

  if (!Array.isArray(order.items)) {
    if (Array.isArray(order.cart)) order.items = order.cart;
    else if (Array.isArray(order.orderItems)) order.items = order.orderItems;
    else order.items = [];
  }
}

function hasMeaningfulOrderData_(order) {
  return Boolean(
    order.id ||
    order.orderId ||
    order.orderID ||
    order.orderNo ||
    order.orderNumber ||
    order.localId ||
    order.name ||
    order.phone ||
    order.addr ||
    order.staffNote ||
    order.trackingNo ||
    (Array.isArray(order.items) && order.items.length) ||
    Number(order.tot || order.total || order.amount || 0)
  );
}

function makeOrderId_(order) {
  // Stable fallback id: retrying the same offline order should not create easy duplicates.
  const seed = [
    order.at || "",
    order.createdAt || "",
    order.phone || "",
    order.addr || "",
    JSON.stringify(order.items || []),
    order.tot || ""
  ].join("|");

  if (seed.replace(/[|\s]/g, "")) {
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, seed);
    const hex = digest.map(function(byte) {
      const value = byte < 0 ? byte + 256 : byte;
      return ("0" + value.toString(16)).slice(-2);
    }).join("").slice(0, 12);
    return "CT-" + hex;
  }

  return "CT-" + new Date().getTime() + "-" + Utilities.getUuid().slice(0, 8);
}

function upsertOrder_(order) {
  order = normaliseIncomingOrder_({ order: order });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const now = new Date().toISOString();
    const saved = Object.assign({}, order, {
      updatedAt: order.updatedAt || now,
      courier: order.courier || detectCourier_(order.trackingNo || "")
    });
    const row = orderToRow_(saved);
    const ids = getIds_(sheet);
    const existingIndex = ids.indexOf(saved.id);

    if (existingIndex >= 0) {
      sheet.getRange(existingIndex + 2, 1, 1, HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    return saved;
  } finally {
    lock.releaseLock();
  }
}

function ensureSheets_() {
  const orderSheet = getSheet_();
  const productSheet = getProductSheet_();
  return {
    orderSheet: orderSheet.getName(),
    productSheet: productSheet.getName(),
    orderRows: Math.max(orderSheet.getLastRow() - 1, 0),
    productRows: Math.max(productSheet.getLastRow() - 1, 0),
    headers: {
      orders: HEADERS,
      products: PRODUCT_HEADERS
    }
  };
}

function getOrders_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return rows.filter(row => row[0]).map(rowToOrder_);
}

function saveProducts_(products, updatedAt) {
  if (!Array.isArray(products)) throw new Error("Products must be an array");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getProductSheet_();
    const stamp = updatedAt || new Date().toISOString();
    const rows = products.map(product => productToRow_(product, stamp));
    sheet.clearContents();
    sheet.getRange(1, 1, 1, PRODUCT_HEADERS.length).setValues([PRODUCT_HEADERS]);
    if (rows.length) sheet.getRange(2, 1, rows.length, PRODUCT_HEADERS.length).setValues(rows);
    SpreadsheetApp.flush();
    return { count: rows.length, updatedAt: stamp, sheetName: sheet.getName() };
  } finally {
    lock.releaseLock();
  }
}

function getProducts_() {
  const sheet = getProductSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, PRODUCT_HEADERS.length).getValues();
  return rows.filter(row => row[0]).map(rowToProduct_);
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Please bind this Apps Script to a Google Sheet.");
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  const current = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = HEADERS.every((header, index) => current[index] === header);
  if (!hasHeaders) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  return sheet;
}

function getProductSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Please bind this Apps Script to a Google Sheet.");

  let sheet = ss.getSheetByName(PRODUCT_SHEET_NAME);

  // Backward compatibility: older versions created a tab called "Products".
  // Reuse/rename it so the final tab is consistently "PRODUCTS".
  if (!sheet) {
    for (let i = 0; i < PRODUCT_SHEET_ALIASES.length; i++) {
      const candidate = ss.getSheetByName(PRODUCT_SHEET_ALIASES[i]);
      if (candidate) {
        sheet = candidate;
        try {
          sheet.setName(PRODUCT_SHEET_NAME);
        } catch (err) {
          // If a PRODUCTS sheet already exists or rename is blocked, continue using the candidate.
        }
        break;
      }
    }
  }

  if (!sheet) sheet = ss.insertSheet(PRODUCT_SHEET_NAME);

  const current = sheet.getRange(1, 1, 1, PRODUCT_HEADERS.length).getValues()[0];
  const hasHeaders = PRODUCT_HEADERS.every((header, index) => current[index] === header);
  if (!hasHeaders) sheet.getRange(1, 1, 1, PRODUCT_HEADERS.length).setValues([PRODUCT_HEADERS]);
  return sheet;
}

function getIds_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(row => String(row[0]));
}

function orderToRow_(order) {
  return [
    order.id || "",
    order.at || "",
    order.updatedAt || order.at || "",
    order.name || "",
    order.phone || "",
    order.addr || "",
    JSON.stringify(order.items || []),
    Number(order.sub || 0),
    Number(order.da || 0),
    Number(order.tot || 0),
    Boolean(order.freeShip),
    Boolean(order.hasGift),
    order.gift || "",
    order.status || "pending",
    order.trackingNo || "",
    order.courier || detectCourier_(order.trackingNo || ""),
    Boolean(order.waConf),
    Boolean(order.waShip),
    order.staffNote || ""
  ];
}

function rowToOrder_(row) {
  return {
    id: String(row[0] || ""),
    at: row[1] || "",
    updatedAt: row[2] || row[1] || "",
    name: row[3] || "",
    phone: String(row[4] || ""),
    addr: row[5] || "",
    items: parseItems_(row[6]),
    sub: Number(row[7] || 0),
    da: Number(row[8] || 0),
    tot: Number(row[9] || 0),
    freeShip: row[10] === true || row[10] === "TRUE",
    hasGift: row[11] === true || row[11] === "TRUE",
    gift: row[12] || "",
    status: row[13] || "pending",
    trackingNo: String(row[14] || ""),
    courier: row[15] || detectCourier_(row[14] || ""),
    waConf: row[16] === true || row[16] === "TRUE",
    waShip: row[17] === true || row[17] === "TRUE",
    staffNote: String(row[18] || ""),
    synced: true
  };
}

function productToRow_(product, updatedAt) {
  return [
    product.id || "",
    product.sku || "",
    product.cat || "",
    product.name || "",
    product.spec || "",
    Number(product.up || 0),
    product.bp == null || product.bp === "" ? "" : Number(product.bp || 0),
    Number(product.bq || 0),
    product.rem || "",
    product.on !== false,
    product.updatedAt || updatedAt
  ];
}

function rowToProduct_(row) {
  return {
    id: String(row[0] || ""),
    sku: String(row[1] || ""),
    cat: String(row[2] || ""),
    name: String(row[3] || ""),
    spec: String(row[4] || ""),
    up: Number(row[5] || 0),
    bp: row[6] === "" ? null : Number(row[6] || 0),
    bq: Number(row[7] || 0),
    rem: String(row[8] || ""),
    on: row[9] !== false && row[9] !== "FALSE",
    updatedAt: row[10] || ""
  };
}

function latestProductsUpdatedAt_(products) {
  return products.reduce((latest, product) => {
    const stamp = String(product.updatedAt || "");
    return stamp > latest ? stamp : latest;
  }, "");
}

function parseItems_(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function detectCourier_(trackingNo) {
  const tn = String(trackingNo || "").replace(/\s/g, "").toUpperCase();
  if (/^SF/.test(tn) || (/^\d{12,15}$/.test(tn) && /^[789]/.test(tn))) return "sf";
  if (/^JD/.test(tn) || /^[VJ]\d{12,}/.test(tn)) return "jd";
  return tn ? "oth" : "";
}

function json_(payload, callback) {
  const body = JSON.stringify(payload);
  if (callback) {
    return ContentService
      .createTextOutput(String(callback).replace(/[^\w.$]/g, "") + "(" + body + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

function testDoPost_upsertOrder() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        action: "upsertOrder",
        order: {
          id: "TEST-001",
          at: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          name: "Test Customer",
          phone: "91234567",
          addr: "Test Address",
          staffNote: "同事備註測試",
          items: [
            { sku: "P001", name: "Test Product", bq: 0, pq: 1, up: 120, bl: 0, pl: 120, lt: 120 }
          ],
          sub: 120,
          da: 0,
          tot: 120,
          freeShip: false,
          hasGift: false,
          gift: "",
          status: "pending",
          trackingNo: "",
          courier: "",
          waConf: false,
          waShip: false
        }
      })
    }
  };
  const result = doPost(fakeEvent);
  Logger.log(result.getContent());
}

function testDoPost_emptyShouldFail() {
  const fakeEvent = { postData: { contents: JSON.stringify({ action: "upsertOrder" }) } };
  const result = doPost(fakeEvent);
  Logger.log(result.getContent());
}


function testEnsureSheets() {
  const result = doGet({ parameter: { action: "ensureSheets" } });
  Logger.log(result.getContent());
}

function testDoPost_saveProducts() {
  const fakeEvent = {
    postData: {
      contents: JSON.stringify({
        action: "saveProducts",
        updatedAt: new Date().toISOString(),
        products: [
          {
            id: "TEST-PRODUCT-001",
            sku: "TEST-SKU",
            cat: "測試分類",
            name: "Test Product",
            spec: "測試規格",
            up: 12,
            bp: 120,
            bq: 12,
            rem: "",
            on: true
          }
        ]
      })
    }
  };
  const result = doPost(fakeEvent);
  Logger.log(result.getContent());
}
