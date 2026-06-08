/**
 * 批量同步没有 Account_Name 的销售订单
 *
 * 功能：
 * 1. 查询所有 Account_Name 为空的 Sales_Orders（排除已知失败的 ID）
 * 2. 获取 Subject（NetSuite Order ID）
 * 3. 调用 SyncSingleSalesOrder 重新同步
 * 4. 记录失败的 ID，下次排除
 *
 * 说明：
 * - 成功的记录会填充 Account_Name，下次查询自动排除
 * - 失败的 ID 记录在 SOLogs，下次查询时排除
 * - 当失败 ID 列表超过 100 个时，清空重来（避免 NOT IN 过长）
 *
 * 触发方式：Schedule 定时任务，每5分钟执行一次
 */

void schedule.SyncSalesOrdersWithoutAccount()
{
	info "========== 开始同步没有 Account_Name 的销售订单 ==========";

	// ========== 1. 获取已知的失败 ID 列表 ==========
	excludeIds = List();
	failLogId = null;
	failLogs = zoho.crm.searchRecords("SOLogs", "(Name:equals:SyncSalesOrdersWithoutAccount_FailedIds)");
	if(failLogs != null && failLogs.size() > 0)
	{
		failLog = failLogs.get(0);
		failLogId = failLog.get("id");
		failIdsStr = failLog.get("Failed_Ids");
		if(failIdsStr != null && failIdsStr != "")
		{
			excludeIds = failIdsStr.toList();
			info "已知失败 ID 数量: " + excludeIds.size();
		}
	}

	// ========== 2. 构建 COQL 查询 ==========
	limit = 200;
	coqlQuery = "SELECT id, Subject, Order_Number, Customer_Name FROM Sales_Orders WHERE Account_Name is null";

	// 添加排除条件（最多排除 100 个，避免 COQL 过长）
	if(excludeIds.size() > 0 && excludeIds.size() <= 100)
	{
		excludeStr = excludeIds.toString().replaceAll("\\[", "(").replaceAll("\\]", ")");
		coqlQuery = coqlQuery + " AND id not in " + excludeStr;
	}

	coqlQuery = coqlQuery + " LIMIT " + limit;
	info "COQL 查询: " + coqlQuery;

	coqlParams = Map();
	coqlParams.put("select_query", coqlQuery);

	coqlResponse = invokeurl
	[
		url: "https://www.zohoapis.com.au/crm/v8/coql"
		type: POST
		parameters: coqlParams.toString()
		connection: "crm"
	];

	if(coqlResponse == null)
	{
		info "查询失败";
		return;
	}

	info "COQL 响应: " + coqlResponse;

	dataList = coqlResponse.get("data");
	if(dataList == null || dataList.size() == 0)
	{
		info "没有需要同步的销售订单";
		return;
	}

	info "本页获取: " + dataList.size() + " 条";

	// ========== 3. 遍历同步每个订单 ==========
	successCount = 0;
	failCount = 0;
	skipCount = 0;
	thisFailIds = List();

	for each order in dataList
	{
		orderId = order.get("id");
		subject = order.get("Subject");
		orderNumber = order.get("Order_Number");

		info "处理订单: " + orderNumber + ", Subject: " + subject;

		// Subject 就是 NetSuite 的订单 ID
		if(subject == null || subject == "")
		{
			info "跳过: Subject 为空";
			skipCount = skipCount + 1;
			thisFailIds.add(orderId);
			continue;
		}

		// 调用单个订单同步方法
		syncResult = standalone.SyncSingleSalesOrder(subject);
		info "同步结果: " + syncResult;

		// 判断是否成功
		isSuccess = false;
		if(syncResult != null)
		{
			// 先检查是否有 error 字段
			if(syncResult.get("error") != null)
			{
				isSuccess = false;
			}
			else
			{
				// 检查 res.data[0].status 或 code
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
							if(status == "success" || code == "SUCCESS")
							{
								isSuccess = true;
							}
						}
					}
				}
			}
		}

		if(isSuccess)
		{
			successCount = successCount + 1;
			info "同步成功: " + subject;
		}
		else
		{
			failCount = failCount + 1;
			info "同步失败: " + subject;
			thisFailIds.add(orderId);
		}
	}

	// ========== 4. 输出统计 ==========
	info "========== 同步完成 ==========";
	info "成功: " + successCount;
	info "失败: " + failCount;
	info "跳过: " + skipCount;
	info "总计: " + dataList.size();

	// ========== 5. 更新失败 ID 列表 ==========
	if(thisFailIds.size() > 0)
	{
		// 合并到已有列表
		for each fid in thisFailIds
		{
			if(!excludeIds.contains(fid))
			{
				excludeIds.add(fid);
			}
		}

		info "失败 ID 总数: " + excludeIds.size();

		// 如果超过 100 个，清空重来
		if(excludeIds.size() > 100)
		{
			info "失败 ID 超过 100 个，清空列表重新开始";
			excludeIds = List();
		}

		// 保存到 SOLogs
		failData = Map();
		failData.put("Name", "SyncSalesOrdersWithoutAccount_FailedIds");
		failData.put("Failed_Ids", excludeIds.toString());
		failData.put("Log_Content", "失败总数: " + excludeIds.size() + ", 本次新增: " + thisFailIds.size());

		failDataList = List();
		failDataList.add(failData);

		failRequestParams = Map();
		failRequestParams.put("data", failDataList);

		if(failLogId != null)
		{
			invokeurl
			[
				url: "https://www.zohoapis.com.au/crm/v8/SOLogs/" + failLogId
				type: PUT
				parameters: failRequestParams.toString()
				connection: "crm"
			];
			info "更新失败 ID 记录";
		}
		else
		{
			invokeurl
			[
				url: "https://www.zohoapis.com.au/crm/v8/SOLogs"
				type: POST
				parameters: failRequestParams.toString()
				connection: "crm"
			];
			info "创建失败 ID 记录";
		}
	}

	moreRecords = coqlResponse.get("more_records");
	if(moreRecords == true || moreRecords == "true")
	{
		info "还有更多数据，Schedule 会继续执行";
	}
	else
	{
		info "所有数据处理完成！";
	}
}
