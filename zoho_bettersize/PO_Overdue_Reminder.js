/**
 * 采购订单逾期提醒
 *
 * 触发方式：Schedule 定时任务，每天执行一次
 *
 * 功能：超过 Latest Arrival Date 后，如果状态还不是 PO SHIPPED 或 PO ONHOLD，每天提醒销售助理
 *
 * 参数：organization - 从 Books Schedule 传入的组织信息
 */

void PO_Overdue_Reminder(Map organization)
{
    // 从参数获取组织 ID
    orgId = organization.get("organization_id");

    // 获取今天日期
    today = zoho.currentdate;
    todayStr = today.toString("yyyy-MM-dd");
    info "========== 开始执行 PO 逾期提醒 - " + todayStr + " ==========";

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

        // 如果状态已经是 PO SHIPPED 或 PO ONHOLD，跳过
        if(cfStatus == "PO SHIPPED" || cfStatus == "PO ONHOLD")
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

        // 计算距离到达日期的天数（负数表示已过期）
        daysToArrival = today.daysBetween(arrivalDate);
        info "  -> 到达日期: " + arrivalDate + ", 距今 " + daysToArrival + " 天";

        // 当前日期 >= 到达日期（daysToArrival <= 0 表示已到到达日期或已过期）才提醒
        if(daysToArrival <= 0)
        {
            vendorName = ifnull(order.get("vendor_name"), "");
            overdueDays = 0 - daysToArrival;

            info "需要提醒 - PO: " + orderNo + ", 到达日期: " + arrivalDate + ", 已逾期 " + overdueDays + " 天";

            // 构建邮件内容（HTML 格式）
            emailSubject = "PO Overdue Reminder: " + orderNo + " - Overdue " + overdueDays + " days";
            emailBody = "<p>Dear Sales Assistant,</p>";
            emailBody = emailBody + "<p>This is an overdue reminder for Purchase Order: <strong>" + orderNo + "</strong></p>";
            emailBody = emailBody + "<p><strong>Details:</strong></p>";
            emailBody = emailBody + "<ul>";
            emailBody = emailBody + "<li>PO Number: " + orderNo + "</li>";
            emailBody = emailBody + "<li>Vendor: " + vendorName + "</li>";
            emailBody = emailBody + "<li>Latest Arrival Date: " + arrivalDate + "</li>";
            emailBody = emailBody + "<li>Days Overdue: " + overdueDays + " days</li>";
            emailBody = emailBody + "<li>Current Status: " + cfStatus + "</li>";
            emailBody = emailBody + "</ul>";
            emailBody = emailBody + "<p>Please update the status to <strong>PO SHIPPED</strong> or <strong>PO ONHOLD</strong>.</p>";
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