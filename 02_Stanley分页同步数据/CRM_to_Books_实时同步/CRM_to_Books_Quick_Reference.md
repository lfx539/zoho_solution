# CRM → Books 实时同步 - 快速参考

## 🚀 快速开始（5 步完成）

### 1️⃣ 创建自定义字段（5 分钟）

**Sales Orders 模块**：
- `Books_SO_ID` (Single Line)
- `Books_Sync_Status` (Pick List: Success/Failed/Pending)
- `Books_Sync_Time` (Date Time)

**Purchase_Orders 模块**：
- `Books_PO_ID` (Single Line)
- `Books_Sync_Status` (Pick List: Success/Failed/Pending)
- `Books_Sync_Time` (Date Time)

**Vendors 模块**：
- `Books_Vendor_ID` (Single Line)

---

### 2️⃣ 创建 Zoho Books Connection（2 分钟）

**在 CRM 中创建连接**：
1. 进入 **设置 → 连接 → 连接**
2. 点击 **创建连接**
3. 填写信息：
   - **连接名称**: `books`  ⚠️ **必须是这个名称，不能修改**
   - **服务**: 选择 "Zoho Books"
   - **作用域**: `ZohoBooks.fullaccess.all`
4. 授权并保存

**重要**：connection 名称必须使用 `books`，因为代码中已经硬编码了这个名称。

**获取 Organization ID**：
1. 登录 Zoho Books
2. 进入 **设置 → 组织信息**
3. 记录 **组织 ID** (Organization ID)

**确定 API 域名**（根据你的 Books 数据中心）：
- 美国: `https://books.zoho.com/api/v3`
- 欧洲: `https://books.zoho.eu/api/v3`
- 澳洲: `https://books.zoho.com.au/api/v3`

---

### 3️⃣ 部署函数（10 分钟）

在 CRM 中创建 4 个函数：

| 函数名 | 文件 | 参数 |
|--------|------|------|
| `GetBooksConfig` | [Books_Config.deluge](Books_Config.deluge) | 无 |
| `SyncVendorToBooks` | [Sync_Vendor_To_Books.deluge](Sync_Vendor_To_Books.deluge) | vendorId |
| `SyncSalesOrderToBooks` | [Sync_SalesOrder_To_Books.deluge](Sync_SalesOrder_To_Books.deluge) | soId |
| `SyncPurchaseOrderToBooks` | [Sync_PurchaseOrder_To_Books.deluge](Sync_PurchaseOrder_To_Books.deluge) | poId |

**重要**：修改 `GetBooksConfig` 中的 organizationId 和 baseUrl。connection 名称 `zoho_books` 已在代码中硬编码。

---

### 4️⃣ 创建 Workflow（5 分钟）

**Sales Order Workflow**：
- 模块: Sales Orders
- 触发: 创建记录时
- 动作: 执行 `SyncSalesOrderToBooks(soId = ${Sales_Orders.ID})`

**Purchase Order Workflow**：
- 模块: Purchase Orders
- 触发: 创建记录时
- 动作: 执行 `SyncPurchaseOrderToBooks(poId = ${Purchase_Orders.ID})`

---

### 5️⃣ 测试验证（3 分钟）

1. 执行 `TestBooksConnection()` 测试 API 连接
2. 在 CRM 创建一个新的 SO 或 PO
3. 检查 Books 中是否创建了对应记录

---

## 📊 同步流程

```
CRM 创建 SO/PO
      ↓
Workflow 自动触发
      ↓
检查依赖数据（Account/Vendor/Product）
      ↓
同步依赖数据到 Books（如未同步）
      ↓
创建 Books Sales Order / Purchase Order
      ↓
保存 Books ID 到 CRM
      ↓
记录同步日志
```

---

## 🔧 已有函数

| 函数 | 作用 | 状态 |
|------|------|------|
| `SyncAccountToBooks` | 同步 Account → Books Customer | ✅ 已实现 |
| `SyncProductToBooks` | 同步 Product → Books Item | ✅ 已实现 |
| `SyncVendorToBooks` | 同步 Vendor → Books Vendor | ✅ 新建 |
| `SyncSalesOrderToBooks` | 同步 SO → Books Sales Order | ✅ 新建 |
| `SyncPurchaseOrderToBooks` | 同步 PO → Books Purchase Order | ✅ 新建 |

---

## ⚠️ 重要提醒

1. **字段名匹配**：确保 CRM 字段名与代码一致
   - SO 子表: `Product_Details` 或 `Ordered_Items`
   - PO 子表: `Purchase_Items`
   - 地址字段: `Billing_Street`, `Shipping_City` 等

2. **前置依赖**：
   - SO 需要 Account 已同步
   - PO 需要 Vendor 已同步
   - 都需要 Product 已同步

3. **只同步一次**：
   - SO/PO 只在创建时同步
   - 后续修改不会自动同步到 Books
   - 如需更新，需手动调用函数

4. **API 限制**：
   - Books API 限制: 100 次/分钟
   - 批量同步时注意添加延迟

---

## 🐛 常见错误

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| Customer not found | Account 未同步 | 先同步 Account |
| Item not found | Product 未同步 | 先同步 Product |
| Authentication failed | API 凭证错误 | 检查 authToken 和 orgId |
| Vendor not found | Vendor 未同步 | 先同步 Vendor |

---

## 📁 文件清单

### 核心文件（必须部署）
- [Books_Config.deluge](Books_Config.deluge) - Books API 配置
- [Sync_Vendor_To_Books.deluge](Sync_Vendor_To_Books.deluge) - Vendor 同步
- [Sync_SalesOrder_To_Books.deluge](Sync_SalesOrder_To_Books.deluge) - SO 同步
- [Sync_PurchaseOrder_To_Books.deluge](Sync_PurchaseOrder_To_Books.deluge) - PO 同步

### 已有文件（确认最新）
- [CRM_to_Books_Sync_Account_Update.deluge](CRM_to_Books_Sync_Account_Update.deluge)
- [CRM_to_Books_Sync_Product_Update.deluge](CRM_to_Books_Sync_Product_Update.deluge)

### 测试文件
- [Test_Books_Sync.deluge](Test_Books_Sync.deluge) - 测试函数

### 文档
- [CRM_to_Books_Realtime_Sync_Implementation_Guide.md](CRM_to_Books_Realtime_Sync_Implementation_Guide.md) - 详细实施指南
- [CRM_to_Books_Sync_Plan.md](CRM_to_Books_Sync_Plan.md) - 原方案文档

---

## 🎯 下一步

完成实时同步后，可以：
1. ✅ 监控同步状态（查看 `Books_Sync_Logs` 模块）
2. 📦 批量同步历史数据
3. 🔄 设置失败重试机制
4. 📧 配置失败通知

---

**需要帮助？**
- 查看详细指南: [CRM_to_Books_Realtime_Sync_Implementation_Guide.md](CRM_to_Books_Realtime_Sync_Implementation_Guide.md)
- 测试连接: 执行 `test.TestBooksConnection()`
- 查看日志: `Books_Sync_Logs` 模块
