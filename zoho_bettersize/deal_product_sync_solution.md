# Deal 产品同步需求 - 实现方案

## 需求概述

在 Zoho CRM 商机模块添加子表 "Product Interested In"，产品信息从 Lead 同步过来。当商机状态变为 Closed Won 时，弹出提示框让用户勾选确认采购的产品，同步到 Product Purchased。

**用户需求**：需要部分选择产品，不是全选/全不选。

---

## 方案一：子表复选框 + 工作流（最简单）

### 流程
1. Lead 转换时 → 自动同步产品到 "Product_Interested_In" 子表
2. 商机状态 = Closed Won 时 → 用户手动编辑子表，勾选 "Is_Purchased" 复选框
3. 子表保存时触发工作流 → 勾选的产品自动创建到 Products_Purchased

### 实现步骤

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | Lead 子表添加字段 | 产品信息（查找产品模块） |
| 2 | Deal 子表 "Product_Interested_In" | 添加：Product（查找）、Is_Purchased（复选框）、Quantity 等 |
| 3 | Lead 转换映射 | 配置字段映射，或用函数同步 |
| 4 | 工作流 | 子表 Is_Purchased = true 时，创建 Products_Purchased 记录 |

### 优点
- 实现简单，无需开发自定义页面
- 使用 Zoho 原生功能，维护成本低
- 用户操作流程清晰

### 缺点
- 不是真正的"弹窗"，需要用户手动编辑子表
- 用户需要进入子表编辑模式

### 适用场景
- 用户对交互体验要求不高
- 快速上线，低开发成本

---

## 方案二：Canvas 自定义页面

### 流程
1. Lead 转换时 → 自动同步产品到子表
2. 商机详情页嵌入 Canvas 组件 → 显示产品选择界面
3. 用户点击"确认采购"按钮 → 弹出选择框
4. 选择后 → 自动创建到 Products_Purchased

### 优点
- 用户体验好，真正的弹窗交互
- 界面可完全自定义
- 可以添加复杂的业务逻辑

### 缺点
- 需要开发 Canvas 页面（HTML/JS）
- 需要部署服务器托管页面
- 开发和维护成本较高

### 技术要求
- 前端开发能力（HTML/CSS/JavaScript）
- Zoho Canvas SDK
- 服务器托管

---

## 方案三：蓝图 + 按钮 + Zoho Creator（最终选择）

### 流程
1. Lead 转换时 → 自动同步产品到子表
2. 商机状态变为 Closed Won → 显示"确认采购产品"按钮
3. 用户点击按钮 → 跳转到 Zoho Creator 页面
4. 确认后 → 同步到 Products_Purchased

### 架构设计

```
Zoho CRM                                    Zoho Creator
┌─────────────────┐                        ┌──────────────────────┐
│  Deal 记录      │                        │  产品选择页面         │
│  ┌───────────┐  │    点击按钮             │  ┌────────────────┐  │
│  │ 子表:     │  │ ─────────────────────►  │  │ □ 产品A        │  │
│  │ Product   │  │                        │  │ ☑ 产品B        │  │
│  │ Interested│  │    选择完成确认         │  │ □ 产品C        │  │
│  │ _In       │  │ ◄─────────────────────  │  │                │  │
│  └───────────┘  │                        │  │ [确认采购]     │  │
│                 │                        │  └────────────────┘  │
│  Products_      │    创建记录             │                      │
│  Purchased ◄────│─────────────────────────│  调用 CRM API        │
└─────────────────┘                        └──────────────────────┘
```

### 为什么选择 Zoho Creator

| 原因 | 说明 |
|------|------|
| 无需服务器 | Zoho 生态内，无需自建服务器托管页面 |
| 低代码开发 | 拖拽式界面，开发速度快 |
| API 集成方便 | 可直接调用 Zoho CRM API |
| 维护成本低 | Zoho 统一管理，升级适配风险小 |

### 优点
- 可以在蓝图状态转换时触发
- 按钮可以控制显示条件
- 用户可部分选择产品
- 无需自建服务器

### 缺点
- 需要跳转页面，不是同一页面弹窗
- 需要学习 Zoho Creator 开发

### 技术要求
- 蓝图配置
- Deluge 函数
- Zoho Creator 页面开发

---

## 对比总结

| 维度 | 方案一 | 方案二 | 方案三 |
|------|--------|--------|--------|
| 开发难度 | 低 | 高 | 中 |
| 用户体验 | 一般 | 最佳 | 较好 |
| 维护成本 | 低 | 高 | 中 |
| 上线周期 | 快 | 慢 | 中 |
| 弹窗交互 | ❌ | ✅ | ⚠️ 跳转页面 |
| 部分选择 | ✅ | ✅ | ✅ |

---

## 方案三详细开发内容

### 第一步：CRM 端配置

| 序号 | 配置项 | 说明 |
|------|--------|------|
| 1 | Deal 子表 `Product_Interested_In` | 字段：Product（查找）、Quantity、Unit_Price 等 |
| 2 | 蓝图 Closed Won 状态 | 添加按钮"确认采购产品" |
| 3 | 按钮 Deluge 函数 | 拼接 URL 跳转到 Creator 页面，传递 Deal ID |

### 第二步：Zoho Creator 应用

| 序号 | 配置项 | 说明 |
|------|--------|------|
| 1 | 创建应用 | 名称：Deal Product Selector |
| 2 | 创建页面 | 接收 Deal ID 参数，显示产品列表 |
| 3 | 页面逻辑 | 调用 CRM API 获取子表数据，渲染复选框 |
| 4 | 确认按钮 | 将选中的产品创建到 Products_Purchased |

### 第三步：URL 参数传递

```
按钮点击时跳转 URL：
https://creator.zoho.com/你的应用名/产品选择页面?deal_id=5809562000077156029
```

### 1. CRM 按钮 Deluge 函数

```deluge
// 获取当前 Deal ID
dealId = record.get("id");

// 拼接 Creator 页面 URL
creatorUrl = "https://creator.zoho.com/你的应用名/产品选择页面?deal_id=" + dealId;

// 跳转到 Creator 页面
openUrl(creatorUrl, "new window");
```

### 2. Creator 页面脚本（获取产品列表）

```deluge
// 页面加载时获取 Deal ID 参数
dealId = request.getParameter("deal_id");

// 调用 CRM API 获取 Deal 记录（包含子表）
getResp = invokeurl
[
    url: "https://www.zohoapis.com/crm/v8/Deals/" + dealId
    type: GET
    connection: "crm"
];

// 解析子表数据
dealData = getResp.get("data").get(0);
productInterestedList = dealData.get("Product_Interested_In");

// 渲染到页面（Creator 页面组件）
```

### 3. Creator 页面 UI（HTML）

```html
<form>
    <h2>选择要采购的产品</h2>
    <table>
        <thead>
            <tr>
                <th>选择</th>
                <th>产品名称</th>
                <th>数量</th>
                <th>单价</th>
            </tr>
        </thead>
        <tbody>
            <!-- 遍历 productInterestedList -->
            <tr>
                <td><input type="checkbox" name="product" value="产品ID"></td>
                <td>产品名称</td>
                <td>数量</td>
                <td>单价</td>
            </tr>
        </tbody>
    </table>
    <button type="submit">确认采购</button>
</form>
```

### 4. 确认创建逻辑

```deluge
// 获取选中的产品 ID
selectedProducts = request.getParameter("product");  // 数组

// 遍历创建 Products_Purchased 记录
for each productId in selectedProducts
{
    productParams = Map();
    productParams.put("Product_Name", {"id": productId});
    productParams.put("Deal_Name", {"id": dealId});
    // 其他字段...

    createResp = invokeurl
    [
        url: "https://www.zohoapis.com/crm/v8/Products_Purchased"
        type: POST
        parameters: {"data": [productParams]}.toString()
        connection: "crm"
    ];
}

// 创建完成后提示用户
alert("已成功创建 " + selectedProducts.size() + " 条采购记录");
```

---

## 项目状态

- [x] 需求确认
- [x] 方案选型
- [ ] CRM 端配置
- [ ] Zoho Creator 应用开发
- [ ] 联调测试
- [ ] 上线
