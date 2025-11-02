let canvas;
let context;

// frame control variables
let fpsInterval = 1000 / 30;
let now;
let then = Date.now();
let request_id;
let paused = false;

// game over variables
let gameOver = false;
let totalZombiesKilled = 0;
let totalBullets = 0;

// hit animation variables
let totalShakeTime = 5;
let shakeTime = 0;
let shakeIntensity = 5;
let knockbackStrength = 40;
let redFlashOpacity = 1.1;
let invulnerabilityLength = 45;

// blood splatter animation variables
let bloodParticles = [];
let numBloodParticles = 5;

// nuke animation variables
let nukeShockwave = {
	active: false,
	x: 0,
	y: 0,
	radius: 0,
	maxRadius: 550,
};

// life display variables
let lifeSize = 15;
let spacing = 4;
let padding = 10;
let maxLives = 5;

// variables that control round breaks
let isRoundTransition = false;
let roundTransitionTimer = 0;
let roundPauseDuration = 3000;
let textFlasher = 0;
let flashDuration = 7;

// player variables
let playerBaseSpeed = 7;
let boostTime = 0;
let shotgunTimer = 0;
let player = {
	x: 380,
	y: 240,
	size: 15,

	speed: playerBaseSpeed,
	trail: [],
	shotgun: false,
	shield: false,

	lives: maxLives,
	invulnerableTimer: 0,
	colour: "cyan",

	invincibleCheat: false,
};

// movement and aiming controls
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;
let mouseX = 0;
let mouseY = 0;

// object variables
let bullets = [];
let zombies = [];
let powerUps = [];
let powerUpSize = 15;
let spawnIntervalID;

// music variables
let audioCtx;
let isMusicPlaying = false;
let baseTempo = 50;
let tempoStore = null;
let maxTempo = 100;
let currentNote = 0;
let musicTimeoutID = null;

// define synth function
function playNote(
	frequency,
	duration = 0.3,
	type = "sawtooth",
	ADSR = [0.01, 0.5, 0.1, 0.01],
	volume = 0.1
) {
	if (!audioCtx) {
		audioCtx = new AudioContext();
	}

	const oscillator = audioCtx.createOscillator();
	const gainNode = audioCtx.createGain();

	// handle gaps in the scores
	if (isNaN(frequency)) {
		volume = 0;
		frequency = 440;
	}

	// Waveform and pitch values
	oscillator.type = type;
	oscillator.frequency.value = frequency;

	oscillator.connect(gainNode);
	gainNode.connect(audioCtx.destination);

	// Attack, Decay Release in seconds
	// Sustain as a fraction of volume
	const attackTime = ADSR[0];
	const decayTime = ADSR[1];
	const sustain = ADSR[2];
	const releaseTime = ADSR[3];

	const sustainLevel = volume * sustain;

	// ADSR Envelope

	// attack
	gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
	gainNode.gain.linearRampToValueAtTime(
		volume,
		audioCtx.currentTime + attackTime
	);

	// decay
	gainNode.gain.linearRampToValueAtTime(
		sustainLevel,
		audioCtx.currentTime + attackTime + decayTime
	);

	// sustain
	gainNode.gain.setValueAtTime(
		sustainLevel,
		audioCtx.currentTime + attackTime + decayTime
	);

	// release
	gainNode.gain.linearRampToValueAtTime(
		0,
		audioCtx.currentTime + duration + releaseTime
	);

	oscillator.start();
	oscillator.stop(audioCtx.currentTime + duration + releaseTime);
}

// soundtrack score
// duration written so that 1 = 1 bar
// not the most interesting soundtrack i know :/
const melody = [
	{ freq: 220, duration: 0.125 }, // A
	{ freq: 174.61, duration: 0.125 }, // A
	{ freq: 196, duration: 0.75 }, // G

	{ freq: 174.61, duration: 0.25 }, // F
	{ freq: 174.61, duration: 0.5 }, // F
	{ freq: 196, duration: 0.25 }, // G

	{ freq: 220, duration: 0.25 }, // A
	{ freq: 220, duration: 0.25 }, // A
	{ freq: 174.61, duration: 0.5 }, // F

	{ freq: 196, duration: 0.5 }, // G
	{ freq: 174.61, duration: 0.25 }, // F
	{ freq: 220, duration: 0.25 }, // A
];

const gameOverMusic = [
	{ freq: 49, duration: 0.2 }, // G
	{ freq: 46.25, duration: 0.2 }, // F#
	{ freq: 43.65, duration: 0.2 }, // F
	{ freq: 41, duration: 0.6 }, // E
	{ freq: NaN, duration: 0.7 }, // break
];

const speedBoostScore = [
	{ freq: 523.25, duration: 0.25, type: "sine" }, // C
	{ freq: 659.25, duration: 0.25, type: "sine" }, // E
	{ freq: 783.99, duration: 0.25, type: "sine" }, // G
	{ freq: 1046.5, duration: 0.25, type: "sine" }, // C +
	{ freq: 783.99, duration: 0.25, type: "sine" }, // G
	{ freq: 659.25, duration: 0.25, type: "sine" }, // E
];

// default score
let currentScore = melody;

// soundtrack driver functions
function initAudio() {
	if (!audioCtx) {
		audioCtx = new AudioContext();
	}
}

function getNoteDuration(durationRelativeToBar) {
	return (60 / tempo) * durationRelativeToBar;
}

// start playing the score
function playMusicLoop() {
	if (!isMusicPlaying) return;

	const note = currentScore[currentNote];

	const noteDuration = getNoteDuration(note.duration);
	playNote(note.freq, noteDuration);

	currentNote = (currentNote + 1) % currentScore.length;

	// call playMusicLoop recursively to continue the loop
	musicTimeoutID = setTimeout(playMusicLoop, noteDuration * 1000);
}

function startMusic(score = melody) {
	if (isMusicPlaying) return;

	initAudio();
	isMusicPlaying = true;
	currentNote = 0;
	currentScore = score;
	playMusicLoop();
}

// stop playing the music
function stopMusic() {
	isMusicPlaying = false;
	if (musicTimeoutID !== null) {
		clearTimeout(musicTimeoutID);
		musicTimeoutID = null;
	}
}

// switch between scores
function switchCurrentScore(newScore = melody, newTempo = tempo) {
	let wasPlaying = isMusicPlaying;
	stopMusic();
	tempo = newTempo;
	currentScore = newScore;

	if (wasPlaying) {
		startMusic(currentScore);
	}
}

// round variables
let roundNum = 1;
let numZombiesKilled = 0;
const minSpawnTime = 200;
const maxMaxZombies = 50;

document.addEventListener("DOMContentLoaded", init, false);

// functions that calculate round variables
function calcTempo(roundNum) {
	let newTempo = 38 + roundNum * 5;
	return Math.min(100, newTempo);
}

function calcSpawnTime(roundNum) {
	return Math.max(minSpawnTime, 1500 * Math.pow(1 - 0.05, roundNum));
}

function calcMaxZombies(roundNum) {
	return Math.min(maxMaxZombies, Math.floor(8 + roundNum / 2));
}

function calcZombiesPerRound(roundNum) {
	return Math.floor(
		2 * (0.00006 * roundNum ** 3 + 0.074 * roundNum ** 2 + 0.718 * roundNum + 5)
	);
}

function calcPowerUpDropChance(roundNum) {
	let chance = 0.5 * Math.pow(1 - 0.1, roundNum);
	return Math.max(0.05, chance);
}

function calcZombieSpeed(roundNum) {
	let speed = 0.25 + roundNum / 10 + Math.random() * (0.72 + roundNum / 3);

	return Math.min(0.9 * playerBaseSpeed, speed);
}

function setNewRoundVariables(roundNum) {
	maxZombies = calcMaxZombies(roundNum);
	zombiesPerRound = calcZombiesPerRound(roundNum);
	spawnTime = calcSpawnTime(roundNum);
	powerUpDropChance = calcPowerUpDropChance(roundNum);
	tempo = calcTempo(roundNum);
}

// calculate initial round variables (roundNum = 1)
let spawnTime = calcSpawnTime(roundNum);
let maxZombies = calcMaxZombies(roundNum);
let zombiesPerRound = calcZombiesPerRound(roundNum);
let powerUpDropChance = calcPowerUpDropChance(roundNum);
let tempo = calcTempo(roundNum);

function randint(min, max) {
	return Math.round(Math.random() * (max - min)) + min;
}

function spawnZombie() {
	// handle pausing
	if (paused) {
		return;
	}

	// new round reached
	if (numZombiesKilled == zombiesPerRound) {
		isRoundTransition = true;
		roundTransitionTimer = Date.now();

		// stop spawning zombies
		clearInterval(spawnIntervalID);

		// after break between rounds update new round variables
		setTimeout(() => {
			roundNum += 1;
			numZombiesKilled = 0;

			setNewRoundVariables(roundNum);

			// start spawining zombies again
			spawnIntervalID = setInterval(spawnZombie, spawnTime);
			isRoundTransition = false;
		}, roundPauseDuration);

		return;
	}

	if (
		zombies.length >= maxZombies || // case when there are more zombies than the max amount to be shown on screen
		numZombiesKilled + zombies.length >= zombiesPerRound // case when there should be no more zombies spawning this round
	) {
		return;
	}

	let zombie = {
		x: null,
		y: null,
		size: 30,
		colour: "green",
		speed: calcZombieSpeed(roundNum),
		type: "regular",
	};

	// special zombie
	if (Math.random() < 0.1) {
		zombie = createSpecialZombie(zombie);
	}

	// spawn zombies at random edge
	let x, y;
	let edge = randint(0, 3);
	switch (edge) {
		case 0: // top
			x = Math.random() * canvas.width;
			y = 0;
			break;
		case 1: // right
			x = canvas.width;
			y = Math.random() * canvas.height;
			break;
		case 2: // bottom
			x = Math.random() * canvas.width;
			y = canvas.height;
			break;
		case 3: // left
			x = 0;
			y = Math.random() * canvas.height;
			break;
	}
	zombie.x = x;
	zombie.y = y;

	zombies.push(zombie);
}

function createSpecialZombie(zombie) {
	let availableSpecials = [];

	if (roundNum > 3) {
		availableSpecials.push("big");
	}
	if (roundNum > 5) {
		availableSpecials.push("small");
	}
	if (roundNum > 7) {
		availableSpecials.push("shield");
	}

	let chosenSpecial =
		availableSpecials[Math.floor(Math.random() * availableSpecials.length)];
	zombie.type = chosenSpecial;

	switch (chosenSpecial) {
		case "big":
			zombie.size = 1.8 * zombie.size;
			zombie.speed = zombie.speed * 0.75;
			zombie.colour = "red";
			break;
		case "small":
			zombie.size = 0.66 * zombie.size;
			zombie.speed = Math.min(
				Math.max(0.99 * playerBaseSpeed, 1.5 * zombie.speed),
				0.75 * playerBaseSpeed
			);
			zombie.colour = "lime";
			break;
	}

	return zombie;
}

function init() {
	canvas = document.querySelector("canvas");
	context = canvas.getContext("2d");

	window.addEventListener("keydown", activate, false);
	window.addEventListener("keyup", deactivate, false);
	canvas.addEventListener(
		"click",
		(event) => {
			const rect = canvas.getBoundingClientRect();
			const clickX = event.clientX - rect.left;
			const clickY = event.clientY - rect.top;
			shoot(clickX, clickY);
		},
		false
	);
	canvas.addEventListener("mousemove", updateMouse, false);

	spawnIntervalID = setInterval(spawnZombie, spawnTime);

	draw();
}

function draw() {
	request_id = window.requestAnimationFrame(draw);

	let now = Date.now();
	let elapsed = now - then;
	if (elapsed <= fpsInterval) {
		return;
	}
	then = now - (elapsed % fpsInterval);

	// check for game over
	if (gameOver) {
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = "rgba(0, 0, 0, 0.8)";
		context.fillRect(0, 0, canvas.width, canvas.height);

		context.fillStyle = "white";
		context.font = "48px Arial";
		context.fillText(
			"GAME OVER",
			canvas.width / 2 - 140,
			canvas.height / 2 - 30
		);

		context.font = "24px Arial";
		context.fillText(
			"Press R to Restart",
			canvas.width / 2 - 110,
			canvas.height / 2 + 20
		);

		context.font = "14px Arial";
		context.fillStyle = "red";
		context.fillText("Bullets Fired: " + totalBullets, 20, canvas.height - 16);

		context.font = "14px Arial";
		context.fillStyle = "red";
		context.fillText(
			"Zombies Deleted: " + totalZombiesKilled,
			20,
			canvas.height - 32
		);

		context.font = "14px Arial";
		context.fillStyle = "red";
		context.fillText("Round: " + roundNum, 20, canvas.height - 48);

		return;
	}

	// handle pause screen
	if (paused) {
		context.fillStyle = "rgba(0, 0, 0, 0.5)";
		context.fillRect(0, 0, canvas.width, canvas.height);

		context.fillStyle = "white";
		context.font = "30px Arial";
		context.fillText("PAUSED", canvas.width / 2 - 60, canvas.height / 2);

		context.font = "15px Arial";
		context.fillText(
			"press P to unpause",
			canvas.width / 2 - 64,
			canvas.height / 2 + 15
		);
		return;
	}

	// handle screen shake
	let offsetX = 0;
	let offsetY = 0;
	if (shakeTime > 0) {
		offsetX = Math.random() * shakeIntensity - shakeIntensity / 2;
		offsetY = Math.random() * shakeIntensity - shakeIntensity / 2;
		shakeTime--;
	}
	context.save();
	context.translate(offsetX, offsetY);

	// clear previous frame
	context.clearRect(0, 0, canvas.width, canvas.height);

	// display round number
	context.font = "20px Arial";
	if (isRoundTransition) {
		textFlasher++;

		// flash colors during transition
		if (Math.floor(textFlasher / flashDuration) % 2 === 0) {
			context.fillStyle = "red";
			context.fillText("Round: " + (roundNum + 1), 10, 30);
		} else {
			context.fillStyle = "white";
			context.fillText("Round: " + roundNum, 10, 30);
		}
	} else {
		textFlasher = 0;
		context.fillStyle = "white";
		context.fillText("Round: " + roundNum, 10, 30);
	}

	// display lives
	for (let i = 0; i < player.lives; i++) {
		context.fillStyle = "red";
		context.fillRect(
			canvas.width - padding - (lifeSize + spacing) * (i + 1),
			canvas.height - padding - lifeSize,
			lifeSize,
			lifeSize
		);
	}

	// draw player
	if (player.invulnerableTimer > 0) {
		// flash white during invulnerability
		if (Math.floor(player.invulnerableTimer / 5) % 2 === 0) {
			context.fillStyle = "white";
		} else {
			context.fillStyle = player.colour;
		}
	} else {
		context.fillStyle = player.colour;
	}
	context.fillRect(player.x, player.y, player.size, player.size);

	// draw shield power up
	if (player.shield) {
		context.strokeStyle = "lightblue";
		context.lineWidth = 2;
		context.strokeRect(
			player.x - 3,
			player.y - 3,
			player.size + 3 * 2,
			player.size + 3 * 2
		);
	}

	// update player position
	if (moveRight) {
		let newX = player.x + player.speed;
		if (newX < canvas.width - player.size) {
			player.x = newX;
		}
	}
	if (moveLeft) {
		let newX = player.x - player.speed;
		if (newX > 0) {
			player.x = newX;
		}
	}
	if (moveUp) {
		let newY = player.y - player.speed;
		if (newY > 0) {
			player.y = newY;
		}
	}
	if (moveDown) {
		let newY = player.y + player.speed;
		if (newY < canvas.height - player.size) {
			player.y = newY;
		}
	}

	// update and draw bullets
	context.fillStyle = "red";
	for (let i = 0; i < bullets.length; i++) {
		let b = bullets[i];
		b.x += b.dx;
		b.y += b.dy;

		context.beginPath();
		context.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
		context.fill();
	}

	// check for power ups picked up by the player
	powerUps.forEach((powerUp, index) => {
		if (collides(player, powerUp)) {
			activatePowerUp(powerUp);
			powerUps.splice(index, 1);
		}
	});

	// handle power up behaviour

	// shotgun power up
	if (player.shotgun) {
		shotgunTimer--;
		if (shotgunTimer <= 0) {
			player.shotgun = false;
		}
	}

	// nuke power up
	if (nukeShockwave.active) {
		nukeShockwave.radius += 8;

		// Check for collisions with zombies
		for (let i = zombies.length - 1; i >= 0; i--) {
			let z = zombies[i];
			let zx = z.x + z.size / 2;
			let zy = z.y + z.size / 2;

			let dx = zx - nukeShockwave.x;
			let dy = zy - nukeShockwave.y;
			let dist = Math.sqrt(dx * dx + dy * dy);

			if (dist < nukeShockwave.radius) {
				zombies.splice(i, 1);
				numZombiesKilled++;
				totalZombiesKilled++;
				startDeathAnimation(z);
			}
		}

		// draw shockwave ring
		context.beginPath();
		context.arc(
			nukeShockwave.x,
			nukeShockwave.y,
			nukeShockwave.radius,
			0,
			Math.PI * 2
		);
		context.strokeStyle = `rgba(255, 255, 255, ${
			1.1 - nukeShockwave.radius / nukeShockwave.maxRadius
		})`;
		context.lineWidth = 6;
		context.stroke();

		// End shockwave after max radius
		if (nukeShockwave.radius > nukeShockwave.maxRadius) {
			nukeShockwave.active = false;
		}
	}

	// set speed boost time
	if (boostTime > 0) {
		boostTime--;
		if (boostTime == 0) {
			player.speed = playerBaseSpeed;
			switchCurrentScore(melody, tempoStore);
		}
	}

	// draw speed trail
	for (let i = 0; i < player.trail.length; i++) {
		let t = player.trail[i];
		context.fillStyle = `rgba(0, 255, 255, ${t.alpha})`;
		context.fillRect(t.x, t.y, player.size, player.size);
	}

	// speed boost trail
	if (boostTime > 0) {
		player.trail.push({ x: player.x, y: player.y, alpha: 0.9 });
	}
	if (player.trail.length > 5) {
		player.trail.shift();
	}
	for (let i = 0; i < player.trail.length; i++) {
		player.trail[i].alpha -= 0.15;
		if (player.trail[i].alpha < 0) player.trail[i].alpha = 0;
	}

	// check for zombies hit by bullets
	for (let i = bullets.length - 1; i >= 0; i--) {
		let b = bullets[i];
		for (let j = zombies.length - 1; j >= 0; j--) {
			let z = zombies[j];
			let hitByBullet =
				b.x > z.x && b.x < z.x + z.size && b.y > z.y && b.y < z.y + z.size;

			if (hitByBullet) {
				// first time big zombie is hit
				if (z.type == "big" && z.colour == "red") {
					z.colour = "orange";
					bullets.splice(i, 1);
					continue;
				} else if (z.type == "big" && z.colour == "orange") {
					z.colour = "yellow";
					bullets.splice(i, 1);
					continue;
				}

				// first time shield zombie is hit
				if (z.type == "shield") {
					z.type = "regular";
					bullets.splice(i, 1);
					continue;
				}

				// remove bullet and zombie
				bullets.splice(i, 1);
				zombies.splice(j, 1);

				startDeathAnimation(z);

				// power up drops
				if (Math.random() < powerUpDropChance) {
					let powerUp = generatePowerUp(z);
					powerUps.push(powerUp);
				}

				numZombiesKilled++;
				totalZombiesKilled++;
				break; // exit zombie loop once this bullet is removed
			}
		}
	}

	// draw power ups
	for (let i = 0; i < powerUps.length; i++) {
		let pu = powerUps[i];
		if (pu.timer >= 0) {
			if (pu.timer <= 60) {
				let flashInterval = 10;
				if (pu.timer % flashInterval < flashInterval / 2) {
					context.fillStyle = "rgb(152, 155, 156)";
				} else {
					context.fillStyle = pu.colour;
				}
			} else {
				context.fillStyle = pu.colour; // Regular color when not flashing
			}

			context.fillRect(pu.x, pu.y, pu.size, pu.size);
			pu.timer--;
		} else {
			powerUps.splice(i, 1);
			i--;
		}
	}

	// remove bullets if they are off screen
	bullets = bullets.filter(
		(b) => b.x > 0 && b.x < canvas.width && b.y > 0 && b.y < canvas.height
	);

	// update zombie position
	for (let i = 0; i < zombies.length; i++) {
		let z = zombies[i];

		let dx = player.x + player.size / 2 - (z.x + z.size / 2);
		let dy = player.y + player.size / 2 - (z.y + z.size / 2);
		let dist = Math.sqrt(dx * dx + dy * dy);

		if (dist !== 0) {
			z.x += (dx / dist) * z.speed;
			z.y += (dy / dist) * z.speed;
		}

		// draw zombie
		context.fillStyle = z.colour;
		context.fillRect(z.x, z.y, z.size, z.size);

		// draw shield if zombie is shield type
		if (z.type == "shield") {
			context.strokeStyle = "lightblue";
			context.lineWidth = 2;
			context.strokeRect(z.x - 3, z.y - 3, z.size + 3 * 2, z.size + 3 * 2);
		}
	}

	// draw blood particles
	for (let i = bloodParticles.length - 1; i >= 0; i--) {
		let p = bloodParticles[i];
		p.x += p.dx;
		p.y += p.dy;
		p.alpha -= 0.02;

		if (p.alpha <= 0) {
			bloodParticles.splice(i, 1);
			continue;
		}

		context.beginPath();
		context.fillStyle = `rgba(255, 0, 0, ${p.alpha})`;
		context.fillRect(p.x, p.y, p.size, p.size);
		context.fill();
	}

	// handle player invulnerability timer
	if (player.invulnerableTimer > 0 && player.invincibleCheat == false) {
		player.invulnerableTimer--;
	}

	// check for zombies hitting player
	for (let i = 0; i < zombies.length; i++) {
		let z = zombies[i];

		let dx = player.x + player.size / 2 - (z.x + z.size / 2);
		let dy = player.y + player.size / 2 - (z.y + z.size / 2);
		let dist = Math.sqrt(dx * dx + dy * dy);

		if (dist < player.size / 2 + z.size / 2) {
			if (player.shield) {
				player.shield = false;
				player.invulnerableTimer = invulnerabilityLength;
				playNote(500, 0.2, "triangle", [0.01, 0.5, 0.9, 0.1], 0.5);
			} else if (player.invulnerableTimer <= 0) {
				if (player.invincibleCheat === false) {
					player.lives--;
					player.invulnerableTimer = invulnerabilityLength;
				}

				// check for game over
				if (player.lives <= 0) {
					// switch to game over music
					switchCurrentScore(gameOverMusic, 0.25 * baseTempo);

					gameOver = true;
					clearInterval(spawnIntervalID); //stop zombie spawning
				} else {
					// red flash when hit
					redFlashOpacity = 0.5;
					// play sound effect
					playNote(50, 0.1, "square", [0.01, 0, 1, 0], 0.7);
				}
			}

			// apply knockback and shakedw
			shakeTime = totalShakeTime;
			if (dist !== 0) {
				player.x += (dx / dist) * knockbackStrength;
				player.y += (dy / dist) * knockbackStrength;
			} else {
				// avoid dividing by zero by applying a small nudge
				player.x += Math.random() * 2 - 1;
				player.y += Math.random() * 2 - 1;
			}

			// ensure player doesnt get knocked off the screen
			player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
			player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));
		}
	}

	// draw screen flash
	if (redFlashOpacity > 0) {
		context.fillStyle = `rgba(255, 0, 0, ${redFlashOpacity})`;
		context.fillRect(0, 0, canvas.width, canvas.height);
		redFlashOpacity -= 0.07;
	}

	// restore canvas context
	context.restore();
}

function collides(obj1, obj2) {
	let dx = obj1.x + obj1.size / 2 - (obj2.x + obj2.size / 2);
	let dy = obj1.y + obj1.size / 2 - (obj2.y + obj2.size / 2);
	let dist = Math.sqrt(dx * dx + dy * dy);

	return dist < obj1.size / 2 + obj2.size / 2;
}

function activate(event) {
	let key = event.key.toLowerCase();

	initAudio();

	if (key === "r" && gameOver) {
		restartGame();
		return;
	}

	if (key === "a") {
		moveLeft = true;
	} else if (key === "d") {
		moveRight = true;
	} else if (key === "w") {
		moveUp = true;
	} else if (key === "s") {
		moveDown = true;
	} else if (key === " ") {
		event.preventDefault();
	} else if (key === "m") {
		// music toggle key
		if (isMusicPlaying) {
			stopMusic();
		} else {
			startMusic(currentScore);
		}
	} else if (key === "i") {
		// invincibility toggle key
		let currentState = player.invincibleCheat;
		player.invincibleCheat = !currentState;

		if (currentState === false) {
			playNote(1200, 0.1, "sine", [0.1, 0, 1, 0], 0.2);
			player.invulnerableTimer = 1;
		} else {
			playNote(600, 0.1, "sine", [0.1, 0, 1, 0], 0.2);
			player.invulnerableTimer = 0;
		}
	} else if (key === "p") {
		// pause key
		paused = !paused;
	}
}

function deactivate(event) {
	const key = event.key.toLowerCase();

	if (key === "a") {
		moveLeft = false;
	} else if (key === "d") {
		moveRight = false;
	} else if (key === "w") {
		moveUp = false;
	} else if (key === "s") {
		moveDown = false;
	} else if (key === " ") {
		shoot(mouseX, mouseY);
	}   
}

function createBulletFromAngle(startX, startY, angle) {
	let speed = 10;

	let bullet = {
		x: startX,
		y: startY,
		radius: 2,
		dx: Math.cos(angle) * speed,
		dy: Math.sin(angle) * speed,
	};

	totalBullets++;
	bullets.push(bullet);
}

function createBullet(startX, startY, targetX, targetY) {
	let angle = Math.atan2(targetY - startY, targetX - startX);
	createBulletFromAngle(startX, startY, angle);
}

function shoot(targetX, targetY) {
	if (paused == true || gameOver == true) {
		return;
	}

	let px = player.x + player.size / 2;
	let py = player.y + player.size / 2;

	let baseAngle = Math.atan2(targetY - py, targetX - px);

	if (player.shotgun) {
		let spread = 0.2;
		let angles = [baseAngle - spread, baseAngle, baseAngle + spread];

		for (let i = 0; i < angles.length; i++) {
			let angle = angles[i];
			createBulletFromAngle(px, py, angle);
		}
		// shotgun sfx
		// playNote(70, 0.15, "square", [0.01, 0.02, 0.9, 0], 0.1);

		playNote(900, 0.05, "sine", [0, 0.03, 0.1, 0.05], 0.1);
		setTimeout(() => {
			playNote(900, 0.05, "sine", [0, 0.03, 0.1, 0.05], 0.1);
		}, 30);
		setTimeout(() => {
			playNote(900, 0.05, "sine", [0, 0.03, 0.1, 0.05], 0.1);
		}, 60);
	} else {
		createBullet(px, py, targetX, targetY);
		// sound effect
		playNote(900, 0.05, "sine", [0, 0.03, 0.1, 0.05], 0.1);
	}
}

function generatePowerUp(zombie) {
	let size = powerUpSize;
	let x = zombie.x + zombie.size / 2 - size / 2;
	let y = zombie.y + zombie.size / 2 - size / 2;
	let timer = 250;

	let types = [
		{ type: "life", colour: "purple" },
		{ type: "speed", colour: "yellow", effectTime: 180 },
		{ type: "nuke", colour: "white" },
		{ type: "shotgun", colour: "orange", effectTime: 250 },
		{ type: "shield", colour: "cyan" },
	];
	let chosen = types[Math.floor(Math.random() * types.length)];

	return {
		x,
		y,
		colour: chosen.colour,
		size,
		type: chosen.type,
		timer,
	};
}

function activatePowerUp(powerUp) {
	let type = powerUp.type;

	if (type == "life" && player.lives < maxLives) {
		player.lives++;
	} else if (type == "speed") {
		// store original tempo when first speed boost is picked up
		// this allows tempo to stack with additional boosts
		// but still return to the same tempo afterwards
		if (boostTime <= 0) {
			tempoStore = tempo;
		}

		player.speed = player.speed * 2.5;
		boostTime = 120;
		switchCurrentScore(speedBoostScore, tempo * 3);
	} else if (type == "nuke") {
		nukeShockwave.active = true;
		nukeShockwave.x = powerUp.x + powerUp.size / 2;
		nukeShockwave.y = powerUp.y + powerUp.size / 2;
		nukeShockwave.radius = player.size;
		shakeTime = 20;
		setTimeout(() => {
			playNote(2500, 0.5, "square", [0.4, 0.4, 0.6, 0.7], 0.05);
		}, 270);
	} else if (type == "shotgun") {
		player.shotgun = true;
		shotgunTimer = 300;
	} else if (type == "shield") {
		player.shield = true;
	}

	// play sound effect
	if (type !== "nuke") {
		playNote(200, 0.1, "triangle", [0.01, 0.05, 0.2, 0], 0.4);
		setTimeout(() => {
			playNote(400, 0.08, "triangle", [0.01, 0.05, 0.2, 0], 0.3);
		}, 100);
		setTimeout(() => {
			playNote(600, 0.06, "triangle", [0.005, 0.03, 0.1, 0], 0.2);
		}, 180);
	}
}

function startDeathAnimation(z) {
	for (let k = 0; k < numBloodParticles; k++) {
		bloodParticles.push({
			x: z.x + z.size / 2,
			y: z.y + z.size / 2,
			dx: (Math.random() - 0.5) * 2.5,
			dy: (Math.random() - 0.5) * 2.5,
			size: Math.random() * 2.5 + 3.5,
			alpha: 1,
		});
	}
}

function updateMouse(event) {
	const rect = canvas.getBoundingClientRect();
	mouseX = event.clientX - rect.left;
	mouseY = event.clientY - rect.top;
}

function restartGame() {
	player.x = 256;
	player.y = 150;
	player.lives = maxLives;
	player.invulnerableTimer = 0;

	bullets = [];
	zombies = [];
	bloodParticles = [];
	powerUps = [];

	roundNum = 1;
	numZombiesKilled = 0;
	isRoundTransition = false;
	textFlasher = 0;

	switchCurrentScore(melody, calcTempo(roundNum));

	setNewRoundVariables(roundNum);

	spawnIntervalID = setInterval(spawnZombie, spawnTime);

	gameOver = false;
}
