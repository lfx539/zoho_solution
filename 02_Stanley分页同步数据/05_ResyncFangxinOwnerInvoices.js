void schedule.ResyncFXOwnerInvoices()
{
// Fangxin user ID
fangxinUserId = "102317000000412001";

// Query Invoices where Owner = Fangxin
coqlQuery = "select id, Subject from Invoices where Owner = " + fangxinUserId + " limit 200";
requestParams = Map();
requestParams.put("select_query", coqlQuery);
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

errorCode = resp.get("code");
if(errorCode != null && errorCode != "SUCCESS")
{
	info "COQL Error: " + errorCode + " - " + resp.get("message");
	return;
}

data = resp.get("data");
if(data == null || data.size() == 0)
{
	info "No invoices found with Fangxin as Owner";
	return;
}

info "Found " + data.size() + " invoices to resync";

successCount = 0;
failCount = 0;
notFoundIds = List();

for each invoice in data
{
	invoiceId = invoice.get("Subject"); // Subject = NetSuite ID
	if(invoiceId == null || invoiceId == "")
	{
		info "Skipping invoice without Subject";
		continue;
	}

	try
	{
		syncResult = standalone.SyncSingleInvoice(invoiceId);

		if(syncResult != null)
		{
			res = syncResult.get("res");
			if(res != null)
			{
				dataList = res.get("data");
				if(dataList != null && dataList.size() > 0)
				{
					firstItem = dataList.get(0);
					code = firstItem.get("code");
					if(code == "SUCCESS")
					{
						info "Resynced: " + invoiceId;
						successCount = successCount + 1;
					}
					else
					{
						info "Failed: " + invoiceId + " - " + firstItem.get("message");
						failCount = failCount + 1;
					}
				}
				else
				{
					info "Resynced: " + invoiceId;
					successCount = successCount + 1;
				}
			}
		}
		else
		{
			info "Failed: " + invoiceId + " - null result";
			failCount = failCount + 1;
		}
	}
	catch (e)
	{
		info "Error: " + invoiceId + " - " + e;
		notFoundIds.add(invoiceId);
		failCount = failCount + 1;
	}
}

info "Done! Success: " + successCount + ", Failed: " + failCount + ", Not Found in NetSuite: " + notFoundIds.size();
if(notFoundIds.size() > 0)
{
	info "Not Found IDs: " + notFoundIds;
	// Save to otherLogs
	logParams = Map();
	logParams.put("Name", "FangxinOwnerInvoices_NotFound");
	logParams.put("Modules", "Invoice");
	logParams.put("Log_Content", notFoundIds.toString());
	logDataList = List();
	logDataList.add(logParams);
	logRequestParams = Map();
	logRequestParams.put("data", logDataList);

	invokeurl
	[
		url :"https://www.zohoapis.com.au/crm/v8/otherLogs"
		type :POST
		parameters:logRequestParams.toString()
		connection:"crm"
	];
	info "Saved to otherLogs: FangxinOwnerInvoices_NotFound";
}
}
