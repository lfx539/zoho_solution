/**
 * 更新 Account 的 Last_SO_Date（Workflow 调用）
 *
 * 触发方式：Sales Orders 模块的 Workflow，在 SO 创建时触发
 *
 * 功能：更新关联 Account 的 Last_SO_Date 字段为当前日期
 *
 * 参数：soId - Sales Order 的 ID（从 Workflow 传入）
 */

void workflow.updateLastSODate(String soId)
{
    info "========== 开始更新 Account Last_SO_Date ==========";
    info "Sales Order ID: " + soId;

    // 1. 获取 Sales Order 详情
    soRecord = zoho.crm.getRecordById("Sales_Orders", soId);

    if(soRecord == null)
    {
        info "错误：无法获取 Sales Order 详情";
        return;
    }

    // 2. 获取关联的 Account
    accountField = soRecord.get("Account_Name");
    if(accountField == null)
    {
        info "错误：Sales Order 没有关联 Account";
        return;
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
        info "错误：Account ID 为空";
        return;
    }

    info "Account ID: " + accountId;

    // 3. 获取 SO 的创建时间
    createdTime = soRecord.get("Created_Time");
    if(createdTime == null || createdTime == "")
    {
        info "错误：Sales Order 没有 Created_Time";
        return;
    }

    // 解析日期（取日期部分）
    createdDateStr = createdTime.subString(0, 10);
    createdDate = createdDateStr.toDate("yyyy-MM-dd");
    info "SO Created_Time: " + createdDateStr;

    // 4. 更新 Account 的 Last_SO_Date
    updateData = Map();
    updateData.put("Last_SO_Date", createdDate);

    updateResult = zoho.crm.updateRecord("Accounts", accountId, updateData);

    if(updateResult != null && updateResult.containsKey("code"))
    {
        errorCode = updateResult.get("code");
        if(errorCode == "SUCCESS")
        {
            info "成功更新 Account " + accountId + " 的 Last_SO_Date 为 " + createdDateStr;
        }
        else
        {
            info "更新失败: " + updateResult.get("message");
        }
    }
    else
    {
        info "更新完成";
    }

    info "========== 更新完成 ==========";
}
