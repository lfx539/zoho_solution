void automation.NotesCopy_Deal(Int did)
{
alldata = zoho.crm.getRecordById("Deals",did,{"approved":"both"});
info alldata;
relatedrecordslist = {"Notes"};
if(alldata.containKey("LeadName") && !alldata.get("LeadName").isNull())
{
	leadid = alldata.get("LeadName").get("id");
	//复制Notes
	noteslist = zoho.crm.getRelatedRecords("Notes","Leads",leadid);
	info noteslist;
	for each  d in noteslist
	{
		d.deleteKeys({"Modified_By","Created_By","id"});
		d.update("Parent_Id",did);
		d.update("se_module","Deals");
		info zoho.crm.createRecord("Notes",d);
	}
	//复制Tasks 
	taskslist = zoho.crm.getRelatedRecords("Tasks","Leads",leadid);
	info taskslist;
	for each  t in taskslist
	{
		// 		t.update("Who_Id",did);
		t.update("What_Id",did);
		t.update("se_module","Deals");
		// 		t.update("Subject", t.get("Subject")+" copy");
		t.deleteKeys({"id","Recurring_Activity"});
		// 			info t;
		info zoho.crm.createRecord("Tasks",t);
	}
}
else
{
	info "此客户没有关联线索";
}
}