import { useState } from 'react';

/**
 * Quản lý trạng thái Toast dùng chung: showToast(ok, err) + toastProps cho <Toast/>.
 * Thay pattern showMsg lặp lại ở từng trang.
 */
export function useToast() {
  const [msg, setMsg] = useState('');
  const [msgError, setMsgError] = useState('');

  const showToast = (ok: string, err?: unknown) => {
    setMsg(ok);
    setMsgError(err ? `Lỗi: ${(err as Error).message}` : '');
  };

  return {
    showToast,
    toastProps: {
      message: msg,
      error: msgError,
      onClose: () => {
        setMsg('');
        setMsgError('');
      },
    },
  };
}
