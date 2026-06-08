string button.RemoveDupLeadsList()
{
msg = "";
queryMap = Map();
queryMap.put("select_query","select id,Email,DupExecutedStatus from Leads where DupExecutedStatus != 'Already' or DupExecutedStatus is null limit 1000");
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
	for each  dt in response.get("data")
	{
		info dt;
		info dt.get("id");
		info button.DuplicateLeadsMail(dt.get("id"));
	}
	msg = "Executed successfully!";
}
else
{
	msg = "No data needs to be removed！";
}
return msg;
}