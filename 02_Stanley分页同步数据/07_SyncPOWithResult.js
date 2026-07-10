string standalone.SyncPOWithResult(Int startOffset)
{
result = Map();
// 配置参数
baseUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/purchaseorder";
limit = 1000;
maxProcessCount = 220;
// 记录错误的PO ID
errorIds = List();
// 统计变量
totalProcessed = 0;
totalSuccess = 0;
totalFailed = 0;
// 计算正确的API offset（必须是limit的倍数）
remainder = startOffset % limit;
apiOffset = startOffset - remainder;
skipCount = remainder;
hasMore = true;
offset = apiOffset;
info "开始批量同步PO，起始位置: " + startOffset + "，API offset: " + apiOffset + "，跳过前 " + skipCount + " 条";
// 使用固定列表模拟循环（最多处理150页）
pageList = {1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150};
// 主循环：分页获取PO列表
for each  pageNum in pageList
{
	if(hasMore == false)
	{
		break;
	}
	if(totalProcessed >= maxProcessCount)
	{
		break;
	}
	// 1. 获取PO列表
	info "正在获取第 " + (offset / limit + 1) + " 页PO列表（offset: " + offset + "）";
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
		info "获取PO列表失败，offset: " + offset;
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
	info "获取到 " + items.size() + " 条PO，开始处理";
	// 2. 逐条处理PO
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
			break;
		}
		poId = item.get("id");
		// 处理单个PO
		try
		{
			syncResult = standalone.SyncSinglePO(poId);
			// 解析返回结果
			isSuccess = false;
			errorMsg = "未知错误";
			if(syncResult != null)
			{
				// 先检查是否有错误信息
				syncError = syncResult.get("error");
				if(syncError != null)
				{
					errorMsg = syncError;
				}
				else
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
								}
							}
						}
					}
				}
			}
			else
			{
				errorMsg = "syncResult为null";
			}
			if(isSuccess == true)
			{
				totalSuccess = totalSuccess + 1;
				totalProcessed = totalProcessed + 1;
			}
			else
			{
				errorStr = errorMsg.toString();
				if(errorStr != null)
				{
					errorIds.add(poId);
				}
				totalFailed = totalFailed + 1;
				totalProcessed = totalProcessed + 1;
				info "PO同步失败: " + poId + " - " + errorMsg;
			}
		}
		catch (e)
		{
			errorStr = e.toString();
			info errorStr;
			if(errorStr != null)
			{
				errorIds.add(poId);
			}
			totalFailed = totalFailed + 1;
			totalProcessed = totalProcessed + 1;
			info "PO处理异常: " + poId + " - " + e;
		}
		itemIndex = itemIndex + 1;
	}
	// 重置skipCount，后续页面不需要跳过
	skipCount = 0;
	// 更新 offset
	offset = offset + items.size();
	// 如果已达到处理限制，提前退出
	if(totalProcessed >= maxProcessCount)
	{
		break;
	}
}
// 输出最终统计
finalProcessed = startOffset + totalProcessed;
info "批量同步完成，本次处理: " + totalProcessed + " 条（成功: " + totalSuccess + "，失败: " + totalFailed + "），累计总数: " + finalProcessed + " 条";
// 输出错误的PO ID列表,保存错误ID到CRM vendorLogs模块
if(errorIds != null && errorIds.size() > 0)
{
	errorIdsStr = errorIds.toString();
	errorIdsCount = errorIds.size();
	// 保存错误ID到vendorLogs
	try
	{
		// 构建错误记录内容
		errorData = Map();
		errorData.put("batchStart",startOffset);
		errorData.put("batchEnd",finalProcessed);
		errorData.put("currentOffset",finalProcessed);
		errorData.put("errorCount",errorIdsCount);
		errorData.put("syncTime",zoho.currenttime.toString());
		// 创建错误记录
		errorParams = Map();
		errorParams.put("Name","POSync_400Errors_" + startOffset + "_" + finalProcessed);
		errorParams.put("Modules","Purchase_Orders");
		errorParams.put("Error_Ids",errorIdsStr);
		errorParams.put("Log_Content","批次: " + startOffset + " - " + finalProcessed + ", 当前处理位置: " + finalProcessed + " 条, 成功: " + totalSuccess + " 条, 失败: " + totalFailed + " 条, 错误数量: " + errorIdsCount + ", 详细数据: " + errorData.toString());
		errorList = List();
		errorList.add(errorParams);
		errorRequestParams = Map();
		errorRequestParams.put("data",errorList);
		invokeurl
		[
			url :"https://www.zohoapis.com.au/crm/v8/vendorLogs"
			type :POST
			parameters:errorRequestParams.toString()
			connection:"crm"
		];
		info "错误ID已保存到vendorLogs";
	}
	catch (e)
	{
		info "保存错误ID失败: " + e;
	}
	info "错误PO ID列表（共 " + errorIds.size() + " 条）: " + errorIds;
}
// 返回结果
result.put("totalProcessed",totalProcessed);
result.put("totalSuccess",totalSuccess);
result.put("totalFailed",totalFailed);
result.put("finalProcessed",finalProcessed);
result.put("hasMore",hasMore);
result.put("errorIds",errorIds);
return result;
}
