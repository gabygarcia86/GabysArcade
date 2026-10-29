// Time-of-day moods for the scenery. Each run picks one at random (see
// Game.setupWorld). Only the backdrop and street change; the skater, Karens
// and props keep their colors so they read the same in every mood.

export const THEMES = {
  sunset: {
    sky: [[0, '#24154f'], [0.45, '#7a2f8f'], [0.78, '#ff6f91'], [1, '#ffc36b']],
    body: 'retroSun',
    cloud: 'rgba(255, 220, 240, 0.55)',
    far: '#5b3a8c',
    farLights: false,
    stars: false,
    tint: null, // wash over the mid-rise and shop sprites
    litChance: 0.55,
    litWindow: '#ffe08a',
    darkWindow: 'rgba(25,15,55,0.55)',
    shopWindow: '#9fd8ff',
    street: {
      walk: '#d4cdea', walkEdge: '#e8e2f8', walkLines: 'rgba(80,60,130,0.25)',
      curb: '#9b92bd', curbShadow: '#7d73a3', road: '#3a3360', roadSheen: 'rgba(255,255,255,0.08)',
      lampGlow: 0.15,
    },
  },

  day: {
    sky: [[0, '#2f8fe8'], [0.55, '#7cc4ff'], [1, '#d6f0ff']],
    body: 'sun',
    cloud: 'rgba(255, 255, 255, 0.9)',
    far: '#8aaed6',
    farLights: false,
    stars: false,
    tint: 'rgba(255,255,255,0.06)',
    litChance: 0.4,
    litWindow: '#d9f1ff', // sky reflected in the glass
    darkWindow: 'rgba(30,55,105,0.45)',
    shopWindow: '#b8e6ff',
    street: {
      walk: '#e4e1ec', walkEdge: '#f6f4fb', walkLines: 'rgba(90,90,130,0.22)',
      curb: '#a9a6bf', curbShadow: '#8c88a8', road: '#46445e', roadSheen: 'rgba(255,255,255,0.1)',
      lampGlow: 0,
    },
  },

  night: {
    sky: [[0, '#03061a'], [0.5, '#0d1442'], [1, '#2a2f6e']],
    body: 'moon',
    cloud: 'rgba(120, 130, 190, 0.3)',
    far: '#161b42',
    farLights: true,
    stars: true,
    tint: 'rgba(8,12,48,0.45)',
    litChance: 0.62,
    litWindow: '#ffd86b',
    darkWindow: 'rgba(5,5,25,0.7)',
    shopWindow: '#ffe2a0', // lit-up shop interiors
    street: {
      walk: '#8f8bb0', walkEdge: '#a7a3c6', walkLines: 'rgba(30,25,70,0.35)',
      curb: '#6c6890', curbShadow: '#575379', road: '#1d1a38', roadSheen: 'rgba(255,255,255,0.05)',
      lampGlow: 0.32,
    },
  },
};

export const THEME_NAMES = Object.keys(THEMES);
