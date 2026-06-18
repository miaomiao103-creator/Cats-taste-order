# Cat's Taste 送貨單系統 App｜README

版本：v21.2 WhatsApp 確認版  
用途：香港貓咪博覽會展場送貨訂單記錄、執貨、快遞單號、WhatsApp 通知及 Google Sheets 共享同步。

---

## 1. 系統目標

呢個 app 係一個 **Offline-first / weak-network friendly PWA**，俾同事喺展場用手機、iPad 或電腦建立送貨單。

主要用途：

- 展場現場建立送貨訂單
- 無網絡時仍可落單，訂單會先保存在本機
- 有網絡時自動同步至 Google Sheets
- 多部裝置可以拉取共享訂單
- 只由指定「產品管理機」管理產品、價錢及優惠設定
- 自動產生 WhatsApp 訂單確認及快遞通知文字

**注意：** App 不處理付款狀態。付款確認請跟現場收銀流程處理。

---

## 2. 檔案結構

```text
catstaste_stable_v21_2_whatsapp_confirm/
├── index.html              # 主 App：落單、訂單、後台、產品管理、同步邏輯
├── Code.gs                 # Google Apps Script 後端
├── service-worker.js       # PWA 離線快取，v21.2 cache
├── app.webmanifest         # PWA 安裝設定
├── icon.png                # App icon
└── README.md               # 本文件
```

---

## 3. v21.2 WhatsApp 確認版 最新更新

v21 係「展場穩定版」方向，重點唔係加花巧功能，而係減少同事出錯，因為人類一忙就會將任何 UI 當成密碼鎖，真係令人對文明略有保留。


### v21.2 WhatsApp 確認版 已完成內容

- 更新 WhatsApp 訂單確認文字：要求客人回覆 *Yes* 確認訂單資料，收到確認後才開始執貨及安排寄出
- 新增 **普通備註**
  - 同事可於落單時輸入
  - App 訂單列表 / 詳情會顯示
  - WhatsApp 訂單確認文字會顯示
  - Google Sheet 欄位：`publicNote`
- 新增 **內部備註**
  - 只俾同事睇
  - App 訂單列表 / 詳情會顯示
  - 不會出現在 WhatsApp 給客人的文字
  - Google Sheet 欄位：`privateNote`
- App 畫面加入版本顯示：`v21.2 WhatsApp 確認版`
- `service-worker.js` cache 更新至 `catstaste-order-v21-2-whatsapp-confirm`，避免手機繼續食舊版 cache

### v21 已完成內容

- 新增 **產品管理機模式**
  - 預設所有裝置只可落單及查看產品
  - 只有開啟「產品管理機模式」的裝置可以新增產品、改價、改九折、改滿額、上架 / 停用
  - 建議現場只開一部管理機
- 新增 **產品類型 itemType**
  - `normal`：一般商品
  - `plastic_bag`：膠袋徵費
  - `eco_bag`：環保袋商品
  - `fee`：附加費
- 修正袋類邏輯
  - 膠袋徵費：不九折、不計滿 $150 門檻、不計贈品門檻
  - 環保袋商品：可按產品設定是否九折 / 是否計門檻
- 新增 **產品最後更新時間** 顯示
- 新增 **裝置名稱 / deviceId**
  - 訂單會記錄由邊部機建立
  - 方便查錯及追蹤
- 訂單 ID 改為更難撞號格式
  - 包含日期、裝置 ID、時間、隨機碼
- 訂單建立後會清楚顯示：
  - 已保存在本機
  - 雲端同步中 / 未同步 / 已同步
- Google Sheet 連線失敗時，不會刪資料
  - 未同步訂單會保存在本機
  - 提示同事不要刪 App / 不要清 cache
- 新增 **複製未同步訂單備份**
  - Google Sheet 斷線時可以先複製未同步訂單文字做備份
- 改價 / 改九折 / 改滿額設定時加入確認提示
- `service-worker.js` cache 更新至 `catstaste-order-v21-2-whatsapp-confirm`

---

## 4. 手機 / 平板安裝

### iPhone / iPad

1. 用 Safari 開啟 app 網址。
2. 按分享按鈕。
3. 選擇「加入主畫面」。
4. 之後直接喺主畫面開 `Cat's Taste 送貨單系統`。

### Android

1. 用 Chrome 開啟 app 網址。
2. 按右上角選單。
3. 選擇「新增至主畫面」或「安裝應用程式」。
4. 之後直接喺主畫面開 app。

---

## 5. Google Sheets 第一次設定

1. 開 Google Sheet。
2. 到「擴充功能」>「Apps Script」。
3. 將新版 `Code.gs` 貼入 Apps Script。
4. 儲存。
5. 部署為 Web App。
6. 權限建議：

```text
Execute as: Me
Who has access: Anyone with the link
```

7. 複製 Web App URL。
8. 回到 App「後台」>「Google Sheets」>「Web App」，貼上 URL。
9. 按「測試連接」。

「測試連接」會自動：

- 檢查 / 建立 `Orders` 分頁
- 檢查 / 建立 `PRODUCTS` 分頁
- 同步本機未同步訂單
- 同步本機產品改動
- 拉取最新訂單
- 拉取最新產品

如更新過 `Code.gs`，必須重新部署新版本：

```text
部署 → 管理部署 → 編輯 → 版本選「新版本」→ 部署
```

只撳儲存係冇用。Google Apps Script 就係咁貼心，專門考驗人類耐性。

---

## 6. 產品管理機 SOP

### 建議現場規則

```text
產品 / 價錢 / 九折 / 滿額設定，只由一部指定管理機修改。
其他同事手機只負責落單、查訂單、填快遞。
```

### 開啟管理機模式

1. 到「後台」。
2. 於「產品管理」區按「產品管理機模式」。
3. 確認開啟。
4. 只有呢部機可以新增 / 編輯產品。

### 其他同事手機

- 不開管理機模式
- 只會自動拉取最新產品
- 不可以改價，避免舊資料覆蓋新資料

---

## 7. PRODUCTS 欄位說明

Google Sheet `PRODUCTS` 分頁欄位：

| 欄位 | 說明 |
|---|---|
| `id` | 產品 ID，不建議手動改 |
| `sku` | SKU / 內部代號 |
| `cat` | 系列類別，只可選指定分類 |
| `name` | 產品名稱 |
| `spec` | 規格，例如包裝 / 罐裝 / 其他 |
| `up` | 單件價 |
| `bp` | 原箱價 |
| `bq` | 原箱件數 |
| `rem` | 備註 |
| `on` | TRUE = 上架，FALSE = 停用 |
| `updatedAt` | 最後更新時間 |
| `discountable` | TRUE = 單件產品可九折 |
| `thresholdable` | TRUE = 計入滿 $150 / 贈品門檻 |
| `itemType` | 產品類型：normal / plastic_bag / eco_bag / fee |

---

## 8. 優惠計算規則

### 滿 $150 九折

- 滿額門檻用 `thresholdable = TRUE` 的商品小計計算。
- 原箱價可以計入滿 $150 門檻。
- 九折只套用到 `discountable = TRUE` 的 **單件產品**。
- 原箱價本身不打九折。
- 膠袋徵費不計門檻、不九折。
- 如果全單滿 $150 但沒有可九折產品，App 不顯示九折提示。

### 贈品

- 贈品與九折使用同一套 `thresholdable` 滿額門檻。
- 膠袋徵費不計入贈品門檻。

### 免費送貨

- 免費送貨按折後總額計算。

---

## 9. 袋類設定建議

### 膠袋徵費

```text
cat: 其他
itemType: plastic_bag
discountable: FALSE
thresholdable: FALSE
```

用途：政府膠袋徵費 / 附加收費。

### 環保袋商品

```text
cat: 其他
itemType: eco_bag
discountable: TRUE 或 FALSE
thresholdable: TRUE 或 FALSE
```

用途：當商品售賣的環保袋，可以按現場優惠策略設定是否九折 / 是否計門檻。

---

## 10. 同步與斷線處理

### 正常情況

- 落單後會先保存到本機。
- 有網絡時會自動同步到 Google Sheet。
- App 會每 30 秒自動同步一次。
- 網絡恢復、App 返回前景、進入訂單 / 後台頁時都會自動同步。

### Google Sheet 斷線時

同事應該：

```text
1. 繼續落單
2. 不要重複建立同一張單
3. 不要刪 App
4. 不要清 Safari / Chrome cache
5. 通知管理人
```

管理人可到後台使用：

```text
複製未同步訂單備份
```

之後等網絡恢復，App 會自動補同步。

---

## 11. 多人同時使用風險

### 訂單

訂單同步有 `LockService`，多人同時落單時會排隊寫入 Google Sheet。v21 訂單 ID 包含裝置 ID、時間及隨機碼，撞號風險比舊版低好多。

### 產品

v21 有產品管理機模式，建議只由一部機改產品。產品同步仍然會用 `id + updatedAt` merge，減少不同產品互相覆蓋。

最安全規則：

```text
產品價錢 / 九折設定 / 滿額設定，只由管理機改。
```

---

## 12. 展前測試清單

展前最少做一次 30 分鐘測試：

```text
3 部手機
1 個 Google Sheet
10 張假單
2 次改價
1 次斷網
1 次復網
1 次快遞單號補填
```

### 必測項目

- [ ] 每部手機可以成功開 App
- [ ] 只有管理機可改產品
- [ ] 非管理機不能改價
- [ ] 測試連接成功
- [ ] 產品最後更新時間有顯示
- [ ] 建立 10 張假單後 Google Sheet 沒有漏單
- [ ] 訂單 ID 沒有重複
- [ ] 斷網時仍可落單
- [ ] 復網後未同步訂單可補同步
- [ ] 膠袋徵費不計 $150、不九折
- [ ] 環保袋商品可按設定參與九折 / 滿額
- [ ] 改價後其他手機能拉取最新產品
- [ ] WhatsApp 訂單確認文字正確
- [ ] 普通備註會出現在 WhatsApp 訂單確認
- [ ] 內部備註不會出現在 WhatsApp 訂單確認
- [ ] Google Sheet 有 publicNote / privateNote 欄位
- [ ] 快遞單號可以補填並同步

---

## 13. 更新部署提醒

每次改 `index.html` 或 `service-worker.js` 後：

```text
1. 上傳新版 index.html
2. 上傳新版 service-worker.js
3. 確認 CACHE_NAME 已更新
4. 手機關閉 App 再重開
5. 如仍食舊版，刪除主畫面 icon 後重新加入
```

每次改 `Code.gs` 後：

```text
1. Apps Script 貼上新版 Code.gs
2. 儲存
3. 部署 → 管理部署 → 編輯
4. 版本選「新版本」
5. 部署
6. 回 App 按「測試連接」
```

---

## 14. 展場使用原則

```text
少啲人改資料，多啲人落單。
Google Sheet 斷線唔好慌，訂單先保存在本機。
見到未同步，通知管理人；不要刪 App，不要清 cache。
展場當日只改價，不改優惠邏輯。
```
