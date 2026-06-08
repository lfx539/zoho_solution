string standalone.SyncRetry(Map params,String moduleName,String queryName)
{
result = Map();
successIds = List();
failedIds = List();
errorIds = params.get("errorIds");
info "开始重新同步错误产品，共 " + errorIds.size() + " 条";
// 遍历每个错误ID
for each  productId in errorIds
{
	info "处理产品ID: " + productId;
	// 1. 检查Zoho CRM Products中是否已存在该产品
	// 注意：productId是NetSuite的ID，需要转换为字符串进行查询
	productIdStr = productId.toString();
	checkDetail = zoho.crm.searchRecords(moduleName,"(" + queryName + ":equals:" + productIdStr + ")");
	if(checkDetail != null && checkDetail.size() > 0)
	{
		// 产品已存在，跳过
		successIds.add(productId);
		continue;
	}
	// 2. 产品不存在，执行同步
	try 
	{
		if(moduleName == "Products")
		{
			syncResult = standalone.SyncSingleInventory(productId);
		}
		else if(moduleName == "Accounts")
		{
			syncResult = standalone.SyncSingleCustomer(productId);
		}
		else if(moduleName == "Sales_Orders")
		{
			syncResult = standalone.SyncSingleSalesOrder(productId);
		}
		else if(moduleName == "Cash_Sale")
		{
			syncResult = standalone.SyncSingleCashSale(productId);
		}
		else if(moduleName == "Invoices")
		{
			syncResult = standalone.SyncSingleInvoice(productId);
		}
		else if(moduleName == "Quotes")
		{
			syncResult = standalone.SyncSingleQuote(productId);
		}
		else if(moduleName == "Credit_Memo")
		{
			syncResult = standalone.SyncSingleCreditMemo(productId);
		}
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
			successIds.add(productId);
		}
		else
		{
			failedIds.add(productId);
		}
	}
	catch (e)
	{
		failedIds.add(productId);
	}
}
// 返回结果
result.put("successIds",successIds);
result.put("failedIds",failedIds);
// 输出统计信息
info "重新同步完成！";
return result;
}