/* 资源预加载与失败兜底 */
const Loader = {
  images: {},
  audios: {},
  imgOk: {},
  audioOk: {},
  soundOn: true,
  audioUnlocked: false,

  load(onProgress, onDone) {
    const imgKeys = Object.keys(CONFIG.IMAGES);
    const audKeys = Object.keys(CONFIG.AUDIO);
    const total = imgKeys.length + audKeys.length;
    let done = 0;
    const step = () => {
      done++;
      if (onProgress) onProgress(Math.round(done / total * 100));
      if (done >= total && onDone) onDone();
    };
    if (total === 0) { if (onProgress) onProgress(100); if (onDone) onDone(); return; }

    imgKeys.forEach((k) => {
      const img = new Image();
      let settled = false;
      const finish = (ok) => { if (settled) return; settled = true; this.imgOk[k] = ok; step(); };
      img.onload = () => finish(true);
      img.onerror = () => finish(false);
      setTimeout(() => finish(!!img.complete && img.naturalWidth > 0), 6000);
      img.src = CONFIG.IMAGES[k];
      this.images[k] = img;
    });

    audKeys.forEach((k) => {
      try {
        const a = new Audio();
        let settled = false;
        const finish = (ok) => { if (settled) return; settled = true; this.audioOk[k] = ok; step(); };
        a.addEventListener('canplaythrough', () => finish(true));
        a.addEventListener('error', () => finish(false));
        setTimeout(() => finish(false), 4000);
        a.preload = 'auto';
        a.src = CONFIG.AUDIO[k];
        a.load();
        this.audios[k] = a;
      } catch (e) { this.audioOk[k] = false; step(); }
    });
  },

  img(key) {
    return this.imgOk[key] ? this.images[key] : null;
  },

  unlockAudio() {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    Object.keys(this.audios).forEach((k) => {
      const a = this.audios[k];
      try {
        a.volume = 0;
        const p = a.play();
        if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.volume = 1; }).catch(() => { a.volume = 1; });
        else { a.pause(); a.currentTime = 0; a.volume = 1; }
      } catch (e) { /* 静默 */ }
    });
  },

  play(key) {
    if (!this.soundOn) return;
    const a = this.audios[key];
    if (!a) return;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => { /* 自动播放被拒，静默跳过 */ });
    } catch (e) { /* 不阻塞流程 */ }
  }
};
