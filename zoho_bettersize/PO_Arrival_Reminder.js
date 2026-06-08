/**
 * 采购订单到达日期提醒
 *
 * 触发方式：Schedule 定时任务，每天执行一次
 *
 * 功能：在 Latest Arrival Date 前两周，如果状态还不是 PO REJECTED 或 PO PROCESSED，每天提醒
 *
 * 参数：organization - 从 Books Schedule 传入的组织信息
 */

void PO_Arrival_Reminder(Map organization)
{
    // 从参数获取组织 ID
    orgId = organization.get("organization_id");

    // 获取今天日期
    today = zoho.currentdate;
    todayStr = today.toString("yyyy-MM-dd");
    info "========== 开始执行 PO 到达日期提醒 - " + todayStr + " ==========";

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

    reminderCount = 0;

    for each order in allOrders
    {
        // 获取字段
        cfStatus = ifnull(order.get("cf_status"), "");
        orderNo = order.get("purchaseorder_number");

        // 使用 _unformatted 版本获取标准日期格式
        cfLatestArrivalDate = order.get("cf_latest_arrival_date_unformatted");

        info "PO: " + orderNo + ", cf_status: [" + cfStatus + "], cf_latest_arrival_date_unformatted: [" + cfLatestArrivalDate + "]";

        // 如果状态已经是 PO REJECTED 或 PO PROCESSED，跳过
        if(cfStatus == "PO REJECTED" || cfStatus == "PO PROCESSED")
        {
            info "  -> 跳过：状态已是 " + cfStatus;
            continue;
        }

        // 如果没有设置 Latest Arrival Date，跳过
        if(cfLatestArrivalDate == null || cfLatestArrivalDate == "")
        {
            info "  -> 跳过：没有设置 Latest Arrival Date";
            continue;
        }

        // 解析 Latest Arrival Date（yyyy-MM-dd 格式）
        arrivalDate = cfLatestArrivalDate.toDate("yyyy-MM-dd");

        if(arrivalDate == null)
        {
            info "  -> 跳过：无法解析日期";
            continue;
        }

        // 计算距离到达日期的天数
        daysToArrival = today.daysBetween(arrivalDate);
        info "  -> 到达日期: " + arrivalDate + ", 距今 " + daysToArrival + " 天";

        // 当前日期 >= 到达日期 - 14 天（即距今 <= 14 天）才提醒
        if(daysToArrival <= 14)
        {
            vendorName = ifnull(order.get("vendor_name"), "");

            info "需要提醒 - PO: " + orderNo + ", 到达日期: " + arrivalDate + ", 还有 " + daysToArrival + " 天";

            // 构建邮件内容（HTML 格式）
            emailSubject = "PO Arrival Reminder: " + orderNo + " - Arriving in " + daysToArrival + " days";
            emailBody = "<p>Dear team,</p>";
            emailBody = emailBody + "<p>This is a reminder for Purchase Order: <strong>" + orderNo + "</strong></p>";
            emailBody = emailBody + "<p><strong>Details:</strong></p>";
            emailBody = emailBody + "<ul>";
            emailBody = emailBody + "<li>PO Number: " + orderNo + "</li>";
            emailBody = emailBody + "<li>Vendor: " + vendorName + "</li>";
            emailBody = emailBody + "<li>Latest Arrival Date: " + arrivalDate + "</li>";
            emailBody = emailBody + "<li>Days Until Arrival: " + daysToArrival + " days</li>";
            emailBody = emailBody + "<li>Current Status: " + cfStatus + "</li>";
            emailBody = emailBody + "</ul>";
            emailBody = emailBody + "<p>Please update the status to <strong>PO REJECTED</strong> or <strong>PO PROCESSED</strong> before arrival.</p>";
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
