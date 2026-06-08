/*
 * Creator 表单提交处理 - 创建 Products_Purchased 记录
 *
 * Zoho Creator 配置：
 * 1. 进入 ProductSelectionForm 表单
 * 2. 点击 Workflow 标签页
 * 3. 创建新 Workflow，触发器选择 On Add
 * 4. 将此代码粘贴到 On Add 代码块中
 */

// ==================== 获取表单数据 ====================
dealId = input.Deal_ID;
selectedProductsStr = input.Selected_Products;

info "Deal ID: " + dealId;
info "Selected Products: " + selectedProductsStr;

// ==================== 解析选中的产品 ID ====================
selectedProductIds = selectedProductsStr.toList(",");

if(selectedProductIds != null && selectedProductIds.size() > 0)
{
    // ==================== 获取 Deal 信息 ====================
    dealResp = invokeurl
    [
        url: "https://www.zohoapis.com/crm/v8/Deals/" + dealId
        type: GET
        connection: "crm"
    ];

    dealData = null;
    accountInfo = null;
    productInterestedList = List();

    if(dealResp != null && dealResp.get("data") != null && dealResp.get("data").size() > 0)
    {
        dealData = dealResp.get("data").get(0);
        accountInfo = dealData.get("Account_Name");
        productInterestedList = dealData.get("Product_Interested_In");
    }

    // ==================== 创建 Products_Purchased 记录 ====================
    successCount = 0;
    failCount = 0;

    for each productId in selectedProductIds
    {
        // 从子表中查找对应产品的详细信息
        quantity = "";
        unitPrice = "";

        if(productInterestedList != null)
        {
            for each item in productInterestedList
            {
                productField = item.get("Product");
                if(productField != null && productField.get("id") == productId)
                {
                    quantity = ifnull(item.get("Quantity"), "");
                    unitPrice = ifnull(item.get("Unit_Price"), "");
                    break;
                }
            }
        }

        // 构建创建参数
        purchasedParams = Map();
        purchasedParams.put("Deal_Name", {"id": dealId});
        purchasedParams.put("Product_Name", {"id": productId});

        if(accountInfo != null)
        {
            purchasedParams.put("Account_Name", accountInfo);
        }

        if(quantity != "")
        {
            purchasedParams.put("Quantity", quantity);
        }

        if(unitPrice != "")
        {
            purchasedParams.put("Unit_Price", unitPrice);
        }

        // 设置采购日期
        purchasedParams.put("Purchase_Date", zoho.currentdate);

        // 用 data 包装
        dataList = List();
        dataList.add(purchasedParams);
        createParams = Map();
        createParams.put("data", dataList);

        info "Creating Products_Purchased: " + createParams;

        // 调用 CRM API 创建记录
        createResp = invokeurl
        [
            url: "https://www.zohoapis.com/crm/v8/Products_Purchased"
            type: POST
            parameters: createParams.toString()
            connection: "crm"
        ];

        info "Create Response: " + createResp;

        // 判断是否成功
        if(createResp != null && createResp.get("data") != null)
        {
            successCount = successCount + 1;
        }
        else
        {
            failCount = failCount + 1;
        }
    }

    // 返回结果提示
    resultMsg = "成功创建 " + successCount + " 条采购记录";
    if(failCount > 0)
    {
        resultMsg = resultMsg + "，失败 " + failCount + " 条";
    }

    info resultMsg;
}