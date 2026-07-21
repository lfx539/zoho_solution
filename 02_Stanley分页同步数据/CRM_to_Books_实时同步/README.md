# CRM → Books 实时同步

## 📁 文件夹说明

本文件夹包含所有 CRM → Books 实时同步相关的代码和文档。

---

## 📂 文件清单

### 🚀 快速开始

| 文件 | 用途 | 优先级 |
|------|------|--------|
| [CRM_to_Books_Quick_Reference.md](CRM_to_Books_Quick_Reference.md) | **快速参考卡片**（5步完成部署） | ⭐⭐⭐⭐⭐ |
| [CRM_to_Books_Realtime_Sync_Implementation_Guide.md](CRM_to_Books_Realtime_Sync_Implementation_Guide.md) | 详细实施指南（25页） | ⭐⭐⭐⭐ |

---

### 💻 核心函数（必须部署）

#### 1. 配置函数
| 文件 | 函数名 | 说明 |
|------|--------|------|
| [Books_Config.deluge](Books_Config.deluge) | `GetBooksConfig` | Books API 配置（需要修改 authToken 等） |

#### 2. 同步函数
| 文件 | 函数名 | 参数 | 说明 |
|------|--------|------|------|
| [Sync_Vendor_To_Books.deluge](Sync_Vendor_To_Books.deluge) | `SyncVendorToBooks` | vendorId | 同步 Vendor → Books Vendor |
| [Sync_SalesOrder_To_Books.deluge](Sync_SalesOrder_To_Books.deluge) | `SyncSalesOrderToBooks` | soId | 同步 Sales Order → Books Sales Order |
| [Sync_PurchaseOrder_To_Books.deluge](Sync_PurchaseOrder_To_Books.deluge) | `SyncPurchaseOrderToBooks` | poId | 同步 Purchase Order → Books Purchase Order |

#### 3. 已有函数（确认最新版本）
| 文件 | 函数名 | 参数 | 说明 |
|------|--------|------|------|
| [CRM_to_Books_Sync_Account_Update.deluge](CRM_to_Books_Sync_Account_Update.deluge) | `SyncAccountToBooks` | accountId | 同步 Account → Books Customer |
| [CRM_to_Books_Sync_Product_Update.deluge](CRM_to_Books_Sync_Product_Update.deluge) | `SyncProductToBooks` | productId | 同步 Product → Books Item |

---

### 🧪 测试函数

| 文件 | 函数名 | 说明 |
|------|--------|------|
| [Test_Books_Sync.deluge](Test_Books_Sync.deluge) | `TestBooksConnection` | 测试 Books API 连接 |
| | `TestBooksSync` | 测试所有同步功能 |

---

### 📖 文档

| 文件 | 说明 |
|------|------|
| [CRM_to_Books_Sync_Plan.md](CRM_to_Books_Sync_Plan.md) | 原始方案文档（包含字段映射、错误处理等） |
| [CRM_to_Books_Quick_Reference.md](CRM_to_Books_Quick_Reference.md) | 快速参考卡片 |
| [CRM_to_Books_Realtime_Sync_Implementation_Guide.md](CRM_to_Books_Realtime_Sync_Implementation_Guide.md) | 详细实施指南 |

---

## 🎯 部署顺序

### 步骤 1: 准备工作
1. 阅读快速参考：[CRM_to_Books_Quick_Reference.md](CRM_to_Books_Quick_Reference.md)
2. 创建自定义字段（SO、PO、Vendor 模块）
3. 获取 Books API 凭证（authToken、organizationId）

### 步骤 2: 部署函数
按以下顺序在 CRM 中创建函数：

1. ✅ `Books_Config.deluge` - 配置函数（**必须先部署并修改配置**）
2. ✅ `Sync_Vendor_To_Books.deluge` - Vendor 同步
3. ✅ `Sync_SalesOrder_To_Books.deluge` - SO 同步
4. ✅ `Sync_PurchaseOrder_To_Books.deluge` - PO 同步

### 步骤 3: 创建 Workflow
1. SO 创建时触发 → `SyncSalesOrderToBooks`
2. PO 创建时触发 → `SyncPurchaseOrderToBooks`

### 步骤 4: 测试验证
1. 执行 `TestBooksConnection()` 测试 API 连接
2. 创建新 SO/PO 测试自动同步

---

## 📊 同步流程

```
CRM 创建 SO/PO
      ↓
Workflow 自动触发
      ↓
检查依赖数据
      ↓
同步 Account/Vendor/Product（如未同步）
      ↓
创建 Books Sales Order / Purchase Order
      ↓
保存 Books ID 到 CRM
      ↓
记录同步日志
```

---

## ⚠️ 重要提醒

### 必须完成的配置

#### 1. 创建 Zoho Books Connection（必须）

在 CRM 中创建连接，用于调用 Books API：

1. 进入 **设置 → 连接 → 连接**
2. 点击 **创建连接**
3. 填写信息：
   - **连接名称**: `books`  ⚠️ **必须是这个名称，不能修改**
   - **服务**: 选择 "Zoho Books"
   - **作用域**: `ZohoBooks.fullaccess.all`
4. 授权并保存

**注意**：connection 名称必须使用 `books`，因为代码中已经硬编码了这个名称。

#### 2. 修改配置参数

在 `Books_Config.deluge` 中修改以下配置：

```deluge
config.put("organizationId", "YOUR_ORGANIZATION_ID_HERE");  // ← 替换为你的 organizationId
config.put("baseUrl", "https://books.zoho.com/api/v3");  // ← 根据你的数据中心修改
```

**注意**：connection 名称 `zoho_books` 已经在所有函数中硬编码，无需在配置中设置。

### 常见数据中心

| 数据中心 | API 域名 |
|---------|---------|
| 美国 | `https://books.zoho.com/api/v3` |
| 欧洲 | `https://books.zoho.eu/api/v3` |
| 澳洲 | `https://books.zoho.com.au/api/v3` |
| 印度 | `https://books.zoho.in/api/v3` |
| 日本 | `https://books.zoho.jp/api/v3` |

---

## 🔗 相关链接

- [Zoho Books API 文档](https://www.zoho.com/books/api/v3/)
- [获取 AuthToken](https://accounts.zoho.com/apiauthtoken/create?SCOPE=ZohoBooks/booksapi)
- [Zoho API Console](https://api-console.zoho.com/)

---

## 📞 需要帮助？

- 查看快速参考：[CRM_to_Books_Quick_Reference.md](CRM_to_Books_Quick_Reference.md)
- 查看详细指南：[CRM_to_Books_Realtime_Sync_Implementation_Guide.md](CRM_to_Books_Realtime_Sync_Implementation_Guide.md)
- 测试连接：执行 `test.TestBooksConnection()`

---

**最后更新**: 2026-07-16
**版本**: 1.0
