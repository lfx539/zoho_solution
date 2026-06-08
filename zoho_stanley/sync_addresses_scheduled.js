/**
 * 定时同步 CustomerAddress 到 Account（Schedule 调用）
 *
 * 每次处理 500 条记录（通过循环获取多页实现）
 * 自动从 CALogs 模块读取和保存进度
 *
 * CALogs 模块字段：
 * - Name: 单行文本
 * - Log_Content: 多行（大）- 存储进度 JSON
 * - Error_Ids: 多行（大）- 存储失败的 ID
 * - Sync_Result: 单行 - 同步结果摘要
 */

void schedule.syncAllCustomerAddresses()
{
    // ========== 1. 从 CALogs 读取当前进度 ==========
    currentOffset = 0;
    statusLogId = null;

    statusLogs = zoho.crm.searchRecords("CALogs", "(Name:equals:CustomerAddressSyncStatus)");

    if(statusLogs != null && statusLogs.size() > 0)
    {
        statusLog = statusLogs.get(0);
        statusLogId = statusLog.get("id");
        logContent = statusLog.get("Log_Content");

        if(logContent != null && logContent != "")
        {
            statusMap = logContent.toMap();
            if(statusMap != null)
            {
                offsetValue = statusMap.get("currentOffset");
                if(offsetValue != null)
                {
                    currentOffset = offsetValue.toLong();
                }
            }
        }
    }

    info "========== 开始同步 CustomerAddress，当前进度: " + currentOffset + " ==========";

    // ========== 2. 执行同步 ==========
    perPage = 200;          // Zoho CRM API 每页最多 200 条
    targetCount = 800;      // 每次函数调用处理的目标数量（4页）

    errorIds = List();
    errorDetails = List();
    totalProcessed = 0;
    totalSuccess = 0;
    totalFailed = 0;
    hasMore = true;

    // 计算起始页码
    startPage = (currentOffset / perPage) + 1;
    currentPage = startPage;
    processedInBatch = 0;

    // 使用固定列表模拟循环（最多获取 4 页）
    pageList = {1, 2, 3, 4};

    for each pageNum in pageList
    {
        if(hasMore == false)
        {
            break;
        }
        if(processedInBatch >= targetCount)
        {
            break;
        }

        // 获取 CustomerAddress 记录
        addressRecords = zoho.crm.getRecords("CustomerAddress", currentPage, perPage);

        recordCount = 0;
        if(addressRecords != null)
        {
            recordCount = addressRecords.size();
        }
        info "第 " + currentPage + " 页，获取到 " + recordCount + " 条记录";

        if(addressRecords == null || addressRecords.size() == 0)
        {
            hasMore = false;
            info "没有更多记录需要处理";
            break;
        }

        // 按 Account 分组
        accountShippingMap = Map();
        accountBillingMap = Map();

        for each addressRecord in addressRecords
        {
            accountField = addressRecord.get("Accounts");
            if(accountField == null)
            {
                continue;
            }

            accountId = "";
            if(accountField.contains("id"))
            {
                accountId = accountField.get("id");
            }
            else
            {
                accountId = accountField;
            }

            if(accountId == null || accountId == "")
            {
                continue;
            }

            defaultShipping = addressRecord.get("Default_Shipping");
            defaultBilling = addressRecord.get("Default_Billing");

            if(defaultShipping == true || defaultShipping == "true")
            {
                accountShippingMap.put(accountId, addressRecord);
            }

            if(defaultBilling == true || defaultBilling == "true")
            {
                accountBillingMap.put(accountId, addressRecord);
            }
        }

        // 合并需要更新的 Account ID（使用 List 去重）
        allAccountIds = List();
        for each id in accountShippingMap.keys()
        {
            if(!allAccountIds.contains(id))
            {
                allAccountIds.add(id);
            }
        }
        for each id in accountBillingMap.keys()
        {
            if(!allAccountIds.contains(id))
            {
                allAccountIds.add(id);
            }
        }

        info "需要更新 " + allAccountIds.size() + " 个 Account";

        // 遍历每个 Account 进行更新
        for each accountId in allAccountIds
        {
            totalProcessed = totalProcessed + 1;

            try
            {
                updateData = Map();

                // 处理发货地址
                if(accountShippingMap.containsKey(accountId))
                {
                    shippingRecord = accountShippingMap.get(accountId);
                    addr1 = shippingRecord.get("Addr1");
                    city = shippingRecord.get("City");
                    state = shippingRecord.get("State");
                    zip = shippingRecord.get("Zip");
                    country = shippingRecord.get("Country");

                    if(addr1 != null)
                    {
                        updateData.put("Shipping_Street", addr1);
                    }
                    if(city != null)
                    {
                        updateData.put("Shipping_City", city);
                    }
                    if(state != null)
                    {
                        updateData.put("Shipping_State", state);
                    }
                    if(zip != null)
                    {
                        updateData.put("Shipping_Code", zip);
                    }
                    if(country != null)
                    {
                        updateData.put("Shipping_Country", country);
                    }
                }

                // 处理开单地址
                if(accountBillingMap.containsKey(accountId))
                {
                    billingRecord = accountBillingMap.get(accountId);
                    addr1 = billingRecord.get("Addr1");
                    city = billingRecord.get("City");
                    state = billingRecord.get("State");
                    zip = billingRecord.get("Zip");
                    country = billingRecord.get("Country");

                    if(addr1 != null)
                    {
                        updateData.put("Billing_Street", addr1);
                    }
                    if(city != null)
                    {
                        updateData.put("Billing_City", city);
                    }
                    if(state != null)
                    {
                        updateData.put("Billing_State", state);
                    }
                    if(zip != null)
                    {
                        updateData.put("Billing_Code", zip);
                    }
                    if(country != null)
                    {
                        updateData.put("Billing_Country", country);
                    }
                }

                if(updateData.size() > 0)
                {
                    updateResult = zoho.crm.updateRecord("Accounts", accountId, updateData);

                    if(updateResult != null && updateResult.containsKey("code"))
                    {
                        errorCode = updateResult.get("code");
                        if(errorCode != "SUCCESS")
                        {
                            totalFailed = totalFailed + 1;
                            errorIds.add(accountId);
                            errorDetails.add("Account " + accountId + ": " + updateResult.get("message"));
                            info "更新失败: Account " + accountId + " - " + updateResult.get("message");
                        }
                        else
                        {
                            totalSuccess = totalSuccess + 1;
                        }
                    }
                    else
                    {
                        totalSuccess = totalSuccess + 1;
                    }
                }
                else
                {
                    totalSuccess = totalSuccess + 1;
                }
            }
            catch (e)
            {
                totalFailed = totalFailed + 1;
                errorIds.add(accountId);
                errorDetails.add("Account " + accountId + ": " + e.toString());
                info "更新异常: Account " + accountId + " - " + e;
            }
        }

        // 更新已处理数量
        processedInBatch = processedInBatch + recordCount;

        // 判断是否还有更多数据
        if(recordCount < perPage)
        {
            hasMore = false;
        }

        // 移动到下一页
        currentPage = currentPage + 1;
    }

    // ========== 3. 更新进度到 CALogs ==========
    newOffset = currentOffset + processedInBatch;

    statusData = Map();
    statusData.put("currentOffset", newOffset);
    statusData.put("lastSyncTime", zoho.currenttime.toString());
    statusData.put("totalSuccess", totalSuccess);
    statusData.put("totalFailed", totalFailed);
    statusData.put("hasMore", hasMore);

    statusLogParams = Map();
    statusLogParams.put("Name", "CustomerAddressSyncStatus");
    statusLogParams.put("Log_Content", statusData.toString());
    statusLogParams.put("Sync_Result", "成功: " + totalSuccess + ", 失败: " + totalFailed + ", 进度: " + newOffset);

    if(errorIds.size() > 0)
    {
        statusLogParams.put("Error_Ids", errorIds.toString());
    }

    statusDataList = List();
    statusDataList.add(statusLogParams);
    statusRequestParams = Map();
    statusRequestParams.put("data", statusDataList);

    if(statusLogId != null)
    {
        // 更新现有记录
        updateResult = invokeurl
        [
            url : "https://www.zohoapis.com.au/crm/v8/CALogs/" + statusLogId
            type : PUT
            parameters : statusRequestParams.toString()
            connection : "crm"
        ];
        info "状态记录已更新";
    }
    else
    {
        // 创建新记录
        createResult = invokeurl
        [
            url : "https://www.zohoapis.com.au/crm/v8/CALogs"
            type : POST
            parameters : statusRequestParams.toString()
            connection : "crm"
        ];
        info "状态记录已创建";
    }

    // 输出统计
    info "========== 同步完成 ==========";
    info "本次处理 CustomerAddress: " + processedInBatch;
    info "更新 Account: " + totalProcessed;
    info "成功: " + totalSuccess;
    info "失败: " + totalFailed;
    info "新进度: " + newOffset;
    info "还有更多: " + hasMore;

    // 如果有失败记录，额外创建一条错误日志
    if(errorIds.size() > 0)
    {
        try
        {
            errorLogParams = Map();
            errorLogParams.put("Name", "CustomerAddressSync_Error_" + currentOffset + "_" + newOffset);
            errorLogParams.put("Log_Content", "批次: " + currentOffset + " - " + newOffset + ", 失败: " + totalFailed + ", 详情: " + errorDetails.toString());
            errorLogParams.put("Error_Ids", errorIds.toString());
            errorLogParams.put("Sync_Result", "失败: " + totalFailed);

            errorDataList = List();
            errorDataList.add(errorLogParams);
            errorRequestParams = Map();
            errorRequestParams.put("data", errorDataList);

            createErrorResult = invokeurl
            [
                url : "https://www.zohoapis.com.au/crm/v8/CALogs"
                type : POST
                parameters : errorRequestParams.toString()
                connection : "crm"
            ];

            info "错误记录已保存到 CALogs 模块";
        }
        catch (e)
        {
            info "保存错误记录失败: " + e;
        }
    }
}
