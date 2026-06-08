/**
 * 28天无订单提醒 - 刚好28天版本
 *
 * 触发方式：Schedule 定时任务，每天执行一次
 *
 * 功能：查询 Last_SO_Date 刚好等于 28 天的 Account，执行：
 *   1. 创建 Task 给 Account Owner（排除 Liu Fangxin, Sean Ren）
 *   2. 发邮件给客户
 *
 * 参数：无
 */

void schedule.noSOReminder28Days()
{
	info "========== 开始执行 28天无订单提醒（刚好28天）==========";

	// ========== 1. 计算日期 ==========
	today = zoho.currentdate;
	targetDate = today.addDay(-28);  // 刚好28天前

	targetDateStr = targetDate.toString("yyyy-MM-dd");
	threeMonthsAgo = today.addDay(-90);  // 3个月前（用于创建时间筛选）
	threeMonthsAgoDateTime = threeMonthsAgo.toString("yyyy-MM-dd'T'00:00:00+00:00");

	info "今天: " + today.toString("yyyy-MM-dd");
	info "目标日期（刚好28天前）: " + targetDateStr;

	// ========== 2. 查询需要提醒的 Accounts ==========
	// 筛选条件：
	// 1. 创建时间在过去三个月内
	// 2. Last_SO_Date 刚好等于 28 天前
	// 3. Owner 排除 Liu Fangxin 和 Sean Ren（在 COQL 中处理）

	perPage = 200;
	page = 1;
	allAccounts = List();
	hasMore = true;

	// 查询 Last_SO_Date 刚好等于 28 天前的
	// 排除特定 Owner: Liu Fangxin 和 Sean Ren
	coqlQuery = "SELECT id, Account_Name, Email, Owner, Owner.first_name, Owner.last_name, Last_SO_Date, Created_Time FROM Accounts WHERE ((Created_Time >= '" + threeMonthsAgoDateTime + "' AND Last_SO_Date = '" + targetDateStr + "') AND Owner.first_name not in ('Fangxin','SEAN'))";
	info "COQL 查询: " + coqlQuery;

	coqlParams = Map();
	coqlParams.put("select_query", coqlQuery);

	coqlResponse = invokeurl
	[
		url : "https://www.zohoapis.com.au/crm/v8/coql"
		type : POST
		parameters : coqlParams.toString()
		connection : "crm"
	];

	if(coqlResponse == null)
	{
		info "查询失败：无法获取 Accounts";
		return;
	}

	info "COQL 响应: " + coqlResponse;

	dataList = coqlResponse.get("data");
	if(dataList == null)
	{
		dataList = List();
	}

	info "查询到 Last_SO_Date 刚好28天的 Accounts: " + dataList.size();

	if(dataList.size() == 0)
	{
		info "没有需要提醒的 Accounts";
		return;
	}

	info "总共需要检查的 Accounts: " + dataList.size();

	// ========== 3. 遍历处理每个 Account ==========
	reminderCount = 0;

	for each account in dataList
	{
		accountId = account.get("id");
		accountName = account.get("Account_Name");
		customerEmail = account.get("Email");

		// 获取 Owner 信息
		ownerField = account.get("Owner");
		ownerName = "";
		ownerId = "";

		if(ownerField != null)
		{
			if(ownerField.containsKey("id"))
			{
				ownerId = ownerField.get("id");
			}
		}

		// COQL 返回的 first_name/last_name 在顶层
		firstName = ifnull(account.get("Owner.first_name"), "");
		lastName = ifnull(account.get("Owner.last_name"), "");
		ownerName = firstName + " " + lastName;

		// 获取 Last_SO_Date
		lastSODate = account.get("Last_SO_Date");
		info "处理 Account: " + accountName + ", Owner: " + ownerName + ", Last_SO_Date: " + lastSODate;

		// ========== 3.1 创建 Task 给 Account Owner ==========
		if(ownerId != null && ownerId != "")
		{
			taskSubject = "Follow up with " + accountName + " - No order in 28 days";
			taskDescription = "Account " + accountName + " has not placed any orders in the past 28 days. Last order date: " + lastSODate + ". Please follow up with the customer.";

			taskData = Map();
			taskData.put("Subject", taskSubject);
			taskData.put("Description", taskDescription);
			taskData.put("Owner", ownerId);
			taskData.put("What_Id", accountId);
			taskData.put("se_module", "Accounts");
			taskData.put("Status", "Not Started");
			taskData.put("Priority", "Normal");

			// 设置 Due Date 为 7 天后
			dueDate = today.addDay(7);
			taskData.put("Due_Date", dueDate);

			createTaskResult = zoho.crm.createRecord("Tasks", taskData);
			info "已创建 Task: " + taskSubject;
		}

		// ========== 3.2 发邮件给客户 ==========
		if(customerEmail != null && customerEmail != "")
		{
			customerEmailSubject = "Checking in from Stanley Packaging";
			customerEmailBody = "<p>Hi " + accountName + ",</p>";
			customerEmailBody = customerEmailBody + "<p>We hope you've been well.</p>";
			customerEmailBody = customerEmailBody + "<p>We just wanted to check in as we noticed there haven't been any recent orders from your side over the past few weeks. We completely understand things can get busy, but we thought we'd reach out to see how everything is going.</p>";
			customerEmailBody = customerEmailBody + "<p>Please let us know if there is anything you need support with — whether it's stock availability, pricing, new products, or anything else. We are always here to help.</p>";
			customerEmailBody = customerEmailBody + "<p>If your requirements have changed recently, we'd also be happy to assist in finding suitable options for you.</p>";
			customerEmailBody = customerEmailBody + "<p>Looking forward to hearing from you.</p>";
			customerEmailBody = customerEmailBody + "<p>Best regards,<br>Stanley Packaging team<br>";
			customerEmailBody = customerEmailBody + "<a href=\"www.stanleypackaging.com.au\">www.stanleypackaging.com.au</a><br>";
			customerEmailBody = customerEmailBody + "59-65 Gaine Road Dandenong South VIC 3175<br>";
			customerEmailBody = customerEmailBody + "Monday-Friday 8:30AM-4:30PM<br>";
			customerEmailBody = customerEmailBody + "Tel: 03 8795 7876, 02 8550 5166</p>";

			sendmail
			[
				from : "sales@stanleypackaging.com.au"
				to : customerEmail
				subject : customerEmailSubject
				message : customerEmailBody
			];
			info "已发送邮件给客户: " + customerEmail;
		}

		reminderCount = reminderCount + 1;
	}

	info "========== 提醒完成 ==========";
	info "处理: " + reminderCount;
}
