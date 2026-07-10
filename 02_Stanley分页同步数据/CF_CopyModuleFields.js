string standalone.CopyModuleFields(String sourceModule, String targetModule, Map subformMapping, Bool includeSystemFields)
{
result = Map();
result.put("sourceModule",sourceModule);
result.put("targetModule",targetModule);

// 默认不复制系统字段
if(includeSystemFields == null)
{
	includeSystemFields = false;
}

// 1. 获取源模块的字段定义
fieldsUrl = "https://www.zohoapis.com.au/crm/v8/settings/fields?module=" + sourceModule;
fieldsResp = invokeurl
[
	url :fieldsUrl
	type :GET
	connection:"crm"
];

if(fieldsResp == null)
{
	result.put("error","获取源模块字段失败");
	return result;
}

fieldsData = fieldsResp.get("fields");
if(fieldsData == null || fieldsData.size() == 0)
{
	result.put("error","源模块没有字段数据");
	return result;
}

// 2. 过滤并复制自定义字段
createdFields = List();
failedFields = List();
skippedFields = List();

// 允许复制的必填系统字段白名单
allowedMandatoryFields = {"Vendor_Name", "Contact_Name"};

for each  field in fieldsData
{
	fieldApiName = field.get("api_name");
	fieldLabel = field.get("field_label");
	fieldType = field.get("data_type");
	isCustomField = field.get("custom_field");
	systemMandatory = field.get("system_mandatory");

	// 根据参数决定是否跳过系统字段
	if(includeSystemFields == false)
	{
		// 跳过系统字段和必填系统字段
		if(isCustomField == false || systemMandatory == true)
		{
			skippedFields.add(fieldApiName + " (系统字段)");
			continue;
		}
	}
	else
	{
		// 即使复制系统字段，也跳过必填系统字段和一些特殊字段
		// 但允许白名单中的必填字段
		isAllowedMandatory = false;
		for each  allowedField in allowedMandatoryFields
		{
			if(fieldApiName == allowedField)
			{
				isAllowedMandatory = true;
			}
		}
		if(systemMandatory == true && isAllowedMandatory == false)
		{
			skippedFields.add(fieldApiName + " (必填系统字段)");
			continue;
		}
		// 跳过特殊的系统字段
		if(fieldApiName == "id" || fieldApiName == "Owner" || fieldApiName == "Created_By" || fieldApiName == "Modified_By" || fieldApiName == "Created_Time" || fieldApiName == "Modified_Time" || fieldApiName == "Tag" || fieldApiName == "Locked__s" || fieldApiName == "Last_Activity_Time" || fieldApiName == "Record_Status__s")
		{
			skippedFields.add(fieldApiName + " (特殊系统字段)");
			continue;
		}
	}

	// 跳过子表字段（单独处理）
	if(fieldType == "subform")
	{
		continue;
	}

	// 构建创建字段的参数
	fieldParams = Map();
	fieldParams.put("field_label",fieldLabel);
	fieldParams.put("data_type",fieldType);
	fieldParams.put("field_length",field.get("length"));

	// 处理不同字段类型
	if(fieldType == "Lookup")
	{
		lookupModule = field.get("lookup");
		if(lookupModule != null && lookupModule.get("module") != null)
		{
			fieldParams.put("lookup_module",lookupModule.get("module"));
		}
	}
	else if(fieldType == "Picklist" || fieldType == "Multi-Select")
	{
		pickListValues = field.get("pick_list_values");
		if(pickListValues != null && pickListValues.size() > 0)
		{
			valuesList = List();
			for each  pickVal in pickListValues
			{
				valuesList.add(pickVal.get("display_value"));
			}
			fieldParams.put("pick_list_values",valuesList);
		}
	}
	else if(fieldType == "Currency")
	{
		fieldParams.put("decimal_place",field.get("decimal_place"));
	}
	else if(fieldType == "Number" || fieldType == "Decimal")
	{
		fieldParams.put("decimal_place",field.get("decimal_place"));
	}
	else if(fieldType == "Formula")
	{
		formula = field.get("formula");
		if(formula != null)
		{
			fieldParams.put("formula",formula);
			fieldParams.put("return_type",field.get("return_type"));
		}
	}

	// 创建字段
	try
	{
		createParams = Map();
		fieldList = List();
		fieldList.add(fieldParams);
		createParams.put("fields",fieldList);

		createUrl = "https://www.zohoapis.com.au/crm/v8/settings/fields?module=" + targetModule;
		createResp = invokeurl
		[
			url :createUrl
			type :POST
			parameters:createParams.toString()
			connection:"crm"
		];

		if(createResp != null && createResp.get("fields") != null)
		{
			createdFields.add(fieldApiName);
		}
		else
		{
			failedFields.add(fieldApiName + " - " + createResp);
		}
	}
	catch (e)
	{
		failedFields.add(fieldApiName + " - " + e);
	}
}

// 3. 获取并复制子表字段
subformResults = List();

// 如果没有传入子表映射，提示用户
if(subformMapping == null || subformMapping.size() == 0)
{
	result.put("warning","未传入子表映射参数，跳过子表字段复制");
}
else
{
	layoutsUrl = "https://www.zohoapis.com.au/crm/v8/settings/layouts?module=" + sourceModule;
	layoutsResp = invokeurl
	[
		url :layoutsUrl
		type :GET
		connection:"crm"
	];

	if(layoutsResp != null && layoutsResp.get("layouts") != null)
	{
		layouts = layoutsResp.get("layouts");
		if(layouts != null && layouts.size() > 0)
		{
			for each  layout in layouts
			{
				sections = layout.get("sections");
				if(sections != null)
				{
					for each  section in sections
					{
						sectionFields = section.get("fields");
						if(sectionFields != null)
						{
							for each  f in sectionFields
							{
								// 检查字段类型
								fieldDataType = f.get("data_type");
								if(fieldDataType == "subform")
								{
									// 子表信息在 associated_module 里
									associatedModule = f.get("associated_module");
									if(associatedModule != null)
									{
										sourceSubformName = associatedModule.get("module");

										// 检查是否有对应的目标子表名称
										targetSubformName = subformMapping.get(sourceSubformName);

										if(targetSubformName == null || targetSubformName == "")
										{
											continue;
										}

										// 获取子表的字段列表
										subformFieldsUrl = "https://www.zohoapis.com.au/crm/v8/settings/fields?module=" + sourceSubformName;
										subformFieldsResp = invokeurl
										[
											url :subformFieldsUrl
											type :GET
											connection:"crm"
										];

										if(subformFieldsResp != null && subformFieldsResp.get("fields") != null)
										{
											subformFieldsList = subformFieldsResp.get("fields");

											subformCreated = List();
											subformFailed = List();

											for each  sf in subformFieldsList
											{
												sfApiName = sf.get("api_name");
												sfLabel = sf.get("field_label");
												sfType = sf.get("data_type");
												sfCustom = sf.get("custom_field");

												// 跳过系统字段
												if(sfCustom == false)
												{
													continue;
												}

												// 构建子表字段参数
												sfParams = Map();
												sfParams.put("field_label",sfLabel);
												sfParams.put("data_type",sfType);

												if(sfType == "Lookup")
												{
													sfLookup = sf.get("lookup");
													if(sfLookup != null && sfLookup.get("module") != null)
													{
														sfParams.put("lookup_module",sfLookup.get("module"));
													}
												}
												else if(sfType == "Picklist")
												{
													sfPickList = sf.get("pick_list_values");
													if(sfPickList != null && sfPickList.size() > 0)
													{
														sfValues = List();
														for each  pv in sfPickList
														{
															sfValues.add(pv.get("display_value"));
														}
														sfParams.put("pick_list_values",sfValues);
													}
												}
												else if(sfType == "Currency" || sfType == "Number")
												{
													sfParams.put("decimal_place",sf.get("decimal_place"));
												}
												else if(sfType == "Formula")
												{
													sfFormula = sf.get("formula");
													if(sfFormula != null)
													{
														sfParams.put("formula",sfFormula);
														sfParams.put("return_type",sf.get("return_type"));
													}
												}

												// 创建子表字段到目标子表
												try
												{
													sfCreateParams = Map();
													sfFieldList = List();
													sfFieldList.add(sfParams);
													sfCreateParams.put("fields",sfFieldList);

													sfCreateUrl = "https://www.zohoapis.com.au/crm/v8/settings/fields?module=" + targetSubformName;
													sfCreateResp = invokeurl
													[
														url :sfCreateUrl
														type :POST
														parameters:sfCreateParams.toString()
														connection:"crm"
													];

													if(sfCreateResp != null && sfCreateResp.get("fields") != null)
													{
														subformCreated.add(sfApiName);
													}
													else
													{
														subformFailed.add(sfApiName + " - " + sfCreateResp);
													}
												}
												catch (e)
												{
													subformFailed.add(sfApiName + " - " + e);
												}
											}

											subformResults.add({
												"sourceSubform":sourceSubformName,
												"targetSubform":targetSubformName,
												"created":subformCreated,
												"failed":subformFailed
											});
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
}

// 4. 返回结果
result.put("createdFields",createdFields);
result.put("failedFields",failedFields);
result.put("skippedFields",skippedFields);
result.put("subformResults",subformResults);
result.put("summary","创建: " + createdFields.size() + " 个字段, 失败: " + failedFields.size() + " 个字段");

return result;
}
