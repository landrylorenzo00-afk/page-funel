(() => {
  // Web3Forms configuration (form submission)
  const WEB3FORMS_URL = "https://api.web3forms.com/submit";
  const WEB3FORMS_ACCESS_KEY = "c9f1b15e-2774-41bf-8934-70d3f0986432";
  const STORAGE_KEY = "gate:unlockedUntil";
  const UNLOCK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  const video = document.querySelector('#heroVideo, #gateVideo');
  const playBtn = document.getElementById("watch") || document.getElementById("play");
  const videoVeil = document.getElementById("videoVeil");
  const videoThumb = document.getElementById("videoThumb");
  const cta = document.getElementById("cta");
  const ctaBottom = document.getElementById('ctaBottom');
  const ctaDemo = document.getElementById('ctaDemo');
  const seeDemoBottom = document.getElementById('seeDemoBottom');
  const hint = document.getElementById("hint");

  let unlocked = false;
  let maxTimeReached = 0;

  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (_) {
      return null;
    }
  })();

  if (saved && typeof saved.expires === "number" && saved.expires > Date.now()) {
    applyUnlock(true);
  }

  if (video) {
    video.controls = false;
    // Forcer les attributs de compatibilité mobile
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline','');

    video.addEventListener("loadedmetadata", () => {
      maxTimeReached = video.currentTime || 0;
      // Fallback poster: si aucun poster, appliquer un background image au conteneur
      const wrap = video.parentElement;
      if (wrap && !video.getAttribute('poster')) {
        wrap.style.backgroundImage = "url('assets/poster.jpg')";
      }
    });

    // Une fois prête à jouer, déclencher le fondu
    video.addEventListener('canplay', () => { video.classList.add('video-ready'); });

    video.addEventListener("play", () => {
      // ensure playback rate stays at 1x
      if (video.playbackRate !== 1) video.playbackRate = 1;
    });

    // Déverrouillage après 5 s de lecture (sans attendre la fin)
    const UNLOCK_AFTER_S = 5;
    video.addEventListener("timeupdate", () => {
      if (video.currentTime > maxTimeReached) {
        maxTimeReached = video.currentTime;
      }
      if (!unlocked && video.currentTime >= UNLOCK_AFTER_S) {
        applyUnlock(true);
        persistUnlock();
      }
    });

    video.addEventListener("seeking", () => {
      if (video.currentTime > maxTimeReached + 0.35) {
        video.currentTime = maxTimeReached;
      }
    });

    video.addEventListener("ratechange", () => {
      if (video.playbackRate !== 1) video.playbackRate = 1;
    });

    video.addEventListener("ended", () => {
      applyUnlock(true);
      persistUnlock();
    });

    video.addEventListener("contextmenu", (event) => event.preventDefault());
    video.addEventListener("dragstart", (event) => event.preventDefault());
  }

  if (playBtn && video) {
    const tryPlay = async () => {
      try {
        // Lecture avec son suite à un geste utilisateur
        video.muted = false; video.volume = 1;
        await video.play();
        // Activer les contrôles pour permettre le plein écran natif
        video.controls = true;
        playBtn.style.display = "none";
        if (videoVeil) videoVeil.classList.add('hidden');
        if (videoThumb) videoThumb.classList.add('hidden');
      } catch (_) {
        playBtn.style.display = "inline-flex";
      }
    };
    playBtn.addEventListener("click", tryPlay);
    video.addEventListener("click", () => {
      if (video.paused) {
        video.muted = false; video.volume = 1;
        try { video.currentTime = 0; } catch(_) {}
        tryPlay();
      }
    });
  }

  // Secondary demo CTAs
  function scrollToVideo() {
    if (!video) return;
    try { video.currentTime = 0; } catch(_) {}
    video.muted = false; video.volume = 1;
    video.play().catch(()=>{});
    video.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (ctaDemo) ctaDemo.addEventListener('click', scrollToVideo);
  if (seeDemoBottom) seeDemoBottom.addEventListener('click', scrollToVideo);

  // Bouton “Voir la vidéo”: lecture inline + scroll (pas de nouvel onglet)
  (function wireInlineWatch(){
    const btn = document.querySelector('#watch');
    const vid = document.querySelector('#heroVideo');
    if (btn && vid) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        // Activer le son à la lecture (geste utilisateur)
        vid.muted = false; vid.volume = 1;
        try { vid.currentTime = 0; } catch(_) {}
        vid.play().catch(()=>{});
        vid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      vid.addEventListener('canplay', () => vid.classList.add('video-ready'));
    }
  })();

  document.addEventListener(
    "keydown",
    (event) => {
      const targetTag = (event.target && event.target.tagName) || "";
      if (["INPUT", "TEXTAREA"].includes(targetTag)) return;
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  function applyUnlock(state) {
    unlocked = state;
    if (!cta) return;
    if (state) {
      cta.disabled = false;
      cta.classList.remove("locked");
      cta.removeAttribute("aria-disabled");
      if (hint) hint.textContent = "Prise de rendez-vous débloquée.";
    } else {
      cta.disabled = true;
      cta.classList.add("locked");
      cta.setAttribute("aria-disabled", "true");
    }
  }

  function persistUnlock() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ expires: Date.now() + UNLOCK_TTL_MS })
      );
    } catch (_) {
      /* ignore quota errors */
    }
  }

  // Modal Calendly (inline embed)
  const overlay = document.getElementById("calOverlay");
  const modal = overlay ? overlay.querySelector(".modal") : null;
  const closeBtn = document.getElementById("calClose");
  const embedHost = document.getElementById("calEmbed");
  const toast = document.getElementById("toast");
  // Pages internes
  const pageSuccess = document.getElementById('pageSuccess');
  const pageOops = document.getElementById('pageOops');
  const successClose = document.getElementById('successClose');
  const oopsClose = document.getElementById('oopsClose');
  const callbackForm = document.getElementById('callbackForm');
  const cbStatus = document.getElementById('cbStatus');
  const cbSubmit = document.getElementById('cbSubmit');
  const oopsCallNow = document.getElementById('oopsCallNow');
  let prevFocusEl = null;
  let hasBooked = false;

  function showToast(message, kind = "info") {
    if (!toast) return;
    toast.className = `toast ${kind}`;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 4500);
  }

  function getFocusable(container) {
    return Array.from(
      container.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.hasAttribute('disabled'));
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const focusables = getFocusable(modal);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      closeCalendly();
    } else {
      trapFocus(e);
    }
  }

  function waitForCalendly(timeoutMs = 6000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      (function check() {
        if (window.Calendly && typeof window.Calendly.initInlineWidget === 'function') return resolve();
        if (Date.now() - start > timeoutMs) return reject(new Error('Calendly load timeout'));
        setTimeout(check, 100);
      })();
    });
  }

  async function openCalendly() {
    if (!(overlay && modal && embedHost)) return;
    hasBooked = false;
    prevFocusEl = document.activeElement;
    document.body.classList.add('modal-open');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    try {
      await waitForCalendly();
      embedHost.innerHTML = '';
      Calendly.initInlineWidget({
        url: cta.dataset.calendlyUrl || 'https://calendly.com/onx24contact/appel-decouverte',
        parentElement: embedHost,
        prefill: {},
        utm: {}
      });
      (closeBtn || modal).focus();
      overlay.addEventListener('keydown', onKeydown);
    } catch (err) {
      showToast("Impossible de charger Calendly. Réessayez.", 'info');
      closeCalendly();
    }
  }

  function closeCalendly() {
    if (!(overlay && modal && embedHost)) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    embedHost.innerHTML = '';
    overlay.removeEventListener('keydown', onKeydown);
    if (prevFocusEl && typeof prevFocusEl.focus === 'function') prevFocusEl.focus();
    // Ouvrir la page interne correspondante
    if (hasBooked) openPage('success'); else openPage('oops');
  }

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeCalendly();
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', closeCalendly);
  if (oopsCallNow) {
    oopsCallNow.addEventListener('click', () => {
      const panel = document.getElementById('callback');
      if (!panel) return;
      const hidden = panel.classList.toggle('is-hidden');
      oopsCallNow.setAttribute('aria-expanded', String(!hidden));
      if (!hidden) {
        const first = document.getElementById('cbName');
        if (first) first.focus();
      }
    });
  }

  // Écoute des événements Calendly (postMessage)
  window.addEventListener('message', (e) => {
    if (!String(e.origin).includes('calendly.com')) return;
    if (e.data && e.data.event === 'calendly.event_scheduled') {
      hasBooked = true;
    }
  });

  if (cta) {
    cta.addEventListener('click', (e) => {
      if (cta.disabled) { e.preventDefault(); return; }
      e.preventDefault();
      openCalendly();
    });
  }
  if (ctaBottom) {
    ctaBottom.addEventListener('click', (e) => { e.preventDefault(); openCalendly(); });
  }

  // Pages internes (Succès / Dommage)
  // (Liens calendrier supprimés – confirmation par e‑mail)

  function openPage(kind) {
    const overlay = kind === 'success' ? pageSuccess : pageOops;
    if (!overlay) return;
    document.body.classList.add('modal-open');
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    const page = overlay.querySelector('.page');
    (page || overlay).focus();
    // Update hash for deeplink
    const targetHash = kind === 'success' ? '#merci' : '#dommage';
    if (location.hash !== targetHash) history.pushState(null, '', targetHash);
    // Trap focus within overlay
    const keyHandler = (e) => {
      if (e.key === 'Escape') { closePage(kind); }
      else trapFocus(e);
    };
    overlay.addEventListener('keydown', keyHandler);
    overlay.dataset.keyHandler = '1';
  }
  function closePage(kind) {
    const overlay = kind === 'success' ? pageSuccess : pageOops;
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('modal-open');
    // Clean hash
    if (location.hash === (kind === 'success' ? '#merci' : '#dommage')) {
      history.replaceState(null, '', '#top');
    }
    if (prevFocusEl && typeof prevFocusEl.focus === 'function') prevFocusEl.focus();
  }
  if (successClose) successClose.addEventListener('click', () => closePage('success'));
  if (oopsClose) oopsClose.addEventListener('click', () => closePage('oops'));

  // Deep-links
  window.addEventListener('hashchange', () => {
    if (location.hash === '#merci') openPage('success');
    else if (location.hash === '#dommage') openPage('oops');
  });
  // Initial hash check
  if (location.hash === '#merci') openPage('success');
  if (location.hash === '#dommage') openPage('oops');

  // Callback form — Web3Forms JSON POST avec validation + honeypot
  if (callbackForm) {
    callbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      // Honeypot anti-bot
      const hp = (document.getElementById('honey')||{}).value;
      if (hp && hp.trim() !== '') { return; }
      const name = (document.getElementById('cbName')||{}).value?.trim();
      const phone = (document.getElementById('cbPhone')||{}).value?.trim();
      if (!name || !phone) { if (cbStatus) cbStatus.textContent = 'Renseignez nom et téléphone.'; return; }
      if (name.length < 2 || phone.length < 6) { if (cbStatus) cbStatus.textContent = 'Vérifiez vos informations.'; return; }
      try {
        if (cbSubmit) { cbSubmit.disabled = true; cbSubmit.textContent = 'Envoi…'; }
        if (cbStatus) cbStatus.textContent = '';
        const res = await fetch(WEB3FORMS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_key: WEB3FORMS_ACCESS_KEY,
            name,
            phone,
            subject: 'Demande de rappel — Receptionist.IA',
            from_name: 'Receptionist.IA',
            reply_to: '',
            source: 'Receptionist.IA – Dommage',
            timestamp: new Date().toISOString(),
            honeypot: ''
          })
        });
        const data = await res.json().catch(() => ({ success: false }));
        if (data && data.success) {
          closePage('oops');
          showToast('✅ Demande envoyée, on vous rappelle vite', 'success');
          if (toast) toast.onclick = () => openCalendly();
        } else {
          showToast('❌ Échec, réessaye', 'info');
        }
      } catch (err) {
        showToast('❌ Échec, réessaie', 'info');
      } finally {
        if (cbSubmit) { cbSubmit.disabled = false; cbSubmit.textContent = 'Envoyer'; }
      }
    });
  }

  // Compteur 0 → 20+ (une seule fois)
  (function initCounter(){
    const el = document.getElementById('counterValue');
    if (!el) return;
    const target = parseInt(el.dataset.target || '20', 10);
    let done = false;
    const animate = (duration=1000) => {
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration);
        el.textContent = String(Math.floor(p * target));
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = String(target);
      };
      requestAnimationFrame(tick);
    };
    const obs = new IntersectionObserver((entries)=>{
      entries.forEach(en=>{
        if (en.isIntersecting && !done) { done = true; animate(); obs.disconnect(); }
      });
    }, { threshold: 0.6 });
    obs.observe(el);
  })();

  // Bookings weekly count + offer slots
  (function initBookingsAndOffer(){
    const bookingsEl = document.getElementById('bookingsCount');
    const slotsTop = document.getElementById('slotsLeft');
    const slotsBottom = document.getElementById('slotsLeftBottom');
    // Randomized but stable per day
    const seedBase = new Date().toDateString();
    function seededRand(min, max) {
      let h = 0; for (let i=0;i<seedBase.length;i++) h = Math.imul(31, h) + seedBase.charCodeAt(i) | 0;
      const x = Math.abs(Math.sin(h)) % 1; return Math.floor(x * (max - min + 1)) + min;
    }
    const weekly = seededRand(12, 28);
    const slotsTarget = 11; // FOMO éthique: valeur crédible et fixe
    function animateNumber(el, target, duration=800) {
      if (!el) return;
      const start = parseInt(el.textContent.replace(/\D/g,'')) || 0;
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        const val = Math.round(start + (target - start) * p);
        el.textContent = String(val);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    if (bookingsEl) animateNumber(bookingsEl, weekly, 900);
    if (slotsTop) animateNumber(slotsTop, slotsTarget, 900);
    if (slotsBottom) animateNumber(slotsBottom, slotsTarget, 900);
  })();

  // Limited offer countdown (to end of month)
  (function initOfferTimer(){
    const elTop = document.getElementById('offerTimer');
    const elBottom = document.getElementById('offerTimerBottom');
    function pad(n){ return n.toString().padStart(2,'0'); }
    function endOfMonth(){
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth()+1, 1, 0,0,0,0);
    }
    function tick(){
      const now = new Date();
      const end = endOfMonth();
      let diff = Math.max(0, end - now);
      const d = Math.floor(diff / (24*3600e3)); diff -= d*24*3600e3;
      const h = Math.floor(diff / 3600e3); diff -= h*3600e3;
      const m = Math.floor(diff / 60e3); diff -= m*60e3;
      const s = Math.floor(diff / 1e3);
      const val = (d>0? d+"j ":"") + pad(h)+":"+pad(m)+":"+pad(s);
      if (elTop) elTop.textContent = val; if (elBottom) elBottom.textContent = val;
    }
    tick(); setInterval(tick, 1000);
  })();

  // Charts (Chart.js) — fallback
  function chartsFallbackMessage() {
    const cards = document.querySelectorAll('.chart-card');
    cards.forEach((card) => {
      const msg = document.createElement('p');
      msg.className = 'chart-note';
      msg.textContent = 'Graphiques indisponibles pour le moment.';
      card.appendChild(msg);
    });
  }

  let chartRespInstance = null;
  let chartQualInstance = null;

  function initCharts() {
    try {
      const respEl = document.getElementById("chart-response");
      const qualEl = document.getElementById("chart-qualification");
      if (!respEl || !qualEl) return;
      if (!window.Chart) { chartsFallbackMessage(); return; }

    const fontFamily = getComputedStyle(document.documentElement).getPropertyValue("font-family");
    Chart.defaults.color = "#f5f5f5";
    Chart.defaults.font = { family: fontFamily.replace(/"/g, "") };

    const responseCtx = respEl.getContext("2d");
    const qualificationCtx = qualEl.getContext("2d");

    if (chartRespInstance && chartRespInstance.destroy) chartRespInstance.destroy();
    if (chartQualInstance && chartQualInstance.destroy) chartQualInstance.destroy();

    chartRespInstance = new Chart(responseCtx, {
      type: "line",
      data: {
        labels: ["< 5 min", "10 min", "30 min"],
        datasets: [
          {
            label: "Indice odds de contact (5 min = 100)",
            data: [100, 15, 5],
            borderColor: "#3b82f6",
            backgroundColor: "rgba(59, 130, 246, 0.2)",
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: "#3b82f6",
            pointBorderColor: "#3b82f6",
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterBody: () => ["Données en indices relatifs (échelle simple)."],
            },
          },
        },
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.12)" } },
          y: { beginAtZero: true, suggestedMax: 110, grid: { color: "rgba(255,255,255,0.12)" } },
        },
      },
    });

    chartQualInstance = new Chart(qualificationCtx, {
      type: "bar",
      data: {
        labels: ["< 1 h", "> 1 h", "24 h+"],
        datasets: [
          {
            label: "Indice odds de qualification",
            data: [60, 60 / 7, 1],
            backgroundColor: "#3b82f6",
            borderColor: "#3b82f6",
            borderWidth: 1.5,
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              footer: () => ["Données en indices relatifs (échelle simple)."],
            },
          },
        },
        scales: { x: { grid: { color: "rgba(255,255,255,0.12)" } }, y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.12)" } } },
      },
    });
    } catch (err) {
      // Protéger l’app contre erreurs Chart/CDN
      console.warn('Charts non initialisés:', err);
      chartsFallbackMessage();
    }
  }

  // Init unique sur DOMContentLoaded
  window.addEventListener('DOMContentLoaded', () => { initCharts(); });

  // Calculator
  const form = document.getElementById("lossForm");
  const out = document.getElementById("lossOut");
  const missedInput = document.getElementById("missed");
  const ticketInput = document.getElementById("ticket");
  const convInput = document.getElementById("conv");
  const missedRange = document.getElementById('missedRange');
  const ticketRange = document.getElementById('ticketRange');
  const convRange = document.getElementById('convRange');
  const segmentRadios = document.querySelectorAll('input[name="seg"]');
  const steps = Array.from(document.querySelectorAll('.step'));
  const nextBtn = document.getElementById('nextStep');
  const prevBtn = document.getElementById('prevStep');
  const progressBar = document.getElementById('calcProgress');
  const personalizedCta = document.getElementById('personalizedCta');
  const finalAmount = document.getElementById('finalAmount');

  const defaults = {
    services: { missed: 30, ticket: 200, conv: 50 },
    resto: { missed: 120, ticket: 18, conv: 80 },
  };

  function setDefaults(segment) {
    const values = defaults[segment] || defaults.services;
    if (missedInput) missedInput.value = values.missed;
    if (ticketInput) ticketInput.value = values.ticket;
    if (convInput) convInput.value = values.conv;
    if (missedRange) missedRange.value = values.missed;
    if (ticketRange) ticketRange.value = values.ticket;
    if (convRange) convRange.value = values.conv;
    computeLoss();
  }

  function getSelectedSegment() {
    const selected = Array.from(segmentRadios).find((radio) => radio.checked);
    return selected ? selected.value : "services";
  }

  function formatEUR(value) {
    try {
      return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(value);
    } catch (_) {
      return `€ ${Math.round(value)}`;
    }
  }

  function computeLoss(event) {
    if (event) event.preventDefault();
    if (!(missedInput && ticketInput && convInput && out)) return;
    const missed = Math.max(0, Number(missedInput.value || 0));
    const ticket = Math.max(0, Number(ticketInput.value || 0));
    const convRate = Math.max(0, Math.min(100, Number(convInput.value || 0))) / 100;
    const loss = missed * ticket * convRate;
    out.innerHTML = `Perte estimée / mois : <strong>${formatEUR(loss)}</strong>`;
    // Personalize CTA and final headline
    const txt = `Récupérez ${formatEUR(loss)} / mois`;
    if (personalizedCta) personalizedCta.textContent = txt;
    if (finalAmount) finalAmount.textContent = `${formatEUR(loss)} / mois`;
  }

  // Wizard logic
  let stepIndex = 1;
  function showStep(n) {
    stepIndex = Math.max(1, Math.min(5, n));
    steps.forEach((s) => { const id = Number(s.dataset.step); s.hidden = id !== stepIndex; });
    if (progressBar) progressBar.style.width = `${((stepIndex-1)/4)*100}%`;
    if (prevBtn) prevBtn.disabled = stepIndex === 1;
    if (nextBtn) nextBtn.textContent = stepIndex === 5 ? 'Terminer' : 'Suivant';
  }
  function nextStepFn(){
    if (stepIndex === 4) computeLoss();
    showStep(stepIndex + 1);
  }
  function prevStepFn(){ showStep(stepIndex - 1); }
  if (nextBtn) nextBtn.addEventListener('click', nextStepFn);
  if (prevBtn) prevBtn.addEventListener('click', prevStepFn);

  segmentRadios.forEach((radio) => {
    radio.addEventListener("change", () => setDefaults(getSelectedSegment()));
  });

  [missedInput, ticketInput, convInput].forEach((input) => {
    if (!input) return;
    ["input", "change"].forEach((eventName) => input.addEventListener(eventName, computeLoss));
  });

  // Sync ranges <-> inputs
  if (missedRange && missedInput) {
    missedRange.addEventListener('input', () => { missedInput.value = missedRange.value; });
    missedInput.addEventListener('input', () => { missedRange.value = missedInput.value; });
  }
  if (ticketRange && ticketInput) {
    ticketRange.addEventListener('input', () => { ticketInput.value = ticketRange.value; });
    ticketInput.addEventListener('input', () => { ticketRange.value = ticketInput.value; });
  }
  if (convRange && convInput) {
    convRange.addEventListener('input', () => { convInput.value = convRange.value; });
    convInput.addEventListener('input', () => { convRange.value = convInput.value; });
  }

  setDefaults(getSelectedSegment());
  showStep(1);

  if (personalizedCta) {
    personalizedCta.addEventListener('click', (e) => {
      e.preventDefault();
      if (cta && cta.disabled) {
        showToast('Regardez la vidéo 5 s pour débloquer.', 'info');
        return;
      }
      openCalendly();
    });
  }

  // (Audit quick-capture removed per request)

  // Intersection observer for subtle reveal
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  document.querySelectorAll(".card, .pillar, .section").forEach((el) => {
    el.classList.add("pre");
    observer.observe(el);
  });
  // Fallback apparition si l'observer ne déclenche pas rapidement
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      document.querySelectorAll('.pre:not(.in)').forEach(el => el.classList.add('in'));
    }, 600);
  });

  // (Live notifications removed per request)

  // (Lead form removed per request)

  // Parallax (subtle)
  (function initParallax(){
    const els = document.querySelectorAll('.parallax');
    if (!els.length) return;
    let raf = null;
    function update(){
      const y = window.scrollY || 0;
      els.forEach(el => { el.style.setProperty('--py', `${Math.min(12, y * 0.04)}px`); });
      raf = null;
    }
    function onScroll(){ if (raf) return; raf = requestAnimationFrame(update); }
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
  })();
})();
