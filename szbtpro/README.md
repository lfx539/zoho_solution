# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh




npm run build:pack  直接打成zohocrm的包，在packhelp下。

---

## 项目结构

```
src/
├── main.jsx              # 线索转换 Widget 入口
├── mainProduct.jsx       # 产品转换 Widget 入口
├── mainPO.jsx            # 生成 PO Widget 入口
├── widgets/
│   ├── conv.jsx          # 线索转换组件
│   ├── convProduct.jsx   # 产品转换组件
│   ├── generatePO.jsx    # 生成 PO 组件
│   └── print.jsx         # 打印组件
└── util/
    └── util.js           # 工具函数

index.html                # 线索转换 HTML 入口
indexProduct.html         # 产品转换 HTML 入口
indexPO.html              # 生成 PO HTML 入口
```

## 打包命令

| 命令 | 说明 | 输出文件 |
|------|------|----------|
| `npm run build:pack` | 打包线索转换 Widget | `packhelp/dist/conv.zip` |
| `npm run build:pack:product` | 打包产品转换 Widget | `packhelp/dist/convProduct.zip` |
| `npm run build:pack:po` | 打包生成 PO Widget | `packhelp/dist/generatePO.zip` |

## Widget 功能

### conv.zip - 线索转换
- 将 Lead 转换为 Account、Contact、Deal
- 触发位置：Leads 模块

### convProduct.zip - 产品转换
- 将 Deal 子表 Product_Interested_deal 转换为 Products_Purchased
- 同时更新/创建 Case_Module 及其子表
- 触发条件：Deal Stage 为 Closed Won
- 触发位置：Deals 模块

### generatePO.zip - 生成 PO
- 在 Zoho Books 中创建采购订单 (Purchase Order)
- 触发条件：Deal Probability >= 75%
- 触发位置：Deals 模块

## 字段依赖

### 产品转换 Widget 需要的字段

**Deal 模块**：
- `IsConvertedToProductPurchased` (Checkbox) - 防重复转换标记
- `leadIdCopy` (Lookup to Leads) - 用于 Case 的 Lead 字段
- `Product_Interested_deal` (Subform) - 产品兴趣子表
  - `Product_Name` (Lookup to Products)
  - `IsOrderPlaced` (Checkbox)

**Case_Module 模块**：
- `Name` - 必填
- `Deal` (Lookup to Deals)
- `Lead` (Lookup to Leads)
- `Product_Purchased` (Subform)
  - `Product_Name` (Lookup to Products)

**Products_Purchased 模块**：
- `Name` - 必填
- `Product_Name` (Lookup to Products)
- `Account_Name` (Lookup to Accounts)
- `Deal_Name` (Lookup to Deals)

### 生成 PO Widget 需要的字段/配置

**Deal 模块**：
- `Probability` - 成单概率字段
- `Product_Interested_deal` (Subform) - 产品兴趣子表
  - `Product_Name` (Lookup to Products)
  - `comments` (Text) - 备注

**Zoho CRM 连接配置**：
- 需要在 Zoho CRM 中创建到 Zoho Books 的连接
- 连接名称：`zoho_books`
- 连接类型：Zoho Services -> Zoho Books

**Zoho Books 配置**：
- Organization ID: `920286948`
- Vendor ID: `8915132000000099002` (Chinese Warehouse)

**Zoho Books PO 自定义字段**（可选，用于存储 Widget 数据）：
- `cf_freight_type` - 运输方式
- `cf_destination` - 目的地
- `cf_special_modification` - 特殊修改
- `cf_estimated_po_time` - 预计 PO 时间
- `cf_latest_arrival_date` - 最晚到达日期
- `cf_deal_name` - 关联 Deal
- `cf_customer_street` - 客户街道
- `cf_customer_state` - 客户州/省
- `cf_customer_country` - 客户国家
- `cf_customer_zip_code` - 客户邮编
- `cf_customer_contact` - 客户联系人
- `cf_customer_account` - 客户账户