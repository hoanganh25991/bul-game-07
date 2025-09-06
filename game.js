/*
  Game Đi Ngang - Lính Kiếm
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
    attackCooldownTimer: 0
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
    maxR: 50,
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
  let lastTime = now();
  buildLevel();
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
    running = true;
    finished = false;
  }

  chooseJoystickBtn.addEventListener("click", () => startGame("joystick"));
  chooseButtonsBtn.addEventListener("click", () => startGame("buttons"));

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
    player.coyoteCounter = 0;
    camera.x = 0;
    setProgress(0);
    input.left = input.right = input.up = false;
    input.attack = false;
    input._prevUp = false;
    input._prevAttack = false;
  }

  // Progress UI
  function setProgress(pct) {
    const v = clamp(pct, 0, 100);
    progressBar.style.width = `${v.toFixed(0)}%`;
    progressText.textContent = `${v.toFixed(0)}%`;
  }

  function computeProgress() {
    const pct = ((player.x - 60) / (world.finishX - 60)) * 100;
    return clamp(pct, 0, 100);
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

    // Jump
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
    if (!player.attacking) {
      if (input.attackPressed && player.attackCooldownTimer <= 0) {
        player.attacking = true;
        player.attackTimer = 0;
        player.attackCooldownTimer = player.attackCooldown;
      }
    } else {
      player.attackTimer += dt;
      if (player.attackTimer >= player.attackDuration) {
        player.attacking = false;
        player.attackTimer = 0;
      }
    }
  }

  // Camera follow
  function updateCamera(dt) {
    const target = player.x + player.w / 2 - BASE_WIDTH / 2;
    camera.x += (target - camera.x) * Math.min(1, dt * 8);
    camera.x = clamp(camera.x, 0, world.width - BASE_WIDTH);
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

    // Player
    const px = player.x - camera.x;
    const py = player.y;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    const shadowW = player.w * 0.9;
    ctx.beginPath();
    ctx.ellipse(px + player.w / 2, Math.min(world.floorY + 18, py + player.h + 8), shadowW / 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
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

    // Sword (idle/carry)
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

    // Attack slash effect
    if (player.attacking) {
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
      updateCamera(dt);

      const pct = computeProgress();
      setProgress(pct);
      if (pct >= 100) {
        finished = true;
        running = false;
        // Show finish overlay & hide touch controls
        finishScreen.classList.add("visible");
        controlsJoystick.classList.add("hidden");
        controlsButtons.classList.add("hidden");
        controlsJoystick.setAttribute("aria-hidden", "true");
        controlsButtons.setAttribute("aria-hidden", "true");
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
