void schedule.SyncInventory()
{
// 配置参数-产品同步300条里失败的产品id会特别多
baseUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/inventoryitem";
limit = 1000;
// 每次从 NetSuite 获取的记录数（注意：offset必须是limit的倍数）
startOffset = 0;
// 起始offset（断点续传）：如果上次处理了100条，这里设置为100，从第101条开始处理。首次运行设置为0
maxProcessCount = 200;
// 单次最大处理数量，避免超时

// ============================================================
// 从 PLogs 读取上次的 startOffset（断点续传）
// ============================================================
statusNoteId = null;
try
{
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
                nextOffsetVal = statusMap.get("nextOffset");
                if(nextOffsetVal != null && nextOffsetVal != "")
                {
                    startOffset = nextOffsetVal.toNumber();
                    if(startOffset < 0)
                    {
                        startOffset = 0;
                    }
                }
            }
        }
    }
}
catch(e)
{
    info "读取上次处理位置失败: " + e;
}

// 记录400错误的产品ID
error400Ids = List();
// 计算正确的API offset（必须是limit的倍数）
remainder = startOffset % limit;
apiOffset = startOffset - remainder;
// 向下取整到最近的limit倍数
skipCount = remainder;
// 需要跳过的记录数（在当前页中）
// 统计变量
totalProcessed = 0;
totalSuccess = 0;
totalFailed = 0;
hasMore = true;
offset = apiOffset;
info "开始批量同步，起始位置: " + startOffset + "，API offset: " + apiOffset + "，跳过前 " + skipCount + " 条";
// 使用固定列表模拟循环（最多处理5页）
pageList = {1,2,3,4,5};
// 主循环：分页获取产品列表
for each  pageNum in pageList
{
	if(hasMore == false)
	{
		break;
	}
	if(totalProcessed >= maxProcessCount)
	{
		info "已达到单次最大处理数量限制（" + maxProcessCount + "），停止处理";
		break;
	}
	// 1. 获取产品列表
	info "正在获取第 " + (offset / limit + 1) + " 页产品列表（offset: " + offset + "）...";
	try 
	{
		auth = standalone.SetListHeaders("GET",baseUrl,true,limit,offset);
		headers = {"Content-Type":"application/json","Authorization":auth};
		listResp = invokeurl
		[
			url :baseUrl + "?limit=" + limit + "&offset=" + offset
			type :GET
			headers:headers
		];
		if(listResp == null)
		{
			info "获取产品列表失败，offset: " + offset;
			break;
		}
		listData = listResp.getFileContent().toJSONList().get(0);
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
			info "当前页无数据，offset: " + offset;
			hasMore = false;
			break;
		}
		info "获取到 " + items.size() + " 条产品，开始处理...";
	}
	catch (e)
	{
		info "获取产品列表异常: " + e;
		break;
	}
	// 2. 逐条处理产品
	itemIndex = 0;
	for each  item in items
	{
		// 跳过已处理的记录（仅在第一次获取数据时跳过）
		if(offset == apiOffset && itemIndex < skipCount)
		{
			itemIndex = itemIndex + 1;
			continue;
		}
		// 检查是否已达到处理限制
		if(totalProcessed >= maxProcessCount)
		{
			info "已达到单次最大处理数量限制（" + maxProcessCount + "），停止处理";
			break;
		}
		productId = item.get("id");
		// 处理单个产品
		try 
		{
			syncResult = standalone.SyncSingleInventory(productId);
			// 			info syncResult;
			// 解析返回结果
			// 正确返回：{"res":{"data":[{"code":"SUCCESS","status":"success",...}]}}
			// 错误返回：{"res":{"data":[{"code":"MANDATORY_NOT_FOUND","status":"error",...}]}}
			isSuccess = false;
			errorMsg = "未知错误";
			is400Error = false;
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
							// 判断是否成功
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
								// 失败情况，获取错误信息
								if(message != null)
								{
									errorMsg = message;
								}
								else if(code != null)
								{
									errorMsg = code;
								}
								// 检查是否是400相关错误
								errorStr = errorMsg.toString();
								if(errorStr != null)
								{
									is400Error = true;
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
				if(is400Error == true)
				{
					error400Ids.add(productId);
					info "产品 " + productId + " 遇到400错误，已记录到错误列表: " + errorMsg;
				}
				totalFailed = totalFailed + 1;
				totalProcessed = totalProcessed + 1;
				info "产品同步失败: " + productId + " - " + errorMsg;
			}
		}
		catch (e)
		{
			errorStr = e.toString();
			info errorStr;
			// 检查是否是400错误
			if(errorStr != null)
			{
				error400Ids.add(productId);
				info "产品 " + productId + " 处理异常（400错误），已记录到错误列表";
			}
			totalFailed = totalFailed + 1;
			totalProcessed = totalProcessed + 1;
			info "产品处理异常: " + productId + " - " + e;
		}
		itemIndex = itemIndex + 1;
	}
	// 重置skipCount，后续页面不需要跳过
	skipCount = 0;
	// 更新 offset
	offset = offset + items.size();
	// 计算实际已处理的总数（用于断点续传）
	actualProcessed = startOffset + totalProcessed;
	info "当前页处理完成，已处理: " + totalProcessed + "，成功: " + totalSuccess + "，失败: " + totalFailed + "，累计总数: " + actualProcessed;
	// 如果已达到最大处理数量，提前退出
	if(totalProcessed >= maxProcessCount)
	{
		info "已达到单次最大处理数量限制（" + maxProcessCount + "），停止处理";
		info "下次运行请将 startOffset 设置为: " + actualProcessed;
		break;
	}
}
// 输出最终统计
actualProcessed = startOffset + totalProcessed;
info "批量同步完成！";
info "本次处理: " + totalProcessed + " 条";
info "累计总数: " + actualProcessed + " 条";
info "成功: " + totalSuccess + " 条";
info "失败: " + totalFailed + " 条";
// 输出400错误的产品ID列表
if(error400Ids != null && error400Ids.size() > 0)
{
	info "400错误产品ID列表（共 " + error400Ids.size() + " 条）:" + error400Ids;
}

// ============================================================
// 1. 保存错误日志到 Logs（如果有错误）- 独立记录，不会被覆盖
// ============================================================
if(error400Ids != null && error400Ids.size() > 0)
{
	try
	{
		// 创建错误记录
		errorLogParams = Map();
		errorLogParams.put("Name", "ProductSync_400Errors_" + startOffset + "_" + actualProcessed);
		errorLogParams.put("Error_Ids", error400Ids.toString());
		errorLogParams.put("Log_Content", "批次: " + startOffset + " - " + actualProcessed + ", 成功: " + totalSuccess + " 条, 失败: " + totalFailed + " 条, 错误数量: " + error400Ids.size() + ", 同步时间: " + zoho.currenttime.toString());

		errorLogList = List();
		errorLogList.add(errorLogParams);
		errorLogRequest = Map();
		errorLogRequest.put("data", errorLogList);

		invokeurl
		[
			url : "https://www.zohoapis.com.au/crm/v8/PLogs"
			type : POST
			parameters : errorLogRequest.toString()
			connection : "crm"
		];

		info "错误ID已保存到 PLogs";
	}
	catch(e)
	{
		info "保存错误日志失败: " + e;
	}
}

// ============================================================
// 2. 保存进度到 PLogs（断点续传）- 不包含errorIds，避免覆盖
// ============================================================
try
{
	statusData = Map();
	if(hasMore == true)
	{
		statusData.put("nextOffset", actualProcessed);
	}
	else
	{
		statusData.put("nextOffset", 0);
	}
	statusData.put("lastSyncTime", zoho.currenttime.toString());
	statusData.put("totalProcessed", actualProcessed);
	statusData.put("totalSuccess", totalSuccess);
	statusData.put("totalFailed", totalFailed);
	statusData.put("hasMore", hasMore);
	// 注意：不再保存 error400Ids，错误ID已单独保存到 Logs

	statusNoteParams = Map();
	statusNoteParams.put("Name", "ProductSyncStatus");
	statusNoteParams.put("Log_Content", statusData.toString());

	statusDataList = List();
	statusDataList.add(statusNoteParams);
	statusRequestParams = Map();
	statusRequestParams.put("data", statusDataList);

	if(statusNoteId != null && statusNoteId != "")
	{
		invokeurl
		[
			url: "https://www.zohoapis.com.au/crm/v8/PLogs/" + statusNoteId
			type: PUT
			parameters: statusRequestParams.toString()
			connection: "crm"
		];
	}
	else
	{
		invokeurl
		[
			url: "https://www.zohoapis.com.au/crm/v8/PLogs"
			type: POST
			parameters: statusRequestParams.toString()
			connection: "crm"
		];
	}

	info "进度已保存到 PLogs";
}
catch(e)
{
	info "保存进度失败: " + e;
}

// 断点续传提示
if(hasMore == true)
{
	info "还有更多数据待处理！";
	info "下次运行将从第 " + actualProcessed + " 条开始（自动读取）";
}
else
{
	info "所有数据已处理完成！";
}
}