void automation.saveErrorIdsToLogs1(String error400IdsStr,Int error400IdsCount,Int startOffset,Int finalProcessed,Int totalSuccess,Int totalFailed,String moduleName)
{
	// 构建错误记录名称
	logName = moduleName + "Sync_400Errors_" + startOffset + "_" + finalProcessed;
	// 先搜索是否已存在同名记录
	existingLog = zoho.crm.searchRecords("otherLogs","(Name:equals:" + logName + ")");
	existingLogId = null;
	if(existingLog != null && existingLog.size() > 0)
	{
		existingLogId = existingLog.get(0).get("id");
	}
	// 构建错误记录内容
	errorData = Map();
	errorData.put("batchStart",startOffset);
	errorData.put("batchEnd",finalProcessed);
	errorData.put("currentOffset",finalProcessed);
	errorData.put("errorCount",error400IdsCount);
	errorData.put("syncTime",zoho.currenttime.toString());
	// 创建错误记录
	noteParams = Map();
	noteParams.put("Name",logName);
	noteParams.put("Error_Ids",error400IdsStr);
	noteParams.put("Log_Content","批次: " + startOffset + " - " + finalProcessed + ", 当前处理位置: " + finalProcessed + " 条, 成功: " + totalSuccess + " 条, 失败: " + totalFailed + " 条, 错误数量: " + error400IdsCount + ", 详细数据: " + errorData.toString());
	noteParams.put("Modules",moduleName);
	// 构建请求参数
	dataList = List();
	dataList.add(noteParams);
	requestParams = Map();
	requestParams.put("data",dataList);
	// 判断是更新还是创建
	if(existingLogId != null)
	{
		// 更新已有记录
		createResult = invokeurl
		[
			url :"https://www.zohoapis.com.au/crm/v8/otherLogs/" + existingLogId
			type :PUT
			parameters:requestParams.toString()
			connection:"crm"
		];
	}
	else
	{
		// 创建新记录
		createResult = invokeurl
		[
			url :"https://www.zohoapis.com.au/crm/v8/otherLogs"
			type :POST
			parameters:requestParams.toString()
			connection:"crm"
		];
	}
	if(createResult != null)
	{
		info "错误ID已保存到Notes";
	}
}
