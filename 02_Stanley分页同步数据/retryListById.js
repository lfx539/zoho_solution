void automation.retryListById(String crmId,String module)
{
if(module == "Accounts")
{
	url = "https://www.zohoapis.com.au/crm/v8/Logs/" + crmId;
}
else if(module == "Sales_Orders")
{
	url = "https://www.zohoapis.com.au/crm/v8/SOLogs/" + crmId;
}
else if(module == "Cash_Sale")
{
	url = "https://www.zohoapis.com.au/crm/v8/CSLogs/" + crmId;
}
else if(module == "Invoices" || module == "Quotes" || module == "Credit_Memo")
{
	url = "https://www.zohoapis.com.au/crm/v8/otherLogs/" + crmId;
}
resp = invokeurl
[
	url :url
	type :GET
	connection:"crm"
];
// info resp;
errorIds = resp.get("data").get(0).get("Error_Ids");
info errorIds;
params = Map();
params.put("errorIds",errorIds);
// 传入 Map
if(module == "Accounts")
{
	result = standalone.SyncRetry(params,"Accounts","Netsuite_ID");
}
else if(module == "Sales_Orders")
{
	result = standalone.SyncRetry(params,"Sales_Orders","Subject");
}
else if(module == "Cash_Sale")
{
	result = standalone.SyncRetry(params,"Cash_Sale","Subject");
}
else if(module == "Invoices")
{
	result = standalone.SyncRetry(params,"Invoices","Subject");
}
else if(module == "Quotes")
{
	result = standalone.SyncRetry(params,"Quotes","Subject");
}
else if(module == "Credit_Memo")
{
	result = standalone.SyncRetry(params,"Credit_Memo","Subject");
}
// 获取结果
successIds = result.get("successIds");
failedIds = result.get("failedIds");
if(successIds != null && successIds.size() > 0)
{
	info "成功产品ID列表:" + successIds;
}
if(failedIds != null && failedIds.size() > 0)
{
	info "失败产品ID列表:" + failedIds;
}
resInfo = "处理完成" + errorIds.size() + "条数据，成功: " + successIds.size() + " 条，失败: " + failedIds.size() + " 条, Error Ids:" + failedIds;
info resInfo;
logParams = Map();
logParams.put("Sync_Result",resInfo);
logList = List();
logList.add(logParams);
parameters = Map();
parameters.put("data",logList);
// 更新现有记录
updateResult = invokeurl
[
	url :url
	type :PUT
	parameters:parameters.toString()
	connection:"crm"
];
if(updateResult != null)
{
	info "Log更新成功!";
}
}