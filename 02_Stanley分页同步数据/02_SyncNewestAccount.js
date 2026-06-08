void schedule.SyncNewestAccount()
{
baseUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/customer";
limit = 200;
error400Ids = List();
totalProcessed = 0;
totalSuccess = 0;
totalFailed = 0;
statusNoteId = null;
fromDate = "01/01/2026";
todayStr = "01/01/2026";
// 从 Logs 读 lastSyncDate 或 lastSyncTime（仅 yyyy-mm-dd 转 MM/DD/YYYY）
statusNotes = zoho.crm.searchRecords("Logs","(Name:equals:CustomerSyncStatus)");
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
					p0 = parts.get(0).toNumber();
					p1 = parts.get(1).toNumber();
					// 第一段<=12 且 第二段>12 则认为是 MM/DD/YYYY，转为 dd/mm/yyyy
					if(p0 <= 12 && p1 > 12)
					{
						fromDate = parts.get(1) + "/" + parts.get(0) + "/" + parts.get(2);
					}
					else
					{
						fromDate = lastSyncDateVal;
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
					if(parts.size() >= 3 && parts.get(0).length() == 4 && parts.get(1).length() == 2 && parts.get(2).length() == 2)
					{
						fromDate = parts.get(2) + "/" + parts.get(1) + "/" + parts.get(0);
					}
				}
			}
		}
	}
}
// Zoho 返回 "14-Feb-2026"（DD-Mon-YYYY），转为 MM/DD/YYYY
raw = zoho.currentdate.toString();
if(raw != null && raw != "")
{
	parts = raw.toList("-");
	if(parts.size() >= 3)
	{
		dd = parts.get(0);
		mon = parts.get(1);
		yyyy = parts.get(2);
		mm = "01";
		if(mon == "Jan")
		{
			mm = "01";
		}
		else if(mon == "Feb")
		{
			mm = "02";
		}
		else if(mon == "Mar")
		{
			mm = "03";
		}
		else if(mon == "Apr")
		{
			mm = "04";
		}
		else if(mon == "May")
		{
			mm = "05";
		}
		else if(mon == "Jun")
		{
			mm = "06";
		}
		else if(mon == "Jul")
		{
			mm = "07";
		}
		else if(mon == "Aug")
		{
			mm = "08";
		}
		else if(mon == "Sep")
		{
			mm = "09";
		}
		else if(mon == "Oct")
		{
			mm = "10";
		}
		else if(mon == "Nov")
		{
			mm = "11";
		}
		else if(mon == "Dec")
		{
			mm = "12";
		}
		todayStr = dd + "/" + mm + "/" + yyyy;
	}
}
qStr = 'dateCreated ON_OR_AFTER "' + fromDate + '"';
encodedQ = standalone.EncodeQForOAuth(qStr);
info "开始同步最新客户，fromDate = " + fromDate;
try 
{
	// 分页拉取：Deluge 无 while，用 for each + break（最多 10 页 = 10000 条）
	allItems = List();
	offset = 0;
	hasMore = true;
	pageList = {1,2,3,4,5,6,7,8,9,10};
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
			url :baseUrl + "?limit=" + limit + "&offset=" + offset + "&q=" + encodedQ
			type :GET
			headers:headers
		];
		if(resp == null)
		{
			info "获取客户列表失败，offset = " + offset;
			break;
		}
		listData = resp.getFileContent().toJSONList().get(0);
		items = listData.get("items");
		hasMore = listData.get("hasMore");
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
		info "没有新增客户（dateCreated >= " + fromDate + "）";
		statusData = Map();
		statusData.put("lastSyncDate",todayStr);
		statusData.put("lastSyncTime",zoho.currenttime.toString());
		statusData.put("hasMore",false);
		statusData.put("mode","newest");
		statusNoteParams = Map();
		statusNoteParams.put("Name","CustomerSyncStatus");
		statusNoteParams.put("Log_Content",statusData.toString());
		statusDataList = List();
		statusDataList.add(statusNoteParams);
		statusRequestParams = Map();
		statusRequestParams.put("data",statusDataList);
		if(statusNoteId != null && statusNoteId != "")
		{
			invokeurl
			[
				url :"https://www.zohoapis.com.au/crm/v8/Logs/" + statusNoteId
				type :PUT
				parameters:statusRequestParams.toString()
				connection:"crm"
			]
		}
		else
		{
			invokeurl
			[
				url :"https://www.zohoapis.com.au/crm/v8/Logs"
				type :POST
				parameters:statusRequestParams.toString()
				connection:"crm"
			]
		}
		info "CustomerSyncStatus 已更新，lastSyncDate = " + todayStr;
		return;
	}
	info "共获取 " + allItems.size() + " 条客户，开始逐条同步";
	for each  item in allItems
	{
		customerId = item.get("id");
		try 
		{
			syncResult = standalone.SyncSingleCustomer(customerId);
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
			}
			if(isSuccess == true)
			{
				totalSuccess = totalSuccess + 1;
				totalProcessed = totalProcessed + 1;
			}
			else
			{
				error400Ids.add(customerId);
				totalFailed = totalFailed + 1;
				totalProcessed = totalProcessed + 1;
				info "客户同步失败: " + customerId + " - " + errorMsg;
			}
		}
		catch (e)
		{
			error400Ids.add(customerId);
			totalFailed = totalFailed + 1;
			totalProcessed = totalProcessed + 1;
			info "客户处理异常: " + customerId + " - " + e;
		}
	}
	info "批量同步完成，本次处理: " + totalProcessed + " 条（成功: " + totalSuccess + "，失败: " + totalFailed + "）";
	if(error400Ids != null && error400Ids.size() > 0)
	{
		info "400错误客户ID（共 " + error400Ids.size() + " 条）: " + error400Ids;
		automation.saveErrorIdsToLogs(error400Ids.toString(),error400Ids.size(),0,totalProcessed,totalSuccess,totalFailed);
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
	statusNoteParams.put("Name","CustomerSyncStatus");
	statusNoteParams.put("Log_Content",statusData.toString());
	statusDataList = List();
	statusDataList.add(statusNoteParams);
	statusRequestParams = Map();
	statusRequestParams.put("data",statusDataList);
	if(statusNoteId != null && statusNoteId != "")
	{
		invokeurl
		[
			url :"https://www.zohoapis.com.au/crm/v8/Logs/" + statusNoteId
			type :PUT
			parameters:statusRequestParams.toString()
			connection:"crm"
		]
	}
	else
	{
		invokeurl
		[
			url :"https://www.zohoapis.com.au/crm/v8/Logs"
			type :POST
			parameters:statusRequestParams.toString()
			connection:"crm"
		]
	}
	info "CustomerSyncStatus 已更新，lastSyncDate = " + todayStr;
}
catch (e)
{
	info "同步最新客户异常: " + e;
}
}