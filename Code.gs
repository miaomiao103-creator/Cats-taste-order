const SHEET_NAME = "Orders";
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
  "waShip"
];

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "ping");
  const callback = e && e.parameter && e.parameter.callback;
  if (action === "getOrders") return json_({ status: "ok", orders: getOrders_() }, callback);
  return json_({ status: "ok", result: "success", at: new Date().toISOString() }, callback);
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const action = String(body.action || "upsertOrder");
    if (action !== "addOrder" && action !== "upsertOrder") {
      return json_({ status: "error", message: "Unsupported action" });
    }
    const saved = upsertOrder_(body.order || {});
    return json_({ status: "ok", result: "success", id: saved.id, updatedAt: saved.updatedAt });
  } catch (err) {
    return json_({ status: "error", message: err && err.message ? err.message : String(err) });
  }
}

function upsertOrder_(order) {
  if (!order.id) throw new Error("Missing order id");

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

function getOrders_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  return rows.filter(row => row[0]).map(rowToOrder_);
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
    Boolean(order.waShip)
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
    synced: true
  };
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
