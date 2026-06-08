# Zoho CRM 模块字段和子表文档

## 1. Products_Purchased 模块

### 主要字段
| API Name | 字段类型 | 描述 |
|----------|----------|------|
| Name | Single Line | 记录名称 (通常为 Deal_Name) |
| Product_Name | Lookup (Products) | 产品关联 |
| Account_Name | Lookup (Accounts) | 客户关联 |
| Deal_Name | Lookup (Deals) | 商机关联 |
| Serial_Number | Single Line | 序列号 |
| Warranty_Start_Date | Date | 保修开始日期 |
| Warranty_End_Date | Date | 保修结束日期 |

### 来源
- 通过 `convProduct.jsx` 从 Deal 的 Product_Interested_deal 子表转化创建

---

## 2. Leads 模块

### 主要字段
| API Name | 字段类型 | 描述 |
|----------|----------|------|
| Full_Name | Single Line | Lead 全名 |
| Name | Single Line | Lead 名称 |
| Company | Single Line | 公司名称 |
| Email | Email | 邮箱 |
| Phone | Phone | 电话 |
| Account_Name | Lookup (Accounts) | 关联客户 (转化后) |
| Contact_Name | Lookup (Contacts) | 关联联系人 (转化后) |
| Owner | Lookup (Users) | Lead Owner |
| IsConvertDeal | Checkbox | 是否已转化为 Deal |
| Converted | Checkbox | 是否已转化 |
| leadIdCopy | Single Line | Lead ID 副本 |
| Source | Pick List | Lead 来源 |
| Company_Industry | Pick List | 公司行业 |
| Note | Multi Line | 备注 |
| Trade_Show | Single Line | 展会 |
| Webinar_Topic | Single Line | 网络研讨会主题 |
| Competitor | Lookup | 竞争对手 |

### 子表 (Subform)
#### Product_Interested_lead
| API Name | 字段类型 | 描述 |
|----------|----------|------|
| Product_Name | Lookup (Products) | 产品名称 |
| Comments | Multi Line | 备注/评论 |

---

## 3. Deals 模块

### 主要字段
| API Name | 字段类型 | 描述 |
|----------|----------|------|
| Deal_Name | Single Line | Deal 名称 |
| Stage | Pick List | 阶段 (如 Closed Won) |
| Account_Name | Lookup (Accounts) | 关联客户 |
| Contact_Name | Lookup (Contacts) | 关联联系人 |
| Owner | Lookup (Users) | Deal Owner |
| leadIdCopy | Single Line | 来源 Lead ID |
| LeadName | Lookup (Leads) | 关联 Lead |
| Converted_Date | Date | 转化日期 |
| Amount | Currency | 金额 |
| Closing_Date | Date | 预计结单日期 |
| Lead_Source | Pick List | Lead 来源 |
| Pipeline | Pick List | 销售管道 |
| GlobalSalesRegion | Pick List | 全球销售区域 |
| NAm_Territory | Pick List | 北美区域 |
| Industry | Pick List | 行业 |
| Competitor | Lookup | 竞争对手 |
| IsConvertedToProductPurchased | Checkbox | 是否已转化为 Product Purchased |
| Scorting | Rating | 评分 |

### 子表 (Subform)
#### Product_Interested_deal
| API Name | 字段类型 | 描述 |
|----------|----------|------|
| Product_Name | Lookup (Products) | 产品名称 |
| Comments | Multi Line | 备注/评论 |
| Converted_To_Sales | Checkbox | 是否已转化为销售 |
| IsOrderPlaced | Checkbox (已弃用) | 是否已下单 (旧字段) |

#### Product_Purchased_deal
| API Name | 字段类型 | 描述 |
|----------|----------|------|
| Purchase_Name | Lookup (Products_Purchased) | 关联 Products_Purchased 记录 |
| Product_Name | Lookup (Products) | 产品名称 |
| Comments | Multi Line | 备注/评论 |
| Serial_Number | Single Line | 序列号 |
| Warranty_Start_Date | Date | 保修开始日期 |
| Warranty_End_Date | Date | 保修结束日期 |

---

## 4. Cases 模块

### 主要字段
| API Name | 字段类型 | 描述 | 必填 |
|----------|----------|------|------|
| Name | Single Line | Case 名称 (Deal_Name + Case Type) | 是 |
| Subject | Single Line | 主题 | 否 |
| Type | Pick List | Case 类型 | 是 |
| Status | Pick List | 状态 | 否 |
| Priority | Pick List | 优先级 | 否 |
| Owner | Lookup (Users) | Case Owner | 是 |
| Lead | Lookup (Leads) | 关联 Lead | 否 |
| Deal | Lookup (Deals) | 关联 Deal | 否 |
| Account_Name | Lookup (Accounts) | 关联客户 | 否 |
| Related_To | Lookup (Contacts) | 关联联系人 | 否 |
| Salesperson | User | 销售人员 (来自 Account.Owner) | 否 |
| Case_Creator | Lookup (Users) | Case 创建者 (来自 Lead/Deal Owner) | 否 |
| Case_Creation_Date | Date | Case 创建日期 | 否 |
| Next_Step | Single Line | 下一步 | 否 |

### Case Type 选项
- Others
- Opportunity - In House Demo
- Opportunity - Field Demo
- Opportunity - Sample Analysis
- Installation
- Service - Hardware Issues
- Service - Software Issues
- Service - Return/Exchange
- Service - General/Maintenance

### Status 选项
- New
- Waiting for Parts/ Prep
- Processing
- Validate/ Verify
- Closed

### Priority 选项
- High
- Medium
- Low

### 子表 (Subform)
#### Product_Interest_Case (非 Closed Won 状态使用)
| API Name | 字段类型 | 描述 |
|----------|----------|------|
| Product_Name | Lookup (Products) | 产品名称 |
| Comments | Multi Line | 备注/评论 |
| Converted_To_Sales | Checkbox | 是否已转化为销售 |

#### Product_Purchased_Case (Closed Won 状态使用)
| API Name | 字段类型 | 描述 |
|----------|----------|------|
| Purchase_Name | Lookup (Products_Purchased) | 关联 Products_Purchased 记录 |
| Product_Name | Lookup (Products) | 产品名称 |
| Comments | Multi Line | 备注/评论 |
| Serial_Number | Single Line | 序列号 |
| Warranty_Start_Date | Date | 保修开始日期 |
| Warranty_End_Date | Date | 保修结束日期 |

---

## 5. 数据流转关系

### Lead -> Deal
```
Lead.Product_Interested_lead -> Deal.Product_Interested_deal
```

### Deal -> Products_Purchased
```
Deal.Product_Interested_deal -> Products_Purchased (通过 convProduct.jsx)
Deal.Product_Purchased_deal 记录 Products_Purchased ID
```

### Lead -> Case
```
Lead.Product_Interested_lead -> Cases.Product_Interest_Case
Lead.Owner -> Cases.Case_Creator
Lead.Account -> Cases.Account_Name
Account.Owner -> Cases.Salesperson
```

### Deal -> Case
```
非 Closed Won:
  Deal.Product_Interested_deal -> Cases.Product_Interest_Case

Closed Won:
  Deal.Product_Purchased_deal -> Cases.Product_Purchased_Case

Deal.Owner -> Cases.Case_Creator
Deal.Account -> Cases.Account_Name
Deal.Contact -> Cases.Related_To
Account.Owner -> Cases.Salesperson
```

---

## 6. 注意事项

1. **字段名拼写**: `leadIdCopy` 不是 `lealIdCopy` (早期代码中有拼写错误，已统一修正)

2. **Salesperson 字段**: 是 User 类型字段，赋值时直接用 ID 字符串，不需要 `{ id: xxx }` 格式

3. **子表更新**: 更新子表时，需要先删除旧数据再添加新数据：
   ```javascript
   productPayload = existingList.map(item => ({ id: item.id, _delete: true }));
   productPayload = productPayload.concat(newList);
   ```

4. **Closed Won 判断**: 只有 Stage = "Closed Won" 且 IsConvertedToProductPurchased = true 时才能同步 Product_Purchased_Case

5. **保修日期和序列号同步**: Case 的 Product_Purchased_Case 子表中填写 Serial_Number、Warranty_Start_Date、Warranty_End_Date 后，会通过 sync_warranty_dates.js 同步到 Products_Purchased 模块和 Deal 的 Product_Purchased_deal 子表

5. **Case 创建逻辑变更** (2026-05-21):
   - 每次 Create Case 都创建新 Case，不再查找已存在的 Case
   - 一个 Lead/Deal 可以对应多个 Case
   - Case Owner 必填

---

## 7. 相关文件

### szbtpro/src/widgets/
- `createCaseFromLead.jsx` - 从 Lead 创建 Case
- `createCaseFromDeal.jsx` - 从 Deal 创建 Case
- `convProduct.jsx` - Product Interested 转化为 Products_Purchased
- `conv.jsx` - Lead 转化逻辑

### zoho_bettersize/
- `lead_to_case_products.js` - Deluge: Lead 产品同步到 Case
- `deal_to_case_products.js` - Deluge: Deal 产品同步到 Case
- `sync_warranty_dates.js` - Deluge: 保修日期同步