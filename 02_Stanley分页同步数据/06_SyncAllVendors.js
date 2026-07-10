void schedule.SyncAllVendors()
{
baseUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/vendor";
limit = 200;
error400Ids = List();
totalProcessed = 0;
totalSuccess = 0;
totalFailed = 0;
info "开始全量同步Vendors";
try
{
	// 分页拉取（300条数据，最多2页）
	allItems = List();
	offset = 0;
	hasMore = true;
	pageList = {1,2,3,4,5};
	for each  pageNum in pageList
	{
		if(hasMore == false)
		{
			break;
		}
		auth = standalone.SetListHeaders("GET",baseUrl,true,limit,offset);
		headers = {"Content-Type":"application/json","Authorization":auth};
		resp = invokeurl
		[
			url :baseUrl + "?limit=" + limit + "&offset=" + offset
			type :GET
			headers:headers
		];
		if(resp == null)
		{
			info "获取vendor列表失败，offset = " + offset;
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
		info "没有找到vendor数据";
		return;
	}
	info "共获取 " + allItems.size() + " 条vendor，开始逐条同步";
	for each  item in allItems
	{
		vendorId = item.get("id");
		try
		{
			syncResult = standalone.SyncSingleVendor(vendorId);
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
				error400Ids.add(vendorId);
				totalFailed = totalFailed + 1;
				totalProcessed = totalProcessed + 1;
				info "vendor同步失败: " + vendorId + " - " + errorMsg;
			}
		}
		catch (e)
		{
			error400Ids.add(vendorId);
			totalFailed = totalFailed + 1;
			totalProcessed = totalProcessed + 1;
			info "vendor处理异常: " + vendorId + " - " + e;
		}
	}
	info "批量同步完成，本次处理: " + totalProcessed + " 条（成功: " + totalSuccess + "，失败: " + totalFailed + "）";
	if(error400Ids != null && error400Ids.size() > 0)
	{
		info "失败vendor ID（共 " + error400Ids.size() + " 条）: " + error400Ids;
	}
	// 更新VendorSyncStatus记录
	try
	{
		// Zoho 返回 "14-Feb-2026"（DD-Mon-YYYY），转为 DD/MM/YYYY
		raw = zoho.currentdate.toString();
		todayStr = "";
		if(raw != null && raw != "")
		{
			parts = raw.toList("-");
			if(parts.size() >= 3)
			{
				dd = parts.get(0);
				mon = parts.get(1);
				yyyy = parts.get(2);
				todayStr = dd + "/" + mon + "/" + yyyy;
			}
		}
		statusData = Map();
		statusData.put("lastSyncDate",todayStr);
		statusData.put("lastSyncTime",zoho.currenttime.toString());
		statusData.put("totalProcessed",totalProcessed);
		statusData.put("totalSuccess",totalSuccess);
		statusData.put("totalFailed",totalFailed);
		statusNoteParams = Map();
		statusNoteParams.put("Name","VendorSyncStatus");
		statusNoteParams.put("Log_Content",statusData.toString());
		statusDataList = List();
		statusDataList.add(statusNoteParams);
		statusRequestParams = Map();
		statusRequestParams.put("data",statusDataList);
		// 检查是否已有记录
		statusNotes = zoho.crm.searchRecords("Logs","(Name:equals:VendorSyncStatus)");
		if(statusNotes != null && statusNotes.size() > 0)
		{
			statusNote = statusNotes.get(0);
			statusNoteId = statusNote.get("id");
			invokeurl
			[
				url :"https://www.zohoapis.com.au/crm/v8/Logs/" + statusNoteId
				type :PUT
				parameters:statusRequestParams.toString()
				connection:"crm"
			];
		}
		else
		{
			invokeurl
			[
				url :"https://www.zohoapis.com.au/crm/v8/Logs"
				type :POST
				parameters:statusRequestParams.toString()
				connection:"crm"
			];
		}
		info "VendorSyncStatus 已更新";
	}
	catch (e)
	{
		info "更新VendorSyncStatus记录失败: " + e;
	}
}
catch (e)
{
	info "全量同步vendor异常: " + e;
}
}
