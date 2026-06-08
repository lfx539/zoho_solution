string button.CreateQuoteFromDeal(String dealId)
{
organizationId = "891257442";
// 获取当前 Deal 信息
dealData = zoho.crm.getRecordById("Deals",dealId);
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
searchParam.put("customer_name",searchCustomer);
quotesResponse = zoho.books.getRecords("estimates",organizationId,searchParam,"books");
// 检查是否有已存在的 Estimates
estimates = quotesResponse.get("estimates");
if(estimates != null && estimates.size() > 0)
{
	// 存在关联 Estimate，跳转到第一个
	firstEstimateId = estimates.get(0).get("estimate_id");
	booksUrl = "https://books.zoho.com/app/" + organizationId + "#/quotes/" + firstEstimateId + "/edit";
	openUrl(booksUrl,"new window");
	return "已跳转到关联 Estimate: " + estimates.get(0).get("estimate_number");
}
else
{
	// 没有关联 Estimate，跳转到新建页面
	booksUrl = "https://books.zoho.com/app/" + organizationId + "#/quotes/new";
	openUrl(booksUrl,"new window");
	return "请在 Zoho Books 中创建估价单";
}
}