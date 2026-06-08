void automation.saveErrorIdsToLogs(String error400IdsStr,Int error400IdsCount,Int startOffset,Int finalProcessed,Int totalSuccess,Int totalFailed)
{
try 
{
	// 构建错误记录内容
	errorData = Map();
	errorData.put("batchStart",startOffset);
	errorData.put("batchEnd",finalProcessed);
	errorData.put("currentOffset",finalProcessed);
	errorData.put("errorCount",error400IdsCount);
	errorData.put("syncTime",zoho.currenttime.toString());
	// 创建错误记录
	noteParams = Map();
	noteParams.put("Name","CustomerSync_400Errors_" + startOffset + "_" + finalProcessed);
	noteParams.put("Error_Ids",error400IdsStr);
	noteParams.put("Log_Content","批次: " + startOffset + " - " + finalProcessed + ", 当前处理位置: " + finalProcessed + " 条, 成功: " + totalSuccess + " 条, 失败: " + totalFailed + " 条, 错误数量: " + error400IdsCount + ", 详细数据: " + errorData.toString());
	// 使用invokeurl创建Logs记录
	try 
	{
		// 构建请求参数
		dataList = List();
		dataList.add(noteParams);
		requestParams = Map();
		requestParams.put("data",dataList);
		// 调用CRM API创建记录
		createResult = invokeurl
		[
			url :"https://www.zohoapis.com.au/crm/v8/Logs"
			type :POST
			parameters:requestParams.toString()
			connection:"crm"
		];
		if(createResult != null)
		{
			info "400错误ID已保存到Notes";
		}
	}
	catch (e)
	{
		info "保存400错误ID到Notes失败: " + e;
	}
}
catch (e)
{
	info "保存400错误ID到Notes失败: " + e;
}
}