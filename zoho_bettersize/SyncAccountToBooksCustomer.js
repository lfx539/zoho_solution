/**
 * 从 CRM Accounts 同步地址信息到 Zoho Books Customer
 *
 * 同步字段：
 * - Shipping_Country_Name -> shipping_address.country
 * - Shipping_USA_State_Province -> shipping_address.state
 * - Billing_Country_Name -> billing_address.country
 * - Billing_USA_State_Province -> billing_address.state
 *
 * 说明：
 * - 每次处理第一页 200 条
 * - Schedule 定时执行
 *
 * 触发方式：Schedule 定时任务
 */

void schedule.SyncAccountToBooksCustomer()
{
    info "========== 开始同步 CRM Accounts 到 Books Customer ==========";

    organizationId = "920286948";  // bettersize Books organization_id

    // ========== 1. 查询 CRM Accounts ==========
    page = 1;
    perPage = 200;
    accounts = zoho.crm.getRecords("Accounts", page, perPage);

    if(accounts == null || accounts.size() == 0)
    {
        info "没有 Accounts";
        return;
    }

    info "获取 " + accounts.size() + " 条";

    // ========== 2. 遍历处理 ==========
    successCount = 0;
    failCount = 0;
    skipCount = 0;

    for each account in accounts
    {
        accountId = account.get("id");
        accountName = account.get("Account_Name");

        // 获取字段值
        shippingCountryName = "";
        shippingState = "";
        billingCountryName = "";
        billingState = "";

        // Shipping Country Name (Lookup)
        shippingCountryObj = account.get("Shipping_Country_Name");
        if(shippingCountryObj != null && shippingCountryObj.containsKey("name"))
        {
            shippingCountryName = shippingCountryObj.get("name");
        }

        // Shipping USA State/Province (Lookup)
        shippingStateObj = account.get("Shipping_USA_State_Province");
        if(shippingStateObj != null && shippingStateObj.containsKey("name"))
        {
            shippingState = shippingStateObj.get("name");
        }

        // Billing Country Name (Lookup)
        billingCountryObj = account.get("Billing_Country_Name");
        if(billingCountryObj != null && billingCountryObj.containsKey("name"))
        {
            billingCountryName = billingCountryObj.get("name");
        }

        // Billing USA State/Province (Lookup)
        billingStateObj = account.get("Billing_USA_State_Province");
        if(billingStateObj != null && billingStateObj.containsKey("name"))
        {
            billingState = billingStateObj.get("name");
        }

        // 跳过没有任何地址信息的 Account
        if(shippingCountryName == "" && shippingState == "" && billingCountryName == "" && billingState == "")
        {
            skipCount = skipCount + 1;
            continue;
        }

        // ========== 3. 查找对应的 Books Customer ==========
        booksCustomerId = null;

        searchUrl = "https://www.zohoapis.com/books/v3/contacts?organization_id=" + organizationId + "&contact_name=" + encodeUrl(accountName) + "&contact_type=customer";

        searchResponse = invokeurl
        [
            url: searchUrl
            type: GET
            connection: "books"
        ];

        if(searchResponse != null && searchResponse.get("contacts") != null && searchResponse.get("contacts").size() > 0)
        {
            booksCustomerId = searchResponse.get("contacts").get(0).get("contact_id");
        }

        if(booksCustomerId == null)
        {
            info "未找到 Books Customer: " + accountName;
            failCount = failCount + 1;
            continue;
        }

        // ========== 4. 更新 billing_address 和 shipping_address ==========
        updateData = Map();

        // Billing Address
        billingAddress = Map();
        billingAddress.put("country", billingCountryName);
        billingAddress.put("state", billingState);
        updateData.put("billing_address", billingAddress);

        // Shipping Address
        shippingAddress = Map();
        shippingAddress.put("country", shippingCountryName);
        shippingAddress.put("state", shippingState);
        updateData.put("shipping_address", shippingAddress);

        updateUrl = "https://www.zohoapis.com/books/v3/contacts/" + booksCustomerId + "?organization_id=" + organizationId;

        updateResponse = invokeurl
        [
            url: updateUrl
            type: PUT
            parameters: updateData.toString()
            connection: "books"
        ];

        info "完整响应: " + updateResponse;

        if(updateResponse != null && updateResponse.get("code") == 0)
        {
            successCount = successCount + 1;
            info "更新成功: " + accountName;
        }
        else
        {
            failCount = failCount + 1;
            info "更新失败: " + accountName + " - " + updateResponse;
        }
    }

    // ========== 5. 输出统计 ==========
    info "========== 完成 ==========";
    info "成功: " + successCount;
    info "失败: " + failCount;
    info "跳过: " + skipCount;
    info "总计: " + accounts.size();
}
