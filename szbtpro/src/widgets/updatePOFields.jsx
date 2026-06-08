import React, { useCallback, useState } from "react";
import {
    Button,
    Typography,
    Box,
    CircularProgress,
    TextField,
    Paper,
    Stack,
} from '@mui/material';
import Swal from 'sweetalert2';
import dayjs from 'dayjs';

const ORGANIZATION_ID = '920286948';

// 日期格式化
const formatDateForBooks = (date) => {
    if (!date) return '';
    return dayjs(date).format('YYYY-MM-DD');
};

const App = (props) => {
    const [isLoading, setIsLoading] = useState(false);
    const [dealInfo, setDealInfo] = useState({});
    const [contactEmail, setContactEmail] = useState('');
    const [poId, setPoId] = useState('');

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

                // 获取 Contact 的 email
                let contactId = dealData?.Contact_Name?.id;
                if (contactId) {
                    let contactResult = await window.ZOHO.CRM.API.getRecord({
                        Entity: "Contacts",
                        approved: "both",
                        RecordID: contactId
                    });
                    if (contactResult?.data?.[0]?.Email) {
                        setContactEmail(contactResult.data[0].Email);
                    }
                }
            }
        } catch (error) {
            console.log(`fetchData发生错误：${error}`);
        } finally {
            setIsLoading(false);
        }
    }, [props]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdate = async () => {
        if (!poId) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "Please enter PO ID",
            });
            return;
        }

        setIsLoading(true);
        try {
            // 获取Deal关联的Account和Contact信息
            const dealId = dealInfo?.id || '';
            const accountId = dealInfo?.Account_Name?.id || '';
            const dealName = dealInfo?.Deal_Name || '';

            console.log('=== Lookup Field Values ===');
            console.log('Deal ID:', dealId);
            console.log('Deal Name:', dealName);
            console.log('Account ID:', accountId);
            console.log('Account Name:', dealInfo?.Account_Name?.name);
            console.log('Contact ID:', dealInfo?.Contact_Name?.id);
            console.log('Contact Email:', contactEmail);

            // 构建自定义字段
            // Lookup字段直接传ID字符串（不要用对象格式）
            const customFields = [
                // Lookup外部关联字段 - 直接传CRM记录ID字符串
                { api_name: 'cf_deal_name', value: dealId },
                { api_name: 'cf_account', value: accountId },
                { api_name: 'cf_contact', value: dealInfo?.Contact_Name?.id || '' },

                // 日期字段
                { api_name: 'cf_estimated_po_time', value: formatDateForBooks(dayjs()) },

                // 其他字段 - hardcode
                { api_name: 'cf_freight_type', value: 'Monthly Sea Freight' },
                { api_name: 'cf_destination', value: 'BP Warehouse' },
                { api_name: 'cf_special_modification', value: 'Test modification' },
            ];

            console.log('Custom Fields:', JSON.stringify(customFields, null, 2));

            // External Lookup 需要三个字段: label, value, value_formatted
            const customFieldsWithExternal = [
                // Deal lookup
                {
                    label: "Deal Name",
                    value: dealId,
                    value_formatted: dealName
                },
                // Account lookup
                {
                    label: "Account",
                    value: accountId,
                    value_formatted: dealInfo?.Account_Name?.name || ''
                },
                // Contact lookup
                {
                    label: "Contact",
                    value: dealInfo?.Contact_Name?.id || '',
                    value_formatted: dealInfo?.Contact_Name?.name || ''
                },

                // 日期和其他字段用 api_name
                { api_name: 'cf_estimated_po_time', value: formatDateForBooks(dayjs()) },
                { api_name: 'cf_freight_type', value: 'Monthly Sea Freight' },
                { api_name: 'cf_destination', value: 'BP Warehouse' },
                { api_name: 'cf_special_modification', value: 'Test modification' },
            ];

            console.log('Custom Fields with External Lookup:', JSON.stringify(customFieldsWithExternal, null, 2));

            const updateData = {
                custom_fields: customFieldsWithExternal
            };

            let req_data = {
                headers: {},
                method: "PUT",
                url: `https://www.zohoapis.com/books/v3/purchaseorders/${poId}?organization_id=${ORGANIZATION_ID}`,
                param_type: 1,
                parameters: {
                    JSONString: JSON.stringify(updateData)
                },
            };

            let result = await window.ZOHO.CRM.CONNECTION.invoke("books", req_data);
            console.log('Update PO Result:', result);

            let response = result?.details?.statusMessage;
            if (response?.code === 0 || response?.purchaseorder) {
                Swal.fire({
                    icon: "success",
                    title: "Success!",
                    text: `PO ${poId} updated successfully!`,
                });
            } else {
                let errorMsg = response?.message || 'Failed to update PO';
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.log(`更新PO时发生错误：${error}`);
            Swal.fire({
                icon: 'error',
                title: 'Update Failed!',
                text: `${error}`,
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={{ padding: 3, width: 400 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
                Update PO Custom Fields
            </Typography>

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
                            Account:
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                            {dealInfo?.Account_Name?.name || '-'}
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                            Contact:
                        </Typography>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                            {dealInfo?.Contact_Name?.name || '-'}
                        </Typography>

                        <Typography variant="body2" color="text.secondary">
                            Contact Email:
                        </Typography>
                        <Typography variant="body1">
                            {contactEmail || '-'}
                        </Typography>
                    </Paper>

                    <TextField
                        fullWidth
                        label="PO ID to Update"
                        value={poId}
                        onChange={(e) => setPoId(e.target.value)}
                        size="small"
                        placeholder="Enter Books PO ID"
                    />

                    <Typography variant="body2" color="text.secondary">
                        Will update these fields:
                    </Typography>
                    <Paper sx={{ p: 1, bgcolor: '#fafafa', fontSize: 12 }}>
                        <Box>• Deal Name: {dealInfo?.Deal_Name || '-'} (ID: {dealInfo?.id || '-'})</Box>
                        <Box>• Account: {dealInfo?.Account_Name?.name || '-'} (ID: {dealInfo?.Account_Name?.id || '-'})</Box>
                        <Box>• Contact: {dealInfo?.Contact_Name?.name || '-'} (ID: {dealInfo?.Contact_Name?.id || '-'})</Box>
                        <Box>• cf_estimated_po_time: {formatDateForBooks(dayjs())}</Box>
                        <Box>• cf_freight_type: Monthly Sea Freight</Box>
                        <Box>• cf_destination: BP Warehouse</Box>
                        <Box>• cf_special_modification: Test modification</Box>
                    </Paper>

                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleUpdate}
                        disabled={!poId}
                    >
                        UPDATE PO
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
