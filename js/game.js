import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { translations, getLang, setLang } from './i18n.js';

// --- CONFIGURATION ---
const TREE_COUNT = 3000;
const WORLD_SIZE = 6000;

const BIOMES = [
    { name_key: "FOREST", type: 'tree', sky: 0x87CEEB, fog: 0x87CEEB, ground: 0x2d4c1e, obj: 0x1a2f1a, sun: 0xffffff },
    { name_key: "CANYON", type: 'rock', sky: 0xFF8C00, fog: 0xFF8C00, ground: 0x8B4500, obj: 0x5c2a00, sun: 0xffaa00 },
    { name_key: "ARCTIC", type: 'spike', sky: 0x527190, fog: 0x527190, ground: 0xf1f5f9, obj: 0x94a3b8, sun: 0xffffff },
    { name_key: "NEON", type: 'city', sky: 0x050510, fog: 0x050510, ground: 0x110022, obj: 0x00ffff, sun: 0xff00ff }
];

// --- SYSTEMS ---
class Haptics {
    static vibrate(ms) { if (navigator.vibrate) navigator.vibrate(ms); }
}

class Leaderboard {
    constructor() { this.key = 'skysoar_scores_pro'; }
    save(score) {
        if(score < 10) return;
        let data = JSON.parse(localStorage.getItem(this.key) || '[]');
        data.push({ date: new Date().toLocaleDateString(), val: Math.floor(score) });
        data.sort((a, b) => b.val - a.val);
        localStorage.setItem(this.key, JSON.stringify(data.slice(0, 5)));
    }
    render() {
        const list = document.getElementById('score-list');
        if(!list) return;
        const data = JSON.parse(localStorage.getItem(this.key) || '[]');
        list.innerHTML = data.length ? data.map(s => `<li><span>${s.date}</span> <span>${s.val}</span></li>`).join('') : '<li><span>-- NO RECORDS --</span></li>';
    }
}

class AudioController {
    constructor() { this.ctx = null; this.gain = null; }
    init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        const b = this.ctx.createBuffer(1, this.ctx.sampleRate*2, this.ctx.sampleRate);
        const d = b.getChannelData(0);
        for(let i=0; i<d.length; i++) d[i] = (Math.random()*2-1)*0.5;
        const src = this.ctx.createBufferSource(); src.buffer = b; src.loop = true;
        const f = this.ctx.createBiquadFilter(); f.frequency.value = 400;
        this.gain = this.ctx.createGain(); this.gain.value = 0;
        src.connect(f).connect(this.gain).connect(this.ctx.destination);
        src.start();
    }
    update(speed) {
        if(!this.gain) return;
        this.gain.gain.setTargetAtTime(Math.min(speed/6, 0.2), this.ctx.currentTime, 0.1);
    }
    suspend(p) { if(this.ctx) p ? this.ctx.suspend() : this.ctx.resume(); }
}

// --- GAME ---
class Game {
    constructor() {
        this.lang = getLang();
        this.t = translations[this.lang];
        this.audio = new AudioController();
        this.leaderboard = new Leaderboard();
        this.input = { x:0, y:0, dive:false, sx:0, sy:0 };
        this.state = { speed:0, stamina:100, score:0, paused:false, biome:0 };
        this.env = [];
        this.wings = []; // Pivots for animation
        
        this.initDOM();
        this.init3D();
    }

    initDOM() {
        // Text Update
        const setTxt = (id, t) => { const el = document.getElementById(id); if(el) el.innerText = t; };
        setTxt('game-title', this.t.title);
        const lblAlt = document.getElementById('lbl_alt'); if(lblAlt) lblAlt.innerText = this.t.alt;
        const lblSpd = document.getElementById('lbl_spd'); if(lblSpd) lblSpd.innerText = this.t.spd;
        const dBtn = document.getElementById('dive-btn'); if(dBtn) dBtn.innerText = this.t.dive;
        const pBtn = document.getElementById('pause-trigger'); if(pBtn) pBtn.innerText = this.t.pause;
        const rBtn = document.getElementById('resume-btn'); if(rBtn) rBtn.innerText = this.t.resume;
        const wBtn = document.getElementById('world-btn'); if(wBtn) wBtn.innerText = this.t.biome;
        const lBtn = document.getElementById('lang-btn'); if(lBtn) lBtn.innerText = this.t.lang_btn;

        // Controls
        const togglePause = () => {
            this.state.paused = !this.state.paused;
            document.getElementById('pause-menu').style.display = this.state.paused ? 'flex' : 'none';
            this.audio.suspend(this.state.paused);
            if(this.state.paused) this.leaderboard.save(this.state.score);
        };

        const bind = (id, fn) => {
            const el = document.getElementById(id);
            if(el) { el.addEventListener('click', fn); el.addEventListener('touchstart', (e)=>{e.preventDefault(); fn();}, {passive:false}); }
        };

        bind('pause-trigger', togglePause);
        bind('resume-btn', togglePause);
        bind('world-btn', () => {
            this.state.biome = (this.state.biome + 1) % BIOMES.length;
            this.loadBiome(this.state.biome);
            Haptics.vibrate(50);
        });
        bind('lang-btn', () => {
            const langs = ['en', 'fil', 'es', 'ja', 'fr'];
            const currentIdx = langs.indexOf(this.lang);
            setLang(langs[(currentIdx + 1) % langs.length]);
        });
        bind('board-btn', () => {
            document.getElementById('leaderboard-modal').style.display = 'flex';
            this.leaderboard.render();
        });
        bind('close-board-btn', () => {
            document.getElementById('leaderboard-modal').style.display = 'none';
        });

        const setDive = (v) => { 
            if(!this.audio.ctx) this.audio.init();
            this.input.dive = v; 
            if(dBtn) { dBtn.style.background = v ? "#ffffff" : ""; dBtn.style.color = v ? "#000000" : ""; }
            if(v) Haptics.vibrate(30);
        };
        if(dBtn) {
            dBtn.addEventListener('mousedown', ()=>setDive(true));
            dBtn.addEventListener('mouseup', ()=>setDive(false));
            dBtn.addEventListener('mouseleave', ()=>setDive(false));
            dBtn.addEventListener('touchstart', (e)=>{e.preventDefault(); setDive(true);}, {passive:false});
            dBtn.addEventListener('touchend', (e)=>{e.preventDefault(); setDive(false);}, {passive:false});
        }

        const zone = document.getElementById('joystick-zone');
        const knob = document.getElementById('joystick-knob');
        if(zone && knob) {
            zone.addEventListener('touchstart', e => {
                if(!this.audio.ctx) this.audio.init();
                this.input.sx = e.touches[0].clientX; this.input.sy = e.touches[0].clientY;
            }, {passive:false});
            zone.addEventListener('touchmove', e => {
                e.preventDefault();
                const dx = e.touches[0].clientX - this.input.sx;
                const dy = e.touches[0].clientY - this.input.sy;
                this.input.x = Math.max(-1, Math.min(1, dx/40));
                this.input.y = Math.max(-1, Math.min(1, -dy/40));
                knob.style.transform = `translate(calc(-50% + ${this.input.x*40}px), calc(-50% + ${this.input.y*-40}px))`;
            }, {passive:false});
            zone.addEventListener('touchend', () => { this.input.x=0; this.input.y=0; knob.style.transform=`translate(-50%,-50%)`; });
        }

        window.addEventListener('keydown', e => {
            if(e.key==='Escape') togglePause();
            if(this.state.paused) return;
            if(!this.audio.ctx) this.audio.init();
            if('ArrowUp,w'.includes(e.key)) this.input.y=1;
            if('ArrowDown,s'.includes(e.key)) this.input.y=-1;
            if('ArrowLeft,a'.includes(e.key)) this.input.x=1;
            if('ArrowRight,d'.includes(e.key)) this.input.x=-1;
            if(e.key==='Shift') setDive(true);
        });
        window.addEventListener('keyup', e => {
            if('ArrowUp,w,s,ArrowDown'.includes(e.key)) this.input.y=0;
            if('ArrowLeft,a,d,ArrowRight'.includes(e.key)) this.input.x=0;
            if(e.key==='Shift') setDive(false);
        });
    }

    init3D() {
        const canvas = document.getElementById('game-canvas');
        this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 6000);

        this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6); this.scene.add(this.hemi);
        this.sun = new THREE.DirectionalLight(0xffffff, 1.5);
        this.sun.position.set(-100, 300, -100); this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        const d = 1000;
        this.sun.shadow.camera.left = -d; this.sun.shadow.camera.right = d;
        this.sun.shadow.camera.top = d; this.sun.shadow.camera.bottom = -d;
        this.scene.add(this.sun);

        this.buildSculptedBird(); // USES THE NEW 3D BIRD
        this.loadBiome(0);

        const loader = document.getElementById('loader');
        if(loader) { loader.style.opacity=0; setTimeout(()=>loader.style.display='none', 500); }

        window.addEventListener('resize', () => {
            this.camera.aspect = innerWidth/innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(innerWidth, innerHeight);
        });
        this.loop();
    }

    loadBiome(idx) {
        const d = BIOMES[idx];
        const wn = document.getElementById('world-name'); if(wn) wn.innerText = d.name_key;
        this.scene.background = new THREE.Color(d.sky);
        this.scene.fog = new THREE.FogExp2(d.fog, 0.0008);
        this.sun.color.setHex(d.sun);

        this.env.forEach(o => this.scene.remove(o));
        this.env = [];

        const gGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 128, 128);
        const pos = gGeo.attributes.position;
        for(let i=0; i<pos.count; i++) {
            const x = pos.getX(i); const y = pos.getY(i);
            const h = d.type==='city' ? 0 : (Math.sin(x/800)*Math.cos(y/800)*150);
            pos.setZ(i, h);
        }
        gGeo.computeVertexNormals();
        const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({color: d.ground, roughness:1}));
        ground.rotation.x = -Math.PI/2; ground.position.y = -150; 
        this.scene.add(ground); this.env.push(ground);

        let geo;
        if (d.type === 'tree') { geo = new THREE.ConeGeometry(20, 80, 6); geo.translate(0,40,0); }
        else if (d.type === 'rock') { geo = new THREE.TetrahedronGeometry(60, 0); geo.translate(0,30,0); }
        else if (d.type === 'spike') { geo = new THREE.ConeGeometry(5, 150, 4); geo.translate(0,75,0); }
        else { geo = new THREE.BoxGeometry(40, 200, 40); geo.translate(0,100,0); }

        const mat = new THREE.MeshStandardMaterial({color: d.obj});
        if(d.type==='city') { mat.emissive = new THREE.Color(d.obj); mat.emissiveIntensity = 0.4; }

        const mesh = new THREE.InstancedMesh(geo, mat, TREE_COUNT);
        mesh.castShadow = true; mesh.receiveShadow = true;
        const dummy = new THREE.Object3D();
        for(let i=0; i<TREE_COUNT; i++) {
            dummy.position.set((Math.random()-0.5)*WORLD_SIZE, -150, (Math.random()-0.5)*WORLD_SIZE);
            const s = 1+Math.random()*2; 
            dummy.scale.set(s, s * (d.type==='city'?2:1), s);
            if(d.type === 'rock') dummy.rotation.set(Math.random(), Math.random(), Math.random());
            dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        }
        this.scene.add(mesh); this.env.push(mesh);
    }

    // --- PRO BIRD SCULPTING (ORGANIC) ---
    buildSculptedBird() {
        this.bird = new THREE.Group();
        this.bird.scale.set(1.8, 1.8, 1.8);

        const matFeather = new THREE.MeshStandardMaterial({color: 0x3E2723, roughness: 0.7});
        const matBeak = new THREE.MeshStandardMaterial({color: 0xFFA000, roughness: 0.2});
        const matWhite = new THREE.MeshStandardMaterial({color: 0xFFFFFF});
        const matBlack = new THREE.MeshStandardMaterial({color: 0x111111});

        // 1. ORGANIC BODY (Lathe)
        const points = [];
        for ( let i = 0; i <= 10; i ++ ) {
            const x = Math.sin(i * 0.3) * 0.45;
            const y = (i - 5) * 0.3;
            points.push(new THREE.Vector2(x, y));
        }
        const bodyGeo = new THREE.LatheGeometry(points, 24);
        bodyGeo.rotateX(-Math.PI/2);
        const body = new THREE.Mesh(bodyGeo, matFeather);
        body.castShadow = true;
        this.bird.add(body);

        // 2. HEAD
        const head = new THREE.Group();
        head.position.set(0, 0.35, -1.0);
        
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), matFeather);
        skull.scale.set(0.9, 1, 1.2);
        head.add(skull);

        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 16), matBeak);
        beak.rotation.x = -Math.PI/2 + 0.5; 
        beak.position.set(0, -0.1, -0.4);
        head.add(beak);

        const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), matWhite); 
        lEye.position.set(0.2, 0.1, -0.15);
        const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), matWhite); 
        rEye.position.set(-0.2, 0.1, -0.15);
        const lPupil = new THREE.Mesh(new THREE.SphereGeometry(0.04), matBlack); lPupil.position.z = -0.08; lEye.add(lPupil);
        const rPupil = new THREE.Mesh(new THREE.SphereGeometry(0.04), matBlack); rPupil.position.z = -0.08; rEye.add(rPupil);
        
        head.add(lEye); head.add(rEye);
        this.bird.add(head);

        // 3. WINGS (Articulated)
        const createWing = (inv) => {
            const g = new THREE.Group(); g.position.set(inv?-0.3:0.3, 0.2, 0);
            
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.5), matFeather);
            arm.position.x = inv ? -0.4 : 0.4; arm.castShadow=true;
            g.add(arm);
            
            for(let i=0; i<5; i++) {
                const f = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.8), matFeather);
                f.position.set((inv?-1:1)*(0.8 + i*0.3), 0, 0.2);
                f.rotation.y = (inv?1:-1) * (0.2 + i*0.15);
                f.castShadow = true;
                g.add(f);
            }
            return g;
        };

        this.wings = [createWing(false), createWing(true)];
        this.bird.add(this.wings[0], this.wings[1]);
        
        // 4. TAIL
        const tail = new THREE.Group(); tail.position.set(0, 0.1, 0.8);
        for(let i=-2; i<=2; i++) {
            const t = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 1.0), matFeather);
            t.position.set(i*0.12, 0, 0.4);
            t.rotation.y = i * -0.1;
            t.castShadow = true;
            tail.add(t);
        }
        this.bird.add(tail);

        this.scene.add(this.bird);
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        if(this.state.paused) return;
        this.state.time += 0.02;

        if(this.input.dive && this.state.stamina>0) this.state.stamina -= 0.5;
        else if(!this.input.dive) this.state.stamina = Math.min(100, this.state.stamina+0.15);
        
        // --- FIX: DEFINE isDiving HERE ---
        const isDiving = (this.input.dive && this.state.stamina>0);
        
        let tSpeed = isDiving ? 5.0 : (this.input.y>0 ? 2.5 : 1.2);
        this.state.speed += (tSpeed - this.state.speed) * 0.05;
        this.state.score += Math.floor(this.state.speed);

        this.bird.translateZ(-this.state.speed);
        this.bird.rotation.z += (this.input.x*-0.8 - this.bird.rotation.z) * 0.1;
        this.bird.rotation.x += ((this.input.dive?-0.6:this.input.y*0.5) - this.bird.rotation.x) * 0.1;
        this.bird.rotation.y += this.bird.rotation.z * 0.04;

        const cOff = new THREE.Vector3(0, 5, 8 + this.state.speed); // Close Camera
        cOff.applyMatrix4(this.bird.matrixWorld);
        this.camera.position.lerp(cOff, 0.1);
        this.camera.lookAt(this.bird.position);

        const flap = Math.sin(this.state.time * 15) * 0.6;
        this.wings[0].rotation.z = isDiving ? -0.5 : (flap + 0.2);
        this.wings[1].rotation.z = isDiving ? 0.5 : (-flap - 0.2);

        if(this.bird.position.length() > WORLD_SIZE/2) {
            this.bird.position.set(0, 150, 0); this.camera.position.set(0, 150, 20);
        }

        // Fixed DOM ID mapping
        const stamBar = document.getElementById('stamina-fill');
        if(stamBar) stamBar.style.width = this.state.stamina + '%';
        
        const spdEl = document.getElementById('spd'); if(spdEl) spdEl.innerText = Math.floor(this.state.speed*50);
        const altEl = document.getElementById('alt'); if(altEl) altEl.innerText = Math.floor(this.bird.position.y+150);
        const scrEl = document.getElementById('score'); if(scrEl) scrEl.innerText = this.state.score;
        
        this.audio.update(this.state.speed);
        this.renderer.render(this.scene, this.camera);
    }
}

window.onload = () => new Game();