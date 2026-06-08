
/*
This is a sample function. It will display the purchase order details.
*/
headerData = List();
headerData.add({"key":"vendor_name","value":"Vendor Name"});
headerData.add({"key":"purchaseorder_number","value":"Purchaseorder Number"});
headerData.add({"key":"status","value":"Status"});
headerData.add({"key":"discount","value":"Discount","align":"right"});
details = Map();
details.put("vendor_name",{"value":purchaseorder.get("vendor_name"),"isExternal":true,"link":"https://books.zoho.com/app#/contacts/" + purchaseorder.get("vendor_id")});
details.put("purchaseorder_number",{"value":purchaseorder.get("purchaseorder_number"),"link":"https://books.zoho.com/app#/purchaseorders/" + purchaseorder.get("purchaseorder_id")});
details.put("status",purchaseorder.get("status"));
details.put("discount",purchaseorder.get("discount"));
listData = List();
listData.add(details);
resultMap = Map();
resultMap.put("header_context",headerData);
resultMap.put("data",listData);
return resultMap;
