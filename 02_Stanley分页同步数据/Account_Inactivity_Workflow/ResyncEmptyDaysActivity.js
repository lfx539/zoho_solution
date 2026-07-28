void schedule.ResyncEmptyDaysActivity()
{
	coqlQuery = "select id, Account_Name from Accounts where Days_Since_Last_Activity is null limit 200";
	requestParams = Map();
	requestParams.put("select_query",coqlQuery);
	resp = invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/coql"
		type :POST
		parameters:requestParams.toString()
		connection:"crm"
	];
	if(resp == null)
	{
		info "Query failed";
		return;
	}
	data = resp.get("data");
	if(data == null || data.size() == 0)
	{
		info "No accounts found with empty Days_Since_Last_Activity";
		return;
	}
	info "Found " + data.size() + " accounts to resync";
	successCount = 0;
	failCount = 0;
	for each  account in data
	{
		accountId = account.get("id");
		accountName = account.get("Account_Name");
		try
		{
			accountDetail = zoho.crm.getRecordById("Accounts",accountId);
			lastActivityDate = null;
			lastActivityTime = accountDetail.get("Last_Activity_Time");
			if(lastActivityTime != null && lastActivityTime != "")
			{
				lastActivityDate = lastActivityTime;
			}
			if(lastActivityDate == null)
			{
				calls = zoho.crm.searchRecords("Calls","(What_Id:equals:" + accountId + ")");
				if(calls != null && calls.size() > 0)
				{
					latestCall = calls.get(0);
					callTime = latestCall.get("Call_Start_Time");
					if(callTime != null && callTime != "")
					{
						lastActivityDate = callTime;
					}
				}
			}
			if(lastActivityDate == null)
			{
				events = zoho.crm.searchRecords("Events","(What_Id:equals:" + accountId + ")");
				if(events != null && events.size() > 0)
				{
					latestEvent = events.get(0);
					eventTime = latestEvent.get("Start_DateTime");
					if(eventTime != null && eventTime != "")
					{
						lastActivityDate = eventTime;
					}
				}
			}
			if(lastActivityDate == null)
			{
				tasks = zoho.crm.searchRecords("Tasks","(What_Id:equals:" + accountId + ")");
				if(tasks != null && tasks.size() > 0)
				{
					latestTask = tasks.get(0);
					taskTime = latestTask.get("Due_Date");
					if(taskTime != null && taskTime != "")
					{
						lastActivityDate = taskTime;
					}
				}
			}
			daysSinceLastActivity = 999;
			if(lastActivityDate != null && lastActivityDate != "")
			{
				try
				{
					lastDate = lastActivityDate.toDate("yyyy-MM-dd'T'HH:mm:ss");
					today = zoho.currenttime.toDate("yyyy-MM-dd'T'HH:mm:ss");
					diffInMillis = today.toLong() - lastDate.toLong();
					daysSinceLastActivity = (diffInMillis / (1000 * 60 * 60 * 24)).round(0);
				}
				catch (e)
				{
					daysSinceLastActivity = 999;
				}
			}
			updateMap = Map();
			updateMap.put("Days_Since_Last_Activity",daysSinceLastActivity);
			if(lastActivityDate != null && lastActivityDate != "")
			{
				try
				{
					activityDate = lastActivityDate.toDate("yyyy-MM-dd'T'HH:mm:ss");
					formattedDate = activityDate.toString("yyyy-MM-dd");
					updateMap.put("Last_Activity_Date",formattedDate);
				}
				catch (e)
				{
					info "Failed to format date for " + accountName + ": " + lastActivityDate;
				}
			}
			updateResp = zoho.crm.updateRecord("Accounts",accountId,updateMap);
			if(updateResp != null)
			{
				// 检查根级别的 code（错误响应格式）
				rootCode = updateResp.get("code");
				if(rootCode != null && rootCode != "SUCCESS")
				{
					info "Failed: " + accountName + " | Code: " + rootCode + " | Message: " + updateResp.get("message");
					failCount = failCount + 1;
				}
				else
				{
					// 检查 data 数组内的 code（成功响应格式）
					dataList = updateResp.get("data");
					if(dataList != null && dataList.size() > 0)
					{
						result = dataList.get(0);
						respCode = result.get("code");
						if(respCode == "SUCCESS")
						{
							info "Updated: " + accountName + " | Days: " + daysSinceLastActivity;
							successCount = successCount + 1;
						}
						else
						{
							info "Failed: " + accountName + " | Code: " + respCode + " | Message: " + result.get("message");
							failCount = failCount + 1;
						}
					}
					else
					{
						// data 数组为空，但根级别没有错误码，视为成功
						info "Updated: " + accountName + " | Days: " + daysSinceLastActivity;
						successCount = successCount + 1;
					}
				}
			}
			else
			{
				info "Failed: " + accountName + " | Null response";
				failCount = failCount + 1;
			}
		}
		catch (e)
		{
			info "Error: " + accountName + " - " + e;
			failCount = failCount + 1;
		}
	}
	info "Done! Success: " + successCount + ", Failed: " + failCount;
}
