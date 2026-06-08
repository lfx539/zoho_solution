void schedule.AutoSyncAccountsFull()
{
// 从CRM获取当前进度
currentOffset = 0;
statusNoteId = null;
statusNotes = zoho.crm.searchRecords("Logs","(Name:equals:CustomerSyncStatus)");
if(statusNotes != null && statusNotes.size() > 0)
{
	statusNote = statusNotes.get(0);
	statusNoteId = statusNote.get("id");
	noteContent = statusNote.get("Log_Content");
	if(noteContent != null && noteContent != "")
	{
		// 使用toMap()解析状态数据
		statusMap = noteContent.toMap();
		if(statusMap != null)
		{
			offsetValue = statusMap.get("currentOffset");
			if(offsetValue != null)
			{
				currentOffset = offsetValue.toLong();
			}
		}
	}
}
info "开始自动同步客户，当前进度: " + currentOffset + " 条";
// 调用批量同步函数（带返回值）
syncResult = standalone.SyncAccountWithResult(currentOffset);
if(syncResult != null)
{
	finalProcessed = syncResult.get("finalProcessed");
	hasMore = syncResult.get("hasMore");
	error400Ids = syncResult.get("error400Ids");
	// 更新CustomerSyncStatus记录（无论是否有错误都更新）
	try 
	{
		statusData = Map();
		statusData.put("currentOffset",finalProcessed);
		statusData.put("lastSyncTime",zoho.currenttime.toString());
		statusData.put("hasMore",hasMore);
		statusNoteParams = Map();
		statusNoteParams.put("Name","CustomerSyncStatus");
		statusNoteParams.put("Log_Content",statusData.toString());
		statusDataList = List();
		statusDataList.add(statusNoteParams);
		statusRequestParams = Map();
		statusRequestParams.put("data",statusDataList);
		if(statusNoteId != null)
		{
			// 更新现有记录
			updateResult = invokeurl
			[
				url :"https://www.zohoapis.com.au/crm/v8/Logs/" + statusNoteId
				type :PUT
				parameters:statusRequestParams.toString()
				connection:"crm"
			];
		}
		else
		{
			// 创建新记录
			createStatusResult = invokeurl
			[
				url :"https://www.zohoapis.com.au/crm/v8/Logs"
				type :POST
				parameters:statusRequestParams.toString()
				connection:"crm"
			];
		}
	}
	catch (e)
	{
		info "更新CustomerSyncStatus记录失败: " + e;
	}
	// 如果还有更多数据，提示设置自动调度
	if(hasMore == true && finalProcessed < 2000)
	{
		info "还有更多数据待处理，新的起始位置: " + finalProcessed;
		info "请在Zoho CRM Workflow中设置自动调度，调用 schedule.AutoSyncCustomerFull()，间隔5分钟";
	}
	else
	{
		info "所有数据已处理完成！";
	}
}
}