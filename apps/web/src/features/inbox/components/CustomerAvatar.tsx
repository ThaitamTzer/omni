import { useState } from 'react';
import { Avatar } from '@mui/material';
import InitialsAvatar from '@/components/InitialsAvatar';

/**
 * Avatar cho khách hàng: hiển thị ảnh đại diện nếu có (customerAvatar),
 * fallback về initials (từ tên) khi chưa có ảnh hoặc ảnh tải lỗi.
 */
export default function CustomerAvatar({ name, avatar, size = 40 }: { name: string; avatar?: string | null; size?: number }) {
  const [imgError, setImgError] = useState(false);

  if (!avatar || imgError) {
    return <InitialsAvatar name={name} size={size} />;
  }

  return (
    <Avatar
      src={avatar}
      alt={name}
      onError={() => setImgError(true)}
      sx={{ width: size, height: size }}
    />
  );
}
