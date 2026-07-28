# CRM → Books 全量数据同步方案

> 最后更新: 2026-07-28
> 状态: 方案设计阶段

---

## 一、表关系映射

| # | CRM 模块 | Books 端点 | Books 模块路径 | 子表 | 备注 |
|---|---------|-----------|---------------|------|------|
| 1 | Sales_Orders | `POST /salesorders` | sales/sales order | line_items (item_id, qty, rate, discount, tax) | 创建后需 confirm |
| 2 | Purchase_Orders | `POST /purchaseorders` | purchase/purchase order | line_items (item_id, qty, rate) | 创建后需 issue |
| 3 | Invoices | `POST /invoices/fromsalesorder?salesorder_id=X` | sales/invoice | line_items (so_line_item_id, qty) | **必须从 SO 创建**，需 Package 同步 |
| 3b | (同上 SO) | `POST /packages?salesorder_id=X` | sales/package | line_items (so_line_item_id, qty, warehouse_id) | 创建后需 shipmentorders 标记 shipped |
| 4 | Cash_Sale | `POST /salesreceipts` | sales/sales receipts | line_items (item_id, qty, rate) | 直接收款，无 Package |
| 5 | Credit_Memos | `POST /creditnotes` | sales/credit notes | line_items (item_id, qty, rate) | 可关联 invoice_id |
| 6 | VendorBill | `POST /bills` | purchase/bills | line_items (item_id, qty, rate) | 采购发票 |
| 7 | VendorPayment | `POST /vendorpayments` | purchase/vendor payments | bills[{bill_id, amount_applied}] | **关联 Vendor Bill** |
| 8 | VendorCredit | `POST /vendorcredits` | purchase/vendor credits | line_items (item_id, qty, rate) | 供应商贷项 |
| 9 | Checks | `POST /expenses` | purchase/expense | line_items (item_id, amount) | 费用支出 |

### 依赖关系图

```
┌─────────────────── 基础数据（必须先同步） ───────────────────┐
│  Accounts → Books Contacts (customer)                       │
│  Vendors  → Books Contacts (vendor)                         │
│  Products → Books Items                                     │
└─────────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
┌─────── 销售侧（需 Customer + Item） ──────┐  ┌──── 采购侧（需 Vendor + Item） ────┐
│  1. Sales Order → sales/salesorder        │  │  2. Purchase Order → purchaseorders │
│  4. Cash Sale → salesreceipts             │  │  6. Vendor Bill → bills             │
│  5. Credit Memo → creditnotes             │  │  7. Vendor Payment → vendorpayments │
│  3. Invoice → invoices (from SO)          │  │  8. Vendor Credit → vendorcredits   │
│  3. Package → packages (from SO)          │  │  9. Check → expenses                │
└───────────────────────────────────────────┘  └─────────────────────────────────────┘
```

### 同步严格顺序

```
Phase 0: 基础映射表 (Accounts → Vendors → Products)
Phase 1: SO → PO (主单据先同步)
Phase 2: Package + Invoice (SO 后续操作，依赖 Books_SO_ID)
Phase 3: CS → Credit Memo (独立销售单据)
Phase 4: Vendor Bill → Vendor Payment → Vendor Credit → Check (采购侧链路)
```

---

## 二、现有代码清单

### 目录: `02_Stanley分页同步数据/CRM_to_Books_实时同步/`

| 文件 | 函数签名 | 功能 | 状态 |
|------|---------|------|------|
| `Books_Config.deluge` | `GetBooksConfig()` | Books API 配置 (baseUrl, orgId) | ✅ |
| `Books_Config.deluge` | `SaveBooksSyncLog(module, crmId, booksId, status, message)` | 写同步日志到 CRM BooksSyncLogs | ✅ |
| `Books_Config.deluge` | `UpdateBooksSyncStatus(module, recordId, booksId, status)` | 更新 CRM 记录的 Books ID | ✅ |
| `CRM_to_Books_Sync_Account_Update.deluge` | `SyncAccountToBooks(accountId)` | Account → Customer (3级查找: Books_Customer_ID → email → name) | ✅ |
| `CRM_to_Books_Sync_Product_Update.deluge` | `SyncProductToBooks(productId)` | Product → Item (SKU → name 查找) | ✅ |
| `Sync_Vendor_To_Books.deluge` | `SyncVendorToBooks(vendorId)` | Vendor → Vendor Contact | ✅ |
| `Sync_SalesOrder_To_Books.deluge` | `SyncSalesOrderToBooks(soId)` | SO → SalesOrder (含子表 line_items) | ✅ |
| `Sync_PurchaseOrder_To_Books.deluge` | `SyncPurchaseOrderToBooks(poId)` | PO → PurchaseOrder (含子表 line_items) | ✅ |
| `Sync_Package_To_Books.deluge` | `SyncPackageToBooks(soId, booksSoId, customerId)` | Package 创建 + shipped (扣库存) | ✅ |
| `Sync_Invoice_To_Books.deluge` | `SyncInvoiceToBooks(soId, booksSoId, customerId)` | Invoice from SO + 标记 sent | ✅ |
| `Sync_SalesOrderToBooksFull.deluge` | `SyncSalesOrderToBooksFull(soId)` | SO + Package + Invoice 联动 | ✅ |
| `DebugCreatePackage.deluge` | `DebugCreatePackage()` | Package 创建调试 | 调试用 |
| `DebugGetPackage.deluge` | `DebugGetPackage()` | Package 详情查询调试 | 调试用 |
| `DebugGetSO.deluge` | `DebugGetSO()` | SO 详情查询调试 | 调试用 |

### 缺失的模块（需新写）

| # | CRM 模块 | 目标 Books 模块 | 需要的函数名 | 预计复杂度 |
|---|---------|----------------|-------------|-----------|
| 4 | Cash_Sale | salesreceipts | `SyncCashSaleToBooks(cashSaleId)` | 中（类似 SO 但更简单，无 Package/Invoice） |
| 5 | Credit_Memos | creditnotes | `SyncCreditMemoToBooks(creditMemoId)` | 中（可独立或关联 invoice_id） |
| 6 | VendorBill | bills | `SyncVendorBillToBooks(vendorBillId)` | 中（类似 PO 但目标不同） |
| 7 | VendorPayment | vendorpayments | `SyncVendorPaymentToBooks(vendorPaymentId)` | 高（需关联 Vendor Bill 的 booksId） |
| 8 | VendorCredit | vendorcredits | `SyncVendorCreditToBooks(vendorCreditId)` | 中（类似 VendorBill） |
| 9 | Checks | expenses | `SyncCheckToBooks(checkId)` | 中（Expense 类型） |

### 缺失的基础设施

| 组件 | 说明 |
|------|------|
| **通用批处理调度器** | 现有代码全部是单条实时同步，无分页批处理框架 |
| **ID 映射缓存** | 14万条数据逐条查 Books 太慢，需先批量拉 Books 全量做内存 Map |
| **API 控速** | 现有代码无 sleep/retry/backoff，批量同步必须加 |
| **Cash Sale / Credit Memo / VendorBill / VendorPayment / VendorCredit / Check 的 CRM 自定义字段** | 需要在各 CRM 模块创建 `Books_XXX_ID` 和 `Books_Sync_Status` 字段 |

---

## 三、现有架构模式总结

### 3.1 单条同步流程（已有函数的统一模式）

```
1. 读取 CRM 记录 (zoho.crm.getRecordById)
2. 读取 CRM v8 API 获取完整数据 (invokeurl GET crm/v8/...)
   - Deluge 内置函数对子表返回 null，必须用 v8 REST API
3. 多级查找 Books 是否已存在:
   - 优先查 CRM 自定义字段 (Books_XXX_ID)
   - 其次按 reference_number / email / name / SKU 搜索 Books
4. 构建 Books payload (字段映射硬编码在函数内)
5. Upsert: 存在则 PUT 更新，不存在则 POST 创建
6. 写回 Books ID 到 CRM 自定义字段
7. 记录日志到 BooksSyncLogs 模块
```

### 3.2 ID 映射字段

| CRM 模块 | CRM 字段 | Books 实体 | Books ID 字段 |
|---------|---------|-----------|-------------|
| Accounts | `Books_Customer_ID` | Contact (customer) | `contact_id` |
| Vendors | `Books_Vendor_ID` | Contact (vendor) | `contact_id` |
| Products | `Books_Item_ID` | Item | `item_id` |
| Sales_Orders | `Books_SO_ID` | Sales Order | `salesorder_id` |
| Sales_Orders | `Books_Package_ID` | Package | `package_id` |
| Sales_Orders | `Books_Invoice_ID` | Invoice | `invoice_id` |
| Purchase_Orders | `Books_PO_ID` | Purchase Order | `purchaseorder_id` |
| (待创建) | `Books_CS_ID` | Sales Receipt | `salesreceipt_id` |
| (待创建) | `Books_CM_ID` | Credit Note | `creditnote_id` |
| (待创建) | `Books_VB_ID` | Bill | `bill_id` |
| (待创建) | `Books_VP_ID` | Vendor Payment | `vendorpayment_id` |
| (待创建) | `Books_VC_ID` | Vendor Credit | `vendorcredit_id` |
| (待创建) | `Books_Check_ID` | Expense | `expense_id` |

### 3.3 Books API 关键发现（已验证）

| 发现 | 详情 |
|------|------|
| Package: salesorder_id 必须在 query param | 放在 body 里会报 "Sales Order does not exist" |
| Shipment: package_ids 必须在 query param | 放在 body 里会报 "Invalid value passed for package_ids" |
| Shipment: 用 `/shipmentorders` 而非 `/packages/{id}/ship` | `/ship` 需要 carrier 集成的 rate_id，不适合 API 调用 |
| SO confirm 是 Package/Invoice 的前置条件 | `POST /salesorders/{id}/status/confirmed` |
| Invoice 从 SO 创建用 `/invoices/fromsalesorder` | 不是独立创建，line_items 用 `so_line_item_id` 关联 |
| delivery_method_id | `259067000001714021` (Click & Collect VIC (Free)) |

### 3.4 子表处理模式

**SO/PO 的 line_items** — 从 CRM 子表重建:
```
CRM Product_Details / Ordered_Items / Purchase_Items
  → 每行调 SyncProductToBooks(productId) 拿 item_id
  → 构建 {item_id, quantity, rate, discount, tax_id, unit}
```

**Package/Invoice 的 line_items** — 直接引用 Books SO 的 line_item_id:
```
GET /salesorders/{id} → 拿到 line_items[].line_item_id
  → 构建 {so_line_item_id, quantity} (无需再查 Product)
```

### 3.5 Tax 映射规则

| CRM GST_Code | Books Tax | 税率 |
|--------------|-----------|------|
| `GST:NA-AU` 或含 `NA-AU` | `"NA"` | 0% |
| `GST:TS-AU` 或其他/缺失 | `"GST"` | 10% |

### 3.6 Unit 映射规则

| CRM Unit | Books Unit | 备注 |
|----------|-----------|------|
| "Eachs" / "EA" | `"Unit"` | 直接映射 |
| 其他 | `"Unit({crmUnit})"` | 需查 Books Item 的 unit_conversion_id |

### 3.7 Books API 配置

```deluge
config.put("organizationId", "7006400577");
config.put("baseUrl", "https://www.zohoapis.com.au/books/v3");
// 认证: Zoho Connection 名 "books" (OAuth)
// CRM 认证: Zoho Connection 名 "crm"
```

---

## 四、NetSuite → CRM 同步架构参考

> 已有的 NetSuite → CRM 三层架构，可参考其批处理模式设计 CRM → Books 批处理

### 三层函数设计

```
Tier 1: SyncAll{Modules} / AutoSync{Modules}Full  (schedule, void)
    |--- 读取 CRM Log 获取上次进度
    |--- 调用 Tier 2
    |--- 保存进度到 CRM Log
    |
Tier 2: Sync{Module}WithResult  (standalone, returns Map)
    |--- 分页从 NetSuite 拉数据 (limit=1000, 每批处理 220 条)
    |--- 逐条调用 Tier 3
    |--- 收集错误 ID
    |--- 返回 {totalProcessed, totalSuccess, totalFailed, finalProcessed, hasMore, errorIds}
    |
Tier 3: SyncSingle{Module}  (standalone, returns Map)
    |--- 拉单条 NetSuite 详情
    |--- 字段映射 (硬编码)
    |--- Upsert 到 CRM
    |--- 返回结果
```

### 关键文件

| 文件 | 用途 |
|------|------|
| `SetHeaders.js` | OAuth 1.0 header (单条详情) |
| `SetListHeaders.js` | OAuth 1.0 header (分页列表) |
| `SetHeadersForNewest.js` | OAuth 1.0 header (按日期过滤) |
| `EncodeQForOAuth.js` | OAuth q 参数编码 |
| `SyncRetry.js` | 通用重试分发器 |
| `ResolveLogErrorsBybatch.js` | 批量错误自动重试 |
| `mapSalesRep.js` | 销售代表名称映射 |

### 日志模块分配

| CRM Log 模块 | 覆盖模块 |
|-------------|---------|
| `vendorLogs` | Vendors, POs, Vendor Bills, VP, VC, Item Receipts |
| `otherLogs` | Invoices, Quotes, Credit Memo |
| `SOLogs` | Sales Orders |
| `CSLogs` | Cash Sale |
| `Logs` | Products, Accounts (legacy) |

---

## 五、数据量估算 & 执行时间线

### 数据量

| 模块 | 预估条数 | 每条 API 调用数 | 预估总 API 调用 |
|------|---------|---------------|---------------|
| Accounts | ~60,000 | 2-4 | ~180,000 |
| Vendors | ~3,000 | 2-3 | ~7,500 |
| Products | ~20,000 | 2-3 | ~50,000 |
| **Sales Orders** | **~140,000** | **5+4N** (N=行数) | **~2,000,000+** |
| **Cash Sale** | **~140,000** | 3-4 | ~490,000 |
| Credit Memo | ~10,000 | 3-4 | ~35,000 |
| PO | ~5,000 | 5+4N | ~100,000 |
| Vendor Bill | ~5,000 | 3-4 | ~17,500 |
| Vendor Payment | ~3,000 | 3-4 | ~10,500 |
| Vendor Credit | ~1,000 | 3-4 | ~3,500 |
| Check | ~2,000 | 3-4 | ~7,000 |

### 时间线（单线程估算，每条 SO ~2-3 秒）

| 阶段 | 耗时 | 说明 |
|------|------|------|
| Phase 0: 映射表 | 2-4 小时 | 批量拉 Books 全量数据 |
| Phase 1: 基础数据 | 3-5 天 | Accounts/Vendors/Products |
| Phase 2: SO | 14-21 天 (单线程) / 5-7 天 (3并行) | 最核心最耗时 |
| Phase 2b: Package+Invoice | 5-7 天 | 依赖 SO 完成 |
| Phase 3: CS | 5-7 天 (单线程) / 2-3 天 (3并行) | |
| Phase 3b: Credit Memo | 1 天 | |
| Phase 4: 采购侧全链路 | 3-5 天 | 数据量小 |
| **总计** | **~6-8 周** | 3 并行可压缩到 3-4 周 |

---

## 六、核心优化策略

### 6.1 ID 映射缓存（最关键优化）

14 万条 SO 逐行 line_items 都要查 Product 对应的 item_id，逐条调 API 太慢。

**策略**: 批量拉 Books 全量数据建内存 Map

```deluge
// 示例：一次性拉取 Books 全量 Items，建 SKU→item_id 映射
booksItems = Map();
page = 1;
do {
    resp = invokeurl [
        url: baseUrl + "/items?organization_id=" + orgId + "&page=" + page
        type: GET  connection: "books"
    ];
    items = resp.get("items");
    for each item in items {
        booksItems.put(item.get("sku"), item.get("item_id"));
    }
    page = page + 1;
} while (items != null && items.size() == 200);
// 后续同步时直接: itemId = booksItems.get(crmSku)
```

同理建:
- `customerNameMap` (Account name → contact_id)
- `vendorNameMap` (Vendor name → contact_id)

### 6.2 并行加速

```
// 创建 3 个独立函数，各自处理不同范围的 SO
// Sync_SO_Batch_1: 处理第 1-333 页
// Sync_SO_Batch_2: 处理第 334-666 页
// Sync_SO_Batch_3: 处理第 667-1000 页
// 3 个定时任务并行执行 → 速度 3x
```

### 6.3 批处理调度器（核心基础设施）

仿照 NetSuite → CRM 的 Tier 1/2 模式:

```deluge
// 通用批处理调度器
// 每次执行处理 50-100 条
// 用 CRM BooksSyncLogs 记录断点 (BookSync_ID + 已处理页码)
// 支持断点续传：下次自动从上次停止的位置继续
// API 控速：每 50 条 sleep 1000ms
// 错误隔离：单条失败不影响整批
```

### 6.4 其他优化

- **按时间过滤**: 只同步最近 2-3 年数据，减少 50%+ 工作量
- **优先级排序**: 优先同步金额大、近期的记录
- **幂等设计**: 已有 Books_XXX_ID → 跳过（现有函数已有此逻辑）
- **错误重试**: 失败记录存 BooksSyncLogs，定时重跑

---

## 七、字段映射参考文件

| 文件路径 | 内容 |
|---------|------|
| `字段对应/CRM_po` | PO CRM 字段 (label + API name + type) |
| `字段对应/CRM_vendorbill` | Vendor Bill CRM 字段 |
| `字段对应/crm_check` | Check CRM 字段 |
| `字段对应/crm_itemReceipt` | Item Receipt CRM 字段 |
| `字段对应/crm_vendorCredit` | Vendor Credit CRM 字段 |
| `字段对应/crm_vendorPayment` | Vendor Payment CRM 字段 |
| `字段对应/netsuite_po` | NetSuite PO API 响应样例 (89KB) |
| `字段对应/netsuite_vendorbill` | NetSuite VB API 响应样例 (251KB) |
| `字段对应/netsuite_vendorCredit` | NS VC 样例 |
| `字段对应/netsuite_vendorCredit2` | NS VC 样例2 (不同结构) |
| `字段对应/netsuite_vendorPayment` | NS VP 样例 |
| `字段对应/netsuite_check` | NS Check 样例 |
| `字段对应/netsuite_itemReceipt` | NS Item Receipt 样例 |
| `字段对应/netsuite_account` | NS Account 样例 |

> 注意：无显式映射表，字段映射全部硬编码在各 SyncSingle 函数内

---

## 八、下一步行动

### 优先级排序

1. **P0 - 基础设施**: 通用批处理调度器 + ID 映射缓存
2. **P1 - 销售侧补齐**: `SyncCashSaleToBooks` + `SyncCreditMemoToBooks`
3. **P2 - 采购侧补齐**: `SyncVendorBillToBooks` + `SyncVendorPaymentToBooks` + `SyncVendorCreditToBooks` + `SyncCheckToBooks`
4. **P3 - CRM 字段创建**: 为缺失模块创建 `Books_XXX_ID` 和 `Books_Sync_Status` 字段
5. **P4 - 批量执行**: 配置定时任务，按 Phase 顺序执行

### 建议开始顺序

```
1. 写批处理调度器 (BatchBooksSyncScheduler)
2. 写 SyncCashSaleToBooks (最简单的新模块，可验证调度器)
3. 写 SyncCreditMemoToBooks
4. 写 SyncVendorBillToBooks
5. 写 SyncVendorPaymentToBooks (最复杂，需关联 VB)
6. 写 SyncVendorCreditToBooks
7. 写 SyncCheckToBooks
```
