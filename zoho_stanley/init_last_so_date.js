/**
 * 初始化 Account 的 Last_SO_Date 字段
 *
 * 触发方式：Schedule 定时任务，每 10-30 分钟执行一次
 *
 * 功能：遍历 Sales Orders，找出每个 Account 最后的订单日期，更新到 Account.Last_SO_Date
 *
 * 进度记录：使用 CALogs 模块
 *
 * 参数：无（使用 CRM connection）
 * coqlQuery = "SELECT * FROM Sales_Orders ORDER BY Created_Time DESC LIMIT 200 OFFSET " + currentOffset;
 */

void schedule.initLastSODate()
{
    // ========== 1. 从 CALogs 读取当前进度 ==========
    currentOffset = 0;
    statusLogId = null;

    statusLogs = zoho.crm.searchRecords("CALogs", "(Name:equals:LastSODateInitStatus)");

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

    info "========== 开始初始化 Last_SO_Date，当前进度: " + currentOffset + " ==========";

    // ========== 2. 获取 Sales Orders（按创建时间倒序） ==========
    perPage = 200;
    targetCount = 1000;  // 每次处理 1000 条 SO

    // 用于存储每个 Account 的最后订单日期
    accountLastSODateMap = Map();

    hasMore = true;
    processedCount = 0;
    startPage = (currentOffset / perPage) + 1;
    currentPage = startPage;

    // 使用固定列表模拟循环（最多获取 5 页）
    pageList = {1, 2, 3, 4, 5};

    for each pageNum in pageList
    {
        if(hasMore == false)
        {
            break;
        }
        if(processedCount >= targetCount)
        {
            break;
        }

        // 获取 Sales Orders
        soRecords = zoho.crm.getRecords("Sales_Orders", currentPage, perPage);

        recordCount = 0;
        if(soRecords != null)
        {
            recordCount = soRecords.size();
        }
        info "第 " + currentPage + " 页，获取到 " + recordCount + " 条 Sales Orders";

        if(soRecords == null || soRecords.size() == 0)
        {
            hasMore = false;
            info "没有更多 Sales Orders";
            break;
        }

        // 遍历 SO，记录每个 Account 的最后订单日期
        for each soRecord in soRecords
        {
            processedCount = processedCount + 1;

            // 获取关联的 Account
            accountField = soRecord.get("Account_Name");
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

            // 获取 SO 创建时间
            createdTime = soRecord.get("Created_Time");
            if(createdTime == null || createdTime == "")
            {
                continue;
            }

            // 解析日期（取日期部分）
            createdDateStr = createdTime.subString(0, 10);
            createdDate = createdDateStr.toDate("yyyy-MM-dd");

            // 如果这个 Account 还没有记录，或者这个日期比已记录的更新，则更新
            if(!accountLastSODateMap.containsKey(accountId))
            {
                accountLastSODateMap.put(accountId, createdDate);
            }
            else
            {
                existingDate = accountLastSODateMap.get(accountId);
                // 如果当前日期比已有日期更新，则更新（daysBetween > 0 表示 createdDate 在 existingDate 之后）
                daysDiff = existingDate.daysBetween(createdDate);
                if(daysDiff > 0)
                {
                    accountLastSODateMap.put(accountId, createdDate);
                }
            }
        }

        // 判断是否还有更多数据
        if(recordCount < perPage)
        {
            hasMore = false;
        }

        currentPage = currentPage + 1;
    }

    info "本次处理 Sales Orders: " + processedCount;
    info "需要更新的 Accounts: " + accountLastSODateMap.size();

    // ========== 3. 批量更新 Account 的 Last_SO_Date ==========
    updateSuccess = 0;
    updateFailed = 0;
    errorIds = List();

    for each accountId in accountLastSODateMap.keys()
    {
        lastSODate = accountLastSODateMap.get(accountId);

        try
        {
            updateData = Map();
            updateData.put("Last_SO_Date", lastSODate);

            updateResult = zoho.crm.updateRecord("Accounts", accountId, updateData);

            if(updateResult != null && updateResult.containsKey("code"))
            {
                errorCode = updateResult.get("code");
                if(errorCode != "SUCCESS")
                {
                    updateFailed = updateFailed + 1;
                    errorIds.add(accountId);
                    info "更新失败: Account " + accountId + " - " + updateResult.get("message");
                }
                else
                {
                    updateSuccess = updateSuccess + 1;
                }
            }
            else
            {
                updateSuccess = updateSuccess + 1;
            }
        }
        catch (e)
        {
            updateFailed = updateFailed + 1;
            errorIds.add(accountId);
            info "更新异常: Account " + accountId + " - " + e;
        }
    }

    // ========== 4. 更新进度到 CALogs ==========
    newOffset = currentOffset + processedCount;

    statusData = Map();
    statusData.put("currentOffset", newOffset);
    statusData.put("lastSyncTime", zoho.currenttime.toString());
    statusData.put("totalProcessed", newOffset);
    statusData.put("updateSuccess", updateSuccess);
    statusData.put("updateFailed", updateFailed);
    statusData.put("hasMore", hasMore);

    statusLogParams = Map();
    statusLogParams.put("Name", "LastSODateInitStatus");
    statusLogParams.put("Log_Content", statusData.toString());
    statusLogParams.put("Sync_Result", "已处理: " + newOffset + ", 更新Account: " + updateSuccess + ", 失败: " + updateFailed);

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
    info "========== 本次执行完成 ==========";
    info "处理 Sales Orders: " + processedCount;
    info "更新 Accounts: " + updateSuccess;
    info "失败: " + updateFailed;
    info "新进度: " + newOffset;
    info "还有更多: " + hasMore;
}
