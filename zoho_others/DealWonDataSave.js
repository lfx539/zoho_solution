void automation.DealWonDataSave(Int did)
{
dealinfo = zoho.crm.getRecordById("Deals",did);
// 	info dealinfo;
todaydate = zoho.currentdate;
info todaydate;
crdate = zoho.currentdate;
//判断时候关联了线索
if(dealinfo.containKey("LeadName"))
{
	leadid = dealinfo.get("LeadName").get("id");
	info leadid;
	leadinfo = zoho.crm.getRecordById("Leads",leadid);
	crdate = leadinfo.get("Created_Time");
	info crdate;
}
else
{
	accifno = dealinfo.get("Account_Name").get("id");
	//如果没有线索，就查找客户，先查找客户上的线索，没有的话直接用客户的创建时间
	if(accifno.containKey("Lead"))
	{
		leadid = dealinfo.get("Lead").get("id");
		leadinfo = zoho.crm.getRecordById("Leads",leadid);
		crdate = leadinfo.get("Created_Time");
	}
	else
	{
		crdate = accifno.get("Created_Time");
	}
}
info crdate;
days = crdate.daysBetween(todaydate);
info days;
info zoho.crm.updateRecord("Deals",did,{"DealWonData":todaydate,"Wondays":days},{"trigger":{}});
}