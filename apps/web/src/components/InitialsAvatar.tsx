import { Avatar } from '@mui/material';
import { Person } from '@mui/icons-material';

const AVATAR_COLORS = ['#2563eb', '#6d28d9', '#0e7490', '#b45309', '#be185d', '#047857'];

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function InitialsAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const text = initials(name);
  return (
    <Avatar sx={{ width: size, height: size, bgcolor: text ? avatarColor(name) : '#d3d9e3', fontSize: size * 0.4 }}>
      {text || <Person fontSize={size >= 40 ? 'small' : 'inherit'} />}
    </Avatar>
  );
}
