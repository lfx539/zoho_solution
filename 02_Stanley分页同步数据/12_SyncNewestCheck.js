void schedule.SyncNewestCheck()
{
baseUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/check";
limit = 200;
errorIds = List();
totalProcessed = 0;
totalSuccess = 0;
totalFailed = 0;
statusNoteId = null;
fromDate = "01/01/2026";
todayStr = "01/01/2026";
// 从 vendorLogs 读 lastSyncDate 或 lastSyncTime
statusNotes = zoho.crm.searchRecords("vendorLogs","(Name:equals:CheckSyncStatus)");
if(statusNotes != null && statusNotes.size() > 0)
{
	statusNote = statusNotes.get(0);
	statusNoteId = statusNote.get("id");
	noteContent = statusNote.get("Log_Content");
	if(noteContent != null && noteContent != "")
	{
		statusMap = noteContent.toMap();
		if(statusMap != null)
		{
			lastSyncDateVal = statusMap.get("lastSyncDate");
			if(lastSyncDateVal != null && lastSyncDateVal != "" && lastSyncDateVal.indexOf("/") >= 0)
			{
				parts = lastSyncDateVal.toList("/");
				if(parts.size() >= 3)
				{
					// 检查是否是 DD/Mon/YYYY 格式（如 29/Jun/2026）
					monthNames = {"Jan":"01","Feb":"02","Mar":"03","Apr":"04","May":"05","Jun":"06","Jul":"07","Aug":"08","Sep":"09","Oct":"10","Nov":"11","Dec":"12"};
					p1Str = parts.get(1);
					if(monthNames.containsKey(p1Str))
					{
						// DD/Mon/YYYY 格式，转换为 DD/MM/YYYY
						fromDate = parts.get(0) + "/" + monthNames.get(p1Str) + "/" + parts.get(2);
					}
					else
					{
						// 尝试作为数字解析
						p0 = parts.get(0).toNumber();
						p1 = parts.get(1).toNumber();
						if(p0 <= 12 && p1 > 12)
						{
							fromDate = parts.get(1) + "/" + parts.get(0) + "/" + parts.get(2);
						}
						else
						{
							fromDate = lastSyncDateVal;
						}
					}
				}
				else
				{
					fromDate = lastSyncDateVal;
				}
			}
			else
			{
				lastSyncTimeVal = statusMap.get("lastSyncTime");
				if(lastSyncTimeVal != null && lastSyncTimeVal != "" && lastSyncTimeVal.length() >= 10)
				{
					part = lastSyncTimeVal.trim().substring(0,10);
					parts = part.toList("-");
					// 支持两种格式：
					// 1. "2026-06-26 13:00:57" (YYYY-MM-DD)
					// 2. "26-Jun-2026 13:00:57" (DD-Mon-YYYY)
					if(parts.size() >= 3)
					{
						// 检查第一部分是否是4位数（年份）
						if(parts.get(0).length() == 4)
						{
							// YYYY-MM-DD 格式
							fromDate = parts.get(2) + "/" + parts.get(1) + "/" + parts.get(0);
						}
						else
						{
							// DD-Mon-YYYY 格式
							monthNames = {"Jan":"01","Feb":"02","Mar":"03","Apr":"04","May":"05","Jun":"06","Jul":"07","Aug":"08","Sep":"09","Oct":"10","Nov":"11","Dec":"12"};
							p1Str = parts.get(1);
							if(monthNames.containsKey(p1Str))
							{
								fromDate = parts.get(0) + "/" + monthNames.get(p1Str) + "/" + parts.get(2);
							}
						}
					}
				}
			}
		}
	}
}
// Zoho 返回 "29-Jun-2026"（DD-Mon-YYYY），转为 DD/MM/YYYY 数字格式
monthMap = {"Jan":"01","Feb":"02","Mar":"03","Apr":"04","May":"05","Jun":"06","Jul":"07","Aug":"08","Sep":"09","Oct":"10","Nov":"11","Dec":"12"};
raw = zoho.currentdate.toString();
if(raw != null && raw != "")
{
	parts = raw.toList("-");
	if(parts.size() >= 3)
	{
		dd = parts.get(0);
		mon = parts.get(1);
		yyyy = parts.get(2);
		// 将英文月份转为数字
		if(monthMap.containsKey(mon))
		{
			todayStr = dd + "/" + monthMap.get(mon) + "/" + yyyy;
		}
		else
		{
			todayStr = dd + "/" + mon + "/" + yyyy;
		}
	}
}
qStr = 'createdDate ON_OR_AFTER "' + fromDate + '"';
info "开始同步最新Checks，fromDate = " + fromDate;
try
{
	allItems = List();
	offset = 0;
	hasMore = true;
	pageList = {1,2,3,4,5,6,7,8,9,10,11,12,13,14,15};
	for each  pageNum in pageList
	{
		if(hasMore == false)
		{
			break;
		}
		auth = standalone.SetHeadersForNewest("GET",baseUrl,true,limit,offset,qStr);
		headers = {"Content-Type":"application/json","Authorization":auth};
		resp = invokeurl
		[
			url :baseUrl + "?limit=" + limit + "&offset=" + offset + "&q=" + qStr
			type :GET
			headers:headers
		];
		if(resp == null)
		{
			info "获取Check列表失败，offset = " + offset;
			break;
		}
		listData = resp.getFileContent().toJSONList().get(0);
		items = listData.get("items");
		hasMoreValue = listData.get("hasMore");
		if(hasMoreValue != null)
		{
			hasMore = hasMoreValue;
		}
		else
		{
			hasMore = false;
		}
		if(items == null || items.size() == 0)
		{
			break;
		}
		info "本页 " + items.size() + " 条（offset=" + offset + "），hasMore=" + hasMore;
		for each  pageItem in items
		{
			allItems.add(pageItem);
		}
		if(hasMore == false)
		{
			break;
		}
		offset = offset + limit;
	}
	if(allItems == null || allItems.size() == 0)
	{
		info "没有新增Check（createdDate >= " + fromDate + "）";
		statusData = Map();
		statusData.put("lastSyncDate",todayStr);
		statusData.put("lastSyncTime",zoho.currenttime.toString());
		statusNoteParams = Map();
		statusNoteParams.put("Name","CheckSyncStatus");
		statusNoteParams.put("Log_Content",statusData.toString());
		statusDataList = List();
		statusDataList.add(statusNoteParams);
		statusRequestParams = Map();
		statusRequestParams.put("data",statusDataList);
		if(statusNoteId != null && statusNoteId != "")
		{
			invokeurl
			[
				url :"https://www.zohoapis.com.au/crm/v8/vendorLogs/" + statusNoteId
				type :PUT
				parameters:statusRequestParams.toString()
				connection:"crm"
			]
		}
		else
		{
			invokeurl
			[
				url :"https://www.zohoapis.com.au/crm/v8/vendorLogs"
				type :POST
				parameters:statusRequestParams.toString()
				connection:"crm"
			]
		}
		info "CheckSyncStatus 已更新，lastSyncDate = " + todayStr;
		return;
	}
	info "共获取 " + allItems.size() + " 条Check，开始逐条同步";
	for each  item in allItems
	{
		checkId = item.get("id");
		try
		{
			syncResult = standalone.SyncSingleCheck(checkId);
			isSuccess = false;
			errorMsg = "未知错误";
			if(syncResult != null)
			{
				res = syncResult.get("res");
				if(res != null)
				{
					data = res.get("data");
					if(data != null && data.size() > 0)
					{
						firstItem = data.get(0);
						if(firstItem != null)
						{
							status = firstItem.get("status");
							code = firstItem.get("code");
							message = firstItem.get("message");
							if(status != null && status == "success")
							{
								isSuccess = true;
							}
							else if(code != null && code == "SUCCESS")
							{
								isSuccess = true;
							}
							else
							{
								if(message != null)
								{
									errorMsg = message;
								}
								else if(code != null)
								{
									errorMsg = code;
								}
							}
						}
					}
				}
				// 检查 syncResult 中的 error 字段
				errorFromResult = syncResult.get("error");
				if(errorFromResult != null && errorFromResult != "")
				{
					errorMsg = errorFromResult;
					isSuccess = false;
				}
			}
			if(isSuccess == true)
			{
				totalSuccess = totalSuccess + 1;
				totalProcessed = totalProcessed + 1;
			}
			else
			{
				errorIds.add(checkId);
				totalFailed = totalFailed + 1;
				totalProcessed = totalProcessed + 1;
				info "Check同步失败: " + checkId + " - " + errorMsg;
			}
		}
		catch (e)
		{
			errorIds.add(checkId);
			totalFailed = totalFailed + 1;
			totalProcessed = totalProcessed + 1;
			info "Check处理异常: " + checkId + " - " + e;
		}
	}
	info "批量同步完成，本次处理: " + totalProcessed + " 条（成功: " + totalSuccess + "，失败: " + totalFailed + "）";
	if(errorIds != null && errorIds.size() > 0)
	{
		info "失败Check ID（共 " + errorIds.size() + " 条）: " + errorIds;
	}
	statusData = Map();
	statusData.put("lastSyncDate",todayStr);
	statusData.put("lastSyncTime",zoho.currenttime.toString());
	statusData.put("hasMore",hasMore);
	statusData.put("mode","newest");
	statusData.put("lastBatchProcessed",totalProcessed);
	statusData.put("lastBatchSuccess",totalSuccess);
	statusData.put("lastBatchFailed",totalFailed);
	statusNoteParams = Map();
	statusNoteParams.put("Name","CheckSyncStatus");
	statusNoteParams.put("Log_Content",statusData.toString());
	statusDataList = List();
	statusDataList.add(statusNoteParams);
	statusRequestParams = Map();
	statusRequestParams.put("data",statusDataList);
	if(statusNoteId != null && statusNoteId != "")
	{
		invokeurl
		[
			url :"https://www.zohoapis.com.au/crm/v8/vendorLogs/" + statusNoteId
			type :PUT
			parameters:statusRequestParams.toString()
			connection:"crm"
		]
	}
	else
	{
		invokeurl
		[
			url :"https://www.zohoapis.com.au/crm/v8/vendorLogs"
			type :POST
			parameters:statusRequestParams.toString()
			connection:"crm"
		]
	}
	info "CheckSyncStatus 已更新，lastSyncDate = " + todayStr;
}
catch (e)
{
	info "同步最新Check异常: " + e;
}
}
