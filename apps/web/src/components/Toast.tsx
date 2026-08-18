import { Alert, Snackbar } from '@mui/material';

/**
 * Toast hiển thị message success/error ở top-center — dùng chung cho các trang.
 */
export default function Toast({
  message,
  error,
  onClose,
}: {
  message: string;
  error: string;
  onClose: () => void;
}) {
  const open = !!message || !!error;
  return (
    <Snackbar
      open={open}
      autoHideDuration={4000}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert severity={error ? 'error' : 'success'} variant="filled" onClose={onClose}>
        {error || message}
      </Alert>
    </Snackbar>
  );
}
