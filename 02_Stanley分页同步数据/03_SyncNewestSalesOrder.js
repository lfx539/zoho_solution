void schedule.SyncNewestSalesOrder()
{
baseUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/salesorder";
limit = 150;
error400Ids = List();
totalProcessed = 0;
totalSuccess = 0;
totalFailed = 0;
statusNoteId = null;
fromDate = "01/01/2026";
todayStr = "01/01/2026";
startOffset = 0;
statusNotes = zoho.crm.searchRecords("SOLogs","(Name:equals:SalesOrderSyncStatus)");
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
			nextOffsetVal = statusMap.get("nextOffset");
			if(nextOffsetVal != null && nextOffsetVal != "")
			{
				startOffset = nextOffsetVal.toNumber();
				if(startOffset < 0)
				{
					startOffset = 0;
				}
			}
			lastSyncDateVal = statusMap.get("lastSyncDate");
			if(lastSyncDateVal != null && lastSyncDateVal != "" && lastSyncDateVal.indexOf("/") >= 0)
			{
				parts = lastSyncDateVal.toList("/");
				if(parts.size() >= 3)
				{
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
qStr = 'createdDate ON_OR_AFTER "' + fromDate + '"';
encodedQ = standalone.EncodeQForOAuth(qStr);
info "开始同步最新销售订单，fromDate = " + fromDate + "，本页 offset = " + startOffset;
try 
{
	auth = standalone.SetHeadersForNewest("GET",baseUrl,true,limit,startOffset,qStr);
	headers = {"Content-Type":"application/json","Authorization":auth};
	resp = invokeurl
	[
		url :baseUrl + "?limit=" + limit + "&offset=" + startOffset + "&q=" + encodedQ
		type :GET
		headers:headers
	];
	if(resp == null)
	{
		info "获取销售订单列表失败，offset = " + startOffset;
		return;
	}
	listData = resp.getFileContent().toJSONList().get(0);
	items = listData.get("items");
	hasMore = listData.get("hasMore");
	if(items == null || items.size() == 0)
	{
		info "本页无数据（createdDate >= " + fromDate + "，offset=" + startOffset + "）";
		statusData = Map();
		statusData.put("lastSyncDate",todayStr);
		statusData.put("lastSyncTime",zoho.currenttime.toString());
		statusData.put("hasMore",false);
		statusData.put("nextOffset",0);
		statusData.put("mode","newest");
		statusNoteParams = Map();
		statusNoteParams.put("Name","SalesOrderSyncStatus");
		statusNoteParams.put("Log_Content",statusData.toString());
		statusDataList = List();
		statusDataList.add(statusNoteParams);
		statusRequestParams = Map();
		statusRequestParams.put("data",statusDataList);
		if(statusNoteId != null && statusNoteId != "")
		{
			invokeurl
			[
				url :"https://www.zohoapis.com.au/crm/v8/SOLogs/" + statusNoteId
				type :PUT
				parameters:statusRequestParams.toString()
				connection:"crm"
			]
		}
		else
		{
			invokeurl
			[
				url :"https://www.zohoapis.com.au/crm/v8/SOLogs"
				type :POST
				parameters:statusRequestParams.toString()
				connection:"crm"
			]
		}
		info "SalesOrderSyncStatus 已更新，lastSyncDate = " + todayStr;
		return;
	}
	info "本页 " + items.size() + " 条（offset=" + startOffset + "），hasMore=" + hasMore + "，开始逐条同步";
	for each  item in items
	{
		orderId = item.get("id");
		try 
		{
			syncResult = standalone.SyncSingleSalesOrder(orderId);
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
				error400Ids.add(orderId);
				totalFailed = totalFailed + 1;
				totalProcessed = totalProcessed + 1;
				info "销售订单同步失败: " + orderId + " - " + errorMsg;
			}
		}
		catch (e)
		{
			error400Ids.add(orderId);
			totalFailed = totalFailed + 1;
			totalProcessed = totalProcessed + 1;
			info "销售订单处理异常: " + orderId + " - " + e;
		}
	}
	info "批量同步完成，本次处理: " + totalProcessed + " 条（成功: " + totalSuccess + "，失败: " + totalFailed + "）";
	if(error400Ids != null && error400Ids.size() > 0)
	{
		info "400错误销售订单ID（共 " + error400Ids.size() + " 条）";
		automation.saveSalesOrderErrorIdsToLogs(error400Ids.toString(),error400Ids.size(),startOffset,totalProcessed,totalSuccess,totalFailed);
	}
	statusData = Map();
	if(hasMore == true)
	{
		statusData.put("nextOffset",startOffset + limit);
		statusData.put("lastSyncDate",fromDate);
	}
	else
	{
		statusData.put("nextOffset",0);
		statusData.put("lastSyncDate",todayStr);
	}
	statusData.put("lastSyncTime",zoho.currenttime.toString());
	statusData.put("hasMore",hasMore);
	statusData.put("mode","newest");
	statusData.put("lastBatchProcessed",totalProcessed);
	statusData.put("lastBatchSuccess",totalSuccess);
	statusData.put("lastBatchFailed",totalFailed);
	statusNoteParams = Map();
	statusNoteParams.put("Name","SalesOrderSyncStatus");
	statusNoteParams.put("Log_Content",statusData.toString());
	statusDataList = List();
	statusDataList.add(statusNoteParams);
	statusRequestParams = Map();
	statusRequestParams.put("data",statusDataList);
	if(statusNoteId != null && statusNoteId != "")
	{
		invokeurl
		[
			url :"https://www.zohoapis.com.au/crm/v8/SOLogs/" + statusNoteId
			type :PUT
			parameters:statusRequestParams.toString()
			connection:"crm"
		]
	}
	else
	{
		invokeurl
		[
			url :"https://www.zohoapis.com.au/crm/v8/SOLogs"
			type :POST
			parameters:statusRequestParams.toString()
			connection:"crm"
		]
	}
	info "SalesOrderSyncStatus 已更新，lastSyncDate = " + todayStr;
}
catch (e)
{
	info "同步最新销售订单异常: " + e;
}
}