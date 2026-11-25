// Static game tables: jet skis, rider items, tricks, cups, rivals, achievements and challenges.
// Everything here is plain data so balancing happens in one place.

export const MPH = 2.23694; // metres per second to miles per hour

// ---------------------------------------------------------------- Jet skis
// stats use the 1-10 scale from the design brief. shape drives the procedural model.
export const SKIS = [
  {
    id: 'paradise100', name: 'Paradise 100', price: 0,
    stats: { speed: 5, handling: 5, accel: 5, stability: 5 },
    desc: 'A friendly two-seater that forgives every mistake. Perfect for your first wave.',
    shape: { len: 3.05, width: 1.16, deck: 0.62, rake: 0.36, nose: 0.55, seats: 2, bars: 'touring', cowl: 'round', fins: false, wing: false, vents: false, sponsons: false },
    colors: { main: '#f4f1e8', secondary: '#16a7c4', seat: '#23303b', handlebar: '#2b3038', graphic: 'waves', decal: 'hibiscus', exhaust: 'chrome', finish: 'gloss' },
  },
  {
    id: 'waverunner', name: 'Wave Runner', price: 1500,
    stats: { speed: 7, handling: 8, accel: 6, stability: 7 },
    desc: 'Light and nimble. Carves tight lines through lagoons and river bends.',
    shape: { len: 2.95, width: 1.08, deck: 0.58, rake: 0.42, nose: 0.45, seats: 2, bars: 'sport', cowl: 'round', fins: true, wing: false, vents: true, sponsons: false },
    colors: { main: '#1d7fe0', secondary: '#ffd23f', seat: '#1b1f27', handlebar: '#e9eef5', graphic: 'stripes', decal: 'star', exhaust: 'black', finish: 'gloss' },
  },
  {
    id: 'oceanbeast', name: 'Ocean Beast', price: 3000,
    stats: { speed: 9, handling: 5, accel: 8, stability: 6 },
    desc: 'A heavy brute with a huge engine. Point it straight and hang on.',
    shape: { len: 3.35, width: 1.26, deck: 0.7, rake: 0.3, nose: 0.62, seats: 3, bars: 'touring', cowl: 'angular', fins: false, wing: false, vents: true, sponsons: true },
    colors: { main: '#2d3a2e', secondary: '#9dd31f', seat: '#121512', handlebar: '#9dd31f', graphic: 'tribal', decal: 'shark', exhaust: 'black', finish: 'metallic' },
  },
  {
    id: 'turbosplash', name: 'Turbo Splash', price: 4500,
    stats: { speed: 10, handling: 6, accel: 10, stability: 5 },
    desc: 'All engine, no manners. Ferocious launches, twitchy at full tilt.',
    shape: { len: 3.0, width: 1.04, deck: 0.56, rake: 0.46, nose: 0.4, seats: 1, bars: 'race', cowl: 'angular', fins: true, wing: true, vents: true, sponsons: false },
    colors: { main: '#ff4d2e', secondary: '#1b1b22', seat: '#1b1b22', handlebar: '#ffcf33', graphic: 'flames', decal: 'lightning', exhaust: 'gold', finish: 'gloss' },
  },
  {
    id: 'aquaracer', name: 'Aqua Racer', price: 6000,
    stats: { speed: 8, handling: 9, accel: 8, stability: 8 },
    desc: 'A balanced thoroughbred built for championship racing lines.',
    shape: { len: 3.1, width: 1.1, deck: 0.57, rake: 0.4, nose: 0.42, seats: 1, bars: 'race', cowl: 'round', fins: true, wing: false, vents: true, sponsons: true },
    colors: { main: '#14c7b2', secondary: '#ffffff', seat: '#0f2b36', handlebar: '#0f2b36', graphic: 'split', decal: 'wave', exhaust: 'titanium', finish: 'pearl' },
  },
  {
    id: 'stormchaser', name: 'Storm Chaser', price: 8000,
    stats: { speed: 9, handling: 7, accel: 9, stability: 7 },
    desc: 'Built to punch through rough water. Loves big swells and stormy seas.',
    shape: { len: 3.25, width: 1.2, deck: 0.66, rake: 0.33, nose: 0.58, seats: 2, bars: 'sport', cowl: 'angular', fins: true, wing: true, vents: true, sponsons: true },
    colors: { main: '#3a3f6b', secondary: '#f6c90e', seat: '#16182c', handlebar: '#f6c90e', graphic: 'lightning', decal: 'lightning', exhaust: 'black', finish: 'metallic' },
  },
  {
    id: 'hydrox', name: 'Hydro X', price: 11000,
    stats: { speed: 10, handling: 9, accel: 9, stability: 8 },
    desc: 'Experimental carbon hull. Razor sharp and blisteringly quick.',
    shape: { len: 3.15, width: 1.06, deck: 0.54, rake: 0.5, nose: 0.36, seats: 1, bars: 'race', cowl: 'angular', fins: true, wing: true, vents: true, sponsons: true },
    colors: { main: '#16181d', secondary: '#00e5ff', seat: '#16181d', handlebar: '#00e5ff', graphic: 'checker', decal: 'star', exhaust: 'titanium', finish: 'metallic' },
  },
  {
    id: 'ultimatepro', name: 'Ultimate Pro', price: 15000,
    stats: { speed: 10, handling: 10, accel: 10, stability: 10 },
    desc: 'The pinnacle of personal watercraft. Nothing faster has ever touched the water.',
    shape: { len: 3.2, width: 1.12, deck: 0.58, rake: 0.44, nose: 0.4, seats: 1, bars: 'race', cowl: 'round', fins: true, wing: true, vents: true, sponsons: true },
    colors: { main: '#ffffff', secondary: '#d4a017', seat: '#151515', handlebar: '#d4a017', graphic: 'stripes', decal: 'crown', exhaust: 'gold', finish: 'pearl' },
  },
];
export const skiById = (id) => SKIS.find((s) => s.id === id) || SKIS[0];

export const UPGRADES = [
  { id: 'engine', name: 'Engine', desc: 'Raises top speed.' },
  { id: 'steering', name: 'Steering', desc: 'Sharper turns and better grip.' },
  { id: 'accel', name: 'Acceleration', desc: 'Faster launches out of corners.' },
  { id: 'stability', name: 'Stability', desc: 'Smoother ride over chop and safer landings.' },
  { id: 'boost', name: 'Boost Tank', desc: 'Holds more boost and refills faster.' },
];
export const UPGRADE_MAX = 5;
export const UPGRADE_COST = [300, 600, 1000, 1500, 2200];
export const UPGRADE_STEP = 0.25; // stat points per level (5 levels = +1.25)

export const PAINT_PRESETS = [
  '#ffffff', '#f4f1e8', '#16181d', '#3b4250', '#e8202a', '#ff4d2e', '#ff8c1a', '#ffd23f',
  '#9dd31f', '#1fbf5b', '#14c7b2', '#16a7c4', '#1d7fe0', '#3a3f6b', '#8a3ffc', '#ff4fa3',
];
export const FINISHES = [
  { id: 'gloss', name: 'Gloss', price: 0, rough: 0.28, metal: 0.05 },
  { id: 'metallic', name: 'Metallic', price: 600, rough: 0.3, metal: 0.6 },
  { id: 'pearl', name: 'Pearl', price: 900, rough: 0.16, metal: 0.25, clearcoat: 1 },
  { id: 'neon', name: 'Neon Glow', price: 1200, rough: 0.35, metal: 0, emissive: 0.45 },
  { id: 'chrome', name: 'Chrome', price: 2000, rough: 0.06, metal: 1 },
];
export const GRAPHICS = [
  { id: 'solid', name: 'Solid', price: 0 },
  { id: 'stripes', name: 'Racing Stripes', price: 0 },
  { id: 'split', name: 'Two-Tone', price: 0 },
  { id: 'waves', name: 'Waves', price: 0 },
  { id: 'flames', name: 'Flames', price: 400 },
  { id: 'tribal', name: 'Tribal', price: 400 },
  { id: 'lightning', name: 'Lightning', price: 500 },
  { id: 'checker', name: 'Checkered', price: 500 },
];
export const DECALS = [
  { id: 'none', name: 'None', price: 0 },
  { id: 'hibiscus', name: 'Hibiscus', price: 0 },
  { id: 'star', name: 'Star', price: 0 },
  { id: 'wave', name: 'Wave Logo', price: 150 },
  { id: 'sun', name: 'Sunburst', price: 150 },
  { id: 'shark', name: 'Shark', price: 250 },
  { id: 'lightning', name: 'Bolt', price: 250 },
  { id: 'turtle', name: 'Sea Turtle', price: 300 },
  { id: 'crown', name: 'Crown', price: 600 },
];
export const EXHAUSTS = [
  { id: 'chrome', name: 'Chrome', price: 0, color: '#e6e9ee', metal: 1, rough: 0.12 },
  { id: 'black', name: 'Black', price: 0, color: '#1a1c20', metal: 0.6, rough: 0.4 },
  { id: 'gold', name: 'Gold', price: 350, color: '#e2b13c', metal: 1, rough: 0.18 },
  { id: 'titanium', name: 'Burnt Titanium', price: 450, color: '#6d74c9', metal: 1, rough: 0.22 },
  { id: 'copper', name: 'Copper', price: 300, color: '#c96f3b', metal: 1, rough: 0.2 },
];

// ---------------------------------------------------------------- Rider
export const SKIN_TONES = ['#ffe0c4', '#f6cba6', '#e8b48a', '#d29a6c', '#b57a4f', '#8f5a37', '#6b4128', '#4a2c1b'];
export const HAIR_COLORS = ['#1c1410', '#3b2416', '#6a4226', '#a8743d', '#e3c27a', '#c4502a', '#e8e8e8', '#3fa9f5', '#ff5fa2'];
export const CLOTH_COLORS = PAINT_PRESETS;

export const HAIR_STYLES = [
  { id: 'buzz', name: 'Buzz' }, { id: 'short', name: 'Short' }, { id: 'spiky', name: 'Spiky' },
  { id: 'curly', name: 'Curly' }, { id: 'ponytail', name: 'Ponytail' }, { id: 'long', name: 'Long' },
  { id: 'bun', name: 'Top Bun' }, { id: 'mohawk', name: 'Mohawk' },
];
export const FACES = [
  { id: 'smile', name: 'Big Smile' }, { id: 'focus', name: 'Focused' }, { id: 'cool', name: 'Cool' },
  { id: 'cheeky', name: 'Cheeky' }, { id: 'freckles', name: 'Freckles' }, { id: 'beard', name: 'Beard' },
];
// Items with a price must be bought once; ownership is saved.
export const TOPS = [
  { id: 'wetsuit', name: 'Racing Wetsuit', price: 0 },
  { id: 'rashguard', name: 'Rash Guard', price: 0 },
  { id: 'tropical', name: 'Tropical Shirt', price: 0 },
  { id: 'jersey', name: 'Racing Jersey', price: 400 },
  { id: 'prosuit', name: 'Pro Wetsuit', price: 800 },
];
export const BOTTOMS = [
  { id: 'boardshorts', name: 'Board Shorts', price: 0 },
  { id: 'wetsuit', name: 'Wetsuit Legs', price: 0 },
  { id: 'racepants', name: 'Race Pants', price: 300 },
];
export const GLOVES = [{ id: 'none', name: 'No Gloves', price: 0 }, { id: 'sport', name: 'Sport Gloves', price: 150 }];
export const SHOES = [{ id: 'none', name: 'Barefoot', price: 0 }, { id: 'aqua', name: 'Water Shoes', price: 100 }];
export const HELMETS = [
  { id: 'none', name: 'None', price: 0 },
  { id: 'cap', name: 'Backwards Cap', price: 0 },
  { id: 'open', name: 'Open-Face Helmet', price: 300 },
  { id: 'full', name: 'Full-Face Helmet', price: 700 },
  { id: 'visor', name: 'Pro Visor Helmet', price: 1200 },
];
export const EYEWEAR = [
  { id: 'none', name: 'None', price: 0 },
  { id: 'sunglasses', name: 'Sunglasses', price: 0 },
  { id: 'goggles', name: 'Goggles', price: 250 },
  { id: 'aviators', name: 'Aviators', price: 400 },
];
export const VESTS = [
  { id: 'none', name: 'No Vest', price: 0 },
  { id: 'classic', name: 'Classic Life Jacket', price: 0 },
  { id: 'race', name: 'Racing Vest', price: 350 },
  { id: 'pro', name: 'Pro Impact Vest', price: 600 },
];

export const DEFAULT_RIDER = {
  body: 'male', skin: SKIN_TONES[2], hair: 'short', hairColor: HAIR_COLORS[1], face: 'smile',
  top: 'wetsuit', topColor: '#16a7c4', accentColor: '#ffd23f', bottom: 'boardshorts', bottomColor: '#ff8c1a',
  gloves: 'none', gloveColor: '#16181d', shoes: 'none', shoeColor: '#ffffff', helmet: 'none', helmetColor: '#ffffff',
  eyewear: 'sunglasses', vest: 'classic', vestColor: '#ff8c1a',
};

export const RIDER_PRESETS = [
  { name: 'Kai', look: { ...DEFAULT_RIDER } },
  { name: 'Malia', look: { ...DEFAULT_RIDER, body: 'female', skin: SKIN_TONES[4], hair: 'ponytail', hairColor: HAIR_COLORS[0], face: 'cheeky', top: 'rashguard', topColor: '#ff4fa3', accentColor: '#ffffff', bottomColor: '#14c7b2', vestColor: '#ffd23f', eyewear: 'none' } },
  { name: 'Rio', look: { ...DEFAULT_RIDER, skin: SKIN_TONES[6], hair: 'curly', hairColor: HAIR_COLORS[0], face: 'cool', top: 'tropical', topColor: '#ffd23f', accentColor: '#e8202a', bottom: 'boardshorts', bottomColor: '#1d7fe0', vest: 'none', eyewear: 'sunglasses' } },
  { name: 'Sky', look: { ...DEFAULT_RIDER, body: 'female', skin: SKIN_TONES[0], hair: 'long', hairColor: HAIR_COLORS[4], face: 'freckles', top: 'wetsuit', topColor: '#8a3ffc', accentColor: '#14c7b2', bottom: 'wetsuit', bottomColor: '#16181d', vestColor: '#14c7b2', eyewear: 'none' } },
  { name: 'Tane', look: { ...DEFAULT_RIDER, skin: SKIN_TONES[5], hair: 'mohawk', hairColor: HAIR_COLORS[5], face: 'beard', top: 'rashguard', topColor: '#16181d', accentColor: '#ff4d2e', bottomColor: '#3b4250', vest: 'classic', vestColor: '#ff4d2e', eyewear: 'none' } },
  { name: 'Nova', look: { ...DEFAULT_RIDER, body: 'female', skin: SKIN_TONES[3], hair: 'bun', hairColor: HAIR_COLORS[7], face: 'focus', top: 'rashguard', topColor: '#ffffff', accentColor: '#1d7fe0', bottom: 'boardshorts', bottomColor: '#ff4fa3', vestColor: '#1d7fe0', eyewear: 'none' } },
];

// ---------------------------------------------------------------- Tricks
// axis/turns drive the trick pivot rotation; pose names the rider animation.
export const TRICKS = {
  backflip: { name: 'Backflip', points: 500, dur: 0.95, axis: 'x', turns: -1, pose: 'tuck' },
  frontflip: { name: 'Frontflip', points: 500, dur: 0.95, axis: 'x', turns: 1, pose: 'tuck' },
  rollLeft: { name: 'Barrel Roll', points: 600, dur: 0.85, axis: 'z', turns: -1, pose: 'tuck' },
  rollRight: { name: 'Barrel Roll', points: 600, dur: 0.85, axis: 'z', turns: 1, pose: 'tuck' },
  superman: { name: 'Superman', points: 700, dur: 1.0, axis: null, turns: 0, pose: 'superman' },
  noHander: { name: 'No-Hander', points: 400, dur: 0.75, axis: null, turns: 0, pose: 'noHander' },
  oneHander: { name: 'One-Hander', points: 300, dur: 0.6, axis: null, turns: 0, pose: 'oneHander' },
  spin: { name: '360 Spin', points: 450, dur: 0.85, axis: 'y', turns: 1, pose: 'tuck' },
  doubleBackflip: { name: 'Double Backflip', points: 1200, dur: 1.55, axis: 'x', turns: -2, pose: 'tuck' },
  doubleRollLeft: { name: 'Double Barrel Roll', points: 1400, dur: 1.45, axis: 'z', turns: -2, pose: 'tuck' },
  doubleRollRight: { name: 'Double Barrel Roll', points: 1400, dur: 1.45, axis: 'z', turns: 2, pose: 'tuck' },
  supermanBackflip: { name: 'Superman Backflip', points: 1500, dur: 1.45, axis: 'x', turns: -1, pose: 'superman' },
};
// Holding the PRO modifier (Space in the air) upgrades these inputs.
export const PRO_TRICKS = { backflip: 'doubleBackflip', rollLeft: 'doubleRollLeft', rollRight: 'doubleRollRight', superman: 'supermanBackflip' };
export const TRICK_INPUTS = ['backflip', 'frontflip', 'rollLeft', 'rollRight', 'spin', 'superman', 'noHander', 'oneHander'];

// ---------------------------------------------------------------- Racing
export const RACE_POINTS = [10, 8, 6, 4, 2, 1];
export const POSITION_COINS = [400, 260, 180, 120, 90, 60];
export const DIFFICULTY = {
  easy: { name: 'Easy', speed: 0.84, accel: 0.85, corner: 0.75, mistakes: 1.6, coins: 1 },
  medium: { name: 'Medium', speed: 0.95, accel: 0.95, corner: 0.9, mistakes: 1, coins: 1.3 },
  hard: { name: 'Hard', speed: 1.03, accel: 1.05, corner: 1.05, mistakes: 0.45, coins: 1.7 },
};

// Personalities: line = preferred lateral offset, aggression = boost/overtake appetite,
// wobble = how messy their steering is, flair = how often they show off in the air.
export const RIVALS = [
  { name: 'Marina Cruz', ski: 'waverunner', main: '#ff4fa3', secondary: '#ffffff', line: -0.35, aggression: 0.6, wobble: 0.3, flair: 0.5, number: 7 },
  { name: 'Diego "Spray" Santos', ski: 'oceanbeast', main: '#e8202a', secondary: '#ffd23f', line: 0.4, aggression: 0.9, wobble: 0.5, flair: 0.3, number: 23 },
  { name: 'Leilani Kahale', ski: 'aquaracer', main: '#14c7b2', secondary: '#16181d', line: 0.05, aggression: 0.4, wobble: 0.15, flair: 0.7, number: 11 },
  { name: 'Tommy Breakers', ski: 'paradise100', main: '#ff8c1a', secondary: '#1d7fe0', line: -0.1, aggression: 0.3, wobble: 0.7, flair: 0.9, number: 42 },
  { name: 'Yuki Tanaka', ski: 'turbosplash', main: '#ffffff', secondary: '#e8202a', line: 0.25, aggression: 0.75, wobble: 0.25, flair: 0.4, number: 3 },
  { name: 'Olu Adeyemi', ski: 'stormchaser', main: '#9dd31f', secondary: '#16181d', line: -0.25, aggression: 0.55, wobble: 0.35, flair: 0.6, number: 18 },
  { name: 'Sven "Tide" Larsen', ski: 'hydrox', main: '#1d7fe0', secondary: '#ffffff', line: 0.15, aggression: 0.7, wobble: 0.2, flair: 0.3, number: 9 },
];
export const BOSSES = {
  riptide: { name: 'Captain Riptide', ski: 'stormchaser', main: '#16181d', secondary: '#ff4d2e', line: 0, aggression: 1, wobble: 0.08, flair: 0.6, number: 1, boss: true, bonus: 1.06 },
  tsunami: { name: 'Kai "Tsunami" Makoa', ski: 'ultimatepro', main: '#d4a017', secondary: '#16181d', line: 0, aggression: 1, wobble: 0.05, flair: 0.8, number: 0, boss: true, bonus: 1.08 },
};

export const CUPS = [
  {
    id: 'paradise', name: 'Paradise Cup', desc: 'Three sunny races to earn your fins.',
    races: [{ env: 'paradise', weather: 'day' }, { env: 'coral', weather: 'day' }, { env: 'sunset', weather: 'sunset', boss: null }],
    unlock: null, prize: [1200, 800, 500],
  },
  {
    id: 'thunder', name: 'Thunder Cup', desc: 'Lava, jungle rapids and a raging storm. Captain Riptide waits at the end.',
    races: [{ env: 'volcano', weather: 'day' }, { env: 'jungle', weather: 'day' }, { env: 'storm', weather: 'storm', boss: 'riptide' }],
    unlock: 'paradise', prize: [2000, 1300, 800],
  },
  {
    id: 'legends', name: 'Legends Cup', desc: 'Night races and wild weather against the legendary Tsunami Makoa.',
    races: [{ env: 'coral', weather: 'night' }, { env: 'volcano', weather: 'sunset' }, { env: 'jungle', weather: 'rain' }, { env: 'paradise', weather: 'night', boss: 'tsunami' }],
    unlock: 'thunder', prize: [3500, 2200, 1400],
  },
];

// ---------------------------------------------------------------- Freestyle
export const SHOWDOWN_SECONDS = 120;
export const CHALLENGES = [
  { id: 'score5k', name: 'Quick Fire', desc: 'Score 5,000 points in 60 seconds.', time: 60, reward: 400 },
  { id: 'backflips3', name: 'Flip Master', desc: 'Land 3 backflips.', time: 0, reward: 300 },
  { id: 'combo4', name: 'Combo Builder', desc: 'Land a 4-trick combo.', time: 0, reward: 500 },
  { id: 'air5', name: 'Sky High', desc: 'Stay airborne for 5 seconds in one jump.', time: 0, reward: 500 },
  { id: 'clean10k', name: 'Clean Machine', desc: 'Score 10,000 points without crashing.', time: 0, reward: 700 },
  { id: 'double', name: 'Double Trouble', desc: 'Land 2 different tricks in one jump.', time: 0, reward: 350 },
];

// ---------------------------------------------------------------- Achievements
export const ACHIEVEMENTS = [
  { id: 'firstRace', name: 'Making Waves', desc: 'Finish your first race.', reward: 100 },
  { id: 'firstWin', name: 'First Place Splash', desc: 'Win a race.', reward: 250 },
  { id: 'cupPodium', name: 'Trophy Hunter', desc: 'Finish a championship on the podium.', reward: 400 },
  { id: 'cupWin', name: 'Champion of the Seas', desc: 'Win a championship.', reward: 600 },
  { id: 'allCups', name: 'Legend of Paradise', desc: 'Win all three championships.', reward: 2000 },
  { id: 'beatBoss', name: 'Rival Crusher', desc: 'Beat a championship boss.', reward: 800 },
  { id: 'firstTrick', name: 'Airborne', desc: 'Land your first trick.', reward: 100 },
  { id: 'combo3', name: 'Combo Starter', desc: 'Land a x3 combo.', reward: 200 },
  { id: 'combo5', name: 'Max Multiplier', desc: 'Land a x5 combo.', reward: 600 },
  { id: 'doubleFlip', name: 'Double Down', desc: 'Land a Double Backflip.', reward: 300 },
  { id: 'air4', name: 'Hang Time', desc: 'Stay airborne for 4 seconds.', reward: 300 },
  { id: 'score25k', name: 'Showstopper', desc: 'Score 25,000 in one freestyle session.', reward: 500 },
  { id: 'allChallenges', name: 'Challenge Accepted', desc: 'Complete every stunt challenge.', reward: 1000 },
  { id: 'ttGold', name: 'Golden Clock', desc: 'Earn a time trial gold medal.', reward: 400 },
  { id: 'shells10', name: 'Beachcomber', desc: 'Find 10 golden shells.', reward: 400 },
  { id: 'shellsAll', name: 'Shell Collector', desc: 'Find every golden shell.', reward: 1500 },
  { id: 'explorer', name: 'Explorer', desc: 'Discover every hidden location.', reward: 1000 },
  { id: 'garage4', name: 'Fleet Owner', desc: 'Own 4 jet skis.', reward: 500 },
  { id: 'garageAll', name: 'Full Garage', desc: 'Own all 8 jet skis.', reward: 2500 },
  { id: 'maxUpgrade', name: 'Fully Tuned', desc: 'Max out any upgrade.', reward: 300 },
  { id: 'stylish', name: 'Island Style', desc: 'Buy a piece of rider gear.', reward: 100 },
  { id: 'nightRider', name: 'Night Rider', desc: 'Finish a race at night.', reward: 200 },
  { id: 'stormSurvivor', name: 'Storm Survivor', desc: 'Finish a race in Stormbreaker Ocean.', reward: 250 },
  { id: 'rich', name: 'Treasure Island', desc: 'Earn 25,000 Paradise Coins in total.', reward: 1000 },
];

export const WEATHERS = {
  day: { name: 'Bright Day' }, sunset: { name: 'Sunset' }, night: { name: 'Night' },
  rain: { name: 'Rain' }, storm: { name: 'Storm' },
};
