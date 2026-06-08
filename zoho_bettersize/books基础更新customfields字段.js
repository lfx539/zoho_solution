
// 获取采购订单 ID
purchaseorderId = purchaseorder.get("purchaseorder_id");
organizationId = organization.get("organization_id");

customFieldList = List();
customFieldMap1 = Map();
customFieldMap1.put('api_name',"cf_remarks");
customFieldMap1.put('value',"测试测试");
customFieldList.add(customFieldMap1);

customFieldMap2 = Map();
customFieldMap2.put('api_name',"cf_confirmation_status");
customFieldMap2.put('value',"Pending");
customFieldList.add(customFieldMap2);

DataMap = Map();
DataMap.put("custom_fields",customFieldList);

response = invokeurl
[
	url :"https://www.zohoapis.com/books/v3/purchaseorder/" + purchaseorderId + "/customfields?organization_id=" + organizationId
	type :PUT
	parameters:DataMap.toString()
	connection:"books"
];
info response;
