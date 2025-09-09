/*
  chiến thuật tấn công
  Điều khiển:
    - Bàn phím: ← → để di chuyển, ↑ để nhảy, Space để tấn công
    - Cảm ứng:
        + Chọn Joystick: cần điều khiển ảo cho trái/phải + nút Nhảy/Chém
        + Chọn Hai nút: nút Trái/Phải + Nhảy/Chém
  Mục tiêu: Tiến độ đạt 100% là hoàn thành màn.
*/

(() => {
  // DOM
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  // Base logical resolution for the game viewport (kept for world/camera)
  // The canvas will scale to fit the screen while preserving this aspect ratio.
  const BASE_WIDTH = 960;
  const BASE_HEIGHT = 540;

  // View/resolution state
  const view = { dpr: 1, scale: 1, cssWidth: 0, cssHeight: 0 };

  // Resize and HiDPI handling: match canvas internal buffer to CSS size * DPR,
  // and scale the context so drawing uses BASE_* logical units.
  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    view.cssWidth = rect.width || BASE_WIDTH;
    view.cssHeight = rect.height || (BASE_HEIGHT * (rect.width ? rect.width / BASE_WIDTH : 1));
    view.dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));

    const displayWidth = Math.round(view.cssWidth * view.dpr);
    const displayHeight = Math.round(view.cssHeight * view.dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    // Because the CSS enforces 16:9, width/height ratios match; compute scale from width
    view.scale = view.cssWidth / BASE_WIDTH;

    // Set transform so that 1 unit in game space == 1 unit at BASE_* after scaling
    ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, 0, 0);
  }

  // Recompute on resize/orientation and at start
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", resizeCanvas);
  resizeCanvas();

  const startScreen = document.getElementById("startScreen");
  const finishScreen = document.getElementById("finishScreen");
  const replayBtn = document.getElementById("replay");

  const chooseJoystickBtn = document.getElementById("choose-joystick");
  const chooseButtonsBtn = document.getElementById("choose-buttons");

  const controlsJoystick = document.getElementById("controls-joystick");
  const controlsButtons = document.getElementById("controls-buttons");

  const skillScreen = document.getElementById("skillScreen");
  const skillLightningBtn = document.getElementById("skill-lightning");
  const skillTurretBtn = document.getElementById("skill-turret");
  const skillTeamBtn = document.getElementById("skill-team");

  // Character and Level selection
  const charButtons = Array.from(document.querySelectorAll(".char-btn"));
  const levelButtons = Array.from(document.querySelectorAll(".level-btn"));
  let currentLevelId = 1;
  let selectedChar = "pistol";
  function setSelectedChar(c) {
    selectedChar = c;
    charButtons.forEach(btn => btn.classList.toggle("selected", btn.dataset.char === c));
    if (chooseJoystickBtn) chooseJoystickBtn.disabled = false;
    if (chooseButtonsBtn) chooseButtonsBtn.disabled = false;
  }
  function setLevel(id) {
    currentLevelId = id;
    levelButtons.forEach(btn => btn.classList.toggle("selected", Number(btn.dataset.level) === id));
  }
  // Bind selections
  charButtons.forEach(btn => {
    if (!btn.disabled) {
      btn.addEventListener("click", () => {
        setSelectedChar(btn.dataset.char);
        // Cập nhật biểu tượng nút tấn công theo nhân vật được chọn
        updateAttackButtons(btn.dataset.char);
      });
    }
  });
  levelButtons.forEach(btn => {
    btn.addEventListener("click", () => setLevel(Number(btn.dataset.level)));
  });
  // Defaults
  setSelectedChar("pistol");
  setLevel(1);

  // Joystick elements
  const joyBase = document.getElementById("joystick-base");
  const joyStick = document.getElementById("joystick-stick");
  const btnJumpJoy = document.getElementById("btn-jump-joy");
  const btnAttackJoy = document.getElementById("btn-attack-joy");

  // Two-buttons elements
  const btnLeft = document.getElementById("btn-left");
  const btnRight = document.getElementById("btn-right");
  const btnJump = document.getElementById("btn-jump");
  const btnAttack = document.getElementById("btn-attack");

  const progressBar = document.getElementById("progress-bar");
  const progressText = document.getElementById("progress-text");
  const hpBar = document.getElementById("hp-bar");
  const hpText = document.getElementById("hp-text");
  const finishTitle = document.getElementById("finishTitle");
  const finishDesc = document.getElementById("finishDesc");
  const levelBanner = document.getElementById("levelBanner");
  const levelText = document.getElementById("levelText");
  // Map UI
  const mapBtn = document.getElementById("mapBtn");
  const mapOverlay = document.getElementById("mapOverlay");
  const mapLevels = document.getElementById("mapLevels");
  const mapClose = document.getElementById("mapClose");
  const mapHP = document.getElementById("mapHP");

  // Biểu tượng và nhãn nút Tấn Công theo từng nhân vật
  const ATTACK_ICONS = {
    pistol: "🔫",
    rifle: "🎯",
    flame: "🔥",
    bomber: "💣",
    laser: "⚡",
    mgun: "💥",
    rocket: "🚀",
    sword: "⚔"
  };
  const ATTACK_LABELS = {
    pistol: "Bắn súng lục",
    rifle: "Bắn súng trường",
    flame: "Súng bắn lửa",
    bomber: "Ném bom",
    laser: "Tia laser toàn màn hình",
    mgun: "Súng máy",
    rocket: "Bắn tên lửa",
    sword: "Chém"
  };
  function updateAttackButtons(charName) {
    const name = charName || selectedChar || (player && player.weapon) || "sword";
    const icon = ATTACK_ICONS[name] || "⚔";
    const label = ATTACK_LABELS[name] || "Tấn công";
    if (btnAttackJoy) {
      btnAttackJoy.textContent = icon;
      btnAttackJoy.setAttribute("aria-label", label);
      btnAttackJoy.title = label;
    }
    if (btnAttack) {
      btnAttack.textContent = icon;
      btnAttack.setAttribute("aria-label", label);
      btnAttack.title = label;
    }
  }
  // Khởi tạo biểu tượng theo nhân vật mặc định
  updateAttackButtons(selectedChar);

  // Utils
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
  const now = () => performance.now();

  // World/Level
  const world = {
    gravity: 2000, // px/s^2
    width: 4000, // chiều dài màn
    floorY: 440, // mặt đất (top)
    finishX: 3600, // vị trí đích đến
    bg: {
      hills: [
        { x: 200, y: 400, r: 120, color: "#75c6a6" },
        { x: 800, y: 420, r: 160, color: "#6bb59a" },
        { x: 1500, y: 410, r: 130, color: "#84d3b5" },
        { x: 2300, y: 415, r: 170, color: "#78c9ac" },
        { x: 3000, y: 405, r: 140, color: "#6dbda1" }
      ]
    },
    platforms: []
  };

  // Levels config: same layout, increasing difficulty
  const LEVELS = {
    1: {
      world: { width: 4000, finishX: 3600 },
      enemySpeed: 60,
      enemyAttackCooldown: 0.8,
      enemyJumpProb: 0.006,
      enemySpecs: [
        { x: 700, minX: 620, maxX: 820 },
        { x: 1700, minX: 1620, maxX: 1820 },
        { x: 2650, minX: 2580, maxX: 2760 }
      ]
    },
    2: {
      world: { width: 4500, finishX: 4100 },
      enemySpeed: 80,
      enemyAttackCooldown: 0.7,
      enemyJumpProb: 0.008,
      enemySpecs: [
        { x: 700, minX: 600, maxX: 840 },
        { x: 1200, minX: 1120, maxX: 1350 },
        { x: 1700, minX: 1600, maxX: 1840 },
        { x: 2300, minX: 2220, maxX: 2460 },
        { x: 3000, minX: 2920, maxX: 3160 }
      ]
    },
    3: {
      world: { width: 5200, finishX: 4700 },
      enemySpeed: 100,
      enemyAttackCooldown: 0.6,
      enemyJumpProb: 0.01,
      enemySpecs: [
        { x: 700, minX: 580, maxX: 860 },
        { x: 1200, minX: 1100, maxX: 1380 },
        { x: 1700, minX: 1600, maxX: 1880 },
        { x: 2200, minX: 2100, maxX: 2400 },
        { x: 2700, minX: 2620, maxX: 2860 },
        { x: 3300, minX: 3220, maxX: 3460 },
        { x: 3800, minX: 3720, maxX: 3960 }
      ]
    }
  };
  
  // Auto-generate levels 4..10 with increasing difficulty if not present
  for (let n = 4; n <= 10; n++) {
    if (!LEVELS[n]) {
      const worldW = 4000 + (n - 1) * 500;
      const finishX = worldW - 400;
      const enemySpeed = Math.min(60 + n * 8, 160);
      const enemyAttackCooldown = Math.max(0.85 - n * 0.05, 0.25);
      const enemyJumpProb = Math.min(0.006 + n * 0.001, 0.02);
      const count = Math.min(3 + n, 14);
      const spacing = (finishX - 600) / (count + 1);
      const specs = [];
      for (let i = 0; i < count; i++) {
        const x = 600 + spacing * (i + 1);
        specs.push({ x: Math.round(x), minX: Math.round(x - 80), maxX: Math.round(x + 100) });
      }
      LEVELS[n] = {
        world: { width: worldW, finishX },
        enemySpeed,
        enemyAttackCooldown,
        enemyJumpProb,
        enemySpecs: specs
      };
    }
  }
  const MAX_LEVEL = 10;
  let levelBannerTimer = 0;
  
  // Build platforms: nền và bệ nhảy
  function buildLevel() {
    const plats = [];

    // Mặt đất dài
    plats.push({ x: 0, y: world.floorY, w: world.width, h: 100 }); // ground

    // Bệ nổi
    plats.push({ x: 350, y: 360, w: 160, h: 20 });
    plats.push({ x: 560, y: 320, w: 120, h: 20 });
    plats.push({ x: 720, y: 280, w: 120, h: 20 });
    plats.push({ x: 980, y: 340, w: 180, h: 20 });

    plats.push({ x: 1300, y: 380, w: 140, h: 20 });
    plats.push({ x: 1500, y: 320, w: 140, h: 20 });
    plats.push({ x: 1700, y: 260, w: 140, h: 20 });
    plats.push({ x: 1950, y: 320, w: 160, h: 20 });

    plats.push({ x: 2250, y: 360, w: 120, h: 20 });
    plats.push({ x: 2450, y: 310, w: 120, h: 20 });
    plats.push({ x: 2620, y: 270, w: 120, h: 20 });
    plats.push({ x: 2850, y: 330, w: 160, h: 20 });

    // Gần đích
    plats.push({ x: 3200, y: 370, w: 120, h: 20 });
    plats.push({ x: 3380, y: 330, w: 110, h: 20 });

    world.platforms = plats;
  }

  function applyLevel(levelId) {
    const cfg = LEVELS[levelId] || LEVELS[1];
    world.width = cfg.world.width;
    world.finishX = cfg.world.finishX;
  }

  // Enemies
  const enemies = [];

  // Skills/state
  let kills = 0;
  let lastSkillMilestone = 0; // number of 10-kill milestones reached
  let lightningFlashTimer = 0;

  const turrets = [];
  const bullets = [];
  const explosions = [];
  const allies = [];
  let laserBeam = null; // { timer, dir }
  let turretPlacement = null; // { x, timer }

  function buildEnemies() {
    enemies.length = 0;
    const cfg = LEVELS[currentLevelId] || LEVELS[1];
    const enemySpecs = cfg.enemySpecs;
    const clones = [-14, 0, 14]; // tăng gấp 3: lệch nhẹ vị trí sinh
    for (let i = 0; i < enemySpecs.length; i++) {
      const s = enemySpecs[i];
      for (let c = 0; c < clones.length; c++) {
        const off = clones[c];
        const type = ((i + c) % 2 === 0) ? "swordsman" : "grunt";
        enemies.push({
          spawnX: s.x + off,
          x: s.x + off,
          y: world.floorY - 56,
          w: 36,
          h: 56,
          vx: cfg.enemySpeed,
          vy: 0,
          onGround: true,
          facing: 1,
          minX: s.minX - 20,
          maxX: s.maxX + 20,
          alive: true,
          type,
          didSlashWave: false,
          // combat
          attacking: false,
          attackTimer: 0,
          attackDuration: 0.22,
          attackCooldown: cfg.enemyAttackCooldown,
          attackCooldownTimer: 0,
          // jump
          jumpVel: 620,
          jumpProb: cfg.enemyJumpProb
        });
      }
    }
  }

  // Skill helpers
  function checkSkillPause() {
    const milestones = Math.floor(kills / 10);
    if (milestones > lastSkillMilestone) {
      lastSkillMilestone = milestones;
      // Pause and show skill selection
      running = false;
      skillScreen.classList.add("visible");
      controlsJoystick.classList.add("hidden");
      controlsButtons.classList.add("hidden");
      controlsJoystick.setAttribute("aria-hidden", "true");
      controlsButtons.setAttribute("aria-hidden", "true");
    }
  }

  function applyLightning() {
    let defeated = 0;
    for (const e of enemies) {
      if (e.alive) {
        e.alive = false;
        e.respawnTimer = 2;
        defeated++;
      }
    }
    if (defeated > 0) {
      kills += defeated;
      checkSkillPause();
    }
    lightningFlashTimer = 0.25;
  }

  function resumeAfterSkill() {
    skillScreen.classList.remove("visible");
    showControls(controlMode);
    running = true;
  }

  // Allies
  function spawnAllies(n) {
    for (let i = 0; i < n; i++) {
      allies.push({
        x: player.x - 40 - i * 20,
        y: world.floorY - 56,
        w: 36,
        h: 56,
        vx: 0,
        vy: 0,
        onGround: true,
        facing: 1,
        color: "#2a2f5a",
        attacking: false,
        attackTimer: 0,
        attackDuration: 0.22,
        attackCooldown: 0.5,
        attackCooldownTimer: 0,
        jumpVel: 680
      });
    }
  }

  function updateAllies(dt) {
    for (const a of allies) {
      // Follow player or chase nearest enemy
      let targetX = player.x - 50;
      let targetEnemy = null;
      let bestDist = 1e9;
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = Math.abs((e.x + e.w / 2) - (a.x + a.w / 2));
        if (d < bestDist) { bestDist = d; targetEnemy = e; }
      }
      if (targetEnemy && bestDist < 160) {
        targetX = targetEnemy.x + (targetEnemy.w / 2) + (a.x < targetEnemy.x ? -30 : 30);
      }
      const ax = targetX > a.x ? 1 : -1;
      a.vx += ax * 1400 * dt;
      a.vx = clamp(a.vx, -220, 220);
      a.facing = a.vx >= 0 ? 1 : -1;

      // Random hop
      if (a.onGround && Math.random() < 0.004) {
        a.vy = -a.jumpVel;
        a.onGround = false;
      }

      // Gravity
      a.vy += world.gravity * dt;

      // Integrate to ground
      a.x += a.vx * dt;
      let nextY = a.y + a.vy * dt;
      const gy = world.floorY - a.h;
      if (nextY >= gy) {
        nextY = gy;
        a.vy = 0;
        a.onGround = true;
      }
      a.y = nextY;

      // Attack timing
      if (a.attackCooldownTimer > 0) a.attackCooldownTimer -= dt;
      if (!a.attacking && targetEnemy && Math.abs((targetEnemy.x + targetEnemy.w / 2) - (a.x + a.w / 2)) < 70) {
        if (a.attackCooldownTimer <= 0) {
          a.attacking = true;
          a.attackTimer = 0;
          a.attackCooldownTimer = a.attackCooldown;
          a.facing = (targetEnemy.x >= a.x) ? 1 : -1;
        }
      } else if (a.attacking) {
        a.attackTimer += dt;
        if (a.attackTimer >= a.attackDuration) {
          a.attacking = false;
          a.attackTimer = 0;
        }
      }

      // Ally slash hitbox vs enemies
      if (a.attacking) {
        const range = 36, height = 36, ay = a.y + 10;
        const ar = a.facing > 0
          ? { x: a.x + a.w, y: ay, w: range, h: height }
          : { x: a.x - range, y: ay, w: range, h: height };
        for (const e of enemies) {
          if (!e.alive) continue;
          if (rectsIntersect({ x: e.x, y: e.y, w: e.w, h: e.h }, ar)) {
            e.alive = false;
            e.respawnTimer = 2;
            kills += 1;
            checkSkillPause();
          }
        }
      }
    }
  }

  function renderAllies() {
    for (const a of allies) {
      const ax = a.x - camera.x;
      const ay = a.y;

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      const shadowW = a.w * 0.9;
      ctx.beginPath();
      ctx.ellipse(ax + a.w / 2, Math.min(world.floorY + 18, ay + a.h + 8), shadowW / 2, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = a.color;
      ctx.fillRect(ax, ay, a.w, a.h);

      // Head
      ctx.fillStyle = "#e3e7ff";
      ctx.fillRect(ax + 6, ay - 16, a.w - 12, 16);

      // Arms
      ctx.fillStyle = "#2d3464";
      const armY = ay + 18;
      if (a.facing > 0) {
        ctx.fillRect(ax + a.w - 6, armY, 6, 14);
        ctx.fillRect(ax + 2, armY + 2, 6, 12);
      } else {
        ctx.fillRect(ax, armY, 6, 14);
        ctx.fillRect(ax + a.w - 8, armY + 2, 6, 12);
      }

      // Sword
      ctx.strokeStyle = "#c7d2ff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (a.facing > 0) {
        ctx.moveTo(ax + a.w + 4, armY);
        ctx.lineTo(ax + a.w + 24, armY - 16);
      } else {
        ctx.moveTo(ax - 4, armY);
        ctx.lineTo(ax - 24, armY - 16);
      }
      ctx.stroke();

      // Slash effect
      if (a.attacking) {
        const t = a.attackTimer / a.attackDuration;
        const swing = a.facing > 0 ? 1 : -1;
        const cx = ax + a.w / 2 + swing * 22;
        const cy = ay + 18;
        const startAng = swing > 0 ? (-20 * Math.PI) / 180 : (200 * Math.PI) / 180;
        const endAng = swing > 0 ? (120 * Math.PI) / 180 : (340 * Math.PI) / 180;
        const ang = startAng + (endAng - startAng) * t;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        const alpha = 0.55 * (1 - t);
        const grad = ctx.createLinearGradient(0, 0, swing * 80, 0);
        grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
        grad.addColorStop(1, `rgba(154,182,255,${alpha})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(80 * swing, -10);
        ctx.lineTo(80 * swing, 10);
        ctx.lineTo(0, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Turrets and bullets
  function spawnTurret(x) {
    turrets.push({ x, y: world.floorY - 40, duration: 5, fireTimer: 0 });
  }

  function updateTurrets(dt) {
    for (let i = turrets.length - 1; i >= 0; i--) {
      const t = turrets[i];
      t.duration -= dt;
      t.fireTimer -= dt;
      if (t.fireTimer <= 0) {
        t.fireTimer = 0.25;
        bullets.push({ x: t.x, y: t.y, vx: -520, vy: 0, ttl: 1.0 });
        bullets.push({ x: t.x, y: t.y, vx: 520, vy: 0, ttl: 1.0 });
      }
      if (t.duration <= 0) turrets.splice(i, 1);
    }
  }

  function renderTurrets() {
    for (const t of turrets) {
      const tx = t.x - camera.x;
      const ty = t.y;
      ctx.fillStyle = "#444c66";
      ctx.fillRect(tx - 10, ty, 20, 40);
      ctx.fillStyle = "#88aaff";
      ctx.fillRect(tx - 14, ty + 16, 28, 8);
    }
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      // physics
      if (b.ay) b.vy += b.ay * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;

      const bw = b.w || (b.r ? b.r * 2 : 8);
      const bh = b.h || (b.r ? b.r * 2 : 6);
      const bRect = { x: b.x, y: b.y, w: bw, h: bh };

      let remove = false;

      if (b.owner === "enemy") {
        // Enemy projectile hits player
        const pr = { x: player.x, y: player.y, w: player.w, h: player.h };
        if (rectsIntersect(pr, bRect)) {
          damagePlayer(5, b.vx);
          remove = true;
        }
      } else {
        // Player/neutral projectile hits enemies
        for (const e of enemies) {
          if (!e.alive) continue;
          if (rectsIntersect({ x: e.x, y: e.y, w: e.w, h: e.h }, bRect)) {
            if (b.splashRadius) {
              explodeAt(b.x, b.y, b.splashRadius);
            } else {
              e.alive = false;
              e.respawnTimer = 2;
              kills += 1;
              checkSkillPause();
            }
            remove = true;
            break;
          }
        }
      }

      // Ground explode for bom/rocket style
      const groundHit = b.ay && (b.y + 20 >= world.floorY - (b.h || 4));
      if (!remove && groundHit && b.splashRadius) {
        explodeAt(b.x, world.floorY - 20, b.splashRadius);
        remove = true;
      }

      if (remove || b.ttl <= 0) {
        bullets.splice(i, 1);
      }
    }
  }

  function updateExplosions(dt) {
    for (let i = explosions.length - 1; i >= 0; i--) {
      explosions[i].t -= dt;
      if (explosions[i].t <= 0) explosions.splice(i, 1);
    }
  }

  function renderBullets() {
    for (const b of bullets) {
      const bx = b.x - camera.x;
      const by = b.y + 20;

      if (b.kind === "crescent") {
        const r = b.r || 18;
        const thick = b.thickness || 12;
        const col = b.color || "#ffe08a";
        const dir = b.dir || (b.vx >= 0 ? 1 : -1);
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = thick;
        ctx.lineCap = "round";
        ctx.shadowColor = col;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        // draw a short arc segment to look like bán nguyệt kiếm
        if (dir > 0) {
          ctx.arc(bx, by, r, -0.7, 0.7, false);
        } else {
          ctx.arc(bx, by, r, Math.PI - 0.7, Math.PI + 0.7, false);
        }
        ctx.stroke();
        ctx.restore();
        continue;
      }

      const bw = b.w || 6;
      const bh = b.h || 4;
      const col = b.color || "#00f7ff"; // brighter default bullet color
      ctx.save();
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;
      ctx.fillRect(bx, by, bw, bh);
      // simple trail
      ctx.globalAlpha = 0.4;
      ctx.fillRect(bx - Math.sign(b.vx || 1) * bw, by + 1, bw, Math.max(2, bh - 2));
      ctx.restore();
    }
  }

  function renderExplosions() {
    for (const ex of explosions) {
      const alpha = ex.t / 0.25;
      ctx.fillStyle = `rgba(255,140,0,${alpha})`;
      ctx.beginPath();
      ctx.arc(ex.x - camera.x, ex.y + 18, ex.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Player ranged helpers
  function spawnPlayerBullet(vx, vy, ttl, extra = {}) {
    const startX = player.facing > 0 ? player.x + player.w : player.x - 6;
    const startY = player.y + 12;
    const b = {
      x: startX,
      y: startY,
      vx,
      vy,
      ttl,
      w: 6,
      h: 4,
      owner: "player",
      ...extra
    };
    bullets.push(b);
  }

  function explodeAt(x, y, r) {
    let defeated = 0;
    for (const e of enemies) {
      if (!e.alive) continue;
      const ex = e.x + e.w / 2;
      const ey = e.y + e.h / 2;
      if (Math.hypot(ex - x, ey - y) <= r) {
        e.alive = false;
        e.respawnTimer = 2;
        defeated++;
      }
    }
    if (defeated > 0) {
      kills += defeated;
      checkSkillPause();
      explosions.push({ x, y, r, t: 0.25 });
    }
  }

  function fireLaser() {
    const dir = player.facing > 0 ? 1 : -1;
    const beamLen = BASE_WIDTH;
    const beamH = 20;
    const sx = player.x + (dir > 0 ? player.w : -beamLen);
    const sy = player.y + 14;
    const beamRect = { x: dir > 0 ? sx : player.x - beamLen, y: sy - beamH / 2, w: beamLen, h: beamH };
    let defeated = 0;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (rectsIntersect({ x: e.x, y: e.y, w: e.w, h: e.h }, beamRect)) {
        e.alive = false;
        e.respawnTimer = 2;
        defeated++;
      }
    }
    if (defeated > 0) {
      kills += defeated;
      checkSkillPause();
    }
    laserBeam = { timer: 0.08, dir };
  }

  function performRangedAttack() {
    const dir = player.facing > 0 ? 1 : -1;
    switch (player.weapon) {
      case "pistol":
        spawnPlayerBullet(700 * dir, 0, 1.2);
        break;
      case "rifle":
        spawnPlayerBullet(900 * dir, 0, 1.4);
        break;
      case "flame":
        {
          const sp = 260 + Math.random() * 120;
          const vy = (Math.random() * 2 - 1) * 40;
          // gần hơn: thời gian sống ngắn và tốc độ thấp
          spawnPlayerBullet(sp * dir, vy, 0.12, { color: "#ffae73", w: 8, h: 6 });
        }
        break;
      case "rocket":
        spawnPlayerBullet(600 * dir, 0, 2.0, { splashRadius: 60, w: 8, h: 6, color: "#ff6b6b" });
        break;
      case "bomber":
        spawnPlayerBullet(450 * dir, -300, 3.0, { ay: 900, splashRadius: 70, w: 8, h: 6, color: "#ffb347" });
        break;
      case "laser":
        fireLaser();
        break;
      // legacy options still supported
      case "archer":
        spawnPlayerBullet(650 * dir, 0, 1.5);
        break;
      case "mgun":
        {
          // Bắn 1 viên mỗi nhịp nhưng rất nhanh (giữ để bắn liên tục)
          const sp = 1050 + Math.random() * 120;
          const vy = (Math.random() * 2 - 1) * 30;
          spawnPlayerBullet(sp * dir, vy, 0.5);
        }
        break;
    }
  }

  function configureWeaponParams(name) {
    // reset movement defaults each time
    player.maxSpeed = 260;
    player.accel = 2200;
    player.jumpVel = 700;

    // reset shape/appearance defaults
    player.w = 36;
    player.h = 56;
    player.color = "#2a2f5a";

    switch (name) {
      case "pistol":
        player.attackDuration = 0.12;
        player.attackCooldown = 0.25;
        break;
      case "rifle":
        player.attackDuration = 0.12;
        player.attackCooldown = 0.30;
        break;
      case "flame":
        player.attackDuration = 0.06;
        player.attackCooldown = 0.015;
        break;
      case "rocket":
        player.attackDuration = 0.14;
        player.attackCooldown = 0.45;
        break;
      case "bomber":
        player.attackDuration = 0.16;
        player.attackCooldown = 0.40;
        break;
      case "laser":
        player.attackDuration = 0.06;
        player.attackCooldown = 0.00; // giữ để bắn liên tục, không ngừng khi nhả nút
        break;
      case "mgun":
        player.attackDuration = 0.06;
        player.attackCooldown = 0.03; // rất nhanh
        break;
      default:
        player.attackDuration = 0.22;
        player.attackCooldown = 0.28;
    }
  }

  function updateTurretPlacement(dt) {
    if (!turretPlacement) return;
    const radius = 24;
    if (Math.abs(player.x - turretPlacement.x) < radius) {
      turretPlacement.timer -= dt;
      if (turretPlacement.timer <= 0) {
        spawnTurret(turretPlacement.x);
        turretPlacement = null;
      }
    } else {
      // moved away -> slowly refill timer
      turretPlacement.timer = Math.min(turretPlacement.timer + dt * 0.5, 2);
    }
  }

  // Player
  const player = {
    x: 60,
    y: 0,
    w: 36,
    h: 56,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1, // 1: phải, -1: trái
    color: "#2a2f5a",
    weapon: "sword",

    // Movement tuning
    maxSpeed: 260,
    accel: 2200,
    airAccel: 1500,
    groundDrag: 0.85,
    airDrag: 0.98,
    jumpVel: 700,
    coyoteTime: 0.08, //s
    coyoteCounter: 0,

    // Attack
    attacking: false,
    attackTimer: 0,
    attackDuration: 0.22, // s
    attackCooldown: 0.28, // s
    attackCooldownTimer: 0,
    didSlashWave: false
  };

  // Camera
  const camera = {
    x: 0
  };

  // Input
  const input = {
    left: false,
    right: false,
    up: false, // held
    attack: false, // current attack hold state
    jumpPressed: false, // edge
    attackPressed: false, // edge
    _prevUp: false,
    _prevAttack: false
  };

  function updateEdges() {
    input.jumpPressed = input.up && !input._prevUp;
    input.attackPressed = input.attack && !input._prevAttack;
    input._prevUp = input.up;
    input._prevAttack = !!input.attack;
  }

  // Keyboard
  const keyMap = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    " ": "attack", // Space in keypress, but in keydown key is " "
    Space: "attack", // Some browsers use "Space"
    Spacebar: "attack" // Legacy browsers
  };
  function setKey(e, down) {
    const k = keyMap[e.key];
    if (!k) return;
    if (k === "left") input.left = down;
    else if (k === "right") input.right = down;
    else if (k === "up") input.up = down;
    else if (k === "attack") input.attack = down;
  }

  // Prevent page scroll on arrows/space
  window.addEventListener(
    "keydown",
    (e) => {
      if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === " " ||
        e.key === "Spacebar" ||
        e.code === "Space"
      ) {
        e.preventDefault();
      }
      setKey(e, true);
    },
    { passive: false }
  );
  window.addEventListener("keyup", (e) => setKey(e, false));

  // Touch helpers
  function bindTouchButton(el, onDown, onUp) {
    const start = (ev) => {
      ev.preventDefault();
      onDown();
    };
    const end = (ev) => {
      ev.preventDefault();
      onUp();
    };
    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchend", end, { passive: false });
    el.addEventListener("touchcancel", end, { passive: false });
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse") {
        e.preventDefault();
        onDown();
      }
    });
    el.addEventListener("pointerup", (e) => {
      if (e.pointerType !== "mouse") {
        e.preventDefault();
        onUp();
      }
    });
    // Also mouse for desktop
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      onDown();
    });
    el.addEventListener("mouseup", (e) => {
      e.preventDefault();
      onUp();
    });
    return () => {
      // Unbind if needed (not necessary for this demo)
    };
  }

  // Two-buttons binding
  bindTouchButton(
    btnLeft,
    () => (input.left = true),
    () => (input.left = false)
  );
  bindTouchButton(
    btnRight,
    () => (input.right = true),
    () => (input.right = false)
  );
  bindTouchButton(
    btnJump,
    () => (input.up = true),
    () => (input.up = false)
  );
  bindTouchButton(
    btnAttack,
    () => (input.attack = true),
    () => (input.attack = false)
  );

  // Joystick
  const joystick = {
    active: false,
    id: -1,
    cx: 0,
    cy: 0,
    maxR: 40,
    dead: 8,
    dx: 0,
    dy: 0
  };

  function getCenter(el) {
    const r = el.getBoundingClientRect();
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2
    };
  }

  function setStickPos(dx, dy) {
    const mag = Math.hypot(dx, dy);
    const clamped = Math.min(mag, joystick.maxR);
    const nx = (dx / (mag || 1)) * clamped;
    const ny = (dy / (mag || 1)) * clamped;
    joyStick.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
  }

  function resetStick() {
    joyStick.style.transform = "translate(-50%, -50%)";
  }

  function handleJoyMove(pageX, pageY) {
    const dx = pageX - joystick.cx;
    const dy = pageY - joystick.cy;
    joystick.dx = dx;
    joystick.dy = dy;
    // Set move from dx
    const mag = Math.hypot(dx, dy);
    let mx = 0;
    if (mag > joystick.dead) {
      const nx = dx / mag;
      // analog strength ~ |dx|
      mx = dx / joystick.maxR;
      mx = clamp(mx, -1, 1);
    }
    // Thresholds to booleans
    input.left = mx < -0.2;
    input.right = mx > 0.2;
    setStickPos(dx, dy);
  }

  // Bind joystick base
  function bindJoystick() {
    if (!joyBase) return;
    joyBase.addEventListener(
      "pointerdown",
      (e) => {
        if (joystick.active) return;
        joystick.active = true;
        joystick.id = e.pointerId;
        const c = getCenter(joyBase);
        joystick.cx = c.x;
        joystick.cy = c.y;
        joyBase.setPointerCapture(e.pointerId);
        handleJoyMove(e.pageX, e.pageY);
      },
      { passive: true }
    );
    joyBase.addEventListener(
      "pointermove",
      (e) => {
        if (!joystick.active || e.pointerId !== joystick.id) return;
        handleJoyMove(e.pageX, e.pageY);
      },
      { passive: true }
    );
    const end = (e) => {
      if (!joystick.active || e.pointerId !== joystick.id) return;
      joystick.active = false;
      joystick.id = -1;
      input.left = false;
      input.right = false;
      resetStick();
      try {
        joyBase.releasePointerCapture(e.pointerId);
      } catch {}
    };
    joyBase.addEventListener("pointerup", end, { passive: true });
    joyBase.addEventListener("pointercancel", end, { passive: true });

    // Joystick jump/attack buttons
    bindTouchButton(
      btnJumpJoy,
      () => (input.up = true),
      () => (input.up = false)
    );
    bindTouchButton(
      btnAttackJoy,
      () => (input.attack = true),
      () => (input.attack = false)
    );
  }
  bindJoystick();

  // Game state
  let running = false;
  let finished = false;
  let pausedByMap = false;
  let lastTime = now();
  buildLevel();
  buildEnemies();
  reset();

  // Start choice
  let controlMode = null; // "joystick" | "buttons"
  function showControls(mode) {
    controlsJoystick.classList.toggle("hidden", mode !== "joystick");
    controlsJoystick.setAttribute("aria-hidden", mode !== "joystick");
    controlsButtons.classList.toggle("hidden", mode !== "buttons");
    controlsButtons.setAttribute("aria-hidden", mode !== "buttons");
  }

  function startGame(mode) {
    controlMode = mode;
    showControls(mode);
    startScreen.classList.remove("visible");
    skillScreen.classList.remove("visible");
    applyLevel(currentLevelId);
    buildLevel();
    buildEnemies();
    reset();
    // set weapon from selected character
    player.weapon = selectedChar || "pistol";
    configureWeaponParams(player.weapon);
    // Đảm bảo nút tấn công hiển thị đúng biểu tượng theo vũ khí đã chọn
    updateAttackButtons(player.weapon);
    running = true;
    finished = false;
    showLevelBanner(`Màn ${currentLevelId}`);
  }

  chooseJoystickBtn.addEventListener("click", () => startGame("joystick"));
  chooseButtonsBtn.addEventListener("click", () => startGame("buttons"));

  // Skill selections
  if (skillLightningBtn) {
    skillLightningBtn.addEventListener("click", () => {
      applyLightning();
      resumeAfterSkill();
    });
  }
  if (skillTurretBtn) {
    skillTurretBtn.addEventListener("click", () => {
      turretPlacement = { x: player.x, timer: 2 };
      resumeAfterSkill();
    });
  }
  if (skillTeamBtn) {
    skillTeamBtn.addEventListener("click", () => {
      spawnAllies(5);
      resumeAfterSkill();
    });
  }

  // Map logic
  function populateMap() {
    if (!mapLevels) return;
    mapLevels.innerHTML = "";
    for (let i = 1; i <= MAX_LEVEL; i++) {
      const b = document.createElement("button");
      b.className = "secondary";
      if (i === currentLevelId) b.classList.add("selected");
      b.dataset.level = String(i);
      b.textContent = `Màn ${i}`;
      b.addEventListener("click", () => {
        gotoLevel(i);
        closeMap();
      });
      mapLevels.appendChild(b);
    }
  }

  function openMap() {
    if (!mapOverlay) return;
    populateMap();
    mapOverlay.classList.add("visible");
    mapOverlay.setAttribute("aria-hidden", "false");
    // Pause gameplay while map is open
    pausedByMap = running;
    running = false;
    // hide touch controls while map open
    controlsJoystick.classList.add("hidden");
    controlsButtons.classList.add("hidden");
    controlsJoystick.setAttribute("aria-hidden", "true");
    controlsButtons.setAttribute("aria-hidden", "true");
  }

  function closeMap() {
    if (!mapOverlay) return;
    mapOverlay.classList.remove("visible");
    mapOverlay.setAttribute("aria-hidden", "true");
    // Resume gameplay if it was running
    if (controlMode && !finished && pausedByMap) {
      running = true;
      showControls(controlMode);
    }
    pausedByMap = false;
  }

  function gotoLevel(lvl) {
    currentLevelId = clamp(lvl, 1, MAX_LEVEL);
    applyLevel(currentLevelId);
    buildLevel();
    buildEnemies();
    reset();
    if (controlMode) {
      running = true;
      finished = false;
      showControls(controlMode);
      showLevelBanner(`Màn ${currentLevelId}`);
    }
  }

  if (mapBtn) mapBtn.addEventListener("click", openMap);
  if (mapClose) mapClose.addEventListener("click", closeMap);

  replayBtn.addEventListener("click", () => {
    reset();
    // Trở về màn chọn để người chơi chọn lại điều khiển
    finishScreen.classList.remove("visible");
    startScreen.classList.add("visible");
    showControls("none");
    running = false;
  });

  function reset() {
    player.x = 60;
    player.y = 0;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.facing = 1;
    player.attacking = false;
    player.attackTimer = 0;
    player.attackCooldownTimer = 0;
    player.didSlashWave = false;
    player.coyoteCounter = 0;
    camera.x = 0;
    setProgress(0);
    input.left = input.right = input.up = false;
    input.attack = false;
    input._prevUp = false;
    input._prevAttack = false;

    // HP
    player.maxHP = 100;
    if (typeof player.hp !== "number") player.hp = player.maxHP;
    setHP(100);

    // Reset enemies
    for (const e of enemies) {
      e.alive = true;
      e.x = e.spawnX;
      e.vx = Math.abs(e.vx);
      e.vy = 0;
      e.onGround = true;
      e.facing = 1;
      e.attacking = false;
      e.attackTimer = 0;
      e.attackCooldownTimer = 0;
      e.didSlashWave = false;
      e.y = world.floorY - e.h;
    }

    // Reset skills/assists
    kills = 0;
    lastSkillMilestone = 0;
    lightningFlashTimer = 0;
    turretPlacement = null;
    allies.length = 0;
    turrets.length = 0;
    bullets.length = 0;
  }

  // Progress UI
  function setProgress(pct) {
    const v = clamp(pct, 0, 1_000_000);
    progressBar.style.width = `${(v / 10000).toFixed(2)}%`;
    progressText.textContent = `${v.toFixed(0)}%`;
  }

  function computeProgress() {
    const pct = ((player.x - 60) / (world.finishX - 60)) * 1_000_000;
    return clamp(pct, 0, 1_000_000);
  }

  // HP system
  function setHP(v) {
    player.hp = clamp(v, 0, player.maxHP);
    const pct = (player.hp / player.maxHP) * 100;
    if (hpBar) hpBar.style.width = `${pct}%`;
    if (hpText) hpText.textContent = `HP ${Math.round(pct)}%`;
    if (mapHP) mapHP.textContent = `HP ${Math.round(pct)}%`;
  }

  function damagePlayer(amount, knock) {
    if (finished) return;
    setHP(player.hp - amount);
    // knockback and small reset to ground
    const dir = knock && knock !== 0 ? Math.sign(knock) : -1;
    player.x = clamp(player.x - dir * 40, 0, world.width - player.w);
    player.vy = -200;
    // defeat
    if (player.hp <= 0) {
      finished = true;
      running = false;
      if (finishTitle) finishTitle.textContent = "Thua cuộc";
      if (finishDesc) finishDesc.textContent = "Bạn đã bị hạ gục.";
      finishScreen.classList.add("visible");
      controlsJoystick.classList.add("hidden");
      controlsButtons.classList.add("hidden");
      controlsJoystick.setAttribute("aria-hidden", "true");
      controlsButtons.setAttribute("aria-hidden", "true");
    }
  }

  function showLevelBanner(text, duration = 1.4) {
    if (!levelBanner || !levelText) return;
    levelText.textContent = text;
    levelBanner.classList.add("visible");
    levelBannerTimer = duration;
  }

  function nextLevelOrWin() {
    if (currentLevelId < MAX_LEVEL) {
      currentLevelId += 1;
      applyLevel(currentLevelId);
      buildLevel();
      buildEnemies();
      reset();
      showLevelBanner(`Màn ${currentLevelId}`);
      running = true;
      finished = false;
    } else {
      finished = true;
      running = false;
      if (finishTitle) finishTitle.textContent = "Chiến thắng!";
      if (finishDesc) finishDesc.textContent = "Bạn đã vượt qua tất cả các màn.";
      finishScreen.classList.add("visible");
      controlsJoystick.classList.add("hidden");
      controlsButtons.classList.add("hidden");
      controlsJoystick.setAttribute("aria-hidden", "true");
      controlsButtons.setAttribute("aria-hidden", "true");
    }
  }

  // Physics & collisions
  function rectsIntersect(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function moveAndCollide(dt) {
    const ax =
      (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const isMoving = ax !== 0;

    if (isMoving) {
      const accel = player.onGround ? player.accel : player.airAccel;
      player.vx += ax * accel * dt;
    } else {
      // Drag
      player.vx *= player.onGround ? Math.pow(player.groundDrag, dt * 60) : Math.pow(player.airDrag, dt * 60);
      if (Math.abs(player.vx) < 5) player.vx = 0;
    }

    // Clamp speed
    player.vx = clamp(player.vx, -player.maxSpeed, player.maxSpeed);

    // Face dir
    if (isMoving) player.facing = ax > 0 ? 1 : -1;

    // Coyote time
    if (player.onGround) {
      player.coyoteCounter = player.coyoteTime;
    } else {
      player.coyoteCounter = Math.max(0, player.coyoteCounter - dt);
    }

    // Jump (xe tăng không nhảy)
    if (input.jumpPressed && (player.onGround || player.coyoteCounter > 0)) {
      player.vy = -player.jumpVel;
      player.onGround = false;
      player.coyoteCounter = 0;
    }

    // Gravity
    player.vy += world.gravity * dt;

    // Horizontal move + collide
    const nextX = player.x + player.vx * dt;
    let hx = nextX;
    let hy = player.y;
    let collidedX = false;

    const aabbX = { x: Math.min(player.x, nextX), y: player.y, w: player.w + Math.abs(player.vx * dt), h: player.h };

    for (let p of world.platforms) {
      if (!rectsIntersect({ x: nextX, y: player.y, w: player.w, h: player.h }, p)) continue;
      // Resolve x
      if (player.vx > 0) {
        hx = p.x - player.w;
      } else if (player.vx < 0) {
        hx = p.x + p.w;
      }
      player.vx = 0;
      collidedX = true;
    }
    player.x = hx;

    // Vertical move + collide
    const nextY = player.y + player.vy * dt;
    let collidedY = false;
    for (let p of world.platforms) {
      if (!rectsIntersect({ x: player.x, y: nextY, w: player.w, h: player.h }, p)) continue;
      if (player.vy > 0) {
        // falling, landed on top
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
        collidedY = true;
      } else if (player.vy < 0) {
        // hitting head
        player.y = p.y + p.h;
        player.vy = 0;
        collidedY = true;
      }
    }
    if (!collidedY) {
      player.y = nextY;
      if (player.vy !== 0) player.onGround = false;
    }

    // Constrain to world
    player.x = clamp(player.x, 0, world.width - player.w);
    if (player.y > BASE_HEIGHT + 400) {
      // rơi hố -> hồi sinh gần nhất
      player.x = Math.max(0, player.x - 120);
      player.y = 0;
      player.vx = 0;
      player.vy = 0;
    }
  }

  // Attack handling
  function updateAttack(dt) {
    if (player.attackCooldownTimer > 0) {
      player.attackCooldownTimer -= dt;
    }

    if (player.weapon === "sword") {
      if (!player.attacking) {
        if (input.attackPressed && player.attackCooldownTimer <= 0) {
          player.attacking = true;
          player.attackTimer = 0;
          player.attackCooldownTimer = player.attackCooldown;
          player.didSlashWave = false;
        }
      } else {
        player.attackTimer += dt;

        // Chém ra bán nguyệt giống địch (mỗi đòn chỉ 1 lần)
        if (!player.didSlashWave && player.attackTimer > player.attackDuration * 0.35) {
          player.didSlashWave = true;
          const sx = player.facing > 0 ? (player.x + player.w + 8) : (player.x - 8);
          const sy = player.y + 12;
          bullets.push({
            x: sx,
            y: sy,
            vx: 520 * player.facing,
            vy: 0,
            ttl: 0.85,
            owner: "player",
            kind: "crescent",
            dir: player.facing,
            r: 18,
            thickness: 12,
            color: "#9ec9ff"
          });
        }

        if (player.attackTimer >= player.attackDuration) {
          player.attacking = false;
          player.attackTimer = 0;
        }
      }
    } else {
      // ranged weapons: hold-to-fire for mgun/laser, press-to-fire for others
      const holdToFire = (player.weapon === "mgun" || player.weapon === "laser" || player.weapon === "flame");
      const wantFire = holdToFire ? input.attack : input.attackPressed;
      if (wantFire && player.attackCooldownTimer <= 0) {
        player.attacking = true;
        player.attackTimer = 0;
        player.attackCooldownTimer = player.attackCooldown;
        performRangedAttack();
      }
      if (player.attacking) {
        player.attackTimer += dt;
        if (player.attackTimer >= Math.min(player.attackDuration, 0.12)) {
          player.attacking = false;
          player.attackTimer = 0;
        }
      }
    }
  }

  // Enemy update and rendering
  function getAttackRect() {
    if (player.weapon !== "sword") return null;
    if (!player.attacking) return null;
    const range = 36;
    const height = 36;
    const y = player.y + 10;
    if (player.facing > 0) {
      return { x: player.x + player.w, y, w: range, h: height };
    } else {
      return { x: player.x - range, y, w: range, h: height };
    }
  }

  function updateEnemies(dt) {
    const atk = getAttackRect();
    for (const e of enemies) {
      if (!e.alive) {
        e.respawnTimer = (e.respawnTimer ?? 2) - dt;
        if (e.respawnTimer <= 0) {
          e.alive = true;
          e.x = e.spawnX;
          e.y = world.floorY - e.h;
          e.vx = Math.abs(e.vx);
          e.vy = 0;
          e.onGround = true;
          e.facing = 1;
          e.attacking = false;
          e.attackTimer = 0;
          e.attackCooldownTimer = 0;
          e.respawnTimer = 0;
        }
        continue;
      }

      // Player attack -> defeat enemy
      if (atk && rectsIntersect({ x: e.x, y: e.y, w: e.w, h: e.h }, atk)) {
        e.alive = false;
        e.respawnTimer = 2;
        kills += 1;
        checkSkillPause();
        continue;
      }

      // Patrol
      e.x += e.vx * dt;
      if (e.x < e.minX) {
        e.x = e.minX;
        e.vx = Math.abs(e.vx);
      }
      if (e.x + e.w > e.maxX) {
        e.x = e.maxX - e.w;
        e.vx = -Math.abs(e.vx);
      }
      e.facing = e.vx >= 0 ? 1 : -1;

      // Gravity + simple ground at floor
      const groundY = world.floorY - e.h;
      e.vy += world.gravity * dt;
      let nextY = e.y + e.vy * dt;
      if (nextY >= groundY) {
        nextY = groundY;
        e.vy = 0;
        e.onGround = true;
      } else {
        e.onGround = false;
      }
      e.y = nextY;

      // Random hop to feel like player
      if (e.onGround && Math.random() < (e.jumpProb ?? 0.006)) {
        e.vy = -e.jumpVel;
        e.onGround = false;
      }

      // Enemy attack timing
      if (e.attackCooldownTimer > 0) e.attackCooldownTimer -= dt;
      const dx = (player.x + player.w / 2) - (e.x + e.w / 2);
      const dy = (player.y + player.h / 2) - (e.y + e.h / 2);
      const near = Math.abs(dx) < 80 && Math.abs(dy) < 40;

      if (!e.attacking) {
        if (near && e.attackCooldownTimer <= 0) {
          e.attacking = true;
          e.attackTimer = 0;
          e.attackCooldownTimer = e.attackCooldown;
          e.facing = dx >= 0 ? 1 : -1;
          e.didSlashWave = false;
        }
      } else {
        e.attackTimer += dt;

        // swordsman fires a crescent slash wave once per attack
        if (e.type === "swordsman" && !e.didSlashWave && e.attackTimer > e.attackDuration * 0.35) {
          e.didSlashWave = true;
          const sx = e.facing > 0 ? (e.x + e.w + 8) : (e.x - 8);
          const sy = e.y + 12;
          bullets.push({
            x: sx,
            y: sy,
            vx: 420 * e.facing,
            vy: 0,
            ttl: 0.85,
            owner: "enemy",
            kind: "crescent",
            dir: e.facing,
            r: 18,
            thickness: 12,
            color: "#ffe08a"
          });
        }

        if (e.attackTimer >= e.attackDuration) {
          e.attacking = false;
          e.attackTimer = 0;
        }
      }

      // Enemy attack hitbox -> damage player
      if (e.attacking) {
        const range = 36;
        const height = 36;
        const ay = e.y + 10;
        const ar = e.facing > 0
          ? { x: e.x + e.w, y: ay, w: range, h: height }
          : { x: e.x - range, y: ay, w: range, h: height };

        const pr = { x: player.x, y: player.y, w: player.w, h: player.h };
        if (rectsIntersect(pr, ar)) {
          damagePlayer(5, dx);
        }
      }

      // Body collision -> damage player
      const pr = { x: player.x, y: player.y, w: player.w, h: player.h };
      if (rectsIntersect(pr, { x: e.x, y: e.y, w: e.w, h: e.h })) {
        damagePlayer(5, dx);
      }
    }
  }

  function renderEnemies() {
    for (const e of enemies) {
      if (!e.alive) continue;
      const ex = e.x - camera.x;
      const ey = e.y;

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      const shadowW = e.w * 0.9;
      ctx.beginPath();
      ctx.ellipse(ex + e.w / 2, Math.min(world.floorY + 18, ey + e.h + 8), shadowW / 2, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body (similar style to player)
      ctx.fillStyle = "#5a2a2a";
      ctx.fillRect(ex, ey, e.w, e.h);

      // Head
      ctx.fillStyle = "#ffdede";
      ctx.fillRect(ex + 6, ey - 16, e.w - 12, 16);

      // Arms
      ctx.fillStyle = "#3d1c1c";
      const armY = ey + 18;
      if (e.facing > 0) {
        ctx.fillRect(ex + e.w - 6, armY, 6, 14);
        ctx.fillRect(ex + 2, armY + 2, 6, 12);
      } else {
        ctx.fillRect(ex, armY, 6, 14);
        ctx.fillRect(ex + e.w - 8, armY + 2, 6, 12);
      }

      // Sword (idle/carry)
      ctx.strokeStyle = "#e6baba";
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (e.facing > 0) {
        ctx.moveTo(ex + e.w + 4, ey + 18);
        ctx.lineTo(ex + e.w + 24, ey + 2);
      } else {
        ctx.moveTo(ex - 4, ey + 18);
        ctx.lineTo(ex - 24, ey + 2);
      }
      ctx.stroke();

      // Attack slash effect
      if (e.attacking) {
        const t = e.attackTimer / e.attackDuration; // 0..1
        const swing = e.facing > 0 ? 1 : -1;
        const cx = ex + e.w / 2 + swing * 22;
        const cy = ey + 18;

        const startAng = swing > 0 ? (-20 * Math.PI) / 180 : (200 * Math.PI) / 180;
        const endAng = swing > 0 ? (120 * Math.PI) / 180 : (340 * Math.PI) / 180;
        const ang = startAng + (endAng - startAng) * t;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        const alpha = 0.65 * (1 - t);
        const grad = ctx.createLinearGradient(0, 0, swing * 80, 0);
        grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
        grad.addColorStop(1, `rgba(255,107,107,${alpha})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(80 * swing, -10);
        ctx.lineTo(80 * swing, 10);
        ctx.lineTo(0, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Camera follow
  function updateCamera(dt) {
    const target = player.x + player.w / 2 - BASE_WIDTH / 2;
    camera.x += (target - camera.x) * Math.min(1, dt * 8);
    camera.x = clamp(camera.x, 0, world.width - BASE_WIDTH);
  }

  // Tank rendering helper
  function renderPlayerTank(px, py) {
    const w = player.w, h = player.h;

    // Tracks (bánh xích)
    const trackH = Math.max(10, Math.floor(h * 0.35));
    const trackY = py + h - trackH;
    ctx.fillStyle = "#2b2e24";
    ctx.fillRect(px, trackY, w, trackH);

    // Tread pattern animation based on position (giả lập chuyển động bánh xích)
    const spacing = 8;
    const offset = (player.x * 0.5) % spacing;
    ctx.fillStyle = "#3a3e30";
    for (let tx = -offset; tx < w; tx += spacing) {
      ctx.fillRect(px + tx, trackY + 2, 4, trackH - 4);
    }

    // Road wheels
    const wheelCount = 5;
    ctx.fillStyle = "#444";
    for (let i = 0; i < wheelCount; i++) {
      const cx = px + (w * (i + 0.5)) / wheelCount;
      const cy = trackY + trackH / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.min(trackH * 0.35, 6), 0, Math.PI * 2);
      ctx.fill();
    }

    // Hull (thân xe)
    const bodyH = h - trackH - 4;
    const bodyY = py + 2;
    ctx.fillStyle = player.color || "#4b4f3a";
    ctx.fillRect(px + 4, bodyY, w - 8, bodyH);
    // top highlight
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(px + 4, bodyY, w - 8, 3);

    // Turret (tháp pháo)
    const turretW = Math.max(22, Math.floor(w * 0.55));
    const turretH = Math.max(10, Math.floor(bodyH * 0.5));
    const turretX = px + (w - turretW) / 2;
    const turretY = bodyY + 2;
    ctx.fillStyle = "#5a5e48";
    ctx.fillRect(turretX, turretY, turretW, turretH);

    // Barrel (nòng pháo)
    const barrelL = Math.max(24, Math.floor(w * 0.45));
    const barrelH = 6;
    const bx = player.facing > 0 ? (turretX + turretW) : (turretX - barrelL);
    const by = turretY + turretH / 2 - barrelH / 2;
    ctx.fillStyle = "#8d9272";
    ctx.fillRect(bx, by, barrelL, barrelH);

    // Muzzle flash khi đang bắn
    if (player.attacking) {
      ctx.fillStyle = "#ffe08a";
      if (player.facing > 0) {
        ctx.fillRect(bx + barrelL, by - 2, 6, barrelH + 4);
      } else {
        ctx.fillRect(bx - 6, by - 2, 6, barrelH + 4);
      }
    }
  }

  // Rendering
  function render() {
    // Clear in device pixels then apply current scale for drawing
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, 0, 0);

    // Parallax background decor (hills)
    ctx.save();
    for (let hill of world.bg.hills) {
      // Parallax factor 0.5
      const hx = hill.x - camera.x * 0.5;
      ctx.beginPath();
      ctx.fillStyle = hill.color;
      ctx.arc(hx, hill.y, hill.r, 0, Math.PI, true);
      ctx.fill();
    }
    ctx.restore();

    // Platforms
    for (let p of world.platforms) {
      const x = p.x - camera.x;
      const y = p.y;
      ctx.fillStyle = "#3c455f";
      ctx.fillRect(x, y, p.w, p.h);
      // Top highlight
      ctx.fillStyle = "#556081";
      ctx.fillRect(x, y, p.w, 4);
    }

    // Finish flag
    const flagX = world.finishX - camera.x;
    ctx.save();
    ctx.translate(flagX, world.floorY);
    ctx.strokeStyle = "#3c3c3c";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -140);
    ctx.stroke();
    // Flag
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(4, -140);
    ctx.lineTo(74, -120);
    ctx.lineTo(4, -100);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    renderTurrets();

    renderEnemies();

    renderAllies();

    renderBullets();

    // Laser beam flash
    if (laserBeam) {
      const dir = laserBeam.dir;
      const beamLen = BASE_WIDTH;
      const beamH = 10;
      const sx = (player.x - camera.x) + (dir > 0 ? player.w : 0);
      const sy = player.y + 18;
      ctx.fillStyle = "rgba(150,255,255,0.8)";
      if (dir > 0) {
        ctx.fillRect(sx, sy - beamH / 2, beamLen, beamH);
      } else {
        ctx.fillRect(sx - beamLen, sy - beamH / 2, beamLen, beamH);
      }
    }

    renderExplosions();

    // Player
    const px = player.x - camera.x;
    const py = player.y;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    const shadowW = player.w * 0.9;
    ctx.beginPath();
    ctx.ellipse(px + player.w / 2, Math.min(world.floorY + 18, py + player.h + 8), shadowW / 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (player.weapon === "tank") {
      // Vẽ xe tăng (thân + bánh xích + tháp pháo + nòng pháo)
      renderPlayerTank(px, py);
    } else {
      // Body (nhân vật người)
      ctx.fillStyle = player.color;
      ctx.fillRect(px, py, player.w, player.h);

      // Head
      ctx.fillStyle = "#e3e7ff";
      ctx.fillRect(px + 6, py - 16, player.w - 12, 16);

      // Arms
      ctx.fillStyle = "#2d3464";
      const armY = py + 18;
      if (player.facing > 0) {
        ctx.fillRect(px + player.w - 6, armY, 6, 14);
        ctx.fillRect(px + 2, armY + 2, 6, 12);
      } else {
        ctx.fillRect(px, armY, 6, 14);
        ctx.fillRect(px + player.w - 8, armY + 2, 6, 12);
      }

      // Weapon visuals (chỉ cho nhân vật người)
      if (player.weapon === "sword") {
        ctx.strokeStyle = "#c7d2ff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (player.facing > 0) {
          ctx.moveTo(px + player.w + 4, py + 18);
          ctx.lineTo(px + player.w + 24, py + 2);
        } else {
          ctx.moveTo(px - 4, py + 18);
          ctx.lineTo(px - 24, py + 2);
        }
        ctx.stroke();
      } else if (player.weapon === "pistol") {
        const hx = player.facing > 0 ? (px + player.w + 2) : (px - 12);
        const hy = py + 16;
        ctx.fillStyle = "#ddd";
        ctx.fillRect(hx, hy, 12, 4);
        if (player.attacking) {
          ctx.fillStyle = "#ffe08a";
          ctx.fillRect(hx + (player.facing > 0 ? 12 : -4), hy - 2, 4, 8);
        }
      } else if (player.weapon === "rifle") {
        const hx = player.facing > 0 ? (px + player.w + 2) : (px - 22);
        const hy = py + 16;
        ctx.fillStyle = "#ccc";
        ctx.fillRect(hx, hy, 22, 4);
        if (player.attacking) {
          ctx.fillStyle = "#ffd166";
          ctx.fillRect(hx + (player.facing > 0 ? 22 : -4), hy - 2, 4, 8);
        }
      } else if (player.weapon === "mgun") {
        const hx = player.facing > 0 ? (px + player.w + 2) : (px - 24);
        const hy = py + 16;
        ctx.fillStyle = "#aaa";
        ctx.fillRect(hx, hy - 1, 24, 6);
        if (player.attacking) {
          ctx.fillStyle = "#ffd166";
          ctx.fillRect(hx + (player.facing > 0 ? 24 : -4), hy - 2, 4, 8);
        }
      } else if (player.weapon === "archer") {
        // simple bow shape
        ctx.strokeStyle = "#deb887";
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (player.facing > 0) {
          ctx.moveTo(px + player.w + 2, py + 14);
          ctx.quadraticCurveTo(px + player.w + 14, py + 18, px + player.w + 2, py + 22);
        } else {
          ctx.moveTo(px - 2, py + 14);
          ctx.quadraticCurveTo(px - 14, py + 18, px - 2, py + 22);
        }
        ctx.stroke();
        // string
        ctx.strokeStyle = "#eee";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (player.facing > 0) {
          ctx.moveTo(px + player.w + 2, py + 14);
          ctx.lineTo(px + player.w + 2, py + 22);
        } else {
          ctx.moveTo(px - 2, py + 14);
          ctx.lineTo(px - 2, py + 22);
        }
        ctx.stroke();
      } else if (player.weapon === "flame") {
        const hx = player.facing > 0 ? (px + player.w + 2) : (px - 18);
        const hy = py + 16;
        ctx.fillStyle = "#888";
        ctx.fillRect(hx, hy - 1, 18, 6);
        if (player.attacking) {
          ctx.fillStyle = "rgba(255,120,0,0.8)";
          const fx = hx + (player.facing > 0 ? 18 : -12);
          ctx.beginPath();
          ctx.ellipse(fx, hy + 2, 12, 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (player.weapon === "rocket") {
        const hx = player.facing > 0 ? (px + player.w + 2) : (px - 20);
        const hy = py + 16;
        ctx.fillStyle = "#cc4444";
        ctx.fillRect(hx, hy - 1, 20, 6);
        if (player.attacking) {
          ctx.fillStyle = "#ffd166";
          ctx.fillRect(hx + (player.facing > 0 ? 20 : -4), hy - 2, 4, 8);
        }
      } else if (player.weapon === "bomber") {
        const hx = player.facing > 0 ? (px + player.w + 2) : (px - 16);
        const hy = py + 16;
        ctx.fillStyle = "#aa8844";
        ctx.fillRect(hx, hy - 1, 16, 6);
        if (player.attacking) {
          ctx.fillStyle = "#ffaa66";
          ctx.fillRect(hx + (player.facing > 0 ? 16 : -4), hy - 2, 4, 8);
        }
      } else if (player.weapon === "laser") {
        const hx = player.facing > 0 ? (px + player.w + 2) : (px - 14);
        const hy = py + 16;
        ctx.fillStyle = "#bbbbbb";
        ctx.fillRect(hx, hy - 1, 14, 6);
        if (player.attacking) {
          ctx.fillStyle = "rgba(150,255,255,0.8)";
          ctx.fillRect(hx + (player.facing > 0 ? 14 : -4), hy - 2, 4, 8);
        }
      } else if (player.weapon === "tank") {
        // unreachable here do to outer guard, kept for reference
        const hx = player.facing > 0 ? (px + player.w + 2) : (px - 28);
        const hy = py + 16;
        ctx.fillStyle = "#777755";
        ctx.fillRect(hx, hy - 2, 28, 8);
        if (player.attacking) {
          ctx.fillStyle = "#ffe08a";
          ctx.fillRect(hx + (player.facing > 0 ? 28 : -4), hy - 2, 4, 8);
        }
      }

      // Attack slash effect (sword only)
      if (player.attacking && player.weapon === "sword") {
        const t = player.attackTimer / player.attackDuration; // 0..1
        const swing = player.facing > 0 ? 1 : -1;
        const cx = px + player.w / 2 + swing * 22;
        const cy = py + 18;

        const startAng = swing > 0 ? (-20 * Math.PI) / 180 : (200 * Math.PI) / 180;
        const endAng = swing > 0 ? (120 * Math.PI) / 180 : (340 * Math.PI) / 180;
        const ang = startAng + (endAng - startAng) * t;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        // slash arc
        const alpha = 0.65 * (1 - t);
        const grad = ctx.createLinearGradient(0, 0, swing * 80, 0);
        grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
        grad.addColorStop(1, `rgba(154,182,255,${alpha})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(80 * swing, -10);
        ctx.lineTo(80 * swing, 10);
        ctx.lineTo(0, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Main loop
  function tick() {
    const t = now();
    let dt = (t - lastTime) / 1000;
    lastTime = t;
    dt = Math.min(dt, 1 / 30); // clamp to avoid big step

    if (running && !finished) {
      updateEdges();
      moveAndCollide(dt);
      updateAttack(dt);
      updateEnemies(dt);
      updateAllies(dt);
      updateTurretPlacement(dt);
      updateTurrets(dt);
      updateBullets(dt);
      updateExplosions(dt);
      if (laserBeam) {
        laserBeam.timer -= dt;
        if (laserBeam.timer <= 0) laserBeam = null;
      }
      updateCamera(dt);
      lightningFlashTimer = Math.max(0, lightningFlashTimer - dt);
      if (levelBannerTimer > 0) {
        levelBannerTimer -= dt;
        if (levelBannerTimer <= 0 && levelBanner) {
          levelBanner.classList.remove("visible");
        }
      }

      const pct = computeProgress();
      setProgress(pct);
      if (pct >= 1_000_000) {
        nextLevelOrWin();
      }
    }

    render();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Initial UI
  startScreen.classList.add("visible");
  controlsJoystick.classList.add("hidden");
  controlsButtons.classList.add("hidden");
  controlsJoystick.setAttribute("aria-hidden", "true");
  controlsButtons.setAttribute("aria-hidden", "true");
})();
