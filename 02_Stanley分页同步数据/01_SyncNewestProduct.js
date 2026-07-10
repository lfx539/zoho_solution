void schedule.SyncNewestProduct()
{
baseUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/inventoryitem";
limit = 1000;
error400Ids = List();
totalProcessed = 0;
totalSuccess = 0;
totalFailed = 0;
statusNoteId = null;
fromDate = "01/01/2026";
todayStr = "01/01/2026";
statusNotes = zoho.crm.searchRecords("PLogs","(Name:equals:ProductSyncStatus)");
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
info "开始同步最新产品，fromDate = " + fromDate;
try 
{
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
			url :baseUrl + "?limit=" + limit + "&offset=" + offset + "&q=" + qStr
			type :GET
			headers:headers
		];
		if(resp == null)
		{
			info "获取产品列表失败，offset = " + offset;
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
		info "没有新增产品（createdDate >= " + fromDate + "）";
		statusData = Map();
		statusData.put("lastSyncDate",todayStr);
		statusData.put("lastSyncTime",zoho.currenttime.toString());
		statusData.put("hasMore",false);
		statusData.put("mode","newest");
		statusNoteParams = Map();
		statusNoteParams.put("Name","ProductSyncStatus");
		statusNoteParams.put("Log_Content",statusData.toString());
		statusDataList = List();
		statusDataList.add(statusNoteParams);
		statusRequestParams = Map();
		statusRequestParams.put("data",statusDataList);
		if(statusNoteId != null && statusNoteId != "")
		{
			invokeurl
			[
				url :"https://www.zohoapis.com.au/crm/v8/PLogs/" + statusNoteId
				type :PUT
				parameters:statusRequestParams.toString()
				connection:"crm"
			]
		}
		else
		{
			invokeurl
			[
				url :"https://www.zohoapis.com.au/crm/v8/PLogs"
				type :POST
				parameters:statusRequestParams.toString()
				connection:"crm"
			]
		}
		info "ProductSyncStatus 已更新，lastSyncDate = " + todayStr;
		return;
	}
	info "共获取 " + allItems.size() + " 条产品，开始逐条同步";
	for each  item in allItems
	{
		productId = item.get("id");
		try 
		{
			syncResult = standalone.SyncSingleInventory(productId);
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
				error400Ids.add(productId);
				totalFailed = totalFailed + 1;
				totalProcessed = totalProcessed + 1;
				info "产品同步失败: " + productId + " - " + errorMsg;
			}
		}
		catch (e)
		{
			error400Ids.add(productId);
			totalFailed = totalFailed + 1;
			totalProcessed = totalProcessed + 1;
			info "产品处理异常: " + productId + " - " + e;
		}
	}
	info "批量同步完成，本次处理: " + totalProcessed + " 条（成功: " + totalSuccess + "，失败: " + totalFailed + "）";
	if(error400Ids != null && error400Ids.size() > 0)
	{
		info "400错误产品ID（共 " + error400Ids.size() + " 条）: " + error400Ids;
		noteParams = Map();
		noteParams.put("Name","ProductSync_400Errors_0_" + totalProcessed);
		noteParams.put("Error_Ids",error400Ids.toString());
		noteParams.put("Log_Content","批次: 0 - " + totalProcessed + "\n成功: " + totalSuccess + " 条\n失败: " + totalFailed + " 条\n错误数量: " + error400Ids.size() + "\n错误ID: " + error400Ids.toString());
		dataList = List();
		dataList.add(noteParams);
		requestParams = Map();
		requestParams.put("data",dataList);
		try 
		{
			invokeurl
			[
				url :"https://www.zohoapis.com.au/crm/v8/PLogs"
				type :POST
				parameters:requestParams.toString()
				connection:"crm"
			]
			info "产品400错误ID已保存到PLogs";
		}
		catch (err)
		{
			info "保存产品400错误ID到PLogs失败: " + err;
		}
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
	statusNoteParams.put("Name","ProductSyncStatus");
	statusNoteParams.put("Log_Content",statusData.toString());
	statusDataList = List();
	statusDataList.add(statusNoteParams);
	statusRequestParams = Map();
	statusRequestParams.put("data",statusDataList);
	if(statusNoteId != null && statusNoteId != "")
	{
		invokeurl
		[
			url :"https://www.zohoapis.com.au/crm/v8/PLogs/" + statusNoteId
			type :PUT
			parameters:statusRequestParams.toString()
			connection:"crm"
		]
	}
	else
	{
		invokeurl
		[
			url :"https://www.zohoapis.com.au/crm/v8/PLogs"
			type :POST
			parameters:statusRequestParams.toString()
			connection:"crm"
		]
	}
	info "ProductSyncStatus 已更新，lastSyncDate = " + todayStr;
}
catch (e)
{
	info "同步最新产品异常: " + e;
}
}