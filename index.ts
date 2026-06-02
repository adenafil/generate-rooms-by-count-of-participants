type Room = {
  code: string;
  name: string;
  type: string;
  capacity: number;
};

const CSV_PATH = new URL("./rooms/rooms.csv", import.meta.url);
const SUPPORTED_TYPES = new Set(["theory", "Lab Multimedia"]);
const UNIVERSAL_TYPE = "universal";

function printUsage(): void {
  console.error(
    [
      "Usage: bun run index.ts <totalParticipants> [type]",
      "Examples:",
      "  bun run index.ts 30",
      '  bun run index.ts 80 theory',
      '  bun run index.ts 70 "Lab Multimedia"',
      '  bun run index.ts 90 universal',
    ].join("\n"),
  );
}

function exitWithError(message: string): never {
  console.error(`Error: ${message}`);
  printUsage();
  process.exit(1);
}

function parseArgs(argv: string[]): { totalParticipants: number; typeFilter?: string } {
  const [totalArg, ...typeParts] = argv;

  if (!totalArg) {
    exitWithError("`totalParticipants` is required.");
  }

  const totalParticipants = Number(totalArg);

  if (!Number.isInteger(totalParticipants) || totalParticipants <= 0) {
    exitWithError("`totalParticipants` must be a positive integer.");
  }

  const rawType = typeParts.join(" ").trim();

  if (!rawType || rawType === UNIVERSAL_TYPE) {
    return { totalParticipants };
  }

  if (!SUPPORTED_TYPES.has(rawType)) {
    exitWithError(
      '`type` must be one of: theory, "Lab Multimedia", universal.',
    );
  }

  return {
    totalParticipants,
    typeFilter: rawType,
  };
}

async function loadRooms(): Promise<Room[]> {
  const file = Bun.file(CSV_PATH);

  if (!(await file.exists())) {
    exitWithError("`rooms/rooms.csv` was not found.");
  }

  const raw = (await file.text()).replace(/\r/g, "\n");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    exitWithError("`rooms/rooms.csv` does not contain room data.");
  }

  return lines.slice(1).map((line, index) => {
    const [code, name, type, capacityText] = line.split(";");

    if (!code || !name || !type || !capacityText) {
      exitWithError(`Invalid CSV row at line ${index + 2}.`);
    }

    const capacity = Number(capacityText);

    if (!Number.isFinite(capacity) || capacity <= 0) {
      exitWithError(`Invalid room capacity at line ${index + 2}.`);
    }

    return {
      code,
      name,
      type,
      capacity,
    };
  });
}

function findFittingRooms(rooms: Room[], target: number): Room[] {
  return rooms.filter((room) => room.capacity >= target);
}

function matchesType(room: Room, typeFilter?: string): boolean {
  if (!typeFilter) {
    return true;
  }

  if (typeFilter === "theory") {
    const roomLabel = `${room.code} ${room.name}`.toLowerCase();
    return room.type === "theory" && !roomLabel.includes("lab");
  }

  return room.type === typeFilter;
}

async function main(): Promise<void> {
  const { totalParticipants, typeFilter } = parseArgs(process.argv.slice(2));
  const rooms = await loadRooms();
  const eligibleRooms = rooms.filter((room) => matchesType(room, typeFilter));

  if (eligibleRooms.length === 0) {
    exitWithError("No rooms available for the selected type.");
  }

  const result = findFittingRooms(eligibleRooms, totalParticipants);

  if (result.length === 0) {
    const filterDescription = typeFilter ? ` for type \`${typeFilter}\`` : "";
    console.error(
      `No rooms found with capacity at least ${totalParticipants}${filterDescription}.`,
    );
    process.exit(1);
  }

  console.log(result.map((room) => room.code).join(", "));
}

await main();
