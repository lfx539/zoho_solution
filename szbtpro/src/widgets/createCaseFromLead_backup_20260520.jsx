/**
 * Create Case From Lead Widget - Backup Version (2026-05-20)
 *
 * 功能说明:
 * 1. 根据已转化的 Lead 创建或更新 Case
 * 2. 如果 Case 已存在（按 Lead 查找），则更新该 Case
 * 3. 同步 Product_Interest_Case 子表
 *
 * 重要特点:
 * - Lead 必须已转化才能创建 Case
 * - 会查找已存在的 Case 并更新
 * - 通过 Lead 查询 Account 和 Contact
 *
 * 字段映射:
 * - Related_To: Contact (通过 Email/Phone 查询或 Lead.Converted_Contact)
 * - Salesperson: Account.Owner (User 字段)
 * - Case_Creator: Lead.Owner
 * - Account_Name: 通过 Lead 查询 Account 获取
 */

import React, { useCallback, useState, useEffect } from "react";
import {
    Button,
    Typography,
    Box,
    CircularProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Paper,
    Stack,
} from '@mui/material';
import Swal from 'sweetalert2';

const CASE_TYPE_OPTIONS = [
    { value: 'Others', label: 'Others' },
    { value: 'Opportunity - In House Demo', label: 'Opportunity - In House Demo' },
    { value: 'Opportunity - Field Demo', label: 'Opportunity - Field Demo' },
    { value: 'Opportunity - Sample Analysis', label: 'Opportunity - Sample Analysis' },
    { value: 'Installation', label: 'Installation' },
    { value: 'Service - Hardware Issues', label: 'Service - Hardware Issues' },
    { value: 'Service - Software Issues', label: 'Service - Software Issues' },
    { value: 'Service - Return/Exchange', label: 'Service - Return/Exchange' },
    { value: 'Service - General/Maintenance', label: 'Service - General/Maintenance' },
];

const App = (props) => {
    const [isLoading, setIsLoading] = useState(false);
    const [leadInfo, setLeadInfo] = useState({});
    const [caseType, setCaseType] = useState('');
    const [existingCase, setExistingCase] = useState(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            let entityId = props?.data?.EntityId?.[0];
            let entity = props?.data?.Entity;

            // Get Lead record
            let leadResult = await window.ZOHO.CRM.API.getRecord({
                Entity: entity,
                approved: "both",
                RecordID: entityId
            });

            if (Array.isArray(leadResult?.data) && leadResult?.data?.length > 0) {
                let leadData = leadResult.data[0];
                setLeadInfo(leadData);

                // Check if there's an existing Case associated with this Lead
                let searchResult = await window.ZOHO.CRM.API.searchRecord({
                    Entity: "Cases",
                    Type: "criteria",
                    Query: "Lead:equals:" + entityId
                });

                if (searchResult?.data?.length > 0) {
                    let existingCaseData = searchResult.data[0];
                    setExistingCase(existingCaseData);
                    // If Case Type exists, show it in dropdown
                    if (existingCaseData?.Type) {
                        setCaseType(existingCaseData.Type);
                    }
                }
            }
        } catch (error) {
        } finally {
            setIsLoading(false);
        }
    }, [props]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreateCase = async () => {
        if (!caseType) {
            Swal.fire({
                icon: "warning",
                title: "Required",
                text: "Please select a Case Type",
            });
            return;
        }

        // Check if Lead is converted
        let isConverted = leadInfo?.IsConvertDeal || leadInfo?.Converted;
        if (!isConverted) {
            Swal.fire({
                icon: "warning",
                title: "Conversion Required",
                text: "Please convert this Lead first before creating Case.",
            });
            return;
        }

        setIsLoading(true);
        try {
            let leadId = leadInfo?.id;
            let leadName = leadInfo?.Full_Name || leadInfo?.Name || '';
            let leadEmail = leadInfo?.Email || '';
            let leadPhone = leadInfo?.Phone || '';
            let leadCompany = leadInfo?.Company || '';

            // Get Lead full data (including subforms)
            let leadFullData = await window.ZOHO.CRM.API.getRecord({
                Entity: "Leads",
                approved: "both",
                RecordID: leadId
            });

            console.log('Lead Full Data:', leadFullData);

            // Get Lead Owner as Case_Creator
            let leadOwner = leadInfo?.Owner;

            // Query Account - first try from Lead data, then search by Lead field
            let accountId = null;
            let salespersonId = null;

            // Check if Lead has Account_Name field (after conversion)
            let leadData = leadFullData?.data?.[0] || leadInfo;
            console.log('leadData:', leadData);
            console.log('leadData.Account_Name:', leadData?.Account_Name);

            if (leadData?.Account_Name?.id) {
                accountId = leadData.Account_Name.id;
            }

            // If no Account_Name, try to find Account by Lead field
            if (!accountId) {
                try {
                    let accountSql = `select id, Account_Name, Owner from Accounts where Lead = ${leadId}`;
                    let config = { select_query: accountSql };
                    let accountResult = await window.ZOHO.CRM.API.coql(config);
                    console.log('Account query result:', accountResult);
                    if (accountResult?.data?.length > 0) {
                        accountId = accountResult.data[0].id;
                        if (accountResult.data[0]?.Owner?.id) {
                            salespersonId = accountResult.data[0].Owner.id;
                        }
                    }
                } catch (e) {
                    console.log('Account query error:', e);
                }
            }

            console.log('accountId:', accountId, 'salespersonId:', salespersonId);

            // Get Account Owner as Salesperson
            if (accountId && !salespersonId) {
                try {
                    let accountResult = await window.ZOHO.CRM.API.getRecord({
                        Entity: "Accounts",
                        approved: "both",
                        RecordID: accountId
                    });
                    if (accountResult?.data?.[0]?.Owner?.id) {
                        salespersonId = accountResult.data[0].Owner.id;
                    }
                } catch (e) {
                }
            }

            // Query Contact - first try from Lead data, then search
            let contactId = null;
            if (leadData?.Contact_Name?.id) {
                contactId = leadData.Contact_Name.id;
            } else {
                // Try to find by Email or Phone
                try {
                    let contactSql = `select id from Contacts where (Email = '${leadEmail}' or Phone = '${leadPhone}')`;
                    let config = { select_query: contactSql };
                    let contactResult = await window.ZOHO.CRM.API.coql(config);
                    if (contactResult?.data?.length > 0) {
                        contactId = contactResult.data[0].id;
                    }
                } catch (e) {
                }
            }

            let productInterestedLead = [];
            if (leadFullData?.data?.[0]?.Product_Interested_lead) {
                productInterestedLead = leadFullData.data[0].Product_Interested_lead;
            }


            // Build Case subform data
            let productInterestedCaseList = productInterestedLead.map(item => {
                let caseItem = {};
                if (item.Product_Name?.id) {
                    caseItem.Product_Name = { id: item.Product_Name.id };
                }
                if (item.Comments) {
                    caseItem.Comments = item.Comments;
                }
                return caseItem;
            });

            if (productInterestedCaseList.length === 0) {
                Swal.fire({
                    icon: "warning",
                    title: "No Products",
                    text: "This Lead has no product information, cannot create Case",
                });
                setIsLoading(false);
                return;
            }

            // Case Name = Lead.Full_Name + Case Type
            let caseName = leadName + ' - ' + caseType;

            if (existingCase) {
                // Update existing Case
                let existingProductList = existingCase.Product_Interest_Case || [];

                // Build payload to delete old data and add new data
                let productPayload = existingProductList.map(item => ({
                    id: item.id,
                    _delete: true
                }));
                productPayload = productPayload.concat(productInterestedCaseList);

                let updateData = {
                    id: existingCase.id,
                    Name: caseName,
                    Type: caseType,
                    Product_Interest_Case: productPayload
                };

                // Set Related_To from Contact
                if (contactId) {
                    updateData.Related_To = { id: contactId };
                }

                // Set Salesperson from Account Owner (User field format)
                if (salespersonId) {
                    updateData.Salesperson = salespersonId;
                }

                // Set Case_Creator from Lead Owner
                if (leadOwner?.id) {
                    updateData.Case_Creator = { id: leadOwner.id };
                }

                // Set Account_Name
                if (accountId) {
                    updateData.Account_Name = { id: accountId };
                }

                console.log('Update updateData:', updateData);

                let updateResult = await window.ZOHO.CRM.API.updateRecord({
                    Entity: "Cases",
                    APIData: updateData,
                    Trigger: ["workflow", "approval", "blueprint"]
                });


                if (updateResult?.data?.[0]?.code === 'SUCCESS') {
                    Swal.fire({
                        icon: "success",
                        title: "Success!",
                        text: `Case updated, synced ${productInterestedCaseList.length} products`,
                    });
                } else {
                    throw new Error('Update failed');
                }
            } else {
                // Create new Case
                let caseData = {
                    Name: caseName,
                    Subject: "From Lead: " + leadName,
                    Lead: { id: leadId },
                    Type: caseType,
                    Product_Interest_Case: productInterestedCaseList
                };

                // Set Related_To from Contact
                if (contactId) {
                    caseData.Related_To = { id: contactId };
                }

                // Set Salesperson from Account Owner (User field format)
                if (salespersonId) {
                    caseData.Salesperson = salespersonId;
                }

                // Set Case_Creator from Lead Owner
                if (leadOwner?.id) {
                    caseData.Case_Creator = { id: leadOwner.id };
                }

                if (accountId) {
                    caseData.Account_Name = { id: accountId };
                }

                console.log('Create caseData:', caseData);

                let createResult = await window.ZOHO.CRM.API.insertRecord({
                    Entity: "Cases",
                    APIData: caseData,
                    Trigger: ["workflow", "approval", "blueprint"]
                });


                if (createResult?.data?.[0]?.code === 'SUCCESS') {
                    let newCaseId = createResult?.data?.[0]?.details?.id;
                    Swal.fire({
                        icon: "success",
                        title: "Success!",
                        text: `Case created, synced ${productInterestedCaseList.length} products`,
                    });
                } else {
                    throw new Error('Create failed');
                }
            }

        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: `Failed to create Case: ${error}`,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={{ padding: 3, width: 400 }}>
            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Stack spacing={2}>
                    <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                        <Typography variant="body2" color="text.secondary">
                            Lead Name:
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                            {leadInfo?.Full_Name || leadInfo?.Name || '-'}
                        </Typography>

                        {existingCase && (
                            <Typography variant="body2" color="warning.main">
                                Existing Case found: {existingCase.Name || existingCase.id}
                            </Typography>
                        )}
                    </Paper>

                    <FormControl fullWidth required>
                        <InputLabel>Case Type *</InputLabel>
                        <Select
                            value={caseType}
                            label="Case Type *"
                            onChange={(e) => setCaseType(e.target.value)}
                        >
                            {CASE_TYPE_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleCreateCase}
                        disabled={!caseType}
                    >
                        {existingCase ? 'UPDATE CASE' : 'CREATE CASE'}
                    </Button>

                    <Button
                        variant="outlined"
                        onClick={() => window.ZOHO.CRM.UI.Popup.close()}
                    >
                        CANCEL
                    </Button>
                </Stack>
            )}
        </Box>
    );
};

export default App;
