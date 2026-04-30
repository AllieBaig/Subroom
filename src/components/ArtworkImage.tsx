import { useState } from 'react';
import { Music } from 'lucide-react';

interface ArtworkImageProps {
  src?: string;
  className?: string;
  iconSize?: number;
}

export const ArtworkImage = ({ src, className, iconSize = 20 }: ArtworkImageProps) => {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={`flex items-center justify-center bg-secondary-system-background ${className}`}>
        <Music size={iconSize} className="text-system-tertiary-label" />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      className={`object-cover ${className}`} 
      onError={() => setError(true)}
      referrerPolicy="no-referrer"
      loading="lazy"
    />
  );
};
