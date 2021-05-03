import {
	Coordinates,
	GameMap,
	KeyMap,
	NextMoveProps,
	NonNullablePlayerRef,
	PlayerConfig,
	PlayerId,
	PlayerKeyboardConfig,
	PlayerRef,
	Players,
	PlayerState,
	PowerUpOrNull,
	PowerUps,
	Square,
	SquareCoordinates,
	TopLeftCoordinates,
} from 'containers/Game/types';
import {
	Axis,
	Direction,
	PowerUp,
	Tile,
	Explosive,
	FIRE_VALUES,
	Player,
} from 'enums';
import {
	OnMove,
	Bomb,
	GameConfigRanges,
	GameState,
	GameConfig,
} from 'store/redux/reducers/game/types';
import * as KeyCode from 'keycode-js';
import { getRandomInt } from './math';

/**
 * Converts from pixel to square.
 *
 * @param coordinates Top Left Coordinates.
 * @returns Square version of the coordinates.
 */
const topLeftCoordinatesToSquareCoordinates = (
	{ top, left }: TopLeftCoordinates,
	movementSize: GameConfigRanges.MovementSize
) => {
	return {
		ySquare: top / movementSize,
		xSquare: left / movementSize,
	};
};

/**
 * Converts from square to pixel.
 *
 * @param coordinates Square Coordinates.
 * @returns Pixel (top, left) version of the coordinates.
 */
const squareCoordinatesToTopLeftCoordinates = (
	{ xSquare, ySquare }: SquareCoordinates,
	movementSize: GameConfigRanges.MovementSize
): TopLeftCoordinates => {
	return {
		top: ySquare * movementSize,
		left: xSquare * movementSize,
	};
};

const getTopLeftCoordinatesFromSquareOrSquareCoordinates = (
	coordinates: Coordinates,
	movementSize: GameConfigRanges.MovementSize
) => {
	let top;
	let left;

	if ((coordinates as SquareCoordinates).xSquare !== undefined) {
		const _coordinates = squareCoordinatesToTopLeftCoordinates(
			coordinates as SquareCoordinates,
			movementSize
		);
		top = _coordinates.top;
		left = _coordinates.left;
	} else {
		top = (coordinates as TopLeftCoordinates).top;
		left = (coordinates as TopLeftCoordinates).left;
	}
	return { top, left };
};

const getSquareCoordinatesFromSquareOrTopLeftCoordinates = (
	coordinates: Coordinates,
	movementSize: GameConfigRanges.MovementSize
) => {
	let xSquare;
	let ySquare;

	if ((coordinates as SquareCoordinates).xSquare !== undefined) {
		xSquare = (coordinates as SquareCoordinates).xSquare;
		ySquare = (coordinates as SquareCoordinates).ySquare;
	} else {
		const _coordinates = topLeftCoordinatesToSquareCoordinates(
			coordinates as TopLeftCoordinates,
			movementSize
		);
		xSquare = _coordinates.xSquare;
		ySquare = _coordinates.ySquare;
	}
	return { xSquare, ySquare };
};

const getDefaultPlayerStartSquareCoordinates = (
	mapSize: GameConfigRanges.MapSize
): Record<PlayerId, SquareCoordinates> => {
	const minSize = 0;
	const maxSize = mapSize - 1;
	return {
		P1: { ySquare: minSize, xSquare: minSize },
		P2: { ySquare: minSize, xSquare: maxSize },
		P3: { ySquare: maxSize, xSquare: maxSize },
		P4: { ySquare: maxSize, xSquare: minSize },
	};
};

const getForbiddenStartCoordinates = (
	mapSize: GameConfigRanges.MapSize
): SquareCoordinateArray => {
	const defaultSquareCoordinates = getDefaultPlayerStartSquareCoordinates(
		mapSize
	);

	// used to calculate the next square
	// value to add to currentX and currentY square coordinates
	const xyDiff = [
		[1, 1], // TopLeft
		[-1, 1], // TopRight
		[-1, -1], // BottomRight
		[1, -1], // BottomLeft
	];

	return Object.values(
		defaultSquareCoordinates
	).reduce<SquareCoordinateArray>((acc, squareCoordinates, ind) => {
		const { xSquare, ySquare } = squareCoordinates;
		const currentDiff = xyDiff[ind];
		// player's coordinate
		acc.push(squareCoordinates);
		for (let i = 0; i < 2; i++) {
			// horizontal adjacent square coordinate
			if (i === 0) {
				acc.push({
					xSquare: xSquare + currentDiff[i],
					ySquare,
				});
				// vertical adjacent square coordinate
			} else {
				acc.push({
					xSquare,
					ySquare: ySquare + currentDiff[i],
				});
			}
		}
		return acc;
	}, []);
};

const generateRandomGameMap = (
	mapSize: GameConfigRanges.MapSize,
	blockTileChance: GameConfigRanges.BlockTileChance,
	forbiddenCoordinates?: SquareCoordinateArray
): GameMap => {
	const _forbiddenCoordinates =
		forbiddenCoordinates || getForbiddenStartCoordinates(mapSize);
	const tiles: Array<KeysOf<typeof Tile>> = [
		...Object.keys(Tile),
		// reverse block density, we want that many Emptys
		...Array(11 - blockTileChance).fill('Empty'),
	];
	const sizedArray = Array(mapSize).fill(0);

	const randomMap = sizedArray.reduce((accOuter, _, indOuter) => {
		accOuter[indOuter] = sizedArray.reduce((accInner, __, indInner) => {
			accInner[indInner] = Tile[tiles[getRandomInt(tiles.length)]];
			return accInner;
		}, {});
		return accOuter;
	}, {});
	// ensure we don't fill the char beginning squares with blocks
	_forbiddenCoordinates.forEach(({ ySquare, xSquare }) => {
		if (randomMap[ySquare][xSquare] !== Tile.Empty) {
			randomMap[ySquare][xSquare] = Tile.Empty;
		}
	});

	return randomMap;
};

const getDefaultPowerUps = () => {
	return Object.values(PowerUp).reduce<DynamicObject>((acc, powerUpKey) => {
		acc[powerUpKey] = 0;
		return acc;
	}, {}) as PowerUps;
};

const generatePlayer = (
	playerId: PlayerId,
	config: GameConfig,
	coordinates?: Coordinates
): PlayerConfig => {
	const {
		keyboardConfig: { [playerId]: defaultKeyboardConfig },
		sizes: { map: mapSize, movement: movementSize },
	} = config;

	// eslint-disable-next-line max-len
	const topLeftCoordinates = getTopLeftCoordinatesFromSquareOrSquareCoordinates(
		coordinates ||
			getDefaultPlayerStartSquareCoordinates(mapSize)[playerId],
		movementSize
	);

	return {
		id: playerId,
		coordinates: topLeftCoordinates,
		state: {
			deathCount: 0,
			powerUps: getDefaultPowerUps(),
		},
		keyboardConfig: defaultKeyboardConfig,
	};
};

const generatePlayers = (
	config: GameConfig
): Record<PlayerId, PlayerConfig> => {
	const defaultCoordinates = getDefaultPlayerStartSquareCoordinates(
		config.sizes.map
	);

	return {
		P1: generatePlayer(Player.P1, config, defaultCoordinates.P1),
		P2: generatePlayer(Player.P2, config, defaultCoordinates.P2),
		P3: generatePlayer(Player.P3, config, defaultCoordinates.P3),
		P4: generatePlayer(Player.P4, config, defaultCoordinates.P4),
	};
};

const generateDefaultGameConfig = (): GameConfig => {
	return {
		powerUps: {
			chance: 5,
			defaults: {
				[PowerUp.Life]: 1,
				[PowerUp.BombCount]: 1,
				[PowerUp.BombSize]: 1,
				[PowerUp.MovementSpeed]: 200,
			},
			increaseValues: {
				[PowerUp.Life]: 1,
				[PowerUp.BombCount]: 1,
				[PowerUp.BombSize]: 1,
				[PowerUp.MovementSpeed]: -15,
			},
			maxDropCount: {
				[PowerUp.Life]: 4,
				[PowerUp.BombCount]: 6,
				[PowerUp.BombSize]: 6,
				[PowerUp.MovementSpeed]: 5,
			},
		},
		tiles: {
			blockTileChance: 1,
		},
		sizes: {
			map: 15,
			character: 32,
			tile: 32,
			movement: 32,
			bomb: 16,
		},
		duration: {
			bomb: {
				firing: 2,
				exploding: 1,
			},
		},
		keyboardConfig: {
			P1: {
				MoveUp: KeyCode.CODE_W,
				MoveRight: KeyCode.CODE_D,
				MoveDown: KeyCode.CODE_S,
				MoveLeft: KeyCode.CODE_A,
				DropBomb: KeyCode.CODE_SPACE,
			},
			P2: {
				MoveUp: KeyCode.CODE_UP,
				MoveRight: KeyCode.CODE_RIGHT,
				MoveDown: KeyCode.CODE_DOWN,
				MoveLeft: KeyCode.CODE_LEFT,
				DropBomb: KeyCode.CODE_SEMICOLON,
			},
		},
	};
};

const generateDefaultGameState = (config?: GameConfig): GameState => {
	const _config = config || generateDefaultGameConfig();
	const {
		sizes: { map: mapSize },
		tiles: { blockTileChance: blockDensity },
	} = _config;
	return {
		players: {
			P1: generatePlayer(Player.P1, _config),
		},
		gameMap: generateRandomGameMap(mapSize, blockDensity),
		bombs: {},
		powerUps: {},
		config: generateDefaultGameConfig(),
		is3D: false,
		isSideView: false,
		animationCounter: 0,
	};
};

const canMove = (
	coordinates: Coordinates,
	gameMap: GameMap,
	{ map: mapSize, movement: movementSize }: GameConfig['sizes']
) => {
	const minTopLeft = 0;
	const maxTopLeft = mapSize - 1;

	const {
		xSquare,
		ySquare,
	} = getSquareCoordinatesFromSquareOrTopLeftCoordinates(
		coordinates,
		movementSize
	);
	const nextSquare = gameMap[ySquare]?.[xSquare];
	const isObstacle =
		nextSquare === Tile.Breaking ||
		nextSquare === Tile.NonBreaking ||
		nextSquare === Explosive.Bomb;
	const isHorizontalEnd = xSquare < minTopLeft || xSquare > maxTopLeft;
	const isVerticalEnd = ySquare < minTopLeft || ySquare > maxTopLeft;
	return !isObstacle && !isHorizontalEnd && !isVerticalEnd;
};

const CUBE_BASE_TRANSFORM = `translateZ(calc(var(--tile-size) / 2 * 1px)) rotateX(0deg) rotateY(0deg) scale(1, 1)`;
/**
 * Since we are moving a flat plane and not a cube, the logical sense of
 * rotating a cube doesn't work. Different type of rotations do no always
 * help. One solution is resetting the rotation to 0 so the rotation
 * movement is smooth on each rotation without worrying about boundaries.
 *
 * NOTE: We need to be aware of the animation cancelling
 *
 * @param characterRef ref object
 */
const resetRotation = (characterRef: NonNullable<PlayerRef>) => {
	// disable animation
	characterRef.style.transition = '0ms';
	// reset
	characterRef.style.transform = CUBE_BASE_TRANSFORM;
};

const ROTATION_REGEX = {
	[Axis.X]: {
		REPLACE: /rotateX\(-?\d+deg\)/g,
		FIND: /rotateX\((?<degree>-?\d+)deg\)/,
	},
	[Axis.Y]: {
		REPLACE: /rotateY\(-?\d+deg\)/g,
		FIND: /rotateY\((?<degree>-?\d+)deg\)/,
	},
};

const rotateMove = (originalTransform: string, direction: Direction) => {
	let rotate = 90;
	let side = Axis.Y;
	if (direction === Direction.DOWN || direction === Direction.LEFT) {
		rotate *= -1;
	}
	if (direction === Direction.UP || direction === Direction.DOWN) {
		side = Axis.X;
	}

	return originalTransform.replace(
		ROTATION_REGEX[side].REPLACE,
		`rotate${side}(${rotate}deg)`
	);
};

const handleRotateMove = (
	characterRef: NonNullablePlayerRef,
	direction: Direction,
	movementSpeed: number
) => {
	/* eslint-disable no-param-reassign */
	// enable animation
	characterRef.style.transition = `${movementSpeed}ms`;
	// move
	characterRef.style.transform = rotateMove(
		characterRef.style.transform,
		direction
	);
	/* eslint-enable no-param-reassign */
};

const handleMove = (
	{
		playerConfig: {
			id: playerId,
			coordinates: { top, left },
		},
		direction,
		is3D,
		gameMap,
	}: NextMoveProps,
	movementSpeed: number,
	onComplete: OnMove,
	ref: NonNullablePlayerRef,
	sizes: GameConfig['sizes']
) => {
	if (!direction) return;

	const { movement } = sizes;

	let newTop = top;
	let newLeft = left;
	switch (direction) {
		case Direction.UP:
			newTop = top - movement;
			break;
		case Direction.RIGHT:
			newLeft = left + movement;
			break;
		case Direction.DOWN:
			newTop = top + movement;
			break;
		case Direction.LEFT:
			newLeft = left - movement;
			break;
		default:
			// do nothing
			break;
	}

	if (!canMove({ top: newTop, left: newLeft }, gameMap, sizes)) return;

	if (is3D) resetRotation(ref);
	// TODO: Do a write-up on this
	// this complexity is required for a smooth 3d rotate move
	// since we are resetting rotation css, we need an async
	// event so that the animation can display smoothly
	setTimeout(() => {
		if (is3D) handleRotateMove(ref, direction, movementSpeed);
		onComplete({
			playerId,
			newCoordinates: { top: newTop, left: newLeft },
		});
	}, 0);
};

/**
 * Gets the scale size for an explosion size.
 * - `explosionSize + 1`: explosion size is exclusive of the current square
 * - `* 2`: explosion goes both ways
 * - `- 1`: don't count the root square twice
 * - `* 2`: revert the padding
 *
 * @param explosionSize Size of the explosion.
 * @returns Scale size.
 */
const getExplosionScaleSize = (explosionSize: number) => {
	return ((explosionSize + 1) * 2 - 1) * 2;
};

type SquareCoordinateArray = Array<SquareCoordinates>;
type TilesToBreak = SquareCoordinateArray;
enum ExplosionDirection {
	HORIZONTAL = 'horizontal',
	VERTICAL = 'vertical',
	CORE = 'core',
}
type CoordinatesToSetOnFire = {
	[ExplosionDirection.HORIZONTAL]: SquareCoordinateArray;
	[ExplosionDirection.VERTICAL]: SquareCoordinateArray;
	[ExplosionDirection.CORE]: SquareCoordinateArray;
};

const getTilesToBreak = (
	gameMap: GameMap,
	ySquare: number,
	xSquare: number
) => {
	const tilesToBreak: TilesToBreak = [];
	if (gameMap[ySquare][xSquare] === Tile.Breaking) {
		tilesToBreak.push({ ySquare, xSquare });
	}

	return tilesToBreak;
};

const isSquareOutsideBoundaries = (
	squareCoordinate: number,
	mapSize: GameConfigRanges.MapSize
) => {
	return squareCoordinate < 0 || squareCoordinate >= mapSize;
};

const getExplosionSquareCoordinatesFromBomb = (
	gameMap: GameMap,
	coordinates: Coordinates,
	explosionSize: number,
	{ map: mapSize, movement: movementSize }: GameConfig['sizes'],
	/** only returns fire locations */
	checkOnlyFire = false
) => {
	/* 
		===========================
		# LOGIC
		===========================
		> Legend
			- Empty = 'T1',
			- Breaking = 'T2',
			- NonBreaking = 'T3',
			- Bomb = 'B',
		> Config
			- bombSize = 3
		> Current Test Row
		 	- [T1, T1, T3, B, T1, T2, T2]
		 				       ^  ^ these ones
		> Check neighbors (<>: check, x: stop on side):
		 	- [T1, T1, T3, <B>, T1, T2, T2]

		 	- [T1, T1, T3, <B, T1>, T2, T2]
						x
			- [T1, T1, T3, <B, T1, T2>, T2]

			- [T1, T1, T3, <B, T1, T2>, T2]
										x

		> Stop checking when you hit a T2 or T3
			- If T2, include it in the list
		
	*/

	const {
		xSquare: bombX,
		ySquare: bombY,
	} = getSquareCoordinatesFromSquareOrTopLeftCoordinates(
		coordinates,
		movementSize
	);
	const bombSquareCoordinates = { xSquare: bombX, ySquare: bombY };
	const explosionCoordinates: CoordinatesToSetOnFire = {
		[ExplosionDirection.HORIZONTAL]: [],
		[ExplosionDirection.VERTICAL]: [],
		[ExplosionDirection.CORE]: [bombSquareCoordinates],
	};

	const pushCurrentCoordinates = (
		xSquare: number,
		ySquare: number,
		explosionDirection: ExplosionDirection
	) => {
		explosionCoordinates[explosionDirection].push({
			xSquare,
			ySquare,
		});
	};

	// used to calculate the next square
	// value to add to currentX and currentY square coordinates
	const xyDiff = [
		[0, -1], // Up
		[1, 0], // Right
		[0, 1], // Down
		[-1, 0], // Left
	];

	// required for proper animation
	// (expanding in scale X or Y)
	const directions = [
		ExplosionDirection.VERTICAL,
		ExplosionDirection.HORIZONTAL,
		ExplosionDirection.VERTICAL,
		ExplosionDirection.HORIZONTAL,
	];

	// check all sides
	for (let i = 0; i < 4; i++) {
		let currentX = bombX;
		let currentY = bombY;
		const currentDirection = directions[i];
		let shouldContinue = true;

		// loop until the end of the explosion
		for (let j = 0; j < explosionSize; j++) {
			if (!shouldContinue) continue;

			const [xDiff, yDiff] = xyDiff[i];
			currentX += xDiff;
			currentY += yDiff;

			// don't go out of boundaries
			if (
				isSquareOutsideBoundaries(currentX, mapSize) ||
				isSquareOutsideBoundaries(currentY, mapSize)
			) {
				continue;
			}

			const currentSquare = gameMap[currentY][currentX];
			if (checkOnlyFire) {
				// if it's not a fire, then we reached the end
				if (
					currentSquare !== Explosive.FireHorizontal &&
					currentSquare !== Explosive.FireVertical
				) {
					continue;
				}

				pushCurrentCoordinates(currentX, currentY, currentDirection);
			}
			switch (currentSquare) {
				case Tile.Breaking:
					pushCurrentCoordinates(
						currentX,
						currentY,
						currentDirection
					);
					shouldContinue = false;
					break;
				case Tile.NonBreaking:
					shouldContinue = false;
					break;
				// Tile.Empty, Explosive.Bomb, Player.[any], PowerUps.[any]
				default:
					pushCurrentCoordinates(
						currentX,
						currentY,
						currentDirection
					);
					break;
			}
		}
	}

	return explosionCoordinates;
};

/**
 * Breaking tiles are "exploded" and removed from the map.
 *
 * @param gameMap Current state of the game map.
 * @param bombCoordinates TopLeft coordinates of where the bomb is placed.
 * @param explosionSize Size of the explosion.
 * @returns New state for the game map with breaking tiles emptied.
 */
const getExplosionResults = (
	gameMap: GameMap,
	players: Players,
	bombCoordinates: TopLeftCoordinates,
	explosionSize: number,
	sizes: GameConfig['sizes'],
	/** only returns fire locations */
	checkOnlyFire = false
) => {
	const tilesToBreak: TilesToBreak = [];
	const coordinatesToSetOnFire: CoordinatesToSetOnFire = {
		[ExplosionDirection.HORIZONTAL]: [],
		[ExplosionDirection.VERTICAL]: [],
		[ExplosionDirection.CORE]: [],
	};

	const explosionSquares = getExplosionSquareCoordinatesFromBomb(
		gameMap,
		bombCoordinates,
		explosionSize,
		sizes,
		checkOnlyFire
	);
	// { horizontal, vertical }
	(Object.keys(explosionSquares) as Array<ExplosionDirection>).forEach(
		explosionDirection => {
			explosionSquares[explosionDirection].forEach(
				({ ySquare, xSquare }) => {
					coordinatesToSetOnFire[explosionDirection].push({
						xSquare,
						ySquare,
					});
					getTilesToBreak(gameMap, ySquare, xSquare).forEach(v => {
						tilesToBreak.push(v);
					});
				}
			);
		}
	);

	return { coordinatesToSetOnFire, tilesToBreak };
};

const getPoweredUpValue = (
	playerState: PlayerState,
	type: PowerUp,
	powerUpConfig: GameConfig['powerUps']
) => {
	return (
		powerUpConfig.defaults[type] +
		playerState.powerUps[type] * powerUpConfig.increaseValues[type]
	);
};

const generateBomb = (
	{
		id: playerId,
		coordinates: { top, left },
		state: playerState,
	}: PlayerConfig,
	powerUpConfig: GameConfig['powerUps']
) => {
	const explosionSize = getPoweredUpValue(
		playerState,
		PowerUp.BombSize,
		powerUpConfig
	);
	const bomb: Bomb = {
		id: new Date().getTime().toString(),
		explosionSize,
		top,
		left,
		playerId,
	};
	return bomb;
};

const getMoveDirectionFromKeyboardCode = (
	keyCode: string,
	{ MoveUp, MoveRight, MoveDown, MoveLeft }: PlayerKeyboardConfig
) => {
	switch (true) {
		case keyCode === MoveUp:
			return Direction.UP;
		case keyCode === MoveRight:
			return Direction.RIGHT;
		case keyCode === MoveDown:
			return Direction.DOWN;
		case keyCode === MoveLeft:
			return Direction.LEFT;
		default:
			return null;
	}
};

const getMoveDirectionFromKeyMap = (
	keyMap: React.MutableRefObject<KeyMap>,
	{ MoveUp, MoveRight, MoveDown, MoveLeft }: PlayerKeyboardConfig,
	multi = false
) => {
	return (multi
		? // record and play all keys that being held
		  [
				keyMap.current[MoveUp] && Direction.UP,
				keyMap.current[MoveRight] && Direction.RIGHT,
				keyMap.current[MoveDown] && Direction.DOWN,
				keyMap.current[MoveLeft] && Direction.LEFT,
		  ]
		: // handle single key down
		  [
				(keyMap.current[MoveUp] && Direction.UP) ||
					(keyMap.current[MoveRight] && Direction.RIGHT) ||
					(keyMap.current[MoveDown] && Direction.DOWN) ||
					(keyMap.current[MoveLeft] && Direction.LEFT),
		  ]
	).filter(Boolean) as Array<Direction>;
};

const generatePowerUpOrNull = (
	powerUpChance: GameConfigRanges.PowerUpChance
) => {
	const possiblePowerUpOrNulls: Array<KeysOf<KeysOf<PowerUpOrNull>>> = [
		...Object.values(PowerUp),
		// reverse block density, we want that many nulls
		...Array(6 - powerUpChance).fill(null),
	];

	return possiblePowerUpOrNulls[getRandomInt(possiblePowerUpOrNulls.length)];
};

const isPowerUp = (square: Square) => {
	return Object.values(PowerUp).includes(square as PowerUp);
};

const isPlayerSteppingOnFire = (
	gameMap: GameMap,
	playerCoordinates: TopLeftCoordinates,
	movementSize: GameConfigRanges.MovementSize
) => {
	const { xSquare, ySquare } = topLeftCoordinatesToSquareCoordinates(
		playerCoordinates,
		movementSize
	);
	const currentSquare = gameMap[ySquare][xSquare];

	return FIRE_VALUES.includes(currentSquare as Explosive);
};

const isPlayerDead = (
	playerState: PlayerState,
	powerUpConfig: GameConfig['powerUps']
) => {
	return (
		playerState.deathCount >=
		getPoweredUpValue(playerState, PowerUp.Life, powerUpConfig)
	);
};

export {
	generateRandomGameMap,
	generatePlayer,
	generatePlayers,
	generateDefaultGameState,
	canMove,
	rotateMove,
	handleRotateMove,
	handleMove,
	resetRotation,
	CUBE_BASE_TRANSFORM,
	getExplosionScaleSize,
	getExplosionResults,
	generateBomb,
	getMoveDirectionFromKeyboardCode,
	getMoveDirectionFromKeyMap,
	topLeftCoordinatesToSquareCoordinates,
	squareCoordinatesToTopLeftCoordinates,
	getTopLeftCoordinatesFromSquareOrSquareCoordinates,
	getSquareCoordinatesFromSquareOrTopLeftCoordinates,
	generatePowerUpOrNull,
	isPowerUp,
	getPoweredUpValue,
	isPlayerSteppingOnFire,
	isPlayerDead,
};
