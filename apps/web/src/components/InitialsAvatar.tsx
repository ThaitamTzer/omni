import { Avatar } from '@mui/material';
import { Person } from '@mui/icons-material';
import { initials, avatarColor } from '@/lib/utils/avatar';

export default function InitialsAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const text = initials(name);
  return (
    <Avatar sx={{ width: size, height: size, bgcolor: text ? avatarColor(name) : '#d3d9e3', fontSize: size * 0.4 }}>
      {text || <Person fontSize={size >= 40 ? 'small' : 'inherit'} />}
    </Avatar>
  );
}
