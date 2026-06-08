void automation.DuplicateLeadsTotalCal(Int did)
{
if(did != null)
{
	sql = "select COUNT(Main_Lead) as ct from Duplicate_Leads where Main_Lead = '" + did + "'";
	queryMap = Map();
	queryMap.put("select_query",sql);
	response = invokeurl
	[
		url :"https://www.zohoapis.com/crm/v7/coql"
		type :POST
		parameters:queryMap.toString()
		connection:"crm"
	];
	info response;
	if(response != "")
	{
		ct = response.get("data").get(0).get("ct");
		info ct;
		info zoho.crm.updateRecord("Leads",did,{"DupLeadsTotal":ct},{"trigger":{}});
	}
}
else
{
	info "没有关联线索数据！";
}
}