/* ==========================================================================
   SKKU brAIn Cinematic Lottery - Core Interactive Logic
   Features: Persistence, HTML5 Web Audio Synthesis, Physics-based Confetti,
             Cinematic Overlay Sync & Rapid Shuffler
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // 1. Data Store & Initial State
  // ==========================================================================

  const DEFAULT_NAMES = [
    '박주선', '안재현', '지용제', '박자연', '정찬희', 
    '박승욱', '송지혜', '김아현', '김율', '강혜진', 
    '이주환', '정연재', '여수연', '김하경', '손지훈', '이승주'
  ];

  const SUITS = [
    { symbol: '♠', name: 'spades', isRed: false },
    { symbol: '♥', name: 'hearts', isRed: true },
    { symbol: '♦', name: 'diamonds', isRed: true },
    { symbol: '♣', name: 'clubs', isRed: false }
  ];

  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const a1Names = ['박주선', '안재현', '지용제', '박자연', '정찬희', '박승욱', '송지혜', '김아현'];

  let participants = []; // Array of { name: string, active: boolean }
  let winners = [];      // Array of { name: string, timestamp: string, card?: object }
  let currentWinner = '';
  let currentDrawnCard = null;
  let activeCardClickListener = null;

  // LocalStorage Helper
  const loadState = () => {
    try {
      const savedParticipants = localStorage.getItem('brain_lottery_participants');
      const savedWinners = localStorage.getItem('brain_lottery_winners');
      const optSkipVideo = localStorage.getItem('brain_lottery_opt_skip');
      const optAllowRepeat = localStorage.getItem('brain_lottery_opt_repeat');

      // Load participants
      if (savedParticipants) {
        participants = JSON.parse(savedParticipants);
      } else {
        participants = DEFAULT_NAMES.map(name => ({ name, active: true }));
        saveParticipants();
      }

      // Load winners
      if (savedWinners) {
        winners = JSON.parse(savedWinners);
      } else {
        winners = [];
      }

      // Load Options
      if (optSkipVideo !== null) {
        document.getElementById('opt-skip-video').checked = JSON.parse(optSkipVideo);
      }
      if (optAllowRepeat !== null) {
        document.getElementById('opt-allow-repeat').checked = JSON.parse(optAllowRepeat);
      }

    } catch (e) {
      console.error('Failed to load state from localStorage, using defaults.', e);
      participants = DEFAULT_NAMES.map(name => ({ name, active: true }));
      winners = [];
    }
  };

  const saveParticipants = () => {
    localStorage.setItem('brain_lottery_participants', JSON.stringify(participants));
  };

  const saveWinners = () => {
    localStorage.setItem('brain_lottery_winners', JSON.stringify(winners));
  };

  // ==========================================================================
  // 2. DOM Selectors
  // ==========================================================================

  const btnDraw = document.getElementById('btn-draw');
  const stageStatusText = document.getElementById('stage-status-text');
  const countActive = document.getElementById('count-active');
  const countTotal = document.getElementById('count-total');
  const countWinners = document.getElementById('count-winners');
  const participantsList = document.getElementById('participants-list');
  const winnersList = document.getElementById('winners-list');
  
  const nameInput = document.getElementById('name-input');
  const btnAddNames = document.getElementById('btn-add-names');
  const btnSelectAll = document.getElementById('btn-select-all');
  const btnDeselectAll = document.getElementById('btn-deselect-all');
  
  const optSkipVideo = document.getElementById('opt-skip-video');
  const optAllowRepeat = document.getElementById('opt-allow-repeat');
  
  const btnResetPool = document.getElementById('btn-reset-pool');
  const btnClearHistory = document.getElementById('btn-clear-history');
  
  // Cinematic Overlay DOM
  const cinematicOverlay = document.getElementById('cinematic-overlay');
  const buildupVideo = document.getElementById('buildup-video');
  const shuffleName = document.getElementById('shuffle-name');
  const btnSkipVideo = document.getElementById('btn-skip-video');
  const hudProgress = document.getElementById('hud-progress');
  
  // Winner Modal DOM
  const winnerModal = document.getElementById('winner-modal');
  const winnerRevealName = document.getElementById('winner-reveal-name');
  const btnCloseWinner = document.getElementById('btn-close-winner');

  // Canvas
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');

  // ==========================================================================
  // 3. Web Audio Synthesis Engine (Premium SFX)
  // ==========================================================================

  let audioCtx = null;

  const initAudio = () => {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  };

  // Cybernetic Synthesized Plip sound
  const playPlipSound = (freq = 800, duration = 0.08) => {
    initAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq / 2, audioCtx.currentTime + duration);

    gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  };

  // Hover Shimmer SFX: Very light, high-frequency resonance beep
  const playShimmerSFX = () => {
    initAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1500, audioCtx.currentTime);

    gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  };

  // Swoosh SFX: Wind-cutting swoosh using bandpass modulated white noise
  const playSwooshSFX = () => {
    initAudio();
    if (!audioCtx) return;

    const bufferSize = audioCtx.sampleRate * 0.35; // 0.35s swoosh duration
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.35);
    filter.Q.setValueAtTime(4.0, audioCtx.currentTime);

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);

    noiseNode.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noiseNode.start();
    noiseNode.stop(audioCtx.currentTime + 0.35);
  };

  // High-End Cybermatic Dramatic Chord & Joker Glitch Riser SFX
  const playWinnerSynthSFX = () => {
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const isJoker = currentDrawnCard && currentDrawnCard.rank === 'Joker';

    if (isJoker) {
      // FM Synth Cyber-Glitch Riser for Joker Card Reveal
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const fmOsc = audioCtx.createOscillator();
      const fmGain = audioCtx.createGain();
      
      const filter = audioCtx.createBiquadFilter();
      const gainNode = audioCtx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      fmOsc.type = 'sine';

      // Sweep frequencies from low rumble (60Hz) to piercing cyber pitch (900Hz)
      osc1.frequency.setValueAtTime(60, now);
      osc1.frequency.exponentialRampToValueAtTime(900, now + 2.4);
      
      osc2.frequency.setValueAtTime(61.5, now);
      osc2.frequency.exponentialRampToValueAtTime(905, now + 2.4);

      // FM index & freq modulation sweeps
      fmOsc.frequency.setValueAtTime(15, now);
      fmOsc.frequency.exponentialRampToValueAtTime(280, now + 2.4);

      fmGain.gain.setValueAtTime(40, now);
      fmGain.gain.exponentialRampToValueAtTime(750, now + 2.4);

      // Lowpass resonance sweep
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(120, now);
      filter.frequency.exponentialRampToValueAtTime(2600, now + 2.4);
      filter.Q.setValueAtTime(9.0, now);

      // Dramatic Riser Volume envelope
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.exponentialRampToValueAtTime(0.16, now + 1.8);
      gainNode.gain.linearRampToValueAtTime(0.24, now + 2.2);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);

      // Connect FM
      fmOsc.connect(fmGain);
      fmGain.connect(osc1.frequency);
      fmGain.connect(osc2.frequency);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      fmOsc.start(now);
      osc1.start(now);
      osc2.start(now);

      fmOsc.stop(now + 2.7);
      osc1.stop(now + 2.7);
      osc2.stop(now + 2.7);

      // Spooky crackle overlay using filtered white noise
      const bufferSize = audioCtx.sampleRate * 2.4;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = audioCtx.createBufferSource();
      noiseNode.buffer = buffer;

      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(400, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(7500, now + 2.4);
      noiseFilter.Q.setValueAtTime(4.0, now);

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.008, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.07, now + 2.1);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);

      noiseNode.start(now);
      noiseNode.stop(now + 2.6);

    } else {
      // Standard Majestic C Major Sci-Fi Chord
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; 

      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        const delay = idx * 0.06;

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq / 2, now + delay);
        osc.frequency.exponentialRampToValueAtTime(freq * 2, now + delay + 1.5);

        gainNode.gain.setValueAtTime(0.0, now);
        gainNode.gain.linearRampToValueAtTime(0.08, now + delay + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + delay + 2.0);

        osc.start(now + delay);
        osc.stop(now + delay + 2.1);
      });

      // High frequency white noise splash
      const bufferSize = audioCtx.sampleRate * 1.5;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = audioCtx.createBufferSource();
      noiseNode.buffer = buffer;

      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(2000, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 1.5);
      noiseFilter.Q.setValueAtTime(2.0, now);

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.setValueAtTime(0.05, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);

      noiseNode.start(now);
      noiseNode.stop(now + 1.6);
    }
  };

  // ==========================================================================
  // 4. Physics Confetti Particle Engine
  // ==========================================================================

  let particles = [];
  let animationId = null;
  let activePalette = 'default';

  class Particle {
    constructor(palette = activePalette) {
      this.x = canvas.width / 2 + (Math.random() * 80 - 40);
      this.y = canvas.height + 20;
      this.radius = Math.random() * 5 + 3;
      
      // Explosion vector
      const angle = (Math.random() * 50 - 25) - 90; // Upward spray
      const speed = Math.random() * 12 + 10;
      
      this.vx = Math.cos(angle * Math.PI / 180) * speed;
      this.vy = Math.sin(angle * Math.PI / 180) * speed;
      
      this.gravity = 0.22;
      this.friction = 0.985;
      
      // Select palette
      let colors;
      if (palette === 'black_joker') {
        colors = [
          '#c084fc', // neon purple
          '#00ffc4', // mint green
          '#cbd5e1', // silver
          '#06b6d4', // teal
          '#ffffff'  // white
        ];
      } else if (palette === 'red_joker') {
        colors = [
          '#991b1b', // deep crimson
          '#e11d48', // ruby red
          '#fda4af', // coral pink
          '#f59e0b', // gold
          '#fffbeb'  // warm white
        ];
      } else {
        // Elegant Emerald, Gold, Mint, and White palettes
        colors = [
          '#00ffc4', // brAIn Mint
          '#10b981', // brAIn Emerald
          '#0b2b20', // deep green
          '#f59e0b', // gold glow
          '#ffffff'  // white sparkles
        ];
      }
      this.color = colors[Math.floor(Math.random() * colors.length)];
      
      this.opacity = 1;
      this.decay = Math.random() * 0.008 + 0.004;

      this.width = Math.random() * 8 + 6;
      this.height = Math.random() * 14 + 10;
      this.rotation = Math.random() * 360;
      this.rotationSpeed = Math.random() * 6 - 3;
    }

    update() {
      this.vx *= this.friction;
      this.vy += this.gravity;
      
      this.x += this.vx;
      this.y += this.vy;
      
      this.rotation += this.rotationSpeed;
      this.opacity -= this.decay;
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation * Math.PI / 180);
      ctx.globalAlpha = this.opacity;
      
      ctx.fillStyle = this.color;
      // Draw spinning ribbon
      ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
      
      ctx.restore();
    }
  }

  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };

  const startConfetti = (palette = 'default') => {
    resizeCanvas();
    particles = [];
    activePalette = palette;
    
    // Spawn 150 explosion particles
    for (let i = 0; i < 150; i++) {
      particles.push(new Particle(palette));
    }

    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    
    animateConfetti();
  };

  const animateConfetti = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Periodically spawn slow falling sky confetti if there are active particles
    if (particles.length > 10 && Math.random() < 0.08) {
      // Spawn standard sky drift particle
      const p = new Particle(activePalette);
      p.x = Math.random() * canvas.width;
      p.y = -20;
      p.vy = Math.random() * 3 + 1;
      p.vx = Math.random() * 2 - 1;
      particles.push(p);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update();
      p.draw();
      
      // Prune dead particles
      if (p.opacity <= 0 || p.y > canvas.height + 40 || p.x < -40 || p.x > canvas.width + 40) {
        particles.splice(i, 1);
      }
    }

    if (particles.length > 0) {
      animationId = requestAnimationFrame(animateConfetti);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  window.addEventListener('resize', resizeCanvas);

  // ==========================================================================
  // 5. Drawing & Cinematic System Logic
  // ==========================================================================

  let isDrawing = false;
  let shuffleTimeoutId = null;
  let drawStartTime = 0;

  // Pre-load voices for SpeechSynthesis (crucial for Chrome/Edge async loading)
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }

  // Helper to convert Korean name (Family-Name + Given-Name) to English order (Given-Name + Family-Name)
  const convertToEnglishOrder = (name) => {
    if (!name || typeof name !== 'string') return '';
    
    // List of common Korean double-character family names (복성)
    const doubleFamilyNames = ['남궁', '황보', '제갈', '사공', '독고', '선우', '서문'];
    
    for (const doubleFam of doubleFamilyNames) {
      if (name.startsWith(doubleFam) && name.length > doubleFam.length) {
        const family = doubleFam;
        const given = name.slice(doubleFam.length);
        return `${given} ${family}`;
      }
    }
    
    // Default: First character is family name
    if (name.length >= 2) {
      const family = name.charAt(0);
      const given = name.slice(1);
      return `${given} ${family}`;
    }
    
    return name;
  };

  // Web Speech API English TTS
  const playWinnerTTS = (name, card) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing synthesis to prevent queuing overlap
      window.speechSynthesis.cancel();
      
      // Convert name order for natural English pronunciation (e.g. 조현영 -> 현영 조)
      const englishOrderedName = convertToEnglishOrder(name);
      
      let cardSpeechText = '';
      if (card) {
        if (card.rank === 'Joker') {
          const jokerColor = card.isRed ? 'Red' : 'Black';
          cardSpeechText = ` You drew the ${jokerColor} Joker!`;
        } else {
          let rankSpeechName = card.rank;
          if (card.rank === 'A') rankSpeechName = 'Ace';
          else if (card.rank === 'J') rankSpeechName = 'Jack';
          else if (card.rank === 'Q') rankSpeechName = 'Queen';
          else if (card.rank === 'K') rankSpeechName = 'King';
          
          const suitSpeechName = card.suitName.charAt(0).toUpperCase() + card.suitName.slice(1);
          cardSpeechText = ` You drew the ${rankSpeechName} of ${suitSpeechName}!`;
        }
      }
      
      const utterance = new SpeechSynthesisUtterance(`Congratulations. The questioner for this session is ${englishOrderedName}.${cardSpeechText}`);
      utterance.lang = 'en-US';
      utterance.rate = 0.95; // A tiny bit slower for professional, majestic tone
      utterance.pitch = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      // Try to find a high-quality Google voice, or fall back to any English voice
      let selectedVoice = voices.find(v => v.lang === 'en-US' && v.name.includes('Google'));
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith('en'));
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn('Text-to-Speech is not supported in this browser.');
    }
  };

  // Trigger White Transition Flash Overlay
  const triggerWhiteFlash = () => {
    const flash = document.createElement('div');
    flash.className = 'white-flash';
    document.body.appendChild(flash);
    setTimeout(() => {
      flash.remove();
    }, 900);
  };

  // Main Draw Lottery Logic
  const startLotteryDraw = () => {
    if (isDrawing) return;

    // Filter list of active candidates
    let pool = participants.filter(p => p.active);
    
    // If repeat is disabled, exclude students already drawn in the winners list
    const allowRepeat = optAllowRepeat.checked;
    if (!allowRepeat) {
      const winnerNames = winners.map(w => w.name);
      pool = pool.filter(p => !winnerNames.includes(p.name));
    }

    if (pool.length === 0) {
      playPlipSound(250, 0.4); // Error buzz
      alert('추첨 가능한 유효 참가자가 없습니다! 참가자 상태나 중복 허용 옵션을 조절해주세요.');
      return;
    }

    // Pick random winner (with exactly 25% probability for '지용제' if present in the active pool)
    const targetName = '지용제';
    const targetWeight = 0.25;
    
    let chosenCandidate = null;
    const hasTarget = pool.some(p => p.name === targetName);
    
    if (hasTarget && pool.length > 1) {
      const otherWeight = (1.0 - targetWeight) / (pool.length - 1);
      const r = Math.random();
      let cumulative = 0;
      
      for (const candidate of pool) {
        const weight = (candidate.name === targetName) ? targetWeight : otherWeight;
        cumulative += weight;
        if (r <= cumulative) {
          chosenCandidate = candidate;
          break;
        }
      }
      
      // Fallback in case of floating point precision issues
      if (!chosenCandidate) {
        chosenCandidate = pool[pool.length - 1];
      }
    } else {
      // Fallback if target is absent or the sole candidate
      const randomIndex = Math.floor(Math.random() * pool.length);
      chosenCandidate = pool[randomIndex];
    }
    
    currentWinner = chosenCandidate.name;
    
    // Pick card based on authority groups and special Joker overrides
    if (currentWinner === '박자연') {
      currentDrawnCard = {
        rank: 'Joker',
        suitSymbol: '★',
        suitName: 'joker',
        isRed: false
      };
    } else if (currentWinner === '강혜진') {
      currentDrawnCard = {
        rank: 'Joker',
        suitSymbol: '★',
        suitName: 'joker',
        isRed: true
      };
    } else {
      const isA1 = a1Names.includes(currentWinner);
      const groupRanks = isA1 ? ['A', '3', '5', '7', '9', 'J', 'K'] : ['2', '4', '6', '8', '10', 'Q'];
      // A1 draws Spades (index 0) or Clubs (index 3), A2 draws Hearts (index 1) or Diamonds (index 2)
      const allowedSuits = isA1 ? [SUITS[0], SUITS[3]] : [SUITS[1], SUITS[2]];
      const randomSuit = allowedSuits[Math.floor(Math.random() * allowedSuits.length)];
      const randomRank = groupRanks[Math.floor(Math.random() * groupRanks.length)];
      currentDrawnCard = {
        rank: randomRank,
        suitSymbol: randomSuit.symbol,
        suitName: randomSuit.name,
        isRed: randomSuit.isRed
      };
    }
    
    isDrawing = true;
    btnDraw.disabled = true;
    stageStatusText.innerText = '추첨 분석 시스템 구동 중...';

    const skipVideo = optSkipVideo.checked;

    if (skipVideo) {
      // Direct instant draw mode
      playPlipSound(800, 0.1);
      triggerWhiteFlash();
      
      setTimeout(() => {
        revealWinner();
      }, 200);
    } else {
      // Cinematic buildup video mode
      initAudio();
      playPlipSound(600, 0.15);
      
      // Active video overlay
      cinematicOverlay.classList.remove('hidden');
      setTimeout(() => {
        cinematicOverlay.classList.add('active');
      }, 50);

      // Play video
      buildupVideo.currentTime = 0;
      buildupVideo.play().catch(e => {
        console.warn('Auto play failed, skipping video...', e);
        skipBuildup();
      });

      // Add glitch class for cyberpunk digital noise buildup
      shuffleName.classList.add('glitch');

      // Initialize draw start time for dynamic deceleration shuffler
      drawStartTime = Date.now();

      // Dynamic Shuffler Deceleration (Roulette Slowdown)
      const shuffleTick = () => {
        if (!isDrawing) return;

        const elapsed = (Date.now() - drawStartTime) / 1000.0;
        const tempIndex = Math.floor(Math.random() * pool.length);
        const currentName = pool[tempIndex].name;

        shuffleName.innerText = currentName;
        // set data-text attribute for CSS glitch clipping duplication
        shuffleName.setAttribute('data-text', currentName);

        // Lower key frequencies as the shuffler slows down to give heavy friction feel
        const currentFreq = 950 + Math.random() * 150 - Math.min(elapsed * 45, 350);
        playPlipSound(currentFreq, 0.04);

        // Climax deceleration formula: exponential delay slow down from 5.5s to 9.5s
        let delay = 60;
        const targetClimaxTime = 9.5;

        if (elapsed > 5.5) {
          const t = (elapsed - 5.5) / (targetClimaxTime - 5.5);
          delay = 60 + Math.pow(Math.min(t, 1.0), 3.0) * 440; // exponential decay up to ~500ms
        }

        shuffleTimeoutId = setTimeout(shuffleTick, delay);
      };

      // Start recursive loop
      shuffleTick();

      // Listen for video updates with high-precision cut-off at 9.5 seconds
      const checkVideoTime = () => {
        if (!isDrawing) return;
        
        const targetClimaxTime = 9.5;
        
        // Update HUD progress bar based on targetClimaxTime
        const progressPercent = Math.min((buildupVideo.currentTime / targetClimaxTime) * 100, 100);
        hudProgress.style.width = `${progressPercent}%`;

        if (buildupVideo.currentTime >= targetClimaxTime) {
          completeCinematicDraw();
        } else {
          requestAnimationFrame(checkVideoTime);
        }
      };
      
      // Start precise timing check
      requestAnimationFrame(checkVideoTime);

      // Fallback for completion if ended event triggers early
      buildupVideo.onended = () => {
        completeCinematicDraw();
      };
    }
  };

  const completeCinematicDraw = () => {
    if (shuffleTimeoutId) {
      clearTimeout(shuffleTimeoutId);
      shuffleTimeoutId = null;
    }
    shuffleName.classList.remove('glitch');
    buildupVideo.pause();
    triggerWhiteFlash();
    
    // Transition away from overlay
    cinematicOverlay.classList.remove('active');
    setTimeout(() => {
      cinematicOverlay.classList.add('hidden');
      revealWinner();
    }, 400);
  };

  const skipBuildup = () => {
    if (!isDrawing) return;
    completeCinematicDraw();
  };

  // Reveal Winner Celebration Frame
  const revealWinner = (instantReveal = false) => {
    // Log winner
    const now = new Date();
    const timestampStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    winners.unshift({ 
      name: currentWinner, 
      timestamp: timestampStr,
      card: currentDrawnCard
    });
    saveWinners();
    
    // Set UI
    const cardEl = document.querySelector('.winner-card');
    if (cardEl) {
      // Cleanup any legacy click listener to prevent double triggering or state pollution
      if (activeCardClickListener) {
        cardEl.removeEventListener('click', activeCardClickListener);
        activeCardClickListener = null;
      }

      cardEl.style.transform = '';
      cardEl.classList.remove('flipped'); // Always start unflipped
      
      if (currentDrawnCard && currentDrawnCard.isRed) {
        cardEl.classList.add('suit-red');
      } else {
        cardEl.classList.remove('suit-red');
      }
      
      if (currentDrawnCard && currentDrawnCard.rank === 'Joker') {
        cardEl.classList.add('joker-card');
      } else {
        cardEl.classList.remove('joker-card');
      }
    }
    
    // Update Card Back Face group identifier dynamically (A1 or A2)
    const backWinnerGroup = document.getElementById('back-winner-group');
    if (backWinnerGroup) {
      backWinnerGroup.innerText = a1Names.includes(currentWinner) ? 'A1' : 'A2';
    }
    
    // Update Card Front Face Details (Rank, Suit, and Large watermark)
    if (currentDrawnCard) {
      const indexTopLeftRank = document.querySelector('.card-index.top-left .rank');
      const indexTopLeftSuit = document.querySelector('.card-index.top-left .suit');
      const indexBottomRightRank = document.querySelector('.card-index.bottom-right .rank');
      const indexBottomRightSuit = document.querySelector('.card-index.bottom-right .suit');
      const cardSuitLarge = document.querySelector('.card-suit-large');
      
      const cardTitleBadge = document.getElementById('winner-card-title-badge');
      const cardMessage = document.getElementById('winner-card-message');

      if (indexTopLeftRank) indexTopLeftRank.innerText = currentDrawnCard.rank;
      if (indexTopLeftSuit) indexTopLeftSuit.innerText = currentDrawnCard.suitSymbol;
      if (indexBottomRightRank) indexBottomRightRank.innerText = currentDrawnCard.rank;
      if (indexBottomRightSuit) indexBottomRightSuit.innerText = currentDrawnCard.suitSymbol;
      if (cardSuitLarge) cardSuitLarge.innerText = currentDrawnCard.suitSymbol;
      
      if (cardTitleBadge) {
        if (currentDrawnCard.rank === 'Joker') {
          const colorText = currentDrawnCard.isRed ? 'RED' : 'BLACK';
          cardTitleBadge.innerText = `THE ${colorText} JOKER`;
        } else {
          let rankFullName = currentDrawnCard.rank;
          if (currentDrawnCard.rank === 'A') rankFullName = 'ACE';
          else if (currentDrawnCard.rank === 'J') rankFullName = 'JACK';
          else if (currentDrawnCard.rank === 'Q') rankFullName = 'QUEEN';
          else if (currentDrawnCard.rank === 'K') rankFullName = 'KING';
          
          const suitFullName = currentDrawnCard.suitName.toUpperCase();
          cardTitleBadge.innerText = `THE ${rankFullName} OF ${suitFullName}`;
        }
      }
      
      if (cardMessage) {
        if (currentDrawnCard.rank === 'Joker') {
          cardMessage.innerText = '축하합니다! 전설적인 조커 카드를 뽑은 오늘의 주인공이십니다!';
        } else if (currentDrawnCard.rank === 'A') {
          cardMessage.innerText = '축하합니다! 에이스 질문자로 선정되셨습니다.';
        } else {
          cardMessage.innerText = `축하합니다! 행운의 ${currentDrawnCard.rank}${currentDrawnCard.suitSymbol} 질문자로 선정되셨습니다.`;
        }
      }
    }
    
    winnerRevealName.innerText = currentWinner;
    
    // Set dynamic authority badge (A1 or A2) based on name group
    const authorityEl = document.getElementById('winner-authority');
    if (authorityEl) {
      authorityEl.innerText = a1Names.includes(currentWinner) ? 'A1' : 'A2';
    }

    // Hide actions container initially
    const actionsContainer = document.getElementById('winner-actions-container');
    if (actionsContainer) {
      actionsContainer.classList.remove('visible');
    }

    winnerModal.classList.remove('hidden');
    setTimeout(() => {
      winnerModal.classList.add('active');
    }, 50);

    const getPalette = () => {
      if (currentDrawnCard && currentDrawnCard.rank === 'Joker') {
        return currentDrawnCard.isRed ? 'red_joker' : 'black_joker';
      }
      return 'default';
    };

    if (instantReveal) {
      // Auto flip for instant mode
      if (cardEl) {
        cardEl.classList.add('flipped');
      }
      playWinnerSynthSFX();
      startConfetti(getPalette());
      
      setTimeout(() => {
        playWinnerTTS(currentWinner, currentDrawnCard);
      }, 1000);

      // Smoothly fade in actionsContainer after card flip completes (1.0s)
      setTimeout(() => {
        if (actionsContainer) {
          actionsContainer.classList.add('visible');
        }
      }, 1200);
    } else {
      // Click to Flip manual mode
      activeCardClickListener = () => {
        playSwooshSFX();
        if (cardEl) {
          cardEl.classList.add('flipped');
        }
        
        // Fire FX exactly at 550ms midpoint when the card front is revealed (1.0s flip rate)
        setTimeout(() => {
          playWinnerSynthSFX();
          startConfetti(getPalette());
          
          setTimeout(() => {
            playWinnerTTS(currentWinner, currentDrawnCard);
          }, 400);
        }, 550);

        // Smoothly fade in actionsContainer after card flip completes (1.0s)
        setTimeout(() => {
          if (actionsContainer) {
            actionsContainer.classList.add('visible');
          }
        }, 1200);
      };
      
      cardEl.addEventListener('click', activeCardClickListener, { once: true });
    }

    // Render updates
    renderParticipants();
    renderWinners();
  };

  // Close Winner Modal
  const closeWinnerModal = () => {
    winnerModal.classList.remove('active');
    
    // Hide actions container smoothly
    const actionsContainer = document.getElementById('winner-actions-container');
    if (actionsContainer) {
      actionsContainer.classList.remove('visible');
    }
    
    // Reset card tilt styles back to neutral
    const cardEl = document.querySelector('.winner-card');
    
    // Clear any active click listener to ensure pristine state for the next draw
    if (activeCardClickListener && cardEl) {
      cardEl.removeEventListener('click', activeCardClickListener);
      activeCardClickListener = null;
    }

    const shineEl = document.querySelector('.winner-card-shine');
    if (cardEl) {
      cardEl.classList.remove('flipped');
      cardEl.style.transform = '';
      cardEl.style.boxShadow = '';
      if (shineEl) {
        shineEl.style.background = '';
        shineEl.style.left = '-100%';
        shineEl.style.width = '100%';
        shineEl.style.height = '100%';
        shineEl.style.transform = '';
      }
    }

    setTimeout(() => {
      winnerModal.classList.add('hidden');
      if (cardEl) {
        cardEl.classList.remove('suit-red');
      }
      
      // Reset state
      isDrawing = false;
      btnDraw.disabled = false;
      stageStatusText.innerText = 'brAIn 로고를 눌러 추첨을 시작하세요';
    }, 400);
  };

  // ==========================================================================
  // 6. Administrative Renderings & Events
  // ==========================================================================

  // Populate Participant items
  const renderParticipants = () => {
    participantsList.innerHTML = '';
    
    let activeCount = 0;
    const allowRepeat = optAllowRepeat.checked;
    const winnerNames = winners.map(w => w.name);

    participants.forEach((p, idx) => {
      // Check if student has already been drawn and repeat draw is disabled
      const isAlreadyDrawn = !allowRepeat && winnerNames.includes(p.name);
      
      const li = document.createElement('li');
      li.className = 'list-item-hover';
      
      const container = document.createElement('div');
      container.className = 'name-item';

      const label = document.createElement('span');
      label.className = `name-label ${(!p.active || isAlreadyDrawn) ? 'inactive' : ''}`;
      
      // Display special tag if student has already won
      if (isAlreadyDrawn) {
        label.innerHTML = `${p.name} <span class="history-time" style="font-size:0.6rem;background:rgba(245,158,11,0.15);color:var(--gold-accent);margin-left:4px;">당첨완료</span>`;
      } else {
        label.innerText = p.name;
      }

      const toggle = document.createElement('label');
      toggle.className = 'switch';
      
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = p.active && !isAlreadyDrawn;
      input.disabled = isAlreadyDrawn; // Disable toggling if already drawn and repeat is disallowed
      
      input.addEventListener('change', () => {
        participants[idx].active = input.checked;
        saveParticipants();
        renderParticipants();
        playPlipSound(700, 0.05);
      });

      const slider = document.createElement('span');
      slider.className = 'slider';

      toggle.appendChild(input);
      toggle.appendChild(slider);
      container.appendChild(label);
      container.appendChild(toggle);
      li.appendChild(container);
      
      participantsList.appendChild(li);

      if (p.active && !isAlreadyDrawn) {
        activeCount++;
      }
    });

    countActive.innerText = activeCount;
    countTotal.innerText = participants.length;
  };

  // Populate Previous Winner entries
  const renderWinners = () => {
    winnersList.innerHTML = '';

    if (winners.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty-state';
      empty.innerText = '아직 추첨된 당첨자가 없습니다.';
      winnersList.appendChild(empty);
      countWinners.innerText = '0명';
      renderStats();
      return;
    }

    winners.forEach((w, idx) => {
      const li = document.createElement('li');
      
      const rank = document.createElement('span');
      rank.className = 'history-rank';
      rank.innerText = winners.length - idx;

      const name = document.createElement('span');
      name.className = 'history-name';
      
      // Prepend a beautifully styled card badge if the winner has card metadata
      if (w.card) {
        const badge = document.createElement('span');
        const displayRank = w.card.rank === 'Joker' ? 'JK' : w.card.rank;
        badge.innerText = `${displayRank}${w.card.suitSymbol}`;
        badge.className = `history-card-badge ${w.card.isRed ? 'red-card' : 'black-card'}`;
        name.appendChild(badge);
      }
      
      const nameText = document.createTextNode(w.name);
      name.appendChild(nameText);

      const time = document.createElement('span');
      time.className = 'history-time';
      time.innerText = w.timestamp;

      li.appendChild(rank);
      li.appendChild(name);
      li.appendChild(time);
      winnersList.appendChild(li);
    });

    countWinners.innerText = `${winners.length}명`;
    renderStats();
  };

  // Live Card Deck Analytics Engine
  const renderStats = () => {
    let spades = 0;
    let clubs = 0;
    let hearts = 0;
    let diamonds = 0;
    let a1 = 0;
    let a2 = 0;
    let jokers = 0;

    winners.forEach(w => {
      if (w.card) {
        if (w.card.rank === 'Joker') {
          jokers++;
        } else {
          if (w.card.suitName === 'spades') spades++;
          else if (w.card.suitName === 'clubs') clubs++;
          else if (w.card.suitName === 'hearts') hearts++;
          else if (w.card.suitName === 'diamonds') diamonds++;

          // Tally authority groups based on the student name
          if (a1Names.includes(w.name)) {
            a1++;
          } else {
            a2++;
          }
        }
      }
    });

    const totalSuits = spades + clubs + hearts + diamonds;
    const pctSpades = totalSuits > 0 ? (spades / totalSuits) * 100 : 0;
    const pctClubs = totalSuits > 0 ? (clubs / totalSuits) * 100 : 0;
    const pctHearts = totalSuits > 0 ? (hearts / totalSuits) * 100 : 0;
    const pctDiamonds = totalSuits > 0 ? (diamonds / totalSuits) * 100 : 0;

    const barSpades = document.getElementById('stats-bar-spades');
    const barClubs = document.getElementById('stats-bar-clubs');
    const barHearts = document.getElementById('stats-bar-hearts');
    const barDiamonds = document.getElementById('stats-bar-diamonds');

    const valSpades = document.getElementById('stats-val-spades');
    const valClubs = document.getElementById('stats-val-clubs');
    const valHearts = document.getElementById('stats-val-hearts');
    const valDiamonds = document.getElementById('stats-val-diamonds');

    const valA1 = document.getElementById('stats-val-a1');
    const valA2 = document.getElementById('stats-val-a2');
    const valJokers = document.getElementById('stats-val-jokers');

    if (barSpades) barSpades.style.width = `${pctSpades}%`;
    if (barClubs) barClubs.style.width = `${pctClubs}%`;
    if (barHearts) barHearts.style.width = `${pctHearts}%`;
    if (barDiamonds) barDiamonds.style.width = `${pctDiamonds}%`;

    if (valSpades) valSpades.innerText = spades;
    if (valClubs) valClubs.innerText = clubs;
    if (valHearts) valHearts.innerText = hearts;
    if (valDiamonds) valDiamonds.innerText = diamonds;

    if (valA1) valA1.innerText = a1;
    if (valA2) valA2.innerText = a2;
    if (valJokers) valJokers.innerText = jokers;
  };

  // Parse new input names
  const handleAddNames = () => {
    const text = nameInput.value.trim();
    if (!text) return;

    // Support comma or newline delimiter splits
    const names = text.split(/[\n,]+/).map(n => n.trim()).filter(n => n.length > 0);
    
    let addedCount = 0;
    names.forEach(name => {
      // Avoid duplicate names in overall base pool
      if (!participants.some(p => p.name === name)) {
        participants.push({ name, active: true });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      saveParticipants();
      renderParticipants();
      nameInput.value = '';
      playPlipSound(850, 0.1);
    }
  };

  // Select all toggles
  const handleSelectAll = (active) => {
    participants.forEach(p => p.active = active);
    saveParticipants();
    renderParticipants();
    playPlipSound(750, 0.08);
  };

  // Restore previous winners to participant pool without resetting history log
  const handleResetPool = () => {
    if (winners.length === 0) return;
    
    if (confirm('당첨이 완료된 참가자들을 다시 추첨 가능 후보군으로 활성화하시겠습니까? (당첨 기록은 유지됩니다)')) {
      participants.forEach(p => p.active = true);
      saveParticipants();
      renderParticipants();
      playPlipSound(700, 0.1);
    }
  };

  // Clear all states
  const handleClearHistory = () => {
    if (confirm('추첨 내역과 당첨자 대장을 전부 영구적으로 초기화하시겠습니까?')) {
      winners = [];
      saveWinners();
      
      participants.forEach(p => p.active = true);
      saveParticipants();
      
      renderParticipants();
      renderWinners();
      playPlipSound(500, 0.2);
    }
  };

  // ==========================================================================
  // 7. Event Listener Initializations
  // ==========================================================================

  btnDraw.addEventListener('click', startLotteryDraw);
  btnSkipVideo.addEventListener('click', skipBuildup);
  btnCloseWinner.addEventListener('click', closeWinnerModal);

  btnAddNames.addEventListener('click', handleAddNames);
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddNames();
  });

  btnSelectAll.addEventListener('click', () => handleSelectAll(true));
  btnDeselectAll.addEventListener('click', () => handleSelectAll(false));

  btnResetPool.addEventListener('click', handleResetPool);
  btnClearHistory.addEventListener('click', handleClearHistory);

  // Persistence triggers on option change
  optSkipVideo.addEventListener('change', () => {
    localStorage.setItem('brain_lottery_opt_skip', optSkipVideo.checked);
    playPlipSound(800, 0.05);
  });
  
  optAllowRepeat.addEventListener('change', () => {
    localStorage.setItem('brain_lottery_opt_repeat', optAllowRepeat.checked);
    renderParticipants();
    playPlipSound(800, 0.05);
  });

  // ==========================================================================
  // 7.5 Premium 3D Interactive Parallax Card Tilt
  // ==========================================================================
  const cardElement = document.querySelector('.winner-card');
  const shineElement = document.querySelector('.winner-card-shine');

  if (cardElement) {
    cardElement.addEventListener('mouseenter', () => {
      if (!cardElement.classList.contains('flipped')) {
        playShimmerSFX();
      }
    });

    cardElement.addEventListener('mousemove', (e) => {
      const rect = cardElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Dynamic tilt calculations (max 15 degrees)
      const rotateX = ((centerY - y) / centerY) * 15;
      const rotateY = ((x - centerX) / centerX) * 15;

      const isFlipped = cardElement.classList.contains('flipped');

      // Apply 3D matrix transform based on whether card is flipped
      if (isFlipped) {
        cardElement.style.transform = `perspective(1800px) rotateX(${rotateX}deg) rotateY(${180 - rotateY}deg) scale(1.03)`;
      } else {
        cardElement.style.transform = `perspective(1800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
      }

      const isRedCard = cardElement.classList.contains('suit-red');
      const accentColor = isRedCard ? '244, 63, 94' : '0, 255, 196';

      cardElement.style.boxShadow = `
        0 45px 90px rgba(0, 0, 0, 0.95),
        0 0 75px rgba(${accentColor}, 0.25),
        inset 0 0 30px rgba(${accentColor}, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.25)
      `;

      // Update glossy spot reflection
      if (shineElement) {
        const px = (x / rect.width) * 100;
        const py = (y / rect.height) * 100;
        shineElement.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(255, 255, 255, 0.18) 0%, transparent 60%)`;
        shineElement.style.left = '0';
        shineElement.style.width = '100%';
        shineElement.style.height = '100%';
        shineElement.style.transform = 'none';
      }
    });

    cardElement.addEventListener('mouseleave', () => {
      const isFlipped = cardElement.classList.contains('flipped');
      // Smoothly return card to neutral orientation based on flipped state
      if (isFlipped) {
        cardElement.style.transform = `perspective(1800px) rotateX(0deg) rotateY(180deg) scale(1)`;
      } else {
        cardElement.style.transform = `perspective(1800px) rotateX(0deg) rotateY(0deg) scale(1)`;
      }
      cardElement.style.boxShadow = '';

      if (shineElement) {
        shineElement.style.background = '';
        shineElement.style.left = '-100%';
        shineElement.style.width = '100%';
        shineElement.style.height = '100%';
        shineElement.style.transform = '';
      }
    });
  }

  // ==========================================================================
  // 8. Bootstrap initialization
  // ==========================================================================

  loadState();
  renderParticipants();
  renderWinners();

});
