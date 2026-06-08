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
    TextField,
    Autocomplete,
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

const STATUS_OPTIONS = [
    { value: 'New', label: 'New' },
    { value: 'Waiting for Parts/ Prep', label: 'Waiting for Parts/ Prep' },
    { value: 'Processing', label: 'Processing' },
    { value: 'Validate/ Verify', label: 'Validate/ Verify' },
    { value: 'Closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = [
    { value: 'High', label: 'High' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Low', label: 'Low' },
];

const App = (props) => {
    const [isLoading, setIsLoading] = useState(false);
    const [dealInfo, setDealInfo] = useState({});
    const [caseType, setCaseType] = useState('');
    const [caseCreationDate, setCaseCreationDate] = useState('');
    const [caseOwner, setCaseOwner] = useState(null);
    const [ownerOptions, setOwnerOptions] = useState([]);
    const [status, setStatus] = useState('');
    const [priority, setPriority] = useState('');
    const [nextSteps, setNextSteps] = useState('');

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
            }

            // Load Users for Owner dropdown
            try {
                let userResult = await window.ZOHO.CRM.API.getAllUsers({
                    Type: "ActiveUsers"
                });
                if (userResult?.users) {
                    setOwnerOptions(userResult.users);
                }
            } catch (e) {
                console.log('Failed to load users:', e);
            }

            // Set default date to today
            const today = new Date().toISOString().split('T')[0];
            setCaseCreationDate(today);

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

        if (!caseOwner) {
            Swal.fire({
                icon: "warning",
                title: "Required",
                text: "Please select a Case Owner",
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

                // Create new Case
                let caseData = {
                    Name: caseName,
                    Subject: "From Deal: " + dealName,
                    Deal: { id: dealId },
                    Type: caseType,
                    Product_Interest_Case: productInterestedCaseList
                };

                // Set Case_Creation_Date
                if (caseCreationDate) {
                    caseData.Case_Creation_Date = caseCreationDate;
                }

                // Set Owner (User field)
                if (caseOwner?.id) {
                    caseData.Owner = caseOwner.id;
                }

                // Set Status
                if (status) {
                    caseData.Status = status;
                }

                // Set Priority
                if (priority) {
                    caseData.Priority = priority;
                }

                // Set Next_Step
                if (nextSteps) {
                    caseData.Next_Step = nextSteps;
                }

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
                    }).then(() => {
                        window.ZOHO.CRM.UI.Popup.closeReload();
                    });
                } else {
                    throw new Error('Create failed');
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
                    // Sync warranty and serial number fields
                    if (item.Serial_Number) {
                        caseItem.Serial_Number = item.Serial_Number;
                    }
                    if (item.Warranty_Start_Date) {
                        caseItem.Warranty_Start_Date = item.Warranty_Start_Date;
                    }
                    if (item.Warranty_End_Date) {
                        caseItem.Warranty_End_Date = item.Warranty_End_Date;
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

                // Create new Case
                let caseData = {
                    Name: caseName,
                    Subject: "From Deal (Closed Won): " + dealName,
                    Deal: { id: dealId },
                    Type: caseType,
                    Product_Purchased_Case: productPurchasedList
                };

                // Set Case_Creation_Date
                if (caseCreationDate) {
                    caseData.Case_Creation_Date = caseCreationDate;
                }

                // Set Owner (User field)
                if (caseOwner?.id) {
                    caseData.Owner = caseOwner.id;
                }

                // Set Status
                if (status) {
                    caseData.Status = status;
                }

                // Set Priority
                if (priority) {
                    caseData.Priority = priority;
                }

                // Set Next_Step
                if (nextSteps) {
                    caseData.Next_Step = nextSteps;
                }

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
                    }).then(() => {
                        window.ZOHO.CRM.UI.Popup.closeReload();
                    });
                } else {
                    throw new Error('Create failed');
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
        <Box sx={{ padding: 3, width: 450 }}>
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
                        <Typography variant="body1">
                            {dealInfo?.Deal_Name || '-'}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Stage:
                        </Typography>
                        <Typography variant="body1">
                            {dealInfo?.Stage || '-'}
                        </Typography>
                    </Paper>

                    <FormControl fullWidth required>
                        <InputLabel>Case Type</InputLabel>
                        <Select
                            value={caseType}
                            label="Case Type"
                            onChange={(e) => setCaseType(e.target.value)}
                        >
                            {CASE_TYPE_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        label="Case Creation Date"
                        type="date"
                        value={caseCreationDate}
                        onChange={(e) => setCaseCreationDate(e.target.value)}
                        InputLabelProps={{
                            shrink: true,
                        }}
                        fullWidth
                    />

                    <Autocomplete
                        options={ownerOptions}
                        getOptionLabel={(option) => option?.full_name || option?.name || ''}
                        value={caseOwner}
                        onChange={(e, newValue) => setCaseOwner(newValue)}
                        renderInput={(params) => (
                            <TextField {...params} label="Case Owner" required />
                        )}
                        isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    />

                    <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                            value={status}
                            label="Status"
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            {STATUS_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth>
                        <InputLabel>Priority</InputLabel>
                        <Select
                            value={priority}
                            label="Priority"
                            onChange={(e) => setPriority(e.target.value)}
                        >
                            {PRIORITY_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        label="Next Steps"
                        value={nextSteps}
                        onChange={(e) => setNextSteps(e.target.value)}
                        fullWidth
                    />

                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleCreateCase}
                        disabled={!caseType || !caseOwner}
                    >
                        CREATE CASE
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
