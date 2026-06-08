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
    const [leadInfo, setLeadInfo] = useState({});
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

            // Get Lead record
            let leadResult = await window.ZOHO.CRM.API.getRecord({
                Entity: entity,
                approved: "both",
                RecordID: entityId
            });

            if (Array.isArray(leadResult?.data) && leadResult?.data?.length > 0) {
                let leadData = leadResult.data[0];
                setLeadInfo(leadData);
            }

            // Load Users for Owner dropdown
            try {
                let userResult = await window.ZOHO.CRM.API.getAllUsers({
                    Type: "ActiveUsers"
                });
                console.log('User result:', userResult);
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

            // Get Lead full data (including subforms)
            let leadFullData = await window.ZOHO.CRM.API.getRecord({
                Entity: "Leads",
                approved: "both",
                RecordID: leadId
            });

            // Get Lead Owner as Case_Creator
            let leadOwner = leadInfo?.Owner;

            // Query Account
            let accountId = null;
            let salespersonId = null;

            let leadData = leadFullData?.data?.[0] || leadInfo;

            if (leadData?.Account_Name?.id) {
                accountId = leadData.Account_Name.id;
            }

            // If no Account_Name, try to find Account by Lead field
            if (!accountId) {
                try {
                    let accountSql = `select id, Account_Name, Owner from Accounts where Lead = ${leadId}`;
                    let config = { select_query: accountSql };
                    let accountResult = await window.ZOHO.CRM.API.coql(config);
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
                    console.log('Failed to get Account Owner:', e);
                }
            }

            // Query Contact
            let contactId = null;
            if (leadData?.Contact_Name?.id) {
                contactId = leadData.Contact_Name.id;
            } else {
                try {
                    let contactSql = `select id from Contacts where (Email = '${leadEmail}' or Phone = '${leadPhone}')`;
                    let config = { select_query: contactSql };
                    let contactResult = await window.ZOHO.CRM.API.coql(config);
                    if (contactResult?.data?.length > 0) {
                        contactId = contactResult.data[0].id;
                    }
                } catch (e) {
                    console.log('Failed to query Contact:', e);
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

            // Create new Case
            let caseData = {
                Name: caseName,
                Subject: "From Lead: " + leadName,
                Lead: { id: leadId },
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

            let createResult = await window.ZOHO.CRM.API.insertRecord({
                Entity: "Cases",
                APIData: caseData,
                Trigger: ["workflow", "approval", "blueprint"]
            });

            if (createResult?.data?.[0]?.code === 'SUCCESS') {
                Swal.fire({
                    icon: "success",
                    title: "Success!",
                    text: `Case created, synced ${productInterestedCaseList.length} products`,
                }).then(() => {
                    window.ZOHO.CRM.UI.Popup.closeReload();
                });
            } else {
                throw new Error('Create failed');
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
                            Lead Name:
                        </Typography>
                        <Typography variant="body1">
                            {leadInfo?.Full_Name || leadInfo?.Name || '-'}
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
