void automation.retryList()
{
errorIds = {2059057,2058056,2059761,2060365,2059762,2060063,2060164,2060766,2059962,2060765,2059862,2060163,2059658,2059764,2060465,2059863,2060165,2060366,2060264,2059660,2060865,2060364,2060565,2059557,2060665,2059661,2060166,2059763,2060965,2060062,2059662,2059657,2059659,2059357,2059760,2060466,2061065,2060464,2059765,2059457,1335039,2060566,2059759};
params = Map();
params.put("errorIds",errorIds);
// 传入 Map
// result = standalone.SyncRetry(params,"Products","Internal_ID");
result = standalone.SyncRetry(params,"Accounts","Netsuite_ID");
// result = standalone.SyncRetry(params,"Sales_Orders","Subject");
// result = standalone.SyncRetry(params,"Cash_Sale","Subject");
// result = standalone.SyncRetry(params,"Invoices","Subject");
// result = standalone.SyncRetry(params,"Quotes","Subject");
// result = standalone.SyncRetry(params,"Credit_Memo","Subject");
// 获取结果
successIds = result.get("successIds");
failedIds = result.get("failedIds");
info "处理完成" + errorIds.size() + "条数据，成功: " + successIds.size() + " 条，失败: " + failedIds.size() + " 条";
if(successIds != null && successIds.size() > 0)
{
	info "成功产品ID列表:" + successIds;
}
if(failedIds != null && failedIds.size() > 0)
{
	info "失败产品ID列表:" + failedIds;
}
}