import { useState, useEffect } from 'react';
import { avatarEmoji } from '../utils/avatar';

interface Props {
  user?: {
    name?: string;
    profileImage?: string | null;
    role?: string;
  } | null;
  size?: number;
  /** Set by headers that sit on the green background. */
  onDark?: boolean;
}

/** Circular profile avatar: shows the uploaded photo or a role emoji fallback. */
export function UserAvatar({ user, size = 44, onDark = true }: Props) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [user?.profileImage]);

  const circle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: size / 2,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    background: onDark ? 'rgba(255, 255, 255, 0.22)' : 'var(--brand-soft)',
    boxShadow: onDark ? '0 2px 8px rgba(0, 0, 0, 0.15)' : undefined,
  };

  if (user?.profileImage && !imgError) {
    return (
      <img
        className="user-avatar-img"
        src={user.profileImage}
        alt={user.name || 'avatar'}
        style={{ ...circle, objectFit: 'cover' }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div className="user-avatar-fallback" style={{ ...circle, fontSize: size * 0.5, color: onDark ? '#ffffff' : 'var(--brand-700)' }}>
      {avatarEmoji(user?.role)}
    </div>
  );
}

export default UserAvatar;