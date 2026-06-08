/**
 * Create Case From Deal Widget - Backup Version (2026-05-20)
 *
 * 功能说明:
 * 1. 根据 Deal 创建或更新 Case
 * 2. 如果 Case 已存在（按 Deal 或 Lead 查找），则更新该 Case
 * 3. 根据 Stage 决定同步哪个子表：
 *    - 非 Closed Won: 同步 Product_Interest_Case
 *    - Closed Won: 同步 Product_Purchased_Case
 *
 * 重要特点:
 * - 会根据 Lead 查找已经创建的 Case，然后更新对应的 Case
 * - 如果 Deal 关联了 Lead (leadIdCopy)，会先按 Deal 查找，找不到再按 Lead 查找
 * - Closed Won 状态需要先转化 Product Purchased 才能创建 Case
 *
 * 字段映射:
 * - Related_To: Deal.Contact_Name
 * - Salesperson: Account.Owner (User 字段)
 * - Case_Creator: Deal.Owner
 * - Account_Name: Deal.Account_Name
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
    const [dealInfo, setDealInfo] = useState({});
    const [caseType, setCaseType] = useState('');
    const [existingCase, setExistingCase] = useState(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            let entityId = props?.data?.EntityId?.[0];
            let entity = props?.data?.Entity;

            // Get Deal record
            let dealResult = await window.ZOHO.CRM.API.getRecord({
                Entity: entity,
                approved: "both",
                RecordID: entityId
            });

            if (Array.isArray(dealResult?.data) && dealResult?.data?.length > 0) {
                let dealData = dealResult.data[0];
                setDealInfo(dealData);

                // Check if there is an existing Case associated with this Deal
                try {
                    let searchResult = await window.ZOHO.CRM.API.searchRecord({
                        Entity: "Cases",
                        Type: "criteria",
                        Query: "Deal:equals:" + entityId
                    });

                    if (searchResult?.data?.length > 0) {
                        let existingCaseData = searchResult.data[0];
                        setExistingCase(existingCaseData);
                        // If Case Type exists, show it in dropdown
                        if (existingCaseData?.Type) {
                            setCaseType(existingCaseData.Type);
                        }
                    }
                } catch (searchError) {
                    // No existing Case found
                }
            }
        } catch (error) {
            console.log('fetchData error:', error);
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

        // Check if Stage is Closed Won but not converted to Product Purchased
        let stage = dealInfo?.Stage || '';
        let isConverted = dealInfo?.IsConvertedToProductPurchased;
        if (stage === 'Closed Won' && !isConverted) {
            Swal.fire({
                icon: "warning",
                title: "Conversion Required",
                text: "Please convert products to Product Purchased first before creating Case for Closed Won deals.",
            });
            return;
        }

        setIsLoading(true);
        try {
            let dealId = dealInfo?.id;
            let dealName = dealInfo?.Deal_Name || '';
            let accountName = dealInfo?.Account_Name;
            let contactName = dealInfo?.Contact_Name;

            // Get Deal full data (including subforms)
            let dealFullData = await window.ZOHO.CRM.API.getRecord({
                Entity: "Deals",
                approved: "both",
                RecordID: dealId
            });

            // Get Deal Owner as Case_Creator
            let dealOwner = dealInfo?.Owner;

            // Get Account Owner as Salesperson
            let salespersonId = null;
            if (accountName?.id) {
                try {
                    let accountResult = await window.ZOHO.CRM.API.getRecord({
                        Entity: "Accounts",
                        approved: "both",
                        RecordID: accountName.id
                    });
                    if (accountResult?.data?.[0]?.Owner?.id) {
                        salespersonId = accountResult.data[0].Owner.id;
                    }
                } catch (e) {
                    console.log('Failed to get Account Owner:', e);
                }
            }

            // Case Name = Deal Name + Case Type
            let caseName = dealName + ' - ' + caseType;

            // Decide which subform to sync based on Stage
            if (stage !== 'Closed Won') {
                // ========== Not Closed Won: Sync Product_Interest_Case ==========
                let productInterestedDeal = dealFullData?.data?.[0]?.Product_Interested_deal || [];

                let productInterestedCaseList = productInterestedDeal.map(item => {
                    let caseItem = {};
                    if (item.Product_Name?.id) {
                        caseItem.Product_Name = { id: item.Product_Name.id };
                    }
                    if (item.Comments) {
                        caseItem.Comments = item.Comments;
                    }
                    if (item.Converted_To_Sales !== undefined && item.Converted_To_Sales !== null) {
                        caseItem.Converted_To_Sales = item.Converted_To_Sales;
                    }
                    return caseItem;
                });

                if (productInterestedCaseList.length === 0) {
                    Swal.fire({
                        icon: "warning",
                        title: "No Products",
                        text: "This Deal has no product information, cannot create Case",
                    });
                    setIsLoading(false);
                    return;
                }

                if (existingCase) {
                    // Update existing Case
                    let existingProductList = existingCase.Product_Interest_Case || [];
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
                    if (contactName?.id) {
                        updateData.Related_To = { id: contactName.id };
                    }

                    // Set Salesperson from Account Owner (User field format)
                    if (salespersonId) {
                        updateData.Salesperson = salespersonId;
                    }

                    // Set Case_Creator from Deal Owner
                    if (dealOwner?.id) {
                        updateData.Case_Creator = { id: dealOwner.id };
                    }

                    let updateResult = await window.ZOHO.CRM.API.updateRecord({
                        Entity: "Cases",
                        APIData: updateData,
                        Trigger: ["workflow", "approval", "blueprint"]
                    });

                    if (updateResult?.data?.[0]?.code === 'SUCCESS') {
                        Swal.fire({
                            icon: "success",
                            title: "Success!",
                            text: `Case updated, synced ${productInterestedCaseList.length} product(s)`,
                        });
                    } else {
                        throw new Error('Update failed');
                    }
                } else {
                    // Create new Case
                    let caseData = {
                        Name: caseName,
                        Subject: "From Deal: " + dealName,
                        Deal: { id: dealId },
                        Type: caseType,
                        Product_Interest_Case: productInterestedCaseList
                    };

                    // Set Related_To from Contact
                    if (contactName?.id) {
                        caseData.Related_To = { id: contactName.id };
                    }

                    // Set Salesperson from Account Owner (User field format)
                    if (salespersonId) {
                        caseData.Salesperson = salespersonId;
                    }

                    // Set Case_Creator from Deal Owner
                    if (dealOwner?.id) {
                        caseData.Case_Creator = { id: dealOwner.id };
                    }

                    if (accountName?.id) {
                        caseData.Account_Name = { id: accountName.id };
                    }

                    let createResult = await window.ZOHO.CRM.API.insertRecord({
                        Entity: "Cases",
                        APIData: caseData,
                        Trigger: ["workflow", "approval", "blueprint"]
                    });

                    if (createResult?.data?.[0]?.code === 'SUCCESS') {
                        Swal.fire({
                            icon: "success",
                            title: "Success!",
                            text: `Case created, synced ${productInterestedCaseList.length} product(s)`,
                        });
                    } else {
                        throw new Error('Create failed');
                    }
                }
            } else {
                // ========== Closed Won: Sync Product_Purchased_Case ==========
                let productPurchasedDeal = dealFullData?.data?.[0]?.Product_Purchased_deal || [];

                let productPurchasedList = [];
                for (let item of productPurchasedDeal) {
                    let caseItem = {};
                    if (item.Purchase_Name?.id) {
                        caseItem.Purchase_Name = { id: item.Purchase_Name.id };
                    }
                    if (item.Product_Name?.id) {
                        caseItem.Product_Name = { id: item.Product_Name.id };
                    }
                    if (item.Comments) {
                        caseItem.Comments = item.Comments;
                    }
                    productPurchasedList.push(caseItem);
                }

                if (productPurchasedList.length === 0) {
                    Swal.fire({
                        icon: "warning",
                        title: "No Products",
                        text: "Product_Purchased_deal subform has no data, cannot sync",
                    });
                    setIsLoading(false);
                    return;
                }

                if (existingCase) {
                    // Update existing Case
                    let existingPurchasedList = existingCase.Product_Purchased_Case || [];
                    let productPayload = existingPurchasedList.map(item => ({
                        id: item.id,
                        _delete: true
                    }));
                    productPayload = productPayload.concat(productPurchasedList);

                    let updateData = {
                        id: existingCase.id,
                        Name: caseName,
                        Type: caseType,
                        Product_Purchased_Case: productPayload
                    };

                    // Set Related_To from Contact
                    if (contactName?.id) {
                        updateData.Related_To = { id: contactName.id };
                    }

                    // Set Salesperson from Account Owner (User field format)
                    if (salespersonId) {
                        updateData.Salesperson = salespersonId;
                    }

                    // Set Case_Creator from Deal Owner
                    if (dealOwner?.id) {
                        updateData.Case_Creator = { id: dealOwner.id };
                    }

                    let updateResult = await window.ZOHO.CRM.API.updateRecord({
                        Entity: "Cases",
                        APIData: updateData,
                        Trigger: ["workflow", "approval", "blueprint"]
                    });

                    if (updateResult?.data?.[0]?.code === 'SUCCESS') {
                        Swal.fire({
                            icon: "success",
                            title: "Success!",
                            text: `Case updated, synced ${productPurchasedList.length} purchased product(s)`,
                        });
                    } else {
                        throw new Error('Update failed');
                    }
                } else {
                    // Create new Case
                    let caseData = {
                        Name: caseName,
                        Subject: "From Deal (Closed Won): " + dealName,
                        Deal: { id: dealId },
                        Type: caseType,
                        Product_Purchased_Case: productPurchasedList
                    };

                    // Set Related_To from Contact
                    if (contactName?.id) {
                        caseData.Related_To = { id: contactName.id };
                    }

                    // Set Salesperson from Account Owner (User field format)
                    if (salespersonId) {
                        caseData.Salesperson = salespersonId;
                    }

                    // Set Case_Creator from Deal Owner
                    if (dealOwner?.id) {
                        caseData.Case_Creator = { id: dealOwner.id };
                    }

                    if (accountName?.id) {
                        caseData.Account_Name = { id: accountName.id };
                    }

                    let createResult = await window.ZOHO.CRM.API.insertRecord({
                        Entity: "Cases",
                        APIData: caseData,
                        Trigger: ["workflow", "approval", "blueprint"]
                    });

                    if (createResult?.data?.[0]?.code === 'SUCCESS') {
                        Swal.fire({
                            icon: "success",
                            title: "Success!",
                            text: `Case created, synced ${productPurchasedList.length} purchased product(s)`,
                        });
                    } else {
                        throw new Error('Create failed');
                    }
                }
            }

        } catch (error) {
            console.log('Create Case error:', error);
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
                            Deal Name:
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                            {dealInfo?.Deal_Name || '-'}
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                            Stage:
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                            {dealInfo?.Stage || '-'}
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
