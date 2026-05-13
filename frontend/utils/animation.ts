export const getAnimationProps = (reducedMotion: boolean) => {
  if (reducedMotion) {
    return {
      initial: false,
      animate: false,
      whileHover: false,
      whileTap: false,
      transition: { duration: 0 }
    };
  }
  return {};
};

export const springConfig = (reducedMotion: boolean) => {
  if (reducedMotion) return { type: 'tween', duration: 0 };
  return { type: 'spring', stiffness: 400, damping: 30 };
};
