import React, { useCallback, useEffect, useState } from "react";
import {
    Button,
    Typography,
    Box,
    Stack,
    CircularProgress,
    Checkbox,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Paper,
    FormHelperText,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import Swal from 'sweetalert2';
import dayjs from "dayjs";
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

const FREIGHT_TYPES = [
    { value: 'Monthly Sea Freight', label: 'Monthly Sea Freight' },
    { value: 'Monthly Air Freight', label: 'Monthly Air Freight' },
    { value: 'Expedited Air Freight', label: 'Expedited Air Freight' },
];

const DESTINATIONS_ALL = [
    { value: 'End Customer', label: 'End Customer' },
    { value: 'BP Warehouse', label: 'BP Warehouse' },
    { value: 'CM Office', label: 'CM Office' },
];

const DESTINATIONS_AIR_ONLY = [
    { value: 'BP Warehouse', label: 'BP Warehouse' },
    { value: 'CM Office', label: 'CM Office' },
];

const ORGANIZATION_ID = '920286948';
const VENDOR_ID = '8915132000000099002';

// Format date to YYYY-MM-DD
const formatDateForBooks = (date) => {
    if (!date) return '';
    return dayjs(date).format('YYYY-MM-DD');
};

const App = (props) => {
    const [isLoading, setIsLoading] = useState(false);
    const [dealInfo, setDealInfo] = useState({});
    const [productInterestList, setProductInterestList] = useState([]);
    const [selectedProductIds, setSelectedProductIds] = useState(new Set());
    const [confirmed, setConfirmed] = useState(false);

    const [freightType, setFreightType] = useState('');
    const [destination, setDestination] = useState('');
    const [specialModification, setSpecialModification] = useState('');
    const [estimatedPOTime, setEstimatedPOTime] = useState(null);
    const [latestArrivalDate, setLatestArrivalDate] = useState(null);
    const [remarks, setRemarks] = useState('');

    const [customerStreet, setCustomerStreet] = useState('');
    const [customerState, setCustomerState] = useState('');
    const [customerCountry, setCustomerCountry] = useState('');
    const [customerZipCode, setCustomerZipCode] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [customerAccount, setCustomerAccount] = useState('');

    // Contacts and Accounts dropdown lists
    const [contactList, setContactList] = useState([]);
    const [accountList, setAccountList] = useState([]);

    const [errors, setErrors] = useState({});

    const availableDestinations = freightType === 'Monthly Air Freight'
        ? DESTINATIONS_AIR_ONLY
        : DESTINATIONS_ALL;

    const showEndCustomerFields = destination === 'End Customer';
    const isLatestArrivalDateReadOnly = freightType === 'Monthly Sea Freight' || freightType === 'Monthly Air Freight';

    const getLatestArrivalTips = () => {
        if (freightType === 'Monthly Sea Freight') {
            return '⚠️ If this arrival date is not acceptable, please consider selecting Air Freight options instead.';
        }
        if (freightType === 'Monthly Air Freight') {
            return '⚠️ If this arrival date is not acceptable, please consider selecting Expedited Air Freight instead.';
        }
        return '';
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            let entityId = props?.data?.EntityId?.[0];
            let entity = props?.data?.Entity;

            let dealResult = await window.ZOHO.CRM.API.getRecord({
                Entity: entity,
                approved: "both",
                RecordID: entityId
            });

            if (Array.isArray(dealResult?.data) && dealResult?.data?.length > 0) {
                let dealData = dealResult.data[0];
                setDealInfo(dealData);

                // Check if PO already created
                if (dealData?.IsConvertedPO) {
                    Swal.fire({
                        icon: "warning",
                        title: "PO Already Created",
                        text: "A Purchase Order has already been generated for this Deal.",
                    }).then(() => {
                        window.ZOHO.CRM.UI.Popup.close();
                    });
                    return;
                }

                let probability = dealData?.Probability || 0;
                if (probability < 75) {
                    Swal.fire({
                        icon: "warning",
                        title: "Cannot Generate PO",
                        text: `Deal probability must be at least 75%. Current: ${probability}%`,
                    }).then(() => {
                        window.ZOHO.CRM.UI.Popup.close();
                    });
                    return;
                }

                const result = await Swal.fire({
                    title: "Generate PO to China",
                    text: "Do you want to generate a Purchase Order to China?",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonText: "Yes",
                    cancelButtonText: "No",
                });

                if (!result.isConfirmed) {
                    window.ZOHO.CRM.UI.Popup.close();
                    return;
                }

                setConfirmed(true);
                let productInterestData = dealData?.Product_Interested_deal || [];
                setProductInterestList(productInterestData);

                // Set default selected products based on Converted_To_Sales
                let defaultSelectedIds = new Set();
                productInterestData.forEach(item => {
                    if (item.Converted_To_Sales === true || item.Converted_To_Sales === 'true') {
                        defaultSelectedIds.add(item.id);
                    }
                });
                setSelectedProductIds(defaultSelectedIds);

                // Get Contacts under the Account associated with this Deal
                let accountId = dealData?.Account_Name?.id;
                if (accountId) {
                    // Get all Contacts of this Account
                    let contactsResult = await window.ZOHO.CRM.API.getRelatedRecords({
                        Entity: "Accounts",
                        RecordID: accountId,
                        RelatedList: "Contacts",
                    });
                    if (contactsResult?.data) {
                        setContactList(contactsResult.data);
                    }

                    // Set default Account
                    setAccountList([{
                        id: accountId,
                        Account_Name: dealData?.Account_Name?.name || ''
                    }]);
                    setCustomerAccount(accountId);
                }

                // Set default Contact from Deal's Contact_Name
                let dealContactId = dealData?.Contact_Name?.id;
                if (dealContactId) {
                    setCustomerContact(dealContactId);
                }
            }
        } catch (error) {
            console.log(`fetchData error: ${error}`);
        } finally {
            setIsLoading(false);
        }
    }, [props]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (freightType === 'Monthly Sea Freight') {
            setLatestArrivalDate(dayjs().add(60, 'day'));
        } else if (freightType === 'Monthly Air Freight') {
            setLatestArrivalDate(dayjs().add(35, 'day'));
        } else {
            setLatestArrivalDate(null);
        }
        setDestination('');
    }, [freightType]);

    const handleProductSelect = (productId) => {
        setSelectedProductIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(productId)) {
                newSet.delete(productId);
            } else {
                newSet.add(productId);
            }
            return newSet;
        });
    };

    const validateForm = () => {
        const newErrors = {};
        if (!freightType) newErrors.freightType = 'Freight Type is required';
        if (!destination) newErrors.destination = 'Destination is required';
        if (selectedProductIds.size === 0) newErrors.products = 'At least one product is required';
        if (!estimatedPOTime) newErrors.estimatedPOTime = 'Estimated PO Time is required';
        if (!latestArrivalDate) newErrors.latestArrivalDate = 'Latest Arrival Date is required';

        if (showEndCustomerFields) {
            if (!customerStreet) newErrors.customerStreet = 'Customer Street is required';
            if (!customerState) newErrors.customerState = 'Customer State is required';
            if (!customerCountry) newErrors.customerCountry = 'Customer Country is required';
            if (!customerZipCode) newErrors.customerZipCode = 'Customer Zip Code is required';
            if (!customerContact) newErrors.customerContact = 'Customer Contact is required';
            if (!customerAccount) newErrors.customerAccount = 'Customer Account is required';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            Swal.fire({
                icon: "error",
                title: "Validation Error",
                text: "Please fill in all required fields.",
            });
            return;
        }

        setIsLoading(true);
        try {
            const selectedProducts = productInterestList.filter(item => selectedProductIds.has(item.id));

            // Search Books Item ID by CRM product name
            const lineItems = [];
            for (const product of selectedProducts) {
                const productName = product?.Product_Name?.name;
                if (!productName) continue;

                // Search corresponding Item in Books
                let searchReq = {
                    headers: {},
                    method: "GET",
                    url: `https://www.zohoapis.com/books/v3/items?organization_id=${ORGANIZATION_ID}&name=${encodeURIComponent(productName)}`,
                    param_type: 1,
                };

                let searchResult = await window.ZOHO.CRM.CONNECTION.invoke("books", searchReq);
                console.log(`Search result for "${productName}":`, searchResult);

                let booksItems = searchResult?.details?.statusMessage?.items || [];
                let matchedItem = booksItems.find(item => item.name === productName) || booksItems[0];

                if (matchedItem?.item_id) {
                    lineItems.push({
                        item_id: matchedItem.item_id,
                        description: product?.comments || '',
                        quantity: 1,
                    });
                } else {
                    console.warn(`Product "${productName}" not found in Books`);
                }
            }

            if (lineItems.length === 0) {
                throw new Error('No matching products found in Zoho Books. Please ensure products are synced.');
            }

            // Build custom fields array
            // External Lookup fields require label, value, value_formatted
            const customFields = [
                // Normal fields use api_name
                { api_name: 'cf_freight_type', value: freightType },
                { api_name: 'cf_destination', value: destination },
                { api_name: 'cf_special_modification', value: specialModification },
                { api_name: 'cf_estimated_po_time', value: formatDateForBooks(estimatedPOTime) },
                { api_name: 'cf_latest_arrival_date', value: formatDateForBooks(latestArrivalDate) },
                { api_name: 'cf_remarks', value: remarks },

                // External Lookup field - Deal
                {
                    label: "Deal Name",
                    value: dealInfo?.id || '',
                    value_formatted: dealInfo?.Deal_Name || ''
                },
            ];

            // End Customer additional fields
            if (showEndCustomerFields) {
                customFields.push(
                    { api_name: 'cf_customer_street', value: customerStreet },
                    { api_name: 'cf_customer_state', value: customerState },
                    { api_name: 'cf_customer_country', value: customerCountry },
                    { api_name: 'cf_customer_zip_code', value: customerZipCode },

                    // External Lookup field - Contact
                    {
                        label: "Contact",
                        value: customerContact || '',
                        value_formatted: contactList.find(c => c.id === customerContact)?.Full_Name || ''
                    },

                    // External Lookup field - Account
                    {
                        label: "Account",
                        value: customerAccount || '',
                        value_formatted: accountList.find(a => a.id === customerAccount)?.Account_Name || ''
                    }
                );
            }

            // Build data in Zoho Books API format (including custom fields)
            const poData = {
                vendor_id: VENDOR_ID,
                date: formatDateForBooks(dayjs()),
                reference_number: dealInfo?.Deal_Name || '',
                notes: remarks,
                line_items: lineItems,
                custom_fields: customFields,
            };

            // Convert entire object to JSON string
            const jsonString = JSON.stringify(poData);

            let req_data = {
                headers: {},
                method: "POST",
                url: `https://www.zohoapis.com/books/v3/purchaseorders?organization_id=${ORGANIZATION_ID}`,
                param_type: 1,
                parameters: {
                    JSONString: jsonString
                },
            };

            let result = await window.ZOHO.CRM.CONNECTION.invoke("books", req_data);
            console.log('PO Creation Result:', result);

            // Check API response
            let response = result?.details?.statusMessage;
            if (response?.code === 0 || response?.purchaseorder) {
                let poId = response?.purchaseorder?.purchaseorder_id;
                let poNumber = response?.purchaseorder?.purchaseorder_number;

                // Update Deal to mark as converted
                let updateDealData = {
                    "data": [{
                        id: dealInfo?.id,
                        IsConvertedPO: true,
                    }],
                    "trigger": []
                };
                await window.ZOHO.CRM.API.updateRecord({
                    Entity: "Deals",
                    APIData: updateDealData.data[0],
                    Trigger: []
                });

                Swal.fire({
                    icon: "success",
                    title: "PO Created Successfully!",
                    html: `PO Number: ${poNumber}<br/>
                           <a href="https://books.zoho.com/app/${ORGANIZATION_ID}#/purchaseorders/${poId}" target="_blank">View in Zoho Books</a>`,
                }).then(() => {
                    window.ZOHO.CRM.UI.Popup.closeReload();
                });
            } else {
                let errorMsg = response?.message || result?.message || 'Failed to create PO';
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.log(`Error creating PO: ${error}`);
            Swal.fire({
                icon: 'error',
                title: 'PO Creation Failed!',
                text: `${error}`,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                    <CircularProgress />
                </Box>
            ) : !confirmed ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                    <Typography>Loading...</Typography>
                </Box>
            ) : (
                <Box sx={{ padding: 2, width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Deal: {dealInfo?.Deal_Name}
                    </Typography>

                    {/* Shipping Information */}
                    <Paper sx={{ p: 2, mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                            Shipping Information
                        </Typography>
                        <Stack spacing={2}>
                            <FormControl fullWidth error={!!errors.freightType}>
                                <InputLabel>Freight Type *</InputLabel>
                                <Select
                                    value={freightType}
                                    label="Freight Type *"
                                    onChange={(e) => setFreightType(e.target.value)}
                                >
                                    {FREIGHT_TYPES.map(option => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                                {errors.freightType && <FormHelperText>{errors.freightType}</FormHelperText>}
                            </FormControl>

                            <FormControl fullWidth error={!!errors.destination}>
                                <InputLabel>Destination *</InputLabel>
                                <Select
                                    value={destination}
                                    label="Destination *"
                                    onChange={(e) => setDestination(e.target.value)}
                                    disabled={!freightType}
                                >
                                    {availableDestinations.map(option => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                                {errors.destination && <FormHelperText>{errors.destination}</FormHelperText>}
                            </FormControl>
                        </Stack>
                    </Paper>

                    {/* PO Details */}
                    <Paper sx={{ p: 2, mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                            PO Details
                        </Typography>
                        <Stack spacing={2}>
                            <TextField
                                fullWidth
                                label="Deal Name"
                                value={dealInfo?.Deal_Name || ''}
                                disabled
                                size="small"
                            />

                            <Box>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                    Purchase Product *
                                </Typography>
                                {errors.products && (
                                    <Typography variant="caption" color="error" display="block" sx={{ mb: 1 }}>
                                        {errors.products}
                                    </Typography>
                                )}
                                <Paper variant="outlined" sx={{ maxHeight: 150, overflow: 'auto' }}>
                                    {productInterestList.length > 0 ? (
                                        productInterestList.map((item) => (
                                            <Box
                                                key={item.id}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    p: 1,
                                                    borderBottom: '1px solid #eee',
                                                }}
                                            >
                                                <Checkbox
                                                    checked={selectedProductIds.has(item.id)}
                                                    onChange={() => handleProductSelect(item.id)}
                                                    size="small"
                                                />
                                                <Typography variant="body2">
                                                    {item?.Product_Name?.name || item?.Product_Name?.id || 'Unknown Product'}
                                                </Typography>
                                            </Box>
                                        ))
                                    ) : (
                                        <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                                            No products found.
                                        </Typography>
                                    )}
                                </Paper>
                            </Box>

                            <TextField
                                fullWidth
                                label="Special Modification (if any)"
                                multiline
                                rows={2}
                                value={specialModification}
                                onChange={(e) => setSpecialModification(e.target.value)}
                                size="small"
                            />

                            <DatePicker
                                label="Estimated PO Time *"
                                value={estimatedPOTime ? dayjs(estimatedPOTime) : null}
                                onChange={(newDate) => setEstimatedPOTime(newDate)}
                                format="YYYY-MM-DD"
                                slotProps={{
                                    textField: {
                                        fullWidth: true,
                                        size: "small",
                                        error: !!errors.estimatedPOTime,
                                        helperText: errors.estimatedPOTime,
                                    }
                                }}
                            />

                            <Box>
                                <DatePicker
                                    label="Latest Arrival Date to Destination *"
                                    value={latestArrivalDate ? dayjs(latestArrivalDate) : null}
                                    onChange={(newDate) => setLatestArrivalDate(newDate)}
                                    readOnly={isLatestArrivalDateReadOnly}
                                    format="YYYY-MM-DD"
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            size: "small",
                                            error: !!errors.latestArrivalDate,
                                            helperText: errors.latestArrivalDate,
                                        }
                                    }}
                                />
                                {getLatestArrivalTips() && (
                                    <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                                        {getLatestArrivalTips()}
                                    </Typography>
                                )}
                            </Box>

                            <TextField
                                fullWidth
                                label="Remarks"
                                multiline
                                rows={2}
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                size="small"
                            />
                        </Stack>
                    </Paper>

                    {/* End Customer Information */}
                    {showEndCustomerFields && (
                        <Paper sx={{ p: 2, mb: 2 }}>
                            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
                                End Customer Information
                            </Typography>
                            <Stack spacing={2}>
                                <TextField
                                    fullWidth
                                    label="Customer Street *"
                                    value={customerStreet}
                                    onChange={(e) => setCustomerStreet(e.target.value)}
                                    size="small"
                                    error={!!errors.customerStreet}
                                    helperText={errors.customerStreet}
                                />
                                <TextField
                                    fullWidth
                                    label="Customer State *"
                                    value={customerState}
                                    onChange={(e) => setCustomerState(e.target.value)}
                                    size="small"
                                    error={!!errors.customerState}
                                    helperText={errors.customerState}
                                />
                                <TextField
                                    fullWidth
                                    label="Customer Country *"
                                    value={customerCountry}
                                    onChange={(e) => setCustomerCountry(e.target.value)}
                                    size="small"
                                    error={!!errors.customerCountry}
                                    helperText={errors.customerCountry}
                                />
                                <TextField
                                    fullWidth
                                    label="Customer Zip Code *"
                                    value={customerZipCode}
                                    onChange={(e) => setCustomerZipCode(e.target.value)}
                                    size="small"
                                    error={!!errors.customerZipCode}
                                    helperText={errors.customerZipCode}
                                />
                                <FormControl fullWidth error={!!errors.customerContact}>
                                    <InputLabel>Customer Contact *</InputLabel>
                                    <Select
                                        value={customerContact}
                                        label="Customer Contact *"
                                        onChange={(e) => setCustomerContact(e.target.value)}
                                    >
                                        <MenuItem value="">-- Select Contact --</MenuItem>
                                        {contactList.map(contact => (
                                            <MenuItem key={contact.id} value={contact.id}>
                                                {contact.Full_Name || contact.Last_Name || contact.Email || contact.id}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    {errors.customerContact && <FormHelperText>{errors.customerContact}</FormHelperText>}
                                </FormControl>
                                <FormControl fullWidth error={!!errors.customerAccount}>
                                    <InputLabel>Customer Account *</InputLabel>
                                    <Select
                                        value={customerAccount}
                                        label="Customer Account *"
                                        onChange={(e) => setCustomerAccount(e.target.value)}
                                    >
                                        <MenuItem value="">-- Select Account --</MenuItem>
                                        {accountList.map(account => (
                                            <MenuItem key={account.id} value={account.id}>
                                                {account.Account_Name || account.id}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    {errors.customerAccount && <FormHelperText>{errors.customerAccount}</FormHelperText>}
                                </FormControl>
                            </Stack>
                        </Paper>
                    )}

                    <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                        <Button variant="contained" color="primary" onClick={handleSubmit}>
                            SUBMIT
                        </Button>
                        <Button
                            variant="outlined"
                            color="secondary"
                            onClick={() => window.ZOHO.CRM.UI.Popup.close()}
                        >
                            CANCEL
                        </Button>
                    </Stack>
                </Box>
            )}
        </LocalizationProvider>
    );
};

export default App;
