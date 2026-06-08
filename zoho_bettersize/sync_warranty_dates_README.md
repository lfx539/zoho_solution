# 同步 Warranty 日期 - 配置说明

## 文件位置
`sync_warranty_dates.js`

## 功能说明
当 Case_Module 的 Product_Purchased 子表的 Warranty_Start_Date 和 Warranty_End_Date 更新时：
1. 同步更新 Products_Purchased 模块的同名字段
2. 同步更新关联 Deal 的 Product_Purchased_deal 子表的同名字段

## 匹配逻辑
- 通过 `Product_Name` (Lookup 字段) 匹配记录

---

## 配置步骤

### 方式一：Workflow Rule（推荐）

1. **创建 Workflow Rule**
   - 模块：Case_Module
   - 触发条件：Edit（编辑时）
   - 条件：Product_Purchased 子表的 Warranty_Start_Date 或 Warranty_End_Date 有变化

2. **添加 Action**
   - 类型：Custom Function
   - 选择：syncWarrantyDates
   - 参数映射：
     - `caseId` -> `Case_Module.Id`

3. **注意事项**
   - Workflow 对子表变化的检测可能有限制
   - 建议测试后确认触发是否正常

---

### 方式二：Button（备选）

如果 Workflow 无法精确检测子表变化，可以在 Case_Module 添加一个 Button：

1. **创建 Button**
   - 模块：Case_Module
   - 类型：Writing Function
   - Label：同步 Warranty 日期

2. **Function 参数**
   - `caseId`: Case_Module.Id

3. **用户操作**
   - 编辑子表后，点击按钮手动触发同步

---

### 方式三：子表单独的模块（如果有）

如果 Product_Purchased 是独立模块，可以在该模块上创建 Workflow：
- 模块：Products_Purchased
- 触发条件：Edit
- 条件：Warranty_Start_Date 或 Warranty_End_Date 有变化
- 更新关联的 Case 和 Deal 的子表

---

## 函数参数

| 参数名 | 类型 | 说明 |
|--------|------|------|
| caseId | String | Case 记录的 ID |
| subformRowId | String | 子表行 ID（可选，用于精确定位更新的行） |

---

## 字段映射

| Case 子表字段 | Products_Purchased 模块 | Deal 子表字段 |
|--------------|------------------------|--------------|
| Product_Name | Product_Name | Product_Name |
| Warranty_Start_Date | Warranty_Start_Date | Warranty_Start_Date |
| Warranty_End_Date | Warranty_End_Date | Warranty_End_Date |

---

## 测试建议

1. 创建测试 Case，关联一个 Deal
2. 在 Case 的 Product_Purchased 子表中添加产品并设置 Warranty 日期
3. 触发 Function
4. 检查：
   - Products_Purchased 模块中对应记录是否更新
   - Deal 的 Product_Purchased_deal 子表是否更新

---

## 可能的问题

1. **子表变化检测**
   - Zoho CRM 的 Workflow 可能无法精确检测子表单个字段的变化
   - 如果遇到问题，考虑使用 Button 方式手动触发

2. **多条匹配记录**
   - 如果一个 Product_Name 在 Products_Purchased 模块中有多条记录，会全部更新

3. **API 限制**
   - 大量数据时注意 API 调用限制