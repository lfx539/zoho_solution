string standalone.SyncCashSaleWithResult(Int startOffset)
{
result = Map();
// 配置参数
baseUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/CashSale";
limit = 1000;
maxProcessCount = 220;
// 记录400错误的Cash Sale ID
error400Ids = List();
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
info "开始批量同步Cash Sale，起始位置: " + startOffset + "，API offset: " + apiOffset + "，跳过前 " + skipCount + " 条";
// 使用固定列表模拟循环（最多处理150页）
pageList = {1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150};
// 主循环：分页获取Cash Sale列表
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
	// 1. 获取Cash Sale列表
	info "正在获取第 " + (offset / limit + 1) + " 页Cash Sale列表（offset: " + offset + "）";
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
		info "获取Cash Sale列表失败，offset: " + offset;
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
	info "获取到 " + items.size() + " 条Cash Sale，开始处理";
	// 2. 逐条处理Cash Sale
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
		cashSaleId = item.get("id");
		// 处理单个Cash Sale
		try 
		{
			syncResult = standalone.SyncSingleCashSale(cashSaleId);
			// 解析返回结果
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
					error400Ids.add(cashSaleId);
				}
				totalFailed = totalFailed + 1;
				totalProcessed = totalProcessed + 1;
				info "Cash Sale同步失败: " + cashSaleId + " - " + errorMsg;
			}
		}
		catch (e)
		{
			errorStr = e.toString();
			info errorStr;
			if(errorStr != null)
			{
				error400Ids.add(cashSaleId);
			}
			totalFailed = totalFailed + 1;
			totalProcessed = totalProcessed + 1;
			info "Cash Sale处理异常: " + cashSaleId + " - " + e;
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
// 输出错误的Cash Sale ID列表,保存错误ID到CRM CSLogs模块
if(error400Ids != null && error400Ids.size() > 0)
{
	error400IdsStr = error400Ids.toString();
	error400IdsCount = error400Ids.size();
	automation.saveCashSaleErrorIdsToLogs(error400IdsStr,error400IdsCount,startOffset,finalProcessed,totalSuccess,totalFailed);
	info "错误Cash Sale ID列表（共 " + error400Ids.size() + " 条）: " + error400Ids;
}
// 返回结果
result.put("totalProcessed",totalProcessed);
result.put("totalSuccess",totalSuccess);
result.put("totalFailed",totalFailed);
result.put("finalProcessed",finalProcessed);
result.put("hasMore",hasMore);
result.put("error400Ids",error400Ids);
return result;
}