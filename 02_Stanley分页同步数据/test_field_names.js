void schedule.TestFieldNames()
{
// 测试各记录类型的日期字段
limit = 1;

// 1. PurchaseOrder
info "=== 1. PurchaseOrder ===";
poUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/purchaseorder";
poAuth = standalone.SetListHeaders("GET",poUrl,true,limit,0);
poHeaders = {"Content-Type":"application/json","Authorization":poAuth};
poResp = invokeurl
[
	url :poUrl + "?limit=" + limit + "&offset=0"
	type :GET
	headers:poHeaders
];
if(poResp != null)
{
	poData = poResp.getFileContent().toJSONList().get(0);
	poItems = poData.get("items");
	if(poItems != null && poItems.size() > 0)
	{
		poId = poItems.get(0).get("id");
		info ("PO ID: " + poId);
		// 获取详情
		poDetailUrl = poUrl + "/" + poId;
		poDetailAuth = standalone.SetHeaders("GET",poDetailUrl,true);
		poDetailHeaders = {"Content-Type":"application/json","Authorization":poDetailAuth};
		poDetailResp = invokeurl
		[
			url :poDetailUrl + "?expandSubResources=false"
			type :GET
			headers:poDetailHeaders
		];
		if(poDetailResp != null)
		{
			poDetail = poDetailResp.getFileContent().toMap();
			// 查找日期字段
			keys = poDetail.keys();
			for each  key in keys
			{
				keyStr = key.toString().toLowerCase();
				if(keyStr.contains("date") || keyStr.contains("created"))
				{
					info ("  " + key + ": " + poDetail.get(key));
				}
			}
		}
	}
}

// 2. VendorBill
info "=== 2. VendorBill ===";
vbUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/vendorbill";
vbAuth = standalone.SetListHeaders("GET",vbUrl,true,limit,0);
vbHeaders = {"Content-Type":"application/json","Authorization":vbAuth};
vbResp = invokeurl
[
	url :vbUrl + "?limit=" + limit + "&offset=0"
	type :GET
	headers:vbHeaders
];
if(vbResp != null)
{
	vbData = vbResp.getFileContent().toJSONList().get(0);
	vbItems = vbData.get("items");
	if(vbItems != null && vbItems.size() > 0)
	{
		vbId = vbItems.get(0).get("id");
		info ("VendorBill ID: " + vbId);
		vbDetailUrl = vbUrl + "/" + vbId;
		vbDetailAuth = standalone.SetHeaders("GET",vbDetailUrl,true);
		vbDetailHeaders = {"Content-Type":"application/json","Authorization":vbDetailAuth};
		vbDetailResp = invokeurl
		[
			url :vbDetailUrl + "?expandSubResources=false"
			type :GET
			headers:vbDetailHeaders
		];
		if(vbDetailResp != null)
		{
			vbDetail = vbDetailResp.getFileContent().toMap();
			keys = vbDetail.keys();
			for each  key in keys
			{
				keyStr = key.toString().toLowerCase();
				if(keyStr.contains("date") || keyStr.contains("created"))
				{
					info ("  " + key + ": " + vbDetail.get(key));
				}
			}
		}
	}
}

// 3. VendorPayment
info "=== 3. VendorPayment ===";
vpUrl = "https://6508945.suitetalk.api.netsuite.com/services/rest/record/v1/vendorpayment";
vpAuth = standalone.SetListHeaders("GET",vpUrl,true,limit,0);
vpHeaders = {"Content-Type":"application/json","Authorization":vpAuth};
vpResp = invokeurl
[
	url :vpUrl + "?limit=" + limit + "&offset=0"
	type :GET
	headers:vpHeaders
];
if(vpResp != null)
{
	vpData = vpResp.getFileContent().toJSONList().get(0);
	vpItems = vpData.get("items");
	if(vpItems != null && vpItems.size() > 0)
	{
		vpId = vpItems.get(0).get("id");
		info ("VendorPayment ID: " + vpId);
		vpDetailUrl = vpUrl + "/" + vpId;
		vpDetailAuth = standalone.SetHeaders("GET",vpDetailUrl,true);
		vpDetailHeaders = {"Content-Type":"application/json","Authorization":vpDetailAuth};
		vpDetailResp = invokeurl
		[
			url :vpDetailUrl + "?expandSubResources=false"
			type :GET
			headers:vpDetailHeaders
		];
		if(vpDetailResp != null)
		{
			vpDetail = vpDetailResp.getFileContent().toMap();
			keys = vpDetail.keys();
			for each  key in keys
			{
				keyStr = key.toString().toLowerCase();
				if(keyStr.contains("date") || keyStr.contains("created"))
				{
					info ("  " + key + ": " + vpDetail.get(key));
				}
			}
		}
	}
}
}
