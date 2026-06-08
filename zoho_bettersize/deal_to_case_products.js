/*
 * Workflow 自动同步 - 将 Deal 子表产品同步到 Case 子表
 * 触发方式：Workflow - Deal 编辑时触发
 * 说明：只更新已存在的 Case，不创建新 Case（由 widget 按钮创建）
 * 注意：只有数据有变化时才执行更新，避免循环触发
 */

void automation.DealSyncCase(String dealId)
{
	info "Deal ID: " + dealId;

	dealRecord = zoho.crm.getRecordById("Deals", dealId);
	info "Deal Record: " + dealRecord;

	if(dealRecord == null)
	{
		info "获取 Deal 记录失败";
		return;
	}

	dealName = ifnull(dealRecord.get("Deal_Name"), "");
	stage = ifnull(dealRecord.get("Stage"), "");
	accountName = dealRecord.get("Account_Name");
	dealOwner = dealRecord.get("Owner");
	info "Deal Name: " + dealName;
	info "Stage: " + stage;
	info "Deal Owner: " + dealOwner;

	// 获取 Deal 完整数据（包含子表）
	getResp = invokeurl
	[
		url: "https://www.zohoapis.com/crm/v8/Deals/" + dealId
		type: GET
		connection: "crm"
	];
	info "Deal Full Data: " + getResp;

	productInterestedDeal = List();
	productPurchasedDeal = List();
	if(getResp != null && getResp.get("data") != null && getResp.get("data").size() > 0)
	{
		dealData = getResp.get("data").get(0);
		productInterestedRaw = dealData.get("Product_Interested_deal");
		if(productInterestedRaw != null)
		{
			productInterestedDeal = productInterestedRaw;
		}
		productPurchasedRaw = dealData.get("Product_Purchased_deal");
		if(productPurchasedRaw != null)
		{
			productPurchasedDeal = productPurchasedRaw;
		}
	}
	info "Product Interested Deal size: " + productInterestedDeal.size();
	info "Product Purchased Deal size: " + productPurchasedDeal.size();

	// ========== Stage 不是 Closed Won：同步到 Product_Interest_Case ==========
	if(stage != "Closed Won")
	{
		// 构建 Deal 的数据列表（用于对比）
		dealProductDataList = List();
		for each item in productInterestedDeal
		{
			productInfo = item.get("Product_Name");
			productId = "";
			if(productInfo != null)
			{
				try
				{
					if(productInfo.containsKey("id"))
					{
						productId = productInfo.get("id");
					}
					else
					{
						productId = productInfo.toString();
					}
				}
				catch (e)
				{
					productId = productInfo.toString();
				}
			}
			comments = ifnull(item.get("Comments"), "");

			if(productId != null && productId != "")
			{
				dealProductDataList.add(productId + "|" + comments);
			}
		}

		// 构建新的子表数据列表
		productInterestedCaseList = List();
		for each item in productInterestedDeal
		{
			productInfo = item.get("Product_Name");
			productId = "";
			if(productInfo != null)
			{
				try
				{
					if(productInfo.containsKey("id"))
					{
						productId = productInfo.get("id");
					}
					else
					{
						productId = productInfo.toString();
					}
				}
				catch (e)
				{
					productId = productInfo.toString();
				}
			}
			comments = ifnull(item.get("Comments"), "");

			caseItem = Map();
			if(productId != null && productId != "")
			{
				caseItem.put("Product_Name", {"id": productId});
			}
			if(comments != "")
			{
				caseItem.put("Comments", comments);
			}
			productInterestedCaseList.add(caseItem);
		}
		info "Product Interest Case list: " + productInterestedCaseList;

		if(productInterestedCaseList.size() == 0)
		{
			info "没有产品数据，跳过同步";
			return;
		}

		// 查找所有关联该 Deal 的 Case
		existingCases = zoho.crm.searchRecords("Cases", "Deal:equals:" + dealId, 1, 200);
		info "Search existing cases by Deal: " + existingCases;

		if(existingCases != null && existingCases.size() > 0)
		{
			info "找到 " + existingCases.size() + " 个关联的 Case";

			for each existingCase in existingCases
			{
				existingCaseId = existingCase.get("id");
				info "处理 Case ID: " + existingCaseId;

				// 获取 Case 现有子表数据
				getCaseResp = invokeurl
				[
					url: "https://www.zohoapis.com/crm/v8/Cases/" + existingCaseId
					type: GET
					connection: "crm"
				];

				existingProductList = List();
				if(getCaseResp != null && getCaseResp.get("data") != null && getCaseResp.get("data").size() > 0)
				{
					caseData = getCaseResp.get("data").get(0);
					existingProductRaw = caseData.get("Product_Interest_Case");
					if(existingProductRaw != null)
					{
						existingProductList = existingProductRaw;
					}
				}

				// 提取 Case 的数据列表（用于对比）
				caseProductDataList = List();
				for each caseItem in existingProductList
				{
					caseProductInfo = caseItem.get("Product_Name");
					caseProductId = "";
					if(caseProductInfo != null)
					{
						try
						{
							if(caseProductInfo.containsKey("id"))
							{
								caseProductId = caseProductInfo.get("id");
							}
							else
							{
								caseProductId = caseProductInfo.toString();
							}
						}
						catch (e)
						{
							caseProductId = caseProductInfo.toString();
						}
					}
					caseComments = ifnull(caseItem.get("Comments"), "");

					if(caseProductId != null && caseProductId != "")
					{
						caseProductDataList.add(caseProductId + "|" + caseComments);
					}
				}

				// 对比两个列表是否相同
				hasChange = false;
				if(dealProductDataList.size() != caseProductDataList.size())
				{
					hasChange = true;
				}
				else
				{
					for each dealDataItem in dealProductDataList
					{
						if(!caseProductDataList.contains(dealDataItem))
						{
							hasChange = true;
							break;
						}
					}
				}

				if(hasChange)
				{
					info "Case 子表数据有变化，执行更新: " + existingCaseId;

					// 构建删除旧数据 + 添加新数据的 payload
					productPayload = List();
					for each oldItem in existingProductList
					{
						oldItemId = oldItem.get("id");
						if(oldItemId != null)
						{
							oldItemIdStr = oldItemId.toString();
							deleteItem = Map();
							deleteItem.put("id", oldItemIdStr);
							deleteItem.put("_delete", true);
							productPayload.add(deleteItem);
						}
					}
					productPayload.addAll(productInterestedCaseList);

					caseParams = Map();
					caseParams.put("Product_Interest_Case", productPayload);

					dataList = List();
					dataList.add(caseParams);
					requestParams = Map();
					requestParams.put("data", dataList);

					info "Update Case Request: " + requestParams;

					updateResp = invokeurl
					[
						url: "https://www.zohoapis.com/crm/v8/Cases/" + existingCaseId
						type: PUT
						parameters: requestParams.toString()
						connection: "crm"
					];

					info "Update Case Response: " + updateResp;
					info "已更新 Case（Product_Interest_Case），同步 " + productInterestedCaseList.size() + " 个产品。Case ID: " + existingCaseId;
				}
				else
				{
					info "Case 子表数据无变化，跳过更新: " + existingCaseId;
				}
			}

			info "所有 Case 更新完成，共更新 " + existingCases.size() + " 个 Case";
		}
		else
		{
			info "没有找到关联的 Case，不创建新 Case（由 widget 按钮创建）";
		}
	}
	// ========== Stage 是 Closed Won：同步到 Product_Purchased_Case ==========
	else
	{
		// 构建 Deal 的数据列表（用于对比）- 从 Product_Purchased_deal 获取
		dealPurchasedDataList = List();
		for each item in productPurchasedDeal
		{
			productInfo = item.get("Product_Name");
			productId = "";
			if(productInfo != null)
			{
				try
				{
					if(productInfo.containsKey("id"))
					{
						productId = productInfo.get("id");
					}
					else
					{
						productId = productInfo.toString();
					}
				}
				catch (e)
				{
					productId = productInfo.toString();
				}
			}
			serialNumber = ifnull(item.get("Serial_Number"), "");
			warrantyStart = ifnull(item.get("Warranty_Start_Date"), "");
			warrantyEnd = ifnull(item.get("Warranty_End_Date"), "");

			if(productId != null && productId != "")
			{
				dealPurchasedDataList.add(productId + "|" + serialNumber + "|" + warrantyStart + "|" + warrantyEnd);
			}
		}

		// 构建新的子表数据列表 - 从 Product_Purchased_deal 获取
		productPurchasedList = List();
		for each item in productPurchasedDeal
		{
			// 获取 Purchase_Name
			purchaseInfo = item.get("Purchase_Name");
			purchaseId = "";
			if(purchaseInfo != null)
			{
				try
				{
					if(purchaseInfo.containsKey("id"))
					{
						purchaseId = purchaseInfo.get("id");
					}
					else
					{
						purchaseId = purchaseInfo.toString();
					}
				}
				catch (e)
				{
					purchaseId = purchaseInfo.toString();
				}
			}

			// 获取 Product_Name
			productInfo = item.get("Product_Name");
			productId = "";
			if(productInfo != null)
			{
				try
				{
					if(productInfo.containsKey("id"))
					{
						productId = productInfo.get("id");
					}
					else
					{
						productId = productInfo.toString();
					}
				}
				catch (e)
				{
					productId = productInfo.toString();
				}
			}

			serialNumber = item.get("Serial_Number");
			warrantyStart = item.get("Warranty_Start_Date");
			warrantyEnd = item.get("Warranty_End_Date");

			caseItem = Map();
			if(purchaseId != null && purchaseId != "")
			{
				caseItem.put("Purchase_Name", {"id": purchaseId});
			}
			if(productId != null && productId != "")
			{
				caseItem.put("Product_Name", {"id": productId});
			}
			if(serialNumber != null && serialNumber != "")
			{
				caseItem.put("Serial_Number", serialNumber);
			}
			if(warrantyStart != null)
			{
				caseItem.put("Warranty_Start_Date", warrantyStart);
			}
			if(warrantyEnd != null)
			{
				caseItem.put("Warranty_End_Date", warrantyEnd);
			}
			productPurchasedList.add(caseItem);
		}
		info "Product Purchased list: " + productPurchasedList;

		if(productPurchasedList.size() == 0)
		{
			info "没有已下单的产品，跳过同步";
			return;
		}

		// 查找所有关联该 Deal 的 Case
		existingCases = zoho.crm.searchRecords("Cases", "Deal:equals:" + dealId, 1, 200);
		info "Search existing cases by Deal: " + existingCases;

		if(existingCases != null && existingCases.size() > 0)
		{
			info "找到 " + existingCases.size() + " 个关联的 Case";

			for each existingCase in existingCases
			{
				existingCaseId = existingCase.get("id");
				info "处理 Case ID: " + existingCaseId;

				// 获取 Case 现有子表数据
				getCaseResp = invokeurl
				[
					url: "https://www.zohoapis.com/crm/v8/Cases/" + existingCaseId
					type: GET
					connection: "crm"
				];

				existingPurchasedList = List();
				if(getCaseResp != null && getCaseResp.get("data") != null && getCaseResp.get("data").size() > 0)
				{
					caseData = getCaseResp.get("data").get(0);
					existingPurchasedRaw = caseData.get("Product_Purchased_Case");
					if(existingPurchasedRaw != null)
					{
						existingPurchasedList = existingPurchasedRaw;
					}
				}

				// 提取 Case 的数据列表（用于对比）
				casePurchasedDataList = List();
				for each caseItem in existingPurchasedList
				{
					caseProductInfo = caseItem.get("Product_Name");
					caseProductId = "";
					if(caseProductInfo != null)
					{
						try
						{
							if(caseProductInfo.containsKey("id"))
							{
								caseProductId = caseProductInfo.get("id");
							}
							else
							{
								caseProductId = caseProductInfo.toString();
							}
						}
						catch (e)
						{
							caseProductId = caseProductInfo.toString();
						}
					}
					caseSerial = ifnull(caseItem.get("Serial_Number"), "");
					caseWarrantyStart = ifnull(caseItem.get("Warranty_Start_Date"), "");
					caseWarrantyEnd = ifnull(caseItem.get("Warranty_End_Date"), "");

					if(caseProductId != null && caseProductId != "")
					{
						casePurchasedDataList.add(caseProductId + "|" + caseSerial + "|" + caseWarrantyStart + "|" + caseWarrantyEnd);
					}
				}

				// 对比两个列表是否相同
				hasChange = false;
				if(dealPurchasedDataList.size() != casePurchasedDataList.size())
				{
					hasChange = true;
				}
				else
				{
					for each dealDataItem in dealPurchasedDataList
					{
						if(!casePurchasedDataList.contains(dealDataItem))
						{
							hasChange = true;
							break;
						}
					}
				}

				if(hasChange)
				{
					info "Case 子表数据有变化，执行更新: " + existingCaseId;

					// 构建删除旧数据 + 添加新数据的 payload
					productPayload = List();
					for each oldItem in existingPurchasedList
					{
						oldItemId = oldItem.get("id");
						if(oldItemId != null)
						{
							oldItemIdStr = oldItemId.toString();
							deleteItem = Map();
							deleteItem.put("id", oldItemIdStr);
							deleteItem.put("_delete", true);
							productPayload.add(deleteItem);
						}
					}
					productPayload.addAll(productPurchasedList);

					caseParams = Map();
					caseParams.put("Product_Purchased_Case", productPayload);

					dataList = List();
					dataList.add(caseParams);
					requestParams = Map();
					requestParams.put("data", dataList);

					info "Update Case Request: " + requestParams;

					updateResp = invokeurl
					[
						url: "https://www.zohoapis.com/crm/v8/Cases/" + existingCaseId
						type: PUT
						parameters: requestParams.toString()
						connection: "crm"
					];

					info "Update Case Response: " + updateResp;
					info "已更新 Case（Product_Purchased_Case），同步 " + productPurchasedList.size() + " 个已下单产品。Case ID: " + existingCaseId;
				}
				else
				{
					info "Case 子表数据无变化，跳过更新: " + existingCaseId;
				}
			}

			info "所有 Case 更新完成，共更新 " + existingCases.size() + " 个 Case";
		}
		else
		{
			info "没有找到关联的 Case，不创建新 Case（由 widget 按钮创建）";
		}
	}
}
