import { Box } from '@mui/material';
import { SmartToy } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { MessageDto } from '@omni/shared';

function formatTime(d: string | Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ message }: { message: MessageDto }) {
  const { t } = useTranslation();
  const isCustomer = message.senderType === 'CUSTOMER';
  const isAgent = message.senderType === 'AGENT';
  const isStaff = message.senderType === 'STAFF';

  return (
    <Box sx={{ display: 'flex', justifyContent: isCustomer ? 'flex-start' : 'flex-end' }}>
      <Box
        sx={{
          maxWidth: '68%',
          px: 1.25,
          py: 0.75,
          borderRadius: 1,
          border: '1px solid',
          borderColor: isCustomer ? '#d8dce2' : isStaff ? '#9cc0f8' : '#cabffd',
          bgcolor: isCustomer ? '#f3f4f6' : isStaff ? '#dbeafe' : '#ede9fe',
          fontSize: 13.5,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <Box
          sx={{
            fontSize: 11,
            fontWeight: 600,
            mb: 0.25,
            color: isCustomer ? 'text.secondary' : isStaff ? '#1d4ed8' : '#6d28d9',
          }}
        >
          {isCustomer ? t('inbox.customer') : isStaff ? t('inbox.staff') : 'AI'}
        </Box>
        {message.text ?? t('inbox.imageAttachment')}
        <Box
          sx={{
            fontSize: 10.5,
            color: 'text.secondary',
            mt: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            justifyContent: isCustomer ? 'flex-start' : 'flex-end',
          }}
        >
          {isAgent && <SmartToy sx={{ fontSize: 11 }} />}
          {formatTime(message.createdAt)}
        </Box>
      </Box>
    </Box>
  );
}
