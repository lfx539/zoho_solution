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
    { value: 'Sample Testing', label: 'Sample Testing' },
    { value: 'Field Demo', label: 'Field Demo' },
    { value: 'Remote Demo', label: 'Remote Demo' },
    { value: 'Installation', label: 'Installation' },
    { value: 'After Sales Service - Hardware Issues', label: 'After Sales Service - Hardware Issues' },
    { value: 'After Sales Service - Software Issues', label: 'After Sales Service - Software Issues' },
    { value: 'After Sales Service - Return', label: 'After Sales Service - Return' },
    { value: 'Other', label: 'Other' },
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
                console.log('Deal Info:', dealData);

                // Check if there is an existing Case associated with this Deal
                try {
                    let searchResult = await window.ZOHO.CRM.API.searchRecord({
                        Entity: "Case_Module",
                        Type: "criteria",
                        Query: "Deal:equals:" + entityId
                    });

                    if (searchResult?.data?.length > 0) {
                        let existingCaseData = searchResult.data[0];
                        setExistingCase(existingCaseData);
                        console.log('Existing Case:', existingCaseData);
                        // If Case Type exists, show it in dropdown
                        if (existingCaseData?.Case_Type) {
                            setCaseType(existingCaseData.Case_Type);
                        }
                    }
                } catch (searchError) {
                    console.log('No existing Case found');
                }

                // If not found, try searching by Lead
                if (!existingCase && dealData?.leadIdCopy) {
                    try {
                        let searchByLead = await window.ZOHO.CRM.API.searchRecord({
                            Entity: "Case_Module",
                            Type: "criteria",
                            Query: "Lead:equals:" + dealData.leadIdCopy
                        });

                        if (searchByLead?.data?.length > 0) {
                            let existingCaseData = searchByLead.data[0];
                            setExistingCase(existingCaseData);
                            console.log('Existing Case by Lead:', existingCaseData);
                            // If Case Type exists, show it in dropdown
                            if (existingCaseData?.Case_Type) {
                                setCaseType(existingCaseData.Case_Type);
                            }
                        }
                    } catch (e) {
                        console.log('No existing Case by Lead');
                    }
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

        setIsLoading(true);
        try {
            let dealId = dealInfo?.id;
            let dealName = dealInfo?.Deal_Name || '';
            let stage = dealInfo?.Stage || '';
            let accountName = dealInfo?.Account_Name;
            let leadIdCopy = dealInfo?.leadIdCopy || '';

            // Get Deal full data (including subforms)
            let dealFullData = await window.ZOHO.CRM.API.getRecord({
                Entity: "Deals",
                approved: "both",
                RecordID: dealId
            });

            let productInterestedDeal = [];
            if (dealFullData?.data?.[0]?.Product_Interested_deal) {
                productInterestedDeal = dealFullData.data[0].Product_Interested_deal;
            }

            console.log('Product Interested Deal:', productInterestedDeal);
            console.log('Stage:', stage);

            // Case Name = Deal Name + Case Type
            let caseName = dealName + ' - ' + caseType;

            // Decide which subform to sync based on Stage
            if (stage !== 'Closed Won') {
                // ========== Sync Product_Interested_case ==========
                let productInterestedCaseList = productInterestedDeal.map(item => {
                    let caseItem = {};
                    if (item.Product_Name?.id) {
                        caseItem.Product_Name = { id: item.Product_Name.id };
                    }
                    if (item.Comments) {
                        caseItem.Comments = item.Comments;
                    }
                    // Is_order_placed -> Converted_To_Sales
                    if (item.IsOrderPlaced !== undefined && item.IsOrderPlaced !== null) {
                        caseItem.Converted_To_Sales = item.IsOrderPlaced;
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
                    let existingProductList = existingCase.Product_Interested_case || [];
                    let productPayload = existingProductList.map(item => ({
                        id: item.id,
                        _delete: true
                    }));
                    productPayload = productPayload.concat(productInterestedCaseList);

                    let updateData = {
                        id: existingCase.id,
                        Name: caseName,
                        Case_Type: caseType,
                        Product_Interested_case: productPayload
                    };

                    console.log('Update Case Data:', updateData);

                    let updateResult = await window.ZOHO.CRM.API.updateRecord({
                        Entity: "Case_Module",
                        APIData: updateData,
                        Trigger: ["workflow", "approval", "blueprint"]
                    });

                    console.log('Update Result:', updateResult);

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
                        Case_Type: caseType,
                        Product_Interested_case: productInterestedCaseList
                    };

                    if (leadIdCopy) {
                        caseData.Lead = { id: leadIdCopy };
                    }
                    if (accountName?.id) {
                        caseData.Account_Name = { id: accountName.id };
                    }

                    console.log('Create Case Data:', caseData);

                    let createResult = await window.ZOHO.CRM.API.insertRecord({
                        Entity: "Case_Module",
                        APIData: caseData,
                        Trigger: ["workflow", "approval", "blueprint"]
                    });

                    console.log('Create Result:', createResult);

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
                // ========== Stage = Closed Won: Sync Product_Purchased ==========
                // Get data from Deal's Product_Purchased_deal subform
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

                console.log('Product Purchased Deal:', productPurchasedDeal);
                console.log('Product Purchased List:', productPurchasedList);

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
                    let existingPurchasedList = existingCase.Product_Purchased || [];
                    let productPayload = existingPurchasedList.map(item => ({
                        id: item.id,
                        _delete: true
                    }));
                    productPayload = productPayload.concat(productPurchasedList);

                    let updateData = {
                        id: existingCase.id,
                        Name: caseName,
                        Case_Type: caseType,
                        Product_Purchased: productPayload
                    };

                    console.log('Update Case Product_Purchased Data:', updateData);

                    let updateResult = await window.ZOHO.CRM.API.updateRecord({
                        Entity: "Case_Module",
                        APIData: updateData,
                        Trigger: ["workflow", "approval", "blueprint"]
                    });

                    console.log('Update Result:', updateResult);

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
                        Case_Type: caseType,
                        Product_Purchased: productPurchasedList
                    };

                    if (leadIdCopy) {
                        caseData.Lead = { id: leadIdCopy };
                    }
                    if (accountName?.id) {
                        caseData.Account_Name = { id: accountName.id };
                    }

                    console.log('Create Case Data:', caseData);

                    let createResult = await window.ZOHO.CRM.API.insertRecord({
                        Entity: "Case_Module",
                        APIData: caseData,
                        Trigger: ["workflow", "approval", "blueprint"]
                    });

                    console.log('Create Result:', createResult);

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
