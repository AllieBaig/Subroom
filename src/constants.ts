export const FREQUENCY_PRESETS = [
  4, 4.11, 4.5, 6.3, 7.83, 13, 33, 55,
  100, 102, 103, 104, 111, 222, 396, 
  417, 432, 444, 528, 639, 741, 852, 888, 963
].sort((a, b) => a - b);

export const NATURE_SOUNDS = [
  { 
    id: 'rain', 
    name: 'Gentle Rain', 
    url: 'https://assets.mixkit.co/sfx/preview/mixkit-light-rain-loop-2393.mp3',
    icon: 'CloudRain'
  },
  { 
    id: 'ocean', 
    name: 'Ocean Waves', 
    url: 'https://assets.mixkit.co/sfx/preview/mixkit-ocean-waves-loop-1196.mp3',
    icon: 'Waves'
  },
  { 
    id: 'forest', 
    name: 'Summer Forest', 
    url: 'https://assets.mixkit.co/sfx/preview/mixkit-forest-birds-ambience-loop-1210.mp3',
    icon: 'Trees'
  },
  { 
    id: 'wind', 
    name: 'Winter Wind', 
    url: 'https://assets.mixkit.co/sfx/preview/mixkit-wind-whistle-loop-1159.mp3',
    icon: 'Wind'
  },
  {
    id: 'fire',
    name: 'Crackling Fire',
    url: 'https://assets.mixkit.co/sfx/preview/mixkit-campfire-crackling-loop-1144.mp3',
    icon: 'Flame'
  },
  {
    id: 'stream',
    name: 'Mountain Stream',
    url: 'https://assets.mixkit.co/sfx/preview/mixkit-river-flowing-water-loop-1195.mp3',
    icon: 'Droplets'
  }
];

export const AUDIO_ACCEPT_STRING = "audio/*, .mp3, .m4a, .aac, .wav, audio/mp4, audio/x-m4a, audio/mpeg, audio/wave, audio/wav, audio/x-wav, audio/aiff, audio/x-aiff";
export const SUPPORTED_AUDIO_FORMATS = ["MP3", "M4A", "AAC", "WAV"];
