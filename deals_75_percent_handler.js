/*
 * Zoho CRM - Deals 达到 75% 时跳转到 Quote
 *
 * 逻辑:
 * 1. 检查 Deal 概率是否达到 75%
 * 2. 在 Zoho Books 中搜索与该 Account 关联的 Quote
 * 3. 如果存在 → 跳转到已存在的 Quote
 * 4. 如果不存在 → 跳转到新建 Quote
 *
 * 使用方法:
 * 1. 在 Zoho CRM > 设置 > 扩展 > API > 连接 创建 Connection (名称: zoho_books_connection)
 * 2. 在 Zoho CRM > 设置 > 定制 > 模块和字段 > Deals 添加自定义按钮
 * 3. 按钮类型选择 "函数"，粘贴此函数代码
 * 4. 按钮显示位置选择 "详情页"
 */
string button.CreateQuoteFromDeal(string dealId)
{
    organizationId = "891257442";

    // 获取当前 Deal 信息
    dealData = zoho.crm.getRecordById("Deals", dealId);

    // 检查概率是否达到 75%
    probability = dealData.get("Probability");
    if(probability < 75)
    {
        return "Deal 概率未达到 75%，当前为 " + probability + "%";
    }

    // 获取关联的 Account 名称
    accountName = "";
    if(dealData.get("Account_Name") != null)
    {
        accountName = dealData.get("Account_Name").get("name");
    }

    // 获取 Deal 名称
    dealName = dealData.get("Deal_Name");

    // 搜索关键词: 优先用 Account 名称，否则用 Deal 名称
    searchCustomer = accountName;
    if(searchCustomer == null || searchCustomer == "")
    {
        searchCustomer = dealName;
    }

    // 调用 Zoho Books API 搜索 Quotes
    searchParam = Map();
    searchParam.put("customer_name", searchCustomer);

    quotesResponse = zoho.books.getRecords(
        "estimates",
        organizationId,
        searchParam,
        "books"
    );

    // 检查是否有已存在的 Estimates
    estimates = quotesResponse.get("estimates");

    if(estimates != null && estimates.size() > 0)
    {
        // 存在关联 Estimate，跳转到第一个
        firstEstimateId = estimates.get(0).get("estimate_id");
        booksUrl = "https://books.zoho.com/app/" + organizationId + "#/quotes/" + firstEstimateId;
        openUrl(booksUrl, "new window");
        return "已跳转到关联 Estimate: " + estimates.get(0).get("estimate_number");
    }
    else
    {
        // 没有关联 Estimate，跳转到新建页面
        booksUrl = "https://books.zoho.com/app/" + organizationId + "#/quotes/new";
        openUrl(booksUrl, "new window");
        return "请在 Zoho Books 中创建估价单";
    }
}