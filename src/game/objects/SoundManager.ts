import { useUIStore } from "@/lib/store/useUIStore";

export class SoundManager {
  private static instance: SoundManager | null = null;
  private ctx: AudioContext | null = null;
  private currentMusic: 'safe_room' | 'briefing_room' | 'combat_tension' | null = null;
  private musicInterval: any = null;
  private activeMusicNodes: AudioNode[] = [];
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private constructor() {
    // Lazy initialize context on first user interaction to comply with browser autoplay policies.
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /**
   * Safe initializer for Web Audio context
   */
  private initContext() {
    if (this.ctx) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      
      // Setup Gain Nodes for master/sfx/music routing
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      // Routing: Source -> Sfx/Music Gain -> Master Gain -> Destination
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Sync volumes from Zustand store
      this.syncVolumeSettings();

      // Listen for volume changes in Zustand store
      useUIStore.subscribe((state) => {
        this.syncVolumeSettings(state.isMuted, state.sfxVolume, state.musicVolume);
      });

    } catch (e) {
      console.error("Web Audio API is not supported in this browser:", e);
    }
  }

  /**
   * Syncs the gain values with the Zustand store settings
   */
  private syncVolumeSettings(muted?: boolean, sfxVol?: number, musicVol?: number) {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return;

    const store = useUIStore.getState();
    const isMuted = muted !== undefined ? muted : store.isMuted;
    const sfxVolume = sfxVol !== undefined ? sfxVol : store.sfxVolume;
    const musicVolume = musicVol !== undefined ? musicVol : store.musicVolume;

    // Apply gains
    const targetMaster = isMuted ? 0 : 1;
    this.masterGain.gain.setValueAtTime(targetMaster, this.ctx.currentTime);
    this.sfxGain.gain.setValueAtTime(sfxVolume, this.ctx.currentTime);
    this.musicGain.gain.setValueAtTime(musicVolume, this.ctx.currentTime);
  }

  /**
   * Resumes the audio context if suspended (autoplay handling)
   */
  private async ensureResume(): Promise<boolean> {
    this.initContext();
    if (!this.ctx) return false;
    
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    return true;
  }

  // =========================================================================
  // SOUND EFFECTS (SFX) SYNTHESIZER
  // =========================================================================

  /**
   * Plays a procedurally generated high-fidelity sound effect.
   */
  public async playSfx(type: 'click' | 'place_item' | 'alarm' | 'stun' | 'laser' | 'breach' | 'heal' | 'victory' | 'defeat') {
    const active = await this.ensureResume();
    if (!active || !this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;

    switch (type) {
      case 'click': {
        // High-tech tactile mechanical click
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = "sine";
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.start(now);
        osc.stop(now + 0.06);
        break;
      }

      case 'place_item': {
        // Cabinet placement thump: low sweep with high mechanical click
        const clickOsc = this.ctx.createOscillator();
        const thumpOsc = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        const thumpGain = this.ctx.createGain();

        clickOsc.connect(clickGain);
        thumpOsc.connect(thumpGain);
        clickGain.connect(this.sfxGain);
        thumpGain.connect(this.sfxGain);

        // Click element
        clickOsc.type = "triangle";
        clickOsc.frequency.setValueAtTime(1000, now);
        clickOsc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
        clickGain.gain.setValueAtTime(0.3, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        // Low thump element
        thumpOsc.type = "sine";
        thumpOsc.frequency.setValueAtTime(150, now);
        thumpOsc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        thumpGain.gain.setValueAtTime(0.7, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        clickOsc.start(now);
        thumpOsc.start(now);
        clickOsc.stop(now + 0.05);
        thumpOsc.stop(now + 0.16);
        break;
      }

      case 'alarm': {
        //Urgent rising-falling high-tech alarm sweep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = "sine";
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.linearRampToValueAtTime(950, now + 0.15);
        osc.frequency.linearRampToValueAtTime(700, now + 0.3);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.05);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.start(now);
        osc.stop(now + 0.31);
        break;
      }

      case 'stun': {
        // High voltage electric crackle/taser shock
        const bufferSize = this.ctx.sampleRate * 0.15; // 0.15s duration
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1; // white noise
        }

        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(800, now);
        filter.Q.setValueAtTime(6.0, now);

        // Modulate filter frequency for cracking effect
        const modOsc = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        modOsc.type = "sawtooth";
        modOsc.frequency.setValueAtTime(45, now);
        modGain.gain.setValueAtTime(500, now);

        modOsc.connect(modGain);
        modGain.connect(filter.frequency);

        const gainNode = this.ctx.createGain();
        noiseNode.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.sfxGain);

        gainNode.gain.setValueAtTime(0.7, now);
        gainNode.gain.linearRampToValueAtTime(0.5, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        modOsc.start(now);
        noiseNode.start(now);
        
        modOsc.stop(now + 0.16);
        noiseNode.stop(now + 0.16);
        break;
      }

      case 'laser': {
        // Kinetic retro taser/laser sweep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(250, now + 0.12);

        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(2000, now);
        filter.frequency.exponentialRampToValueAtTime(400, now + 0.12);

        osc.disconnect(gain);
        osc.connect(filter);
        filter.connect(gain);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

        osc.start(now);
        osc.stop(now + 0.14);
        break;
      }

      case 'breach': {
        // Deep white-noise industrial explosion rumble
        const bufferSize = this.ctx.sampleRate * 0.8;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Sub bass element
        const subOsc = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        subOsc.type = "sine";
        subOsc.frequency.setValueAtTime(90, now);
        subOsc.frequency.linearRampToValueAtTime(30, now + 0.4);
        subGain.gain.setValueAtTime(0.8, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        subOsc.connect(subGain);
        subGain.connect(this.sfxGain);

        // Filtered noise element for burst
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(250, now);
        filter.frequency.exponentialRampToValueAtTime(20, now + 0.6);

        const noiseGain = this.ctx.createGain();
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);

        noiseGain.gain.setValueAtTime(0.9, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        subOsc.start(now);
        noise.start(now);
        subOsc.stop(now + 0.6);
        noise.stop(now + 0.8);
        break;
      }

      case 'heal': {
        // Bright upward arpeggio chime
        const notes = [293.66, 349.23, 440.00, 523.25]; // D4, F4, A4, C5
        notes.forEach((freq, index) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.connect(gain);
          gain.connect(this.sfxGain!);

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + index * 0.08);

          gain.gain.setValueAtTime(0.001, now + index * 0.08);
          gain.gain.linearRampToValueAtTime(0.25, now + index * 0.08 + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.2);

          osc.start(now + index * 0.08);
          osc.stop(now + index * 0.08 + 0.21);
        });
        break;
      }

      case 'victory': {
        // High-pitched glorious major pentatonic sweep
        const notes = [523.25, 659.25, 783.99, 880.00, 1046.50]; // C5, E5, G5, A5, C6
        notes.forEach((freq, index) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.connect(gain);
          gain.connect(this.sfxGain!);

          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + index * 0.06);

          gain.gain.setValueAtTime(0.001, now + index * 0.06);
          gain.gain.linearRampToValueAtTime(0.2, now + index * 0.06 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.06 + 0.35);

          osc.start(now + index * 0.06);
          osc.stop(now + index * 0.06 + 0.36);
        });
        break;
      }

      case 'defeat': {
        // Descending melancholy low square sweep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(90, now + 0.6);

        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(300, now);
        filter.frequency.exponentialRampToValueAtTime(40, now + 0.6);

        osc.disconnect(gain);
        osc.connect(filter);
        filter.connect(gain);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

        osc.start(now);
        osc.stop(now + 0.7);
        break;
      }
    }
  }

  // =========================================================================
  // BACKGROUND MUSIC (BGM) SCHEDULER
  // =========================================================================

  /**
   * Plays a procedurally looping background atmospheric track.
   */
  public async playMusic(type: 'safe_room' | 'briefing_room' | 'combat_tension') {
    const active = await this.ensureResume();
    if (!active || !this.ctx || !this.musicGain) return;

    if (this.currentMusic === type) return; // already playing this track

    // Stop current track cleanly
    this.stopMusic();

    this.currentMusic = type;

    switch (type) {
      case 'safe_room': {
        // Cozy Ambient Cyber-Pad (FM7 - BbM7 - Eb7 - Abmaj7 progression)
        // 4 chords, 4 seconds per chord, slowly loops in background
        const chords = [
          [174.61, 220.00, 261.63, 329.63], // F3, A3, C4, E4 (Fmaj7)
          [233.08, 293.66, 349.23, 440.00], // Bb3, D4, F4, A4 (Bbmaj7)
          [155.56, 196.00, 233.08, 311.13], // Eb3, G3, Bb3, Eb4 (Eb)
          [207.65, 261.63, 311.13, 392.00]  // Ab3, C4, Eb4, G4 (Abmaj7)
        ];
        
        let chordIdx = 0;
        const playPadChord = () => {
          if (this.currentMusic !== 'safe_room' || !this.ctx) return;
          const now = this.ctx.currentTime;
          const notes = chords[chordIdx];

          notes.forEach((freq) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            osc.connect(gain);
            gain.connect(this.musicGain!);

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, now);

            // Resonant sweeping filter for high-end glassmorphic pad warmth
            const filter = this.ctx!.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(200, now);
            filter.frequency.linearRampToValueAtTime(500, now + 2.0);
            filter.frequency.linearRampToValueAtTime(200, now + 4.0);

            osc.disconnect(gain);
            osc.connect(filter);
            filter.connect(gain);

            // Fade in and out beautifully
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.12, now + 1.5);
            gain.gain.linearRampToValueAtTime(0.12, now + 3.0);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 4.0);

            osc.start(now);
            osc.stop(now + 4.1);

            this.activeMusicNodes.push(osc, gain, filter);
          });

          // Move to next chord
          chordIdx = (chordIdx + 1) % chords.length;
        };

        // Trigger immediately and schedule every 4 seconds
        playPadChord();
        this.musicInterval = setInterval(playPadChord, 4000);
        break;
      }

      case 'briefing_room': {
        // Tactical Terminal Pulse (Bass note + high radar click)
        // 110 BPM (0.54s per beat). Low techno pulses with soft chimes
        const bassSequence = [110.00, 110.00, 130.81, 146.83]; // A2, A2, C3, D3
        let beatIdx = 0;

        const playBriefingPulse = () => {
          if (this.currentMusic !== 'briefing_room' || !this.ctx) return;
          const now = this.ctx.currentTime;

          // Bass heartbeat
          const bassOsc = this.ctx.createOscillator();
          const bassGain = this.ctx.createGain();
          bassOsc.connect(bassGain);
          bassGain.connect(this.musicGain!);

          bassOsc.type = "triangle";
          bassOsc.frequency.setValueAtTime(bassSequence[beatIdx % bassSequence.length], now);
          bassGain.gain.setValueAtTime(0.15, now);
          bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

          bassOsc.start(now);
          bassOsc.stop(now + 0.42);
          this.activeMusicNodes.push(bassOsc, bassGain);

          // Radar sweep ping on beat 4
          if (beatIdx % 4 === 3) {
            const pingOsc = this.ctx.createOscillator();
            const pingGain = this.ctx.createGain();
            pingOsc.connect(pingGain);
            pingGain.connect(this.musicGain!);

            pingOsc.type = "sine";
            pingOsc.frequency.setValueAtTime(987.77, now); // B5 radar ping
            pingGain.gain.setValueAtTime(0.001, now);
            pingGain.gain.linearRampToValueAtTime(0.06, now + 0.02);
            pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

            pingOsc.start(now);
            pingOsc.stop(now + 0.52);
            this.activeMusicNodes.push(pingOsc, pingGain);
          }

          beatIdx++;
        };

        playBriefingPulse();
        this.musicInterval = setInterval(playBriefingPulse, 540);
        break;
      }

      case 'combat_tension': {
        // Fast Industrial Cyber-Breach (145 BPM - 0.41s per beat)
        // Aggressive square wave bass and filtered drum heartbeat thump
        const combatBass = [73.42, 73.42, 87.31, 98.00]; // D2, D2, F2, G2
        let beatIdx = 0;

        const playCombatBeat = () => {
          if (this.currentMusic !== 'combat_tension' || !this.ctx) return;
          const now = this.ctx.currentTime;

          // Aggressive cyber-bass
          const bassOsc = this.ctx.createOscillator();
          const bassGain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(280, now);

          bassOsc.connect(filter);
          filter.connect(bassGain);
          bassGain.connect(this.musicGain!);

          bassOsc.type = "sawtooth";
          // Sequence bass tones
          bassOsc.frequency.setValueAtTime(combatBass[beatIdx % combatBass.length], now);

          bassGain.gain.setValueAtTime(0.12, now);
          bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

          bassOsc.start(now);
          bassOsc.stop(now + 0.36);
          this.activeMusicNodes.push(bassOsc, bassGain, filter);

          // Heavy industrial kick drum beat
          if (beatIdx % 2 === 0) {
            const kickOsc = this.ctx.createOscillator();
            const kickGain = this.ctx.createGain();
            kickOsc.connect(kickGain);
            kickGain.connect(this.musicGain!);

            kickOsc.type = "sine";
            kickOsc.frequency.setValueAtTime(110, now);
            kickOsc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

            kickGain.gain.setValueAtTime(0.35, now);
            kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

            kickOsc.start(now);
            kickOsc.stop(now + 0.14);
            this.activeMusicNodes.push(kickOsc, kickGain);
          }

          // Cyber tension chime on alternate measures
          if (beatIdx % 8 === 4) {
            const chimeOsc = this.ctx.createOscillator();
            const chimeGain = this.ctx.createGain();
            chimeOsc.connect(chimeGain);
            chimeGain.connect(this.musicGain!);

            chimeOsc.type = "sine";
            chimeOsc.frequency.setValueAtTime(1318.51, now); // E6 siren frequency
            chimeOsc.frequency.linearRampToValueAtTime(880.00, now + 0.3); // sliding down

            chimeGain.gain.setValueAtTime(0.04, now);
            chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

            chimeOsc.start(now);
            chimeOsc.stop(now + 0.32);
            this.activeMusicNodes.push(chimeOsc, chimeGain);
          }

          beatIdx++;
        };

        playCombatBeat();
        this.musicInterval = setInterval(playCombatBeat, 410);
        break;
      }
    }
  }

  /**
   * Stop looping ambient background music cleanly
   */
  public stopMusic() {
    this.currentMusic = null;

    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }

    // Clean up active oscillators and gains instantly
    for (const node of this.activeMusicNodes) {
      try {
        (node as any).stop();
      } catch (e) {
        // ignore errors on stopped nodes or non-audio nodes
      }
      try {
        node.disconnect();
      } catch (e) {
        // ignore
      }
    }
    this.activeMusicNodes = [];
  }
}
