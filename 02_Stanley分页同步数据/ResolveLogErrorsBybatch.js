void automation.ResolveLogErrorsBybatch()
{
module = "Accounts";
try 
{
	// 使用 select_query (COQL) 语法查询
	// 查询 Sync_Result 为空的记录，限制15条
	if(module == "Accounts")
	{
		selectQuery = "select id from Logs where Sync_Result is null limit 15";
	}
	else if(module == "Sales_Orders")
	{
		selectQuery = "select id from SOLogs where Sync_Result is null limit 15";
	}
	else if(module == "Cash_Sale")
	{
		selectQuery = "select id from CSLogs where Sync_Result is null limit 15";
	}
	else if(module == "Invoices")
	{
		selectQuery = "select id from otherLogs where ((Sync_Result is null) and (Modules = 'Invoice')) limit 15";
	}
	else if(module == "Quotes")
	{
		selectQuery = "select id from otherLogs where ((Sync_Result is null) and (Modules = 'Quote')) limit 15";
	}
	else if(module == "Credit_Memo")
	{
		selectQuery = "select id from otherLogs where ((Sync_Result is null) and (Modules = 'CM')) limit 15";
	}
	// 构建请求参数
	requestParams = Map();
	requestParams.put("select_query",selectQuery);
	// 使用 COQL API 端点
	apiUrl = "https://www.zohoapis.com.au/crm/v8/coql";
	apiResponse = invokeurl
	[
		url :apiUrl
		type :POST
		parameters:requestParams.toString()
		connection:"crm"
	];
	if(apiResponse == null)
	{
		info "API 返回为空";
		return;
	}
	// 解析 API 响应
	responseData = apiResponse.get("data");
	if(responseData == null || responseData.size() == 0)
	{
		info "未找到符合条件的 SOLogs 记录";
		return;
	}
	info "获取到 " + responseData.size() + " 条符合条件的 SOLogs 记录";
	// 遍历处理每条记录
	for each  logRecord in responseData
	{
		logId = logRecord.get("id");
		info logId;
		if(logId != null && logId != "")
		{
			// 调用处理函数
			automation.retryListById(logId,module);
		}
	}
	info "批量处理完成，共处理 " + responseData.size() + " 条记录";
}
catch (e)
{
	info "获取 SOLogs CRM ID 失败: " + e;
}
}