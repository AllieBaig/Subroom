import React, { useRef, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

interface PickerItemData {
  id: string | number;
  label: string;
}

interface PickerWheelProps {
  items: PickerItemData[];
  selectedValue: string | number;
  onValueChange: (value: any) => void;
  height?: number;
  itemHeight?: number;
}

export function PickerWheel({ 
  items, 
  selectedValue, 
  onValueChange, 
  height = 200, 
  itemHeight = 44 
}: PickerWheelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollY = useMotionValue(0);
  
  const selectedIndex = items.findIndex(item => item.id === selectedValue);
  const targetY = -selectedIndex * itemHeight;

  // Use a spring for smooth scrolling
  const springY = useSpring(scrollY, {
    stiffness: 400,
    damping: 40,
    mass: 1
  });

  useEffect(() => {
    scrollY.set(targetY);
  }, [targetY, scrollY, selectedValue]); // Added selectedValue to dependency array

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const currentY = scrollY.get();
    const nearestIdx = Math.round(-currentY / itemHeight);
    const newIdx = nearestIdx + (e.deltaY > 0 ? 1 : -1);
    const clampedIdx = Math.max(0, Math.min(items.length - 1, newIdx));
    onValueChange(items[clampedIdx].id);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const startY = e.touches[0].clientY;
    const startScroll = scrollY.get();

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const deltaY = moveEvent.touches[0].clientY - startY;
      scrollY.set(startScroll + deltaY);
    };

    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      
      const finalY = scrollY.get();
      const nearestIdx = Math.round(-finalY / itemHeight);
      const clampedIdx = Math.max(0, Math.min(items.length - 1, nearestIdx));
      onValueChange(items[clampedIdx].id);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full overflow-hidden bg-system-background rounded-3xl border border-apple-border shadow-inner touch-none"
      style={{ height }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
    >
      {/* Selector highlight */}
      <div 
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 bg-secondary-system-background/30 border-y border-apple-border pointer-events-none z-10"
        style={{ height: itemHeight }}
      />

      <motion.div 
        className="flex flex-col items-center"
        style={{ y: springY, paddingTop: height / 2 - itemHeight / 2 }}
      >
        {items.map((item, index) => {
          const itemY = index * itemHeight;
          // Calculate distance from center for scaling/fading
          return (
            <PickerItem 
              key={item.id} 
              item={item} 
              index={index} 
              scrollY={springY} 
              centerOffset={height / 2 - itemHeight / 2}
              itemHeight={itemHeight}
            />
          );
        })}
      </motion.div>
    </div>
  );
}

function PickerItem({ item, index, scrollY, centerOffset, itemHeight }: any) {
  const y = index * itemHeight;
  
  // Custom transform logic to fade and scale items based on their distance from center
  const distance = useTransform(scrollY, (val: any) => Math.abs((val as number) + y));
  const opacity = useTransform(distance, [0, itemHeight, itemHeight * 2], [1, 0.4, 0.1]);
  const scale = useTransform(distance, [0, itemHeight * 2], [1, 0.85]);
  const rotateX = useTransform(distance, [0, itemHeight * 2], [0, 45]);

  return (
    <motion.div
      style={{ 
        height: itemHeight,
        opacity,
        scale,
        rotateX,
        perspective: 1000
      }}
      className="flex items-center justify-center w-full px-4"
    >
      <span className="text-[14px] font-bold text-system-label truncate uppercase tracking-widest">
        {item.label}
      </span>
    </motion.div>
  );
}
