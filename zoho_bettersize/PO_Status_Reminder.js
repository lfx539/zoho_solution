/**
 * 采购订单状态提醒
 *
 * 触发方式：Schedule 定时任务，每天执行一次
 *
 * 功能：提醒创建超过 3 天且状态仍为 "Not Processed" 的采购订单
 *
 * 参数：organization - 从 Books Schedule 传入的组织信息
 */

void PO_Status_Reminder(Map organization)
{
    // 从参数获取组织 ID
    orgId = organization.get("organization_id");

    // 获取今天日期
    today = zoho.currentdate;
    todayStr = today.toString("yyyy-MM-dd");
    info "========== 开始执行 PO 状态提醒 - " + todayStr + " ==========";

    // 使用 invokeurl 查询所有采购订单
    response = invokeurl
    [
        url : "https://www.zohoapis.com/books/v3/purchaseorders?organization_id=" + orgId
        type : GET
        connection : "books"
    ];

    // 从响应中提取采购订单列表
    allOrders = response.get("purchaseorders");
    if(allOrders == null || allOrders.size() == 0)
    {
        info "未找到采购订单";
        return;
    }

    info "共获取到 " + allOrders.size() + " 个采购订单";

    // 打印第一个 order 的完整结构来确认字段
    if(allOrders.size() > 0)
    {
        firstOrder = allOrders.get(0);
        info "第一个 PO 完整数据: " + firstOrder;
    }

    reminderCount = 0;

    for each order in allOrders
    {
        // 获取 cf_status（直接在 order 对象中）
        cfStatus = ifnull(order.get("cf_status"), "");
        orderNo = order.get("purchaseorder_number");

        // 获取创建时间
        createdTimeStr = order.get("created_time");

        info "PO: " + orderNo + ", cf_status: [" + cfStatus + "], created_time: [" + createdTimeStr + "]";

        // 只处理状态为 "Not Processed" 的 PO
        if(cfStatus != "Not Processed")
        {
            info "  -> 跳过：状态不是 Not Processed";
            continue;
        }

        if(createdTimeStr == null || createdTimeStr == "")
        {
            info "  -> 跳过：创建时间为空";
            continue;
        }

        // 解析创建时间（格式：yyyy-MM-dd 或 ISO 格式）
        createdDateStr = createdTimeStr.subString(0, 10);
        createdDate = createdDateStr.toDate("yyyy-MM-dd");

        // 计算创建天数
        dayDiff = createdDate.daysBetween(today);
        info "  -> 创建日期: " + createdDate + ", 已过 " + dayDiff + " 天";

        // 超过 3 天才提醒
        if(dayDiff > 3)
        {
            purchaseorderId = order.get("purchaseorder_id");
            orderNo = order.get("purchaseorder_number");
            vendorName = ifnull(order.get("vendor_name"), "");

            info "需要提醒 - PO: " + orderNo + ", 创建时间: " + createdDate + ", 已过 " + dayDiff + " 天";

            // 构建邮件内容（HTML 格式）
            emailSubject = "PO Status Reminder: " + orderNo + " - Not Processed for " + dayDiff + " days";
            emailBody = "<p>Dear team,</p>";
            emailBody = emailBody + "<p>This is a reminder for Purchase Order: <strong>" + orderNo + "</strong></p>";
            emailBody = emailBody + "<p><strong>Details:</strong></p>";
            emailBody = emailBody + "<ul>";
            emailBody = emailBody + "<li>PO Number: " + orderNo + "</li>";
            emailBody = emailBody + "<li>Vendor: " + vendorName + "</li>";
            emailBody = emailBody + "<li>Created Date: " + createdDate + "</li>";
            emailBody = emailBody + "<li>Days Pending: " + dayDiff + " days</li>";
            emailBody = emailBody + "<li>Current Status: " + cfStatus + "</li>";
            emailBody = emailBody + "</ul>";
            emailBody = emailBody + "<p>Please take action to update the status.</p>";
            emailBody = emailBody + "<p><em>This is an automated reminder.</em></p>";

            // 发送邮件（多人用逗号分隔）
            sendmail
            [
                from : zoho.adminuserid
                to : "liufangxin539@163.com,karyn.pham@bettersize.us,kiwan.park@bettersize.us"
                subject : emailSubject
                message : emailBody
            ];

            info "PO " + orderNo + " 提醒邮件已发送";
            reminderCount = reminderCount + 1;
        }
    }

    info "========== 提醒完成，共发送 " + reminderCount + " 封邮件 ==========";
}
